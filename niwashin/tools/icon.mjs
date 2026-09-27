// 庭心のマークの定義。
// favicon・PNG・画面内のロゴは、すべてここの数値から作られる。
// 形を直したいときはここだけを触り、tools/make-icons.mjs で書き出し直す。
//
// 【ねらい】「まちの緑を地図に記録して見守る」を一目で伝えること。
//
//     街の地図の上に、葉であり地図のピンでもある印が挿さっている
//
// ── 印について
// 外側は水滴で、下の尖りがピンを表す。ただし左右対称の水滴にまっすぐな
// 縦線を引くと、葉ではなく熱気球か感嘆符に見える（実際に書き出して確認した）。
// 葉に見せているのは主脈の「曲がり」で、これが入った瞬間に葉として読める。
// 脈を左向きにすると炎に、上下とも尖らせるとコーヒー豆に見えたので、
// 水滴＋右上へ曲がる主脈に決めた。側脈は48pxで潰れるため描かない。
//
// ── 背景について
// 線を引くだけでは「地図」に見えず、ただの模様になる。地図らしさの正体は
// 線ではなく「線で区切られた面（街区）」なので、面を置いている。
// さらに、等間隔の格子にすると方眼紙に見えるため、
//   ・区画の大きさを不揃いにする
//   ・幹線を縦横1本ずつ太くする
//   ・斜めの大通りを1本通す  ← これが入ると実在する街の地図に見える
//   ・全体をわずかに傾ける
// としている。色の差は小さく保ち、印の邪魔をしない。
//
// 川も試したが、この大きさでは隅の染みにしか見えなかったので入れていない。

export const GREEN = '#1e4d38';  // 地。アプリの theme-color と同じ
export const CREAM = '#faf7f0';  // 印。アプリの背景色と同じ
export const BLOCK = '#24583f';  // 街区の面。地よりわずかに明るい
export const ROAD  = '#2f6b4f';  // 道

// 100×100 の升目での輪郭。上がふくらみ、下が尖る。
export const BODY_PATH =
  'M50 6 C64 6 78 17 78 34 C78 48 68 62 50 94 C32 62 22 48 22 34 C22 17 36 6 50 6 Z';

// 主脈。下の尖りの手前から右上へゆるく曲がる。
// 輪郭の縁に触れない長さで止める（触れると形が割れて見える）。
export const VEIN_PATH = 'M50 86 C46 68 45 53 51 38 C55 29 59 24 62 21';
export const VEIN_WIDTH = 6.5;

// 道の位置。間隔が不揃いなのが街らしさになる。枠の外まで伸ばして端を切らせる。
const XS = [-18, 8, 30, 62, 82, 118];
const YS = [-18, 6, 34, 54, 84, 118];
const WIDE_X = 2, WIDE_Y = 2;   // この位置の道だけ太くする（幹線）
const ROAD_GAP = 3.2;           // 街区どうしの隙間＝道の幅

function cityMap() {
  let out = '';
  // 街区の面
  for (let i = 0; i < XS.length - 1; i++) {
    for (let j = 0; j < YS.length - 1; j++) {
      const x = XS[i] + ROAD_GAP / 2, y = YS[j] + ROAD_GAP / 2;
      const w = XS[i + 1] - XS[i] - ROAD_GAP, h = YS[j + 1] - YS[j] - ROAD_GAP;
      out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.6" fill="${BLOCK}"/>`;
    }
  }
  // 道
  for (let i = 1; i < XS.length - 1; i++) {
    out += `<path d="M${XS[i]} -25 V125" stroke="${ROAD}" stroke-width="${i === WIDE_X ? 4.6 : 2.8}" fill="none"/>`;
  }
  for (let j = 1; j < YS.length - 1; j++) {
    out += `<path d="M-25 ${YS[j]} H125" stroke="${ROAD}" stroke-width="${j === WIDE_Y ? 4.6 : 2.8}" fill="none"/>`;
  }
  // 斜めの大通り
  out += `<path d="M-25 108 L118 -14" stroke="${ROAD}" stroke-width="4" fill="none"/>`;
  return `<g transform="rotate(-8 50 50)">${out}</g>`;
}

/**
 * マークのSVGを組み立てる。
 * @param {number} size      一辺（px）
 * @param {number} scale     地に対する印の大きさ（0〜1）。maskable では小さくする
 * @param {boolean} rounded  角を丸めるか（iOS・Android用は丸めず全面に地を敷く）
 */
export function iconSvg({ size = 512, scale = 0.62, rounded = true } = {}) {
  const r = rounded ? size * 0.225 : 0; // iOSのアイコンに馴染む角丸の比率
  const m = size * scale;
  const x = (size - m) / 2, y = (size - m) / 2;
  const u = m / 100, s = size / 100;

  // idはページに埋め込まれたときにぶつからないよう、独自の名前にする
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="庭心">
  <defs><clipPath id="niwashinIconClip"><rect width="${size}" height="${size}" rx="${r}"/></clipPath></defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="${GREEN}"/>
  <g clip-path="url(#niwashinIconClip)"><g transform="scale(${s})">${cityMap()}</g></g>
  <g transform="translate(${x} ${y}) scale(${u})">
    <path d="${BODY_PATH}" fill="${CREAM}"/>
    <path d="${VEIN_PATH}" stroke="${GREEN}" stroke-width="${VEIN_WIDTH}" stroke-linecap="round" fill="none"/>
  </g>
</svg>`;
}
