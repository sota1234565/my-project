// 地図を最初にどこに合わせるかの決め方。
//
// 全国で使うため、特定の市を初期値にしない。代わりに次の順で決める。
//   1. 前回この端末で見ていた場所（覚えてある）
//   2. 登録されている緑地が全部入る範囲
//      … データが藤沢だけなら藤沢が映り、全国に広がれば自然に引いていく
//   3. 日本全体
//
// これで固定座標が要らなくなり、データの広がりに表示がついてくる。

const KEY = 'niwashin.mapView.v1';

export const JAPAN_CENTER = [36.5, 138.0];
export const JAPAN_ZOOM = 5;

// 前回見ていた場所を覚える／読み出す。
// localStorage は私用ウィンドウなどで例外になることがあるので必ず包む。
export function saveMapView(center, zoom) {
  try {
    if (!Number.isFinite(center?.lat) || !Number.isFinite(center?.lng)) return;
    localStorage.setItem(KEY, JSON.stringify({ lat: center.lat, lng: center.lng, zoom }));
  } catch { /* 覚えられなくても動作に支障はない */ }
}

export function loadMapView() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!Number.isFinite(v?.lat) || !Number.isFinite(v?.lng)) return null;
    const zoom = Number.isFinite(v.zoom) ? Math.min(19, Math.max(3, v.zoom)) : 14;
    return { center: [v.lat, v.lng], zoom };
  } catch {
    return null;
  }
}

// 緑地が全部入る範囲。1件だけのときは範囲にならないので、その点を中心にする。
export function boundsOfItems(items) {
  const pts = (items || [])
    .map(it => [it.location?.lat, it.location?.lng])
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  if (pts.length === 0) return null;
  if (pts.length === 1) return { center: pts[0], zoom: 15 };
  return { points: pts };
}
