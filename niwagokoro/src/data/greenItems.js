// 都市緑地データ（木・花・雨庭）
export const GREEN_TYPES = {
  tree: { label: '木', emoji: '🌳', color: '#2d6a4f' },
  flower: { label: '花', emoji: '🌸', color: '#e07a9f' },
  rain_garden: { label: '雨庭', emoji: '🌿', color: '#52b788' },
};

// 表示するのは実際に登録された緑地だけ。
// 庭心は現地へ行くことを促すアプリのため、実在の場所に未確認の情報を出すと
// それを見て足を運んだ人に誤情報を渡すことになる。よってサンプルデータは持たない。
export const initialGreenItems = [];

// 利用者も実際に使った人だけ。架空の利用者は作らない。
export const initialUsers = [];

export const CURRENT_USER = { id: 'user-me', name: 'あなた', points: 0, avatar: '🌱' };
