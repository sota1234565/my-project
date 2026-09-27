// 庭心のマークの定義。
// favicon・PNG・画面内のロゴは、すべてここの数値から作られる。
// 形を直したいときはここだけを触り、tools/make-icons.mjs で書き出し直す。
//
// 【ねらい】「まちの緑を地図に記録して見守る」を一目で伝えること。
//
//   地図の上に、葉であり地図のピンでもある印が挿さっている
//
// 外側は水滴で、下の尖りがピンを表す。ただし左右対称の水滴にまっすぐな
// 縦線を引くと、葉ではなく熱気球か感嘆符に見える（実際に書き出して確認した）。
// 葉に見せているのは主脈の「曲がり」で、これが入った瞬間に葉として読める。
// 脈を左向きにすると炎に、上下とも尖らせるとコーヒー豆に見えたので、
// 水滴＋右上へ曲がる主脈に決めた。
//
// 背景の線は道。これが無いと「ただの水滴」で終わり、地図のアプリだと伝わらない。
// 等間隔の格子にすると方眼紙に見えるので、太さと向きをばらけさせている。

export const GREEN = '#1e4d38';  // 地。アプリの theme-color と同じ
export const CREAM = '#faf7f0';  // 印。アプリの背景色と同じ
export const ROAD  = '#2b6349';  // 道。地との差は小さく保ち、印の邪魔をしない

// 100×100 の升目での輪郭。上がふくらみ、下が尖る。
export const BODY_PATH =
  'M50 6 C64 6 78 17 78 34 C78 48 68 62 50 94 C32 62 22 48 22 34 C22 17 36 6 50 6 Z';

// 主脈。下の尖りの手前から、右上へゆるく曲がって立ち上がる。
// 輪郭の縁に触れない長さで止める（触れると形が割れて見える）。
// 側脈は 48px で潰れて雑然とするため描かない。
export const VEIN_PATH = 'M50 86 C46 68 45 53 51 38 C55 29 59 24 62 21';
export const VEIN_WIDTH = 6.5;

// 背景の道。100×100 の升目。枠の外まで伸ばして、切り取られても端が途切れないようにする。
const ROADS = [
  ['M-5 72 C22 66 46 78 105 62', 5],    // 幹線
  ['M18 -5 C22 34 14 66 20 105', 3],
  ['M-5 26 C30 22 58 34 105 18', 2.6],
  ['M62 -5 C72 26 84 44 105 50', 2.6],  // 斜め。格子に見せないための1本
];

/**
 * マークのSVGを組み立てる。
 * @param {number} size      一辺（px）
 * @param {number} scale     地に対する印の大きさ（0〜1）。maskable では小さくする
 * @param {boolean} rounded  角を丸めるか（iOS・Android用は丸めず全面に地を敷く）
 */
export function iconSvg({ size = 512, scale = 0.62, rounded = true } = {}) {
  const r = rounded ? size * 0.225 : 0; // iOSのアイコンに馴染む角丸の比率
  const m = size * scale;
  const x = (size - m) / 2;
  const y = (size - m) / 2;
  const u = m / 100;
  const s = size / 100;

  const roads = ROADS
    .map(([d, w]) =>
      `<path d="${d}" stroke="${ROAD}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`)
    .join('');

  // idはページに埋め込まれたときにぶつからないよう、独自の名前にする
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="庭心">
  <defs><clipPath id="niwashinIconClip"><rect width="${size}" height="${size}" rx="${r}"/></clipPath></defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="${GREEN}"/>
  <g clip-path="url(#niwashinIconClip)"><g transform="scale(${s})">${roads}</g></g>
  <g transform="translate(${x} ${y}) scale(${u})">
    <path d="${BODY_PATH}" fill="${CREAM}"/>
    <path d="${VEIN_PATH}" stroke="${GREEN}" stroke-width="${VEIN_WIDTH}" stroke-linecap="round" fill="none"/>
  </g>
</svg>`;
}
