// 緯度経度から住所を求める（逆ジオコーディング）。全国対応。
//
// 国土地理院のものを主に使う。日本の住所は公式の町丁目データに基づくため、
// OpenStreetMap系より正確で、市区町村を「コード」で返してくれる。
// このコードは通報の窓口判定にも使うので、住所の文字列とは別に持ち回る。
//
// 返ってくるのは市区町村コードと町丁目名だけなので、
//   ・都道府県名 … コードの上2桁から（下の PREF_NAMES。47件なので直接持つ）
//   ・市区町村名 … data/muniNames.json（1,902件。重いので遅延読み込み）
// で名前に直して組み立てる。
//
// どこかが欠けても住所欄は手で直せるので、取得に失敗してもアプリは止めない。

// 市区町村コードの上2桁 → 都道府県名
export const PREF_NAMES = {
  '01': '北海道', '02': '青森県', '03': '岩手県', '04': '宮城県', '05': '秋田県',
  '06': '山形県', '07': '福島県', '08': '茨城県', '09': '栃木県', '10': '群馬県',
  '11': '埼玉県', '12': '千葉県', '13': '東京都', '14': '神奈川県', '15': '新潟県',
  '16': '富山県', '17': '石川県', '18': '福井県', '19': '山梨県', '20': '長野県',
  '21': '岐阜県', '22': '静岡県', '23': '愛知県', '24': '三重県', '25': '滋賀県',
  '26': '京都府', '27': '大阪府', '28': '兵庫県', '29': '奈良県', '30': '和歌山県',
  '31': '鳥取県', '32': '島根県', '33': '岡山県', '34': '広島県', '35': '山口県',
  '36': '徳島県', '37': '香川県', '38': '愛媛県', '39': '高知県', '40': '福岡県',
  '41': '佐賀県', '42': '長崎県', '43': '熊本県', '44': '大分県', '45': '宮崎県',
  '46': '鹿児島県', '47': '沖縄県',
};

const TIMEOUT_MS = 6000;

// 市区町村名の表は 44KB あるので、住所を実際に取るときまで読み込まない。
// 一度読んだら使い回す（Promise ごと覚えるので、連打しても読み込みは1回）。
let muniTablePromise = null;
function loadMuniTable() {
  if (!muniTablePromise) {
    muniTablePromise = import('./data/muniNames.json')
      .then(m => m.default)
      .catch(() => ({})); // 読めなくても住所取得ごと失敗させない
  }
  return muniTablePromise;
}

// コードは必ずゼロ埋め5桁の文字列として扱う。
// 数値にすると北海道〜沖縄の 01xxx〜09xxx が先頭0を失って壊れる。
function normalizeMuniCd(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().padStart(5, '0');
  if (!/^\d{5}$/.test(s)) return null;
  if (!PREF_NAMES[s.slice(0, 2)]) return null; // 01〜47 以外は異常値
  return s;
}

export function prefNameOf(muniCd) {
  const cd = normalizeMuniCd(muniCd);
  return cd ? PREF_NAMES[cd.slice(0, 2)] : null;
}

export async function muniNameOf(muniCd) {
  const cd = normalizeMuniCd(muniCd);
  if (!cd) return null;
  const table = await loadMuniTable();
  return table[cd] || null;
}

async function fetchJson(url, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// 国土地理院。市区町村コードと町丁目名が返る。海上や国外では空になる。
async function viaGsi(lat, lng) {
  const data = await fetchJson(
    `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lng}`
  );
  const r = data?.results;
  if (!r) return null;
  const muniCd = normalizeMuniCd(r.muniCd);
  if (!muniCd) return null;
  // lv01Nm は町丁目が無いところでは '－' が入る
  const lv = typeof r.lv01Nm === 'string' ? r.lv01Nm.trim() : '';
  return { muniCd, town: lv && lv !== '－' ? lv : null };
}

// OpenStreetMap。国土地理院が使えないときと、表に無い自治体の名前を補うときに使う。
async function viaNominatim(lat, lng) {
  const data = await fetchJson(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ja`
  );
  if (!data) return null;
  const a = data.address || {};
  return {
    prefName: a.province || a.state || null,
    // 政令指定都市では区が city_district に入ることがある
    muniName: a.city || a.town || a.village || a.city_district || a.county || null,
    // 道路名（a.road）は入れない。「○○通り」まで足すと実際の住所表記とずれる。
    town: a.suburb || a.neighbourhood || null,
  };
}

/**
 * @returns {{
 *   address: string,          // 表示・保存用（組み立てられなければ ''）
 *   muniCd: string | null,    // '14205'（ゼロ埋め5桁）。通報の窓口判定のキー
 *   muniName: string | null,  // '藤沢市' / '横浜市鶴見区' / '中央区'
 *   prefName: string | null,  // '神奈川県'
 *   town: string | null,      // '羽鳥五丁目'
 *   source: 'gsi' | 'gsi+osm' | 'osm' | 'none',
 * }}
 */
export async function reverseGeocode(lat, lng) {
  const empty = { address: '', muniCd: null, muniName: null, prefName: null, town: null, source: 'none' };

  // まず国土地理院。ここが取れれば市区町村コードが手に入る。
  const gsi = await viaGsi(lat, lng);

  if (gsi) {
    const prefName = PREF_NAMES[gsi.muniCd.slice(0, 2)];
    let muniName = await muniNameOf(gsi.muniCd);
    let source = 'gsi';

    // 表に無い＝2023年以降に合併した自治体など。名前だけ OpenStreetMap から補う。
    // コードは正しいので、通報の窓口判定はこの先も効く。
    if (!muniName) {
      const osm = await viaNominatim(lat, lng);
      if (osm?.muniName) {
        muniName = osm.muniName;
        source = 'gsi+osm';
      }
    }

    return {
      address: [prefName, muniName, gsi.town].filter(Boolean).join(''),
      muniCd: gsi.muniCd,
      muniName,
      prefName,
      town: gsi.town,
      source,
    };
  }

  // 国土地理院が使えないとき。住所の表示だけはできるが、市区町村コードは取れない。
  // ここで得た市区町村名は裏取りができていないので、通報の窓口判定には使わない。
  const osm = await viaNominatim(lat, lng);
  if (osm) {
    const address = [osm.prefName, osm.muniName, osm.town].filter(Boolean).join('');
    if (address) {
      return { address, muniCd: null, muniName: osm.muniName, prefName: osm.prefName, town: osm.town, source: 'osm' };
    }
  }

  return empty;
}
