import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Circle, CircleMarker, AttributionControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GREEN_TYPES } from '../data/greenItems';
import { getLocationHelp } from '../platform';

// 端末は途中で変わらないので、一度だけ判定する
const LOCATION_HELP = getLocationHelp();

const CONDITION_COLORS = {
  healthy: '#4ade80',
  needs_care: '#fb923c',
  poor: '#f87171',
};

const NEARBY_RADIUS_M = 500;

// 地図タイルは国土地理院のものを使う。日本国内は公式測量に基づくため精度が高い。
// 利用にあたり出典の表示が必要（下の attribution）。
const GSI_ATTRIBUTION =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>';
const TILE_STYLES = {
  pale: {
    label: '航空写真',
    icon: '🛰',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',
  },
  photo: {
    label: '地図',
    icon: '🗺',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
  },
};

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

export default function GreenMap({ items, selectedItem, onSelectItem }) {
  const [userPos, setUserPos] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [watching, setWatching] = useState(false);
  const [following, setFollowing] = useState(false);
  const [locError, setLocError] = useState(null); // null | 'denied' | 'timeout' | 'unavailable' | 'unsupported'
  const [tileStyle, setTileStyle] = useState('pale'); // 'pale'（地図） | 'photo'（航空写真）
  const watchIdRef = useRef(null);

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
        {/* 地理院タイルはズーム18まで。それ以上は拡大表示して操作できるようにする */}
        <TileLayer
          key={tileStyle}
          attribution={GSI_ATTRIBUTION}
          url={TILE_STYLES[tileStyle].url}
          maxNativeZoom={18}
          maxZoom={19}
        />

        {selectedItem && <FlyTo item={selectedItem} />}
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
                eventHandlers={{ click: () => onSelectItem(item) }}
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
        onClick={() => setTileStyle(s => (s === 'pale' ? 'photo' : 'pale'))}
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
      {userPos && nearbyItems.length > 0 && (
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
      {userPos && nearbyItems.length === 0 && (
        <div className="nearby-panel">
          <div className="nearby-title">📍 半径{NEARBY_RADIUS_M}m以内に緑地はありません</div>
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
