// 庭心のしるし。アプリのアイコンと同じ輪郭を使い、見た目を揃える。
// 形の定義は tools/icon.mjs にあり、そこから写している
// （画面内のこれは小さく、色も currentColor で変わるため、別に持っている）。
//
// 絵文字は端末ごとに形が変わるので、自前の図形にしている。
export default function LeafMark({ size = 26 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="庭心のロゴ"
      className="leaf-mark"
    >
      <path
        d="M50 6 C64 6 78 17 78 34 C78 48 68 62 50 94 C32 62 22 48 22 34 C22 17 36 6 50 6 Z"
        fill="currentColor"
      />
      {/* 主脈。これが入って初めて葉に見える。
          背景と同じ色で抜くので、置かれる場所の色に合わせる。 */}
      <path
        d="M50 86 C46 68 45 53 51 38 C55 29 59 24 62 21"
        stroke="var(--surface)"
        strokeWidth="6.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
