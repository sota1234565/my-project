// 庭心のマークの定義。
// favicon・PNG・画面内のロゴは、すべてここの数値から作られる。
// 形を直したいときはここだけを触り、tools/make-icons.mjs で書き出し直す。
//
// 【ねらい】1つの輪郭が「葉」と「地図のピン」の両方に見えること。
//
// 外側は水滴。下の尖りが地図のピンを表す。
// ただし左右対称の水滴にまっすぐな線を引くと、葉ではなく熱気球か
// 感嘆符に見える（実際に試して確認した）。葉に見せているのは主脈の
// 「曲がり」で、これが入った瞬間に葉として読めるようになる。
// 側脈は 48px まで小さくすると潰れるので描かない。

export const GREEN = '#1e4d38';  // 地。アプリの theme-color と同じ
export const CREAM = '#faf7f0';  // 形。アプリの背景色と同じ

// 100×100 の升目での輪郭。上がふくらみ、下が尖る。
export const BODY_PATH =
  'M50 6 C64 6 78 17 78 34 C78 48 68 62 50 94 C32 62 22 48 22 34 C22 17 36 6 50 6 Z';

// 主脈。下の尖りの手前から、右上へゆるく曲がって立ち上がる。
// 輪郭の縁に触れない長さで止める（触れると形が割れて見える）。
export const VEIN_PATH = 'M50 86 C46 68 45 53 51 38 C55 29 59 24 62 21';
export const VEIN_WIDTH = 6.5;

/**
 * マークのSVGを組み立てる。
 * @param {number} size      一辺（px）
 * @param {number} scale     地に対する形の大きさ（0〜1）。maskable では小さくする
 * @param {boolean} rounded  角を丸めるか（iOS用は丸めず全面に地を敷く）
 */
export function iconSvg({ size = 512, scale = 0.62, rounded = true } = {}) {
  const r = rounded ? size * 0.225 : 0; // iOSのアイコンに馴染む角丸の比率
  const m = size * scale;
  const x = (size - m) / 2;
  const y = (size - m) / 2;
  const u = m / 100;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="庭心">
  <rect width="${size}" height="${size}" rx="${r}" fill="${GREEN}"/>
  <g transform="translate(${x} ${y}) scale(${u})">
    <path d="${BODY_PATH}" fill="${CREAM}"/>
    <path d="${VEIN_PATH}" stroke="${GREEN}" stroke-width="${VEIN_WIDTH}" stroke-linecap="round" fill="none"/>
  </g>
</svg>`;
}
