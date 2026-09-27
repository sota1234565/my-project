// 市への通報を「書きやすくする」ための文面づくりと、窓口の判定。
//
// 【何をしていて、何をしていないか】
// どの窓口も、外部アプリから内容を送り込む仕組みを持っていない。
// そのため庭心は通報を代行しない。できるのは、必要な情報を整えて渡すところまで。
// 画面上でもそのことを明示し、「庭心が送った」と誤解させないようにする。
//
// 窓口は緑地の市区町村コードから決める（data/reportChannels.js）。
// 街路樹に全国共通の窓口は無く、自治体ごとに分かれている。
import { CONDITIONS, GREEN_TYPES } from './data/greenItems';
import { googleMapsPlaceUrl } from './maps';
import { MUNI_CHANNELS, EMERGENCY_CHANNEL } from './data/reportChannels';

// 通報の対象にするのは、手入れが要りそうなものだけ。
// 健全な木を通報しても窓口の手間が増えるだけで、誰の得にもならない。
export function isReportable(condition) {
  return condition === 'needs_care' || condition === 'poor';
}

// 緊急の電話（#9910）を出してよいか。
// 対象は道路。雨庭は公園側の扱いなので出さない。
// 道路緊急ダイヤルは道路の異状を受ける窓口であり、そこへ公園の木の相談を
// 送ると、本来つながるべき人の回線を塞ぐことになる。
export function canUseRoadEmergency(type) {
  return type !== 'rain_garden';
}

/**
 * その緑地について、どの窓口を案内するかを決める。
 *
 * 自治体の窓口は道路も公園もまとめて受けるのが普通なので、種別で振り分けない。
 * 種別を見るのは、緊急の電話を出すかどうかだけ。
 *
 * @param {{ muniCd: string|null, muniName: string|null, type: string }} input
 * @returns {{
 *   muniName: string|null,
 *   channel: object|null,        // 1段目：確認できたこの自治体の窓口
 *   search: { label: string, url: string }|null, // 2段目：担当課を探す
 *   emergency: object|null,      // 3段目：倒木など緊急時の電話
 * }}
 */
export function resolveReportTargets({ muniCd, muniName, type }) {
  const entry = muniCd ? MUNI_CHANNELS[muniCd] : null;

  // 名前は表に載っているものを優先する。自動取得で得ただけの名前は
  // 裏取りができていないので、窓口の名乗りには使わない。
  const name = entry?.muniName || muniName || null;

  // 多くの自治体が「道路・公園の損傷通報」という名前で運用しているので、
  // 実際に見つかりやすい語で検索する。
  const search = name
    ? {
        label: `${name} の窓口を検索`,
        url: 'https://www.google.com/search?q=' +
          encodeURIComponent(`${name} 道路 公園 損傷 通報`),
      }
    : null;

  return {
    muniName: name,
    channel: entry || null,
    search,
    emergency: canUseRoadEmergency(type) ? EMERGENCY_CHANNEL : null,
  };
}

export function buildReportText(item, { appUrl, muniName } = {}) {
  const type = GREEN_TYPES[item.type]?.label || '緑地';
  const cond = CONDITIONS[item.condition];
  const lat = item.location?.lat;
  const lng = item.location?.lng;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  const lines = [
    '【場所】',
    // 住所が無くても、緯度経度と地図リンクがあれば場所は特定できる。
    item.location?.address || muniName || '（下の地図リンクをご覧ください）',
    hasCoords ? `${lat.toFixed(6)}, ${lng.toFixed(6)}\n${googleMapsPlaceUrl(lat, lng)}` : '',
    '',
    '【対象】',
    `${item.name}（${type}）`,
    '',
    '【状態】',
    cond ? `${cond.label}（${cond.hint}）` : '',
    '',
    '【気づいたこと】',
    // ここは本人が書く。決めつけた文面を入れると、実際と違う内容のまま
    // 送られてしまうため、あえて空欄にして書く場所だけ示す。
    '（見たままを書いてください。例：根元から幹が裂けていて、歩道側に傾いています）',
    '',
    '【参考】',
    `この記録は市民参加型の緑地マップ「庭心」で登録されたものです。\n${appUrl}`,
  ];

  return lines.filter(l => l !== '').join('\n');
}
