// 庭心のしるし（葉）。アプリのアイコンと同じ形を使い、見た目を揃える。
// 絵文字は端末ごとに形が変わるため、自前の図形にしている。
export default function LeafMark({ size = 26 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="庭心のロゴ"
      className="leaf-mark"
    >
      <path
        d="M18.4 18.4 A25.5 25.5 0 0 1 45.6 45.6 A25.5 25.5 0 0 1 18.4 18.4 Z"
        fill="currentColor"
      />
      <path
        d="M21.5 21.5 L42.5 42.5"
        stroke="#2d6a4f"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
