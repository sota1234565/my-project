// 都市緑地データ（木・花・雨庭）
export const GREEN_TYPES = {
  tree: { label: '木', emoji: '🌳', color: '#2d6a4f' },
  flower: { label: '花', emoji: '🌸', color: '#e07a9f' },
  rain_garden: { label: '雨庭', emoji: '🌿', color: '#52b788' },
};

// 緑地の状態。「要ケア」は手入れが要りそうなもの、「不良」は傷んでいるもの。
// 見た人が更新できるようにしてあるので、同じ木でも時期によって変わる。
export const CONDITIONS = {
  healthy: { label: '健全', emoji: '🌳', hint: '元気そう' },
  needs_care: { label: '要ケア', emoji: '⚠️', hint: '枝が折れている・枯れかけなど' },
  poor: { label: '不良', emoji: '🥀', hint: 'かなり傷んでいる' },
};

export const CONDITION_LABELS = Object.fromEntries(
  Object.entries(CONDITIONS).map(([k, v]) => [k, v.label])
);

// 表示するのは実際に登録された緑地だけ。
// 庭心は現地へ行くことを促すアプリのため、実在の場所に未確認の情報を出すと
// それを見て足を運んだ人に誤情報を渡すことになる。よってサンプルデータは持たない。
export const initialGreenItems = [];

