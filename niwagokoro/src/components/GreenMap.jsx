import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { GREEN_TYPES } from '../data/greenItems';

const CONDITION_COLORS = {
  healthy: '#2d6a4f',
  needs_care: '#f4a261',
  poor: '#e63946',
};

function FlyTo({ item }) {
  const map = useMap();
  useEffect(() => {
    if (item) {
      map.flyTo([item.location.lat, item.location.lng], 16, { duration: 0.8 });
    }
  }, [item, map]);
  return null;
}

export default function GreenMap({ items, selectedItem, onSelectItem }) {
  return (
    <div className="map-container">
      <MapContainer
        center={[35.6888, 35.6925]}
        zoom={15}
        style={{ width: '100%', height: '100%' }}
        center={[35.6888, 139.6925]}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {selectedItem && <FlyTo item={selectedItem} />}
        {items.map((item) => {
          const typeInfo = GREEN_TYPES[item.type];
          const isSelected = selectedItem?.id === item.id;
          return (
            <CircleMarker
              key={item.id}
              center={[item.location.lat, item.location.lng]}
              radius={isSelected ? 14 : 10}
              pathOptions={{
                color: isSelected ? '#fff' : CONDITION_COLORS[item.condition],
                fillColor: typeInfo.color,
                fillOpacity: 0.9,
                weight: isSelected ? 3 : 1.5,
              }}
              eventHandlers={{ click: () => onSelectItem(item) }}
            >
              <Popup>
                <div className="map-popup">
                  <div className="popup-id">{item.id}</div>
                  <div className="popup-name">{typeInfo.emoji} {item.name}</div>
                  <div className="popup-address">{item.location.address}</div>
                  <button
                    className="popup-detail-btn"
                    onClick={() => onSelectItem(item)}
                  >
                    詳細を見る
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
        <div style={{ borderTop: '1px solid #e0e8e0', marginTop: '0.4rem', paddingTop: '0.4rem' }}>
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
    </div>
  );
}
