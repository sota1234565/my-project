// この端末だけの個人データ（ポイント・推し・自分の観察記録）。
// 木そのものは全員で共有（Firebase）するが、これらは各自の記録として端末に持つ。
const POINTS = 'niwagokoro.points.v1';
const SUPPORTS = 'niwagokoro.supports.v1';   // { itemId: true }
const MYOBS = 'niwagokoro.myobs.v1';         // { itemId: [obs, ...] }

function loadObj(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveObj(key, obj) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
  } catch {
    // 容量不足などは黙って無視（写真は共有側に置くので通常は問題にならない）
  }
}

export function loadPoints() {
  try {
    const n = Number(localStorage.getItem(POINTS));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}
export function savePoints(n) {
  try { localStorage.setItem(POINTS, String(n)); } catch { /* ignore */ }
}

export const loadSupports = () => loadObj(SUPPORTS);
export const saveSupports = (o) => saveObj(SUPPORTS, o);
export const loadMyObs = () => loadObj(MYOBS);
export const saveMyObs = (o) => saveObj(MYOBS, o);
