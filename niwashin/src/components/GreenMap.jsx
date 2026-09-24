import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents, Circle, CircleMarker, AttributionControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GREEN_TYPES } from '../data/greenItems';
import { getLocationHelp } from '../platform';
import { googleMapsDirUrl, walkMinutes, formatDistance } from '../maps';
import { GSI_ATTRIBUTION, TILE_STYLES, nextTileStyle, TILE_MAX_NATIVE_ZOOM, TILE_MAX_ZOOM } from '../tiles';

// 端末は途中で変わらないので、一度だけ判定する
const LOCATION_HELP = getLocationHelp();

const CONDITION_COLORS = {
  healthy: '#4ade80',
  needs_care: '#fb923c',
  poor: '#f87171',
};

const NEARBY_RADIUS_M = 500;

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function makeEmojiIcon(emoji, isSelected, isNearby, condition) {
  const condColor = CONDITION_COLORS[condition] || CONDITION_COLORS.healthy;
  const size = isSelected ? 52 : 40;
  const border = isSelected
    ? `3px solid #fff`
    : isNearby
    ? `2.5px solid #3b82f6`
    : `2px solid rgba(255,255,255,0.8)`;
  const shadow = isSelected
    ? '0 4px 16px rgba(0,0,0,0.35)'
    : '0 2px 8px rgba(0,0,0,0.22)';

  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:${size}px;height:${size}px;
        border-radius:50%;
        background:${condColor};
        border:${border};
        box-shadow:${shadow};
        display:flex;align-items:center;justify-content:center;
        font-size:${isSelected ? 24 : 20}px;
        transition:all 0.2s;
        ${isSelected ? 'transform:scale(1.15)' : ''}
      ">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

const USER_ICON = L.divIcon({
  className: '',
  html: `<div class="user-dot">
           <div class="user-dot-pulse"></div>
           <div class="user-dot-core"></div>
         </div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -12],
});

// 地図の「表示領域の大きさ」を Leaflet に知らせ直す。
//
// Leaflet は生成された瞬間の大きさを覚えて、その範囲ぶんのタイルしか読み込まない。
// ところがスマホでは、生成直後はまだ高さが確定していないことがある。
// （Webフォントの読み込み、iOSのツールバーの出入り、100dvh の確定待ちなど）
// その状態のまま覚えてしまうと、あとから領域が広がってもタイルが追加されず、
// 下半分が灰色のまま残る。「何回か開き直すと直る」のはこれが理由で、
// たまたま高さが先に確定した回だけ正しく描かれていた。通信の良し悪しではない。
//
// invalidateSize() は「大きさを測り直して、足りないタイルを読み込む」命令。
// 大きさが変わりうる場面すべてで呼ぶことで、一発で全面が描かれるようにする。
function KeepMapSized() {
  const map = useMap();

  useEffect(() => {
    const el = map.getContainer();
    const fix = () => {
      try { map.invalidateSize({ animate: false }); } catch { /* 地図でアプリを落とさない */ }
    };

    // 初回。レイアウトが落ち着くまでに数フレームかかるため、間を置いて数回試す。
    const timers = [0, 120, 400, 1000].map(ms => setTimeout(fix, ms));

    // 以降は領域の大きさが変わるたびに呼ぶ。これで次の3つをまとめて拾える。
    //  ・iOSのツールバーが出入りして高さが変わる
    //  ・一覧やランキングに切り替えると地図が display:none になり、戻ると復活する
    //  ・画面を回転させる
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(fix);
      ro.observe(el);
    }
    // ResizeObserver が無い環境と、履歴を戻ってきたときの保険
    window.addEventListener('orientationchange', fix);
    window.addEventListener('pageshow', fix);

    return () => {
      timers.forEach(clearTimeout);
      if (ro) ro.disconnect();
      window.removeEventListener('orientationchange', fix);
      window.removeEventListener('pageshow', fix);
    };
  }, [map]);

  return null;
}

// 地図を安全に移動する。座標が不正（NaN）や、地図の大きさがまだ0のときにクラッシュしないようにする。
function moveMap(map, lat, lng, zoom) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  try {
    const size = map.getSize();
    if (size.x > 0 && size.y > 0) {
      map.flyTo([lat, lng], zoom, { duration: 1.2 });
    } else {
      // 大きさが未確定のときはアニメーションなしで位置だけ合わせる
      map.setView([lat, lng], zoom, { animate: false });
    }
  } catch {
    // 何かあっても地図移動でアプリ全体を落とさない
  }
}

// 経路全体が画面に収まるように地図を動かす
function FitRoute({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (!coords || coords.length < 2) return;
    try {
      const size = map.getSize();
      if (size.x > 0 && size.y > 0) {
        map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 17 });
      }
    } catch {
      // 地図移動でアプリ全体を落とさない
    }
  }, [coords, map]);
  return null;
}

function FlyTo({ item }) {
  const map = useMap();
  useEffect(() => {
    if (item) moveMap(map, item.location?.lat, item.location?.lng, 17);
  }, [item, map]);
  return null;
}

// 追従中は地図が現在地を追いかける。地図を手で動かしたら追従を解除する。
function FollowUser({ pos, following, onManualDrag }) {
  const map = useMap();
  const firstRef = useRef(true);

  useMapEvents({
    dragstart: () => onManualDrag(),
  });

  useEffect(() => {
    if (!pos || !following) return;
    const [lat, lng] = pos;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (firstRef.current) {
      firstRef.current = false;
      moveMap(map, lat, lng, 17);
    } else {
      try { map.panTo([lat, lng], { animate: true, duration: 0.6 }); } catch { /* ignore */ }
    }
  }, [pos, following, map]);

  useEffect(() => {
    if (!following) firstRef.current = true;
  }, [following]);

  return null;
}

export default function GreenMap({ items, selectedItem, onSelectItem, routeTarget, onClearRoute }) {
  const [userPos, setUserPos] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [watching, setWatching] = useState(false);
  const [following, setFollowing] = useState(false);
  const [locError, setLocError] = useState(null); // null | 'denied' | 'timeout' | 'unavailable' | 'unsupported'
  const [tileStyle, setTileStyle] = useState('pale'); // 'pale'（地図） | 'photo'（航空写真）
  const watchIdRef = useRef(null);
  // 経路。どの緑地の経路かを targetId で持ち、表示時に今の routeTarget と一致するものだけ使う
  // （対象が変わったり消えたりしたときに、effect内で同期的に消す必要がなくなる）。
  const [route, setRoute] = useState(null);
  // 経路取得の瞬間の現在地を読むためのref（effectの依存に userPos を入れないため）
  const userPosRef = useRef(null);
  useEffect(() => { userPosRef.current = userPos; }, [userPos]);

  // 位置の追従開始／停止
  useEffect(() => {
    if (!watching || !navigator.geolocation) return;

    let cancelled = false;
    let gotFix = false;

    const apply = (pos) => {
      if (cancelled) return;
      gotFix = true;
      setUserPos([pos.coords.latitude, pos.coords.longitude]);
      setAccuracy(pos.coords.accuracy);
      setLocError(null);
    };

    const onError = (err) => {
      if (cancelled) return;
      // 許可されていない場合だけ追従をやめる。案内を出して操作してもらう。
      if (err.code === err.PERMISSION_DENIED) {
        setLocError('denied');
        setWatching(false);
        setFollowing(false);
        return;
      }
      // iPhoneでは高精度の初回測位がタイムアウトしてから成功することが多い。
      // そのため追従は止めず、まだ一度も取得できていないときだけ知らせる。
      if (!gotFix) {
        setLocError(err.code === err.TIMEOUT ? 'timeout' : 'unavailable');
      }
    };

    // まず粗い位置を素早く取り、地図をすぐ動かす（iPhoneは高精度測位が遅いため）
    navigator.geolocation.getCurrentPosition(apply, onError, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60000,
    });

    // 続けて高精度で追従する
    watchIdRef.current = navigator.geolocation.watchPosition(apply, onError, {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 10000,
    });

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [watching]);

  // 経路表示：現在地を取り、無料の経路サービス（OSRM）で道順を取得して線を描く。
  // OSRMの公開サーバーは徒歩でも車の道で計算するため、所要時間は距離から自前で出す（maps.js）。
  useEffect(() => {
    if (!routeTarget) return;
    const lat = routeTarget.location?.lat, lng = routeTarget.location?.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const dest = [lat, lng];
    const targetId = routeTarget.id;
    let cancelled = false;

    const getOrigin = () => new Promise((resolve, reject) => {
      if (userPosRef.current) return resolve(userPosRef.current);
      if (!navigator.geolocation) return reject(new Error('unsupported'));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
        (err) => reject(err),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    });

    (async () => {
      setFollowing(false); // 追従中だと fitBounds と喧嘩する
      setRoute({ targetId, loading: true });
      let origin;
      try {
        origin = await getOrigin();
      } catch (err) {
        if (cancelled) return;
        setLocError(err && err.code === 1 ? 'denied' : 'unavailable');
        setRoute({ targetId, noPosition: true });
        return;
      }
      if (cancelled) return;
      setUserPos(origin);
      // 1) 歩行者用の正確な経路（OpenRouteService。サーバー関数経由でキーを隠す）
      // 2) だめなら OSRM の公開サーバー（車の道ベースだが街なかでは形はほぼ同じ）
      // 3) それもだめなら直線。どの段でも「壊れて見えない」ようにする。
      const viaOrs = async () => {
        const res = await fetch('/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: origin, to: dest }),
        });
        const data = await res.json();
        if (data.error || !Array.isArray(data.coords)) throw new Error(data.error || 'no route');
        return { coords: data.coords, distance: data.distance, duration: data.duration, provider: 'ors', fallback: false };
      };
      const viaOsrm = async () => {
        const url = `https://router.project-osrm.org/route/v1/foot/${origin[1]},${origin[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.code !== 'Ok' || !data.routes?.[0]) throw new Error('no route');
        const r = data.routes[0];
        return {
          coords: r.geometry.coordinates.map(([x, y]) => [y, x]),
          distance: r.distance, duration: null, provider: 'osrm', fallback: false,
        };
      };
      let result = null;
      try { result = await viaOrs(); } catch { try { result = await viaOsrm(); } catch { result = null; } }
      if (cancelled) return;
      if (result) {
        setRoute({ targetId, ...result });
      } else {
        setRoute({
          targetId,
          coords: [origin, dest],
          distance: getDistance(origin[0], origin[1], dest[0], dest[1]),
          duration: null, provider: null, fallback: true,
        });
      }
    })();

    return () => { cancelled = true; };
  }, [routeTarget]);

  // 今表示すべき経路（対象が変わった・消えたときは自然に null になる）
  const activeRoute = routeTarget && route && route.targetId === routeTarget.id ? route : null;

  // ボタン：停止中→追従開始／地図を動かした後→現在地に戻す／追従中→停止
  function handleLocate() {
    if (!navigator.geolocation) { setLocError('unsupported'); return; }
    if (!watching) {
      setWatching(true);
      setFollowing(true);
      setLocError(null);
    } else if (!following) {
      setFollowing(true);
    } else {
      setWatching(false);
      setFollowing(false);
    }
  }

  const nearbyItems = userPos
    ? items.filter(item => getDistance(userPos[0], userPos[1], item.location.lat, item.location.lng) <= NEARBY_RADIUS_M)
    : [];

  return (
    <div className="map-container">
      <MapContainer
        center={[35.3386, 139.4875]}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        {/* 地図データの出典表示。ライセンス上の義務なので消せないが、
            prefix={false} でライブラリの宣伝だけ省き、CSSで小さく目立たなくする。 */}
        <AttributionControl position="bottomright" prefix={false} />
        <KeepMapSized />
        <TileLayer
          key={tileStyle}
          attribution={GSI_ATTRIBUTION}
          url={TILE_STYLES[tileStyle].url}
          maxNativeZoom={TILE_MAX_NATIVE_ZOOM}
          maxZoom={TILE_MAX_ZOOM}
        />

        {selectedItem && <FlyTo item={selectedItem} />}

        {/* 経路。白い縁取りの上に青い線（Googleマップ風）。取得できないときは破線の直線 */}
        {activeRoute?.coords && (
          <>
            <Polyline
              positions={activeRoute.coords}
              pathOptions={{ color: '#ffffff', weight: 10, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
            />
            <Polyline
              positions={activeRoute.coords}
              pathOptions={{
                color: '#2563eb', weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round',
                dashArray: activeRoute.fallback ? '10 12' : undefined,
              }}
            />
            <FitRoute coords={activeRoute.coords} />
          </>
        )}
        <FollowUser
          pos={userPos}
          following={following}
          onManualDrag={() => setFollowing(false)}
        />

        {/* 現在地の範囲円 */}
        {userPos && (
          <Circle
            center={userPos}
            radius={NEARBY_RADIUS_M}
            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.08, weight: 1.5, dashArray: '6 4' }}
          />
        )}

        {/* GPSの誤差範囲 */}
        {userPos && accuracy != null && accuracy > 15 && (
          <Circle
            center={userPos}
            radius={accuracy}
            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.12, weight: 0 }}
          />
        )}

        {/* 現在地マーカー */}
        {userPos && (
          <Marker position={userPos} icon={USER_ICON} zIndexOffset={2000}>
            <Popup>
              📍 あなたの現在地
              {accuracy != null && (
                <div style={{ fontSize: '0.75rem', color: '#777', marginTop: 4 }}>
                  誤差およそ {Math.round(accuracy)}m
                </div>
              )}
            </Popup>
          </Marker>
        )}

        {/* 緑地マーカー（クラスタリング） */}
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
          showCoverageOnHover={false}
          iconCreateFunction={(cluster) => {
            const count = cluster.getChildCount();
            return L.divIcon({
              className: '',
              html: `<div style="
                width:44px;height:44px;border-radius:50%;
                background:linear-gradient(135deg,#2d6a4f,#52b788);
                color:white;font-size:0.85rem;font-weight:800;
                display:flex;align-items:center;justify-content:center;
                box-shadow:0 3px 10px rgba(45,106,79,0.45);
                border:2.5px solid white;
              ">${count}</div>`,
              iconSize: [44, 44],
              iconAnchor: [22, 22],
            });
          }}
        >
          {items.map((item) => {
            const typeInfo = GREEN_TYPES[item.type];
            const isSelected = selectedItem?.id === item.id;
            const isNearby = userPos && getDistance(userPos[0], userPos[1], item.location.lat, item.location.lng) <= NEARBY_RADIUS_M;
            return (
              <Marker
                key={item.id}
                position={[item.location.lat, item.location.lng]}
                icon={makeEmojiIcon(typeInfo.emoji, isSelected, isNearby, item.condition)}
                zIndexOffset={isSelected ? 1000 : 0}
              >
                <Popup className="custom-popup">
                  <div className="map-popup">
                    {item.photo && (
                      <img src={item.photo} alt={item.name} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px', marginBottom: '6px' }} />
                    )}
                    <div className="popup-type" style={{ color: typeInfo.color }}>
                      {typeInfo.emoji} {typeInfo.label}
                      {isNearby && <span className="nearby-badge"> 📍 近く</span>}
                    </div>
                    <div className="popup-name">{item.name}</div>
                    <div className="popup-address">📍 {item.location.address}</div>
                    <div className="popup-stats">
                      <span className={`popup-condition condition-${item.condition}`}>
                        {item.condition === 'healthy' ? '健全' : item.condition === 'needs_care' ? '要ケア' : '不良'}
                      </span>
                      <span className="popup-supporters">💚 {item.supporters.length}</span>
                    </div>
                    <button className="popup-detail-btn" onClick={() => onSelectItem(item)}>
                      詳細を見る →
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>

      {/* まだ何も登録されていないときの案内。
          現在地を表示したら地図の邪魔になるので消す。 */}
      {items.length === 0 && !userPos && (
        <div className="map-empty-hint">
          <div className="map-empty-emoji">🌱</div>
          <div className="map-empty-title">地図はまだ空です</div>
          <div className="map-empty-text">
            近くの木や花を見つけたら「＋」から登録してみましょう。
          </div>
        </div>
      )}

      {/* 地図と航空写真の切り替え */}
      <button
        className={`style-toggle ${tileStyle === 'photo' ? 'on-photo' : ''}`}
        onClick={() => setTileStyle(nextTileStyle)}
        title={`${TILE_STYLES[tileStyle].label}に切り替え`}
      >
        <span className="style-toggle-icon">{TILE_STYLES[tileStyle].icon}</span>
        <span className="style-toggle-label">{TILE_STYLES[tileStyle].label}</span>
      </button>

      {/* 現在地ボタン */}
      <button
        className={`locate-btn ${watching ? 'watching' : ''} ${following ? 'following' : ''}`}
        onClick={handleLocate}
        title={!watching ? '現在地を表示' : following ? '追従を停止' : '現在地に戻る'}
      >
        {watching ? '🎯' : '📍'}
      </button>

      {/* 近くの緑地パネル */}
      {!routeTarget && userPos && nearbyItems.length > 0 && (
        <div className="nearby-panel">
          <div className="nearby-title">
            📍 近くの緑地（{NEARBY_RADIUS_M}m以内）
            {following && <span className="live-dot" title="追従中" />}
          </div>
          {nearbyItems.map(item => {
            const typeInfo = GREEN_TYPES[item.type];
            const dist = Math.round(getDistance(userPos[0], userPos[1], item.location.lat, item.location.lng));
            return (
              <div key={item.id} className="nearby-item" onClick={() => onSelectItem(item)}>
                <span style={{ color: typeInfo.color }}>{typeInfo.emoji}</span>
                <span className="nearby-name">{item.name}</span>
                <span className="nearby-dist">{dist}m</span>
              </div>
            );
          })}
        </div>
      )}
      {!routeTarget && userPos && nearbyItems.length === 0 && (
        <div className="nearby-panel">
          <div className="nearby-title">📍 半径{NEARBY_RADIUS_M}m以内に緑地はありません</div>
        </div>
      )}
      {/* 経路カード：所要時間・距離・Googleマップへの引き渡し */}
      {activeRoute && (
        <div className="route-card">
          <button className="route-card-close" onClick={onClearRoute} title="経路を消す">✕</button>
          <div className="route-card-title">🚶 {routeTarget.name} まで</div>
          {activeRoute.loading && <div className="route-card-sub">経路を調べています…</div>}
          {activeRoute.noPosition && (
            <div className="route-card-sub">現在地が取れませんでした。Googleマップなら案内できます。</div>
          )}
          {activeRoute.coords && (
            <div className="route-card-stat">
              徒歩 約<b>{activeRoute.duration ? Math.max(1, Math.round(activeRoute.duration / 60)) : walkMinutes(activeRoute.distance)}</b>分 · {formatDistance(activeRoute.distance)}
              {activeRoute.fallback && <span className="route-card-note">（経路を取得できず、直線距離です）</span>}
              {activeRoute.provider === 'osrm' && <span className="route-card-note">（簡易ルート：車道ベースの道順です）</span>}
            </div>
          )}
          <a
            className="route-card-gmaps"
            href={googleMapsDirUrl(routeTarget.location.lat, routeTarget.location.lng)}
            target="_blank"
            rel="noopener noreferrer"
          >
            📍 Googleマップで案内
          </a>
          {activeRoute.provider === 'ors' && (
            <div className="route-card-credit">経路: openrouteservice · © OpenStreetMap contributors</div>
          )}
          {activeRoute.provider === 'osrm' && (
            <div className="route-card-credit">経路: OSRM · © OpenStreetMap contributors</div>
          )}
        </div>
      )}
      {locError && (
        <div className="locate-error">
          <button className="locate-error-close" onClick={() => setLocError(null)} title="閉じる">✕</button>
          {locError === 'denied' && (
            <>
              <div className="locate-error-title">位置情報が許可されていません</div>
              <div className="locate-error-text">
                <ol className="locate-error-steps">
                  {LOCATION_HELP.steps.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
                {LOCATION_HELP.note && (
                  <span className="locate-error-note">※{LOCATION_HELP.note}</span>
                )}
              </div>
            </>
          )}
          {locError === 'timeout' && (
            <>
              <div className="locate-error-title">現在地を探しています…</div>
              <div className="locate-error-text">
                建物の中では時間がかかることがあります。窓際や屋外に出ると取得しやすくなります。
              </div>
            </>
          )}
          {locError === 'unavailable' && (
            <>
              <div className="locate-error-title">現在地を取得できませんでした</div>
              <div className="locate-error-text">
                電波の届く場所で、もう一度 📍 を押してみてください。
              </div>
            </>
          )}
          {locError === 'unsupported' && (
            <div className="locate-error-title">この端末では位置情報を利用できません</div>
          )}
        </div>
      )}

      <div className="map-legend">
        <div className="legend-title">凡例</div>
        {Object.entries(GREEN_TYPES).map(([key, val]) => (
          <div key={key} className="legend-item">
            <span style={{ fontSize: '1rem' }}>{val.emoji}</span>
            <span>{val.label}</span>
          </div>
        ))}
        <div className="legend-divider" />
        <div className="legend-item">
          <div className="legend-dot" style={{ background: CONDITION_COLORS.healthy }} />
          <span>健全</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: CONDITION_COLORS.needs_care }} />
          <span>要ケア</span>
        </div>
      </div>
    </div>
  );
}
