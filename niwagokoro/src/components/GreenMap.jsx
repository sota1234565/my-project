import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { GREEN_TYPES } from '../data/greenItems';

const CONDITION_COLORS = {
  healthy: '#4ade80',
  needs_care: '#fb923c',
  poor: '#f87171',
};

function FlyTo({ item }) {
  const map = useMap();
  useEffect(() => {
    if (item) {
      map.flyTo([item.location.lat, item.location.lng], 17, { duration: 1.2 });
    }
  }, [item, map]);
  return null;
}

export default function GreenMap({ items, selectedItem, onSelectItem }) {
  return (
    <div className="map-container">
      <MapContainer
        center={[35.6888, 139.6925]}
        zoom={15}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        {/* 衛星画像レイヤー（Google Earth風） */}
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
        {/* 地名・道路ラベルレイヤー */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
          opacity={0.8}
        />

        {selectedItem && <FlyTo item={selectedItem} />}

        {items.map((item) => {
          const typeInfo = GREEN_TYPES[item.type];
          const isSelected = selectedItem?.id === item.id;
          return (
            <CircleMarker
              key={item.id}
              center={[item.location.lat, item.location.lng]}
              radius={isSelected ? 16 : 11}
              pathOptions={{
                color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.6)',
                fillColor: typeInfo.color,
                fillOpacity: isSelected ? 1 : 0.85,
                weight: isSelected ? 3 : 1.5,
              }}
              eventHandlers={{ click: () => onSelectItem(item) }}
            >
              <Popup className="custom-popup">
                <div className="map-popup">
                  <div className="popup-type" style={{ color: typeInfo.color }}>
                    {typeInfo.emoji} {typeInfo.label}
                  </div>
                  <div className="popup-name">{item.name}</div>
                  <div className="popup-address">📍 {item.location.address}</div>
                  <div className="popup-stats">
                    <span className={`popup-condition condition-${item.condition}`}>
                      {item.condition === 'healthy' ? '健全' : item.condition === 'needs_care' ? '要ケア' : '不良'}
                    </span>
                    <span className="popup-supporters">💚 {item.supporters.length}</span>
                  </div>
                  <button
                    className="popup-detail-btn"
                    onClick={() => onSelectItem(item)}
                  >
                    詳細を見る →
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

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
      </div>
    </div>
  );
}
