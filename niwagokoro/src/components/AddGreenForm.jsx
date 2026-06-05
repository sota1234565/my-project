import { useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GREEN_TYPES } from '../data/greenItems';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ja`,
      { headers: { 'User-Agent': 'NiwaGokoro-App' } }
    );
    const data = await res.json();
    const a = data.address || {};
    const parts = [a.prefecture, a.city || a.town || a.village, a.suburb || a.neighbourhood, a.road].filter(Boolean);
    return parts.join('') || data.display_name || '';
  } catch {
    return '';
  }
}

function LocationPicker({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function AddGreenForm({ onAdd, onClose }) {
  const [form, setForm] = useState({
    type: 'tree',
    name: '',
    scientificName: '',
    address: '',
    lat: '',
    lng: '',
    plantedYear: '',
    height: '',
    description: '',
    tags: '',
  });
  const [gpsStatus, setGpsStatus] = useState('idle');
  const [addressLoading, setAddressLoading] = useState(false);
  const [pinPos, setPinPos] = useState(null);
  const [photo, setPhoto] = useState(null);

  function handlePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  const applyLocation = useCallback(async (lat, lng) => {
    setPinPos([lat, lng]);
    setForm(prev => ({ ...prev, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
    setAddressLoading(true);
    const address = await reverseGeocode(lat, lng);
    setForm(prev => ({ ...prev, address }));
    setAddressLoading(false);
  }, []);

  function handleGetGPS() {
    if (!navigator.geolocation) { setGpsStatus('error'); return; }
    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyLocation(pos.coords.latitude, pos.coords.longitude);
        setGpsStatus('success');
      },
      () => setGpsStatus('error'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onAdd({
      type: form.type,
      name: form.name.trim(),
      scientificName: form.scientificName.trim() || null,
      location: {
        lat: parseFloat(form.lat) || 35.3386,
        lng: parseFloat(form.lng) || 139.4875,
        address: form.address.trim() || '藤沢市',
      },
      plantedYear: form.plantedYear ? parseInt(form.plantedYear) : null,
      height: form.height ? parseFloat(form.height) : null,
      trunkDiameter: null,
      condition: 'healthy',
      moisture: 60,
      description: form.description.trim(),
      photo: photo || null,
      observations: [],
      supporters: [],
      tags: form.tags.split(/[,、\s]+/).map(t => t.trim()).filter(Boolean),
    });
  }

  return (
    <div className="add-form-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="add-form-box">
        <div className="add-form-title">🌱 新しい緑地を登録</div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">種別 *</label>
            <select className="form-select" name="type" value={form.type} onChange={handleChange}>
              {Object.entries(GREEN_TYPES).map(([key, val]) => (
                <option key={key} value={key}>{val.emoji} {val.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">名前 *</label>
            <input className="form-input" name="name" placeholder="例：ソメイヨシノ" value={form.name} onChange={handleChange} required />
          </div>

          {/* 地図タップで場所指定 */}
          <div className="form-group">
            <label className="form-label">📍 地図をタップして場所を指定</label>
            <div className="location-map-wrap">
              <MapContainer
                center={pinPos || [35.3386, 139.4875]}
                zoom={14}
                style={{ width: '100%', height: '200px' }}
                zoomControl={true}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />
                <LocationPicker onPick={applyLocation} />
                {pinPos && <Marker position={pinPos} />}
              </MapContainer>
              <div className="map-tap-hint">タップした場所にピンが立ち、住所が自動入力されます</div>
            </div>
          </div>

          {/* GPS取得ボタン */}
          <div className="form-group">
            <button type="button" className="btn-gps" onClick={handleGetGPS} disabled={gpsStatus === 'loading'}>
              {gpsStatus === 'loading' ? '📡 取得中...' : '📍 GPSで現在地を取得'}
            </button>
            {gpsStatus === 'success' && <div className="gps-success">✅ 現在地を取得しました</div>}
            {gpsStatus === 'error' && <div className="gps-error">⚠️ 取得できませんでした。地図をタップして指定してください。</div>}
          </div>

          {/* 住所（自動入力・修正可） */}
          <div className="form-group">
            <label className="form-label">
              住所
              {addressLoading && <span className="address-loading"> 取得中...</span>}
            </label>
            <input
              className="form-input"
              name="address"
              placeholder="地図をタップすると自動入力されます"
              value={form.address}
              onChange={handleChange}
            />
          </div>

          {/* 写真アップロード */}
          <div className="form-group">
            <label className="form-label">📷 写真（任意）</label>
            <label className="photo-upload-label">
              {photo ? (
                <img src={photo} alt="プレビュー" className="photo-preview" />
              ) : (
                <div className="photo-placeholder">タップして写真を選択</div>
              )}
              <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">学名（任意）</label>
            <input className="form-input" name="scientificName" placeholder="例：Prunus × yedoensis" value={form.scientificName} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label">説明</label>
            <textarea className="form-textarea" name="description" placeholder="この木・花・雨庭について教えてください" value={form.description} onChange={handleChange} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div className="form-group">
              <label className="form-label">植栽年</label>
              <input className="form-input" name="plantedYear" type="number" placeholder="例：2010" value={form.plantedYear} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">高さ (m)</label>
              <input className="form-input" name="height" type="number" step="0.1" placeholder="例：8.5" value={form.height} onChange={handleChange} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">タグ（カンマ区切り）</label>
            <input className="form-input" name="tags" placeholder="例：桜、街路樹、春" value={form.tags} onChange={handleChange} />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>キャンセル</button>
            <button type="submit" className="btn-primary">✅ 登録する (+30pt)</button>
          </div>
        </form>
      </div>
    </div>
  );
}
