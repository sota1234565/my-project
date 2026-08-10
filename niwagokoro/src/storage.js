// 登録した緑地とポイントを端末に保存する。
// サーバーを持たないため、データはこの端末のブラウザ内にのみ残る。
const ITEMS_KEY = 'niwagokoro.items.v1';
const POINTS_KEY = 'niwagokoro.points.v1';

export function loadItems(fallback) {
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function loadPoints() {
  try {
    const raw = localStorage.getItem(POINTS_KEY);
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

// 保存に失敗したら false を返す。写真を多く登録すると容量上限に達することがある。
export function saveItems(items) {
  try {
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export function savePoints(points) {
  try {
    localStorage.setItem(POINTS_KEY, String(points));
    return true;
  } catch {
    return false;
  }
}
