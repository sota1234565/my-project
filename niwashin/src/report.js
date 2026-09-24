// 市への通報を「書きやすくする」ための文面づくり。
//
// 【何をしていて、何をしていないか】
// 藤沢市の市民レポートはLINEの対話形式で、外部アプリから内容を送り込む仕組みが無い。
// そのため庭心は通報を代行できない。できるのは、必要な情報を整えて渡すところまで。
// 画面上でもそのことを明示し、「庭心が市に送った」と誤解させないようにする。
//
// 参考：藤沢市LINE公式アカウント「市民レポート」（道路施設・公園施設）
// 受付対象に街路樹・樹木が含まれ、写真・位置情報・状況を送る形式。
import { CONDITIONS, GREEN_TYPES } from './data/greenItems';
import { googleMapsPlaceUrl } from './maps';

// 藤沢市LINE公式アカウント。友だち追加してから「市民レポート」を使う。
export const FUJISAWA_LINE_URL = 'https://page.line.me/327adlaa';

// 通報の対象にするのは、手入れが要りそうなものだけ。
// 健全な木を通報しても市の手間が増えるだけで、誰の得にもならない。
export function isReportable(condition) {
  return condition === 'needs_care' || condition === 'poor';
}

export function buildReportText(item, appUrl) {
  const type = GREEN_TYPES[item.type]?.label || '緑地';
  const cond = CONDITIONS[item.condition];
  const lat = item.location?.lat;
  const lng = item.location?.lng;

  const lines = [
    '【場所】',
    item.location?.address || '藤沢市',
    Number.isFinite(lat) && Number.isFinite(lng)
      ? `${lat.toFixed(6)}, ${lng.toFixed(6)}\n${googleMapsPlaceUrl(lat, lng)}`
      : '',
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
