// 庭心 Service Worker
// キャッシュ名のバージョンを上げると、古いキャッシュが破棄されて更新される
const CACHE = 'niwagokoro-v3';
const TILE_CACHE = 'niwagokoro-tiles-v1';
const TILE_LIMIT = 800; // 保存する地図タイルの上限（おおよそ20〜40MB）
const CORE = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        // 地図タイルのキャッシュは消さない（せっかく貯めたものを捨てないため）
        keys.filter((k) => k !== CACHE && k !== TILE_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// 地図タイル：一度読み込んだものは保存し、次からは通信なしで表示する
async function tileFirst(req) {
  const cache = await caches.open(TILE_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    // 外部画像はopaqueレスポンス（status 0）で返るためtypeでも判定する
    if (res && (res.status === 200 || res.type === 'opaque')) {
      cache.put(req, res.clone());
      trimTileCache();
    }
    return res;
  } catch {
    return hit || Response.error();
  }
}

// 上限を超えたぶんを古い順に削除する
async function trimTileCache() {
  const cache = await caches.open(TILE_CACHE);
  const keys = await cache.keys();
  const excess = keys.length - TILE_LIMIT;
  for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 地図タイル（国土地理院・OpenStreetMap）
  if (url.hostname === 'cyberjapandata.gsi.go.jp' || url.hostname.endsWith('tile.openstreetmap.org')) {
    e.respondWith(tileFirst(req));
    return;
  }

  // それ以外の外部リソースはそのまま通す
  if (url.origin !== self.location.origin) return;

  // ページ遷移：ネットワーク優先、オフライン時はキャッシュしたトップを返す
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // 静的アセット：キャッシュを即返しつつ裏で更新
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
