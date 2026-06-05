import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, CircleMarker } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GREEN_TYPES } from '../data/greenItems';

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

function FlyTo({ item }) {
  const map = useMap();
  useEffect(() => {
    if (item) map.flyTo([item.location.lat, item.location.lng], 17, { duration: 1.2 });
  }, [item, map]);
  return null;
}

function FlyToUser({ pos }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.flyTo(pos, 16, { duration: 1.2 });
  }, [pos, map]);
  return null;
}

export default function GreenMap({ items, selectedItem, onSelectItem }) {
  const [userPos, setUserPos] = useState(null);
  const [flyToUser, setFlyToUser] = useState(false);
  const [locError, setLocError] = useState(false);

  function handleLocate() {
    if (!navigator.geolocation) { setLocError(true); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
        setFlyToUser(true);
        setTimeout(() => setFlyToUser(false), 100);
      },
      () => setLocError(true),
      { enableHighAccuracy: true, timeout: 10000 }
    );
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
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {selectedItem && <FlyTo item={selectedItem} />}
        {flyToUser && userPos && <FlyToUser pos={userPos} />}

        {/* 現在地の範囲円 */}
        {userPos && (
          <Circle
            center={userPos}
            radius={NEARBY_RADIUS_M}
            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.08, weight: 1.5, dashArray: '6 4' }}
          />
        )}

        {/* 現在地マーカー */}
        {userPos && (
          <CircleMarker
            center={userPos}
            radius={10}
            pathOptions={{ color: '#fff', fillColor: '#3b82f6', fillOpacity: 1, weight: 3 }}
          >
            <Popup>📍 あなたの現在地</Popup>
          </CircleMarker>
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

      {/* 現在地ボタン */}
      <button className="locate-btn" onClick={handleLocate} title="現在地を表示">📍</button>

      {/* 近くの緑地パネル */}
      {userPos && nearbyItems.length > 0 && (
        <div className="nearby-panel">
          <div className="nearby-title">📍 近くの緑地（{NEARBY_RADIUS_M}m以内）</div>
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
        <div className="nearby-panel" style={{ color: '#e63946' }}>⚠️ 現在地を取得できませんでした</div>
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
