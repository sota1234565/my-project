import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { GREEN_TYPES } from '../data/greenItems';

const CONDITION_COLORS = {
  healthy: '#4ade80',
  needs_care: '#fb923c',
  poor: '#f87171',
};

const NEARBY_RADIUS_M = 500; // 500m以内を「近く」とする

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

        {/* 緑地マーカー */}
        {items.map((item) => {
          const typeInfo = GREEN_TYPES[item.type];
          const isSelected = selectedItem?.id === item.id;
          const isNearby = userPos && getDistance(userPos[0], userPos[1], item.location.lat, item.location.lng) <= NEARBY_RADIUS_M;
          return (
            <CircleMarker
              key={item.id}
              center={[item.location.lat, item.location.lng]}
              radius={isSelected ? 16 : isNearby ? 13 : 11}
              pathOptions={{
                color: isSelected ? '#ffffff' : isNearby ? '#3b82f6' : 'rgba(255,255,255,0.6)',
                fillColor: typeInfo.color,
                fillOpacity: isSelected ? 1 : 0.85,
                weight: isSelected ? 3 : isNearby ? 2.5 : 1.5,
              }}
              eventHandlers={{ click: () => onSelectItem(item) }}
            >
              <Popup className="custom-popup">
                <div className="map-popup">
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
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* 現在地ボタン */}
      <button className="locate-btn" onClick={handleLocate} title="現在地を表示">
        📍
      </button>

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
        <div className="nearby-panel" style={{ color: '#e63946' }}>
          ⚠️ 現在地を取得できませんでした
        </div>
      )}

      <div className="map-legend">
        <div className="legend-title">凡例</div>
        {Object.entries(GREEN_TYPES).map(([key, val]) => (
          <div key={key} className="legend-item">
            <div className="legend-dot" style={{ background: val.color }} />
            <span>{val.emoji} {val.label}</span>
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
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#3b82f6' }} />
          <span>現在地付近</span>
        </div>
      </div>
    </div>
  );
}
