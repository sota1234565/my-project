// 現在地から緑地までの「徒歩」経路を取得する（OpenRouteService）。
//
// foot-walking プロファイルは歩道・遊歩道・階段まで考慮した歩行者用の道順を返す。
// 所要時間もサービス側が徒歩の速さで計算する（無料の OSRM は車の道・車の速度だった）。
//
// この処理をサーバー側に置いているのは、APIキーを隠すため。
// キーは Vercel の環境変数 ORS_API_KEY から読む（無料枠：1日2,000回）。
// 置き場所はリポジトリの根っこの api/（identify.mjs と同じ理由）。

// 旧 api.openrouteservice.org は非推奨。HeiGITの新ベースURLを使う（2026年9月に確認）。
const ORS_ENDPOINT = 'https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson';

function isLatLng(p) {
  return Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    res.status(200).json({ error: 'not_configured' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const from = body?.from; // [lat, lng]
  const to = body?.to;     // [lat, lng]
  if (!isLatLng(from) || !isLatLng(to)) {
    res.status(400).json({ error: 'bad_coordinates' });
    return;
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(ORS_ENDPOINT, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/geo+json, application/json',
      },
      // ORS は [経度, 緯度] の順
      body: JSON.stringify({ coordinates: [[from[1], from[0]], [to[1], to[0]]] }),
    });
    clearTimeout(timer);

    if (r.status === 401 || r.status === 403) {
      res.status(200).json({ error: 'bad_key' });
      return;
    }
    if (r.status === 429) {
      res.status(200).json({ error: 'quota_exceeded' });
      return;
    }
    if (!r.ok) {
      res.status(200).json({ error: 'failed' });
      return;
    }

    const data = await r.json();
    const f = data?.features?.[0];
    const coordsLngLat = f?.geometry?.coordinates;
    if (!Array.isArray(coordsLngLat) || coordsLngLat.length < 2) {
      res.status(200).json({ error: 'no_route' });
      return;
    }
    // アプリ側は [緯度, 経度] で扱うので入れ替えて返す
    const coords = coordsLngLat.map(([lng, lat]) => [lat, lng]);
    const summary = f.properties?.summary || {};
    res.status(200).json({
      coords,
      distance: summary.distance ?? null, // m
      duration: summary.duration ?? null, // 秒（徒歩）
      provider: 'ors',
    });
  } catch {
    res.status(200).json({ error: 'failed' });
  }
}
