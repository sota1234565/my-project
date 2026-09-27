// 市への通報を「書きやすくする」ための文面づくりと、窓口の判定。
//
// 【何をしていて、何をしていないか】
// どの窓口も、外部アプリから内容を送り込む仕組みを持っていない。
// そのため庭心は通報を代行しない。できるのは、必要な情報を整えて渡すところまで。
// 画面上でもそのことを明示し、「庭心が送った」と誤解させないようにする。
//
// 窓口は緑地の市区町村コードから決める（data/reportChannels.js の3段構え）。
import { CONDITIONS, GREEN_TYPES } from './data/greenItems';
import { googleMapsPlaceUrl } from './maps';
import { MUNI_CHANNELS, NATIONWIDE_CHANNELS, SCOPE_ROAD, SCOPE_PARK } from './data/reportChannels';

// 通報の対象にするのは、手入れが要りそうなものだけ。
// 健全な木を通報しても市の手間が増えるだけで、誰の得にもならない。
export function isReportable(condition) {
  return condition === 'needs_care' || condition === 'poor';
}

// その緑地が「道路のもの」か「それ以外」か。
// 雨庭は道路脇にあることもあるが、道路緊急ダイヤルは道路の異状が対象なので
// 自動では道路扱いにしない。誤った窓口に流すより、自治体を探してもらうほうがよい。
export function scopeOf(type) {
  return type === 'rain_garden' ? SCOPE_PARK : SCOPE_ROAD;
}

const matchesScope = (scope) => (ch) => Array.isArray(ch.scope) && ch.scope.includes(scope);

/**
 * 緑地に対して、どの窓口を案内するかを決める。
 *
 * @param {{ muniCd: string|null, muniName: string|null, type: string }} input
 * @returns {{
 *   muniName: string|null,
 *   scope: string,
 *   verified: object[],   // 1段目：この自治体で確認できた窓口
 *   nationwide: object[], // 2段目：全国共通（道路のときだけ）
 *   search: { label: string, url: string }|null, // 3段目：検索リンク
 * }}
 */
export function resolveReportTargets({ muniCd, muniName, type }) {
  const scope = scopeOf(type);
  const entry = muniCd ? MUNI_CHANNELS[muniCd] : null;

  // 名前は表に載っているものを優先する。
  // 自動取得で得ただけの名前は裏取りができていないので、窓口の名乗りには使わない。
  const name = entry?.muniName || muniName || null;

  const verified = (entry?.channels || []).filter(matchesScope(scope));
  const nationwide = NATIONWIDE_CHANNELS.filter(matchesScope(scope));

  // 検索リンクは自治体名が分かるときだけ。分からないまま
  // 「〇〇市で検索」とは書けない。
  const search = name
    ? {
        label: `${name} の窓口を検索`,
        url: 'https://www.google.com/search?q=' +
          encodeURIComponent(`${name} ${scope === SCOPE_ROAD ? '街路樹' : '公園 樹木'} 通報 窓口`),
      }
    : null;

  return { muniName: name, scope, verified, nationwide, search };
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
