// 緯度経度から住所を求める（逆ジオコーディング）。
//
// 国土地理院のものを優先する。日本の住所は公式の町丁目データに基づくため、
// OpenStreetMap系より町丁目まで正確に出る。
// 返るのは市区町村コードと町丁目名なので、コードを名前に直す表を持つ。
// 表に無い（＝神奈川県外の）ときだけ、従来の Nominatim に任せる。

// 神奈川県の市区町村コード。庭心の対象は藤沢市だが、
// 市境の近くを登録したときに隣の市が返ることがあるため周辺も持つ。
const KANAGAWA_MUNI = {
  14101: '横浜市鶴見区', 14102: '横浜市神奈川区', 14103: '横浜市西区',
  14104: '横浜市中区', 14105: '横浜市南区', 14106: '横浜市保土ケ谷区',
  14107: '横浜市磯子区', 14108: '横浜市金沢区', 14109: '横浜市港北区',
  14110: '横浜市戸塚区', 14111: '横浜市港南区', 14112: '横浜市旭区',
  14113: '横浜市緑区', 14114: '横浜市瀬谷区', 14115: '横浜市栄区',
  14116: '横浜市泉区', 14117: '横浜市青葉区', 14118: '横浜市都筑区',
  14131: '川崎市川崎区', 14132: '川崎市幸区', 14133: '川崎市中原区',
  14134: '川崎市高津区', 14135: '川崎市多摩区', 14136: '川崎市宮前区',
  14137: '川崎市麻生区',
  14151: '相模原市緑区', 14152: '相模原市中央区', 14153: '相模原市南区',
  14201: '横須賀市', 14203: '平塚市', 14204: '鎌倉市', 14205: '藤沢市',
  14206: '小田原市', 14207: '茅ヶ崎市', 14208: '逗子市', 14210: '三浦市',
  14211: '秦野市', 14212: '厚木市', 14213: '大和市', 14214: '伊勢原市',
  14215: '海老名市', 14216: '座間市', 14217: '南足柄市', 14218: '綾瀬市',
  14301: '葉山町', 14321: '寒川町', 14341: '大磯町', 14342: '二宮町',
  14361: '中井町', 14362: '大井町', 14363: '松田町', 14364: '山北町',
  14366: '開成町', 14382: '箱根町', 14383: '真鶴町', 14384: '湯河原町',
  14401: '愛川町', 14402: '清川村',
};

const TIMEOUT_MS = 6000;

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

// 国土地理院。町丁目まで返るが、市区町村はコードなので表で名前に直す。
async function viaGsi(lat, lng) {
  const data = await fetchJson(
    `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lng}`
  );
  const r = data?.results;
  if (!r) return '';
  const muni = KANAGAWA_MUNI[Number(r.muniCd)];
  // 県外は表に無い。中途半端な住所を出すより Nominatim に任せる。
  if (!muni) return '';
  const town = typeof r.lv01Nm === 'string' && r.lv01Nm !== '－' ? r.lv01Nm : '';
  return `神奈川県${muni}${town}`;
}

// 従来の方法。国土地理院で取れなかったときの控え。
async function viaNominatim(lat, lng) {
  const data = await fetchJson(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ja`,
    { headers: { 'User-Agent': 'Niwashin-App' } }
  );
  if (!data) return '';
  const a = data.address || {};
  // 道路名（a.road）は入れない。「○○通り」まで足すと、
  // 実際の住所表記とずれたものが住所として残ってしまう。
  const parts = [
    a.province || a.state,
    a.city || a.town || a.village,
    a.suburb || a.neighbourhood,
  ].filter(Boolean);
  return parts.join('') || data.display_name || '';
}

export async function reverseGeocode(lat, lng) {
  return (await viaGsi(lat, lng)) || (await viaNominatim(lat, lng)) || '';
}
