import { useState } from 'react';
import { GREEN_TYPES } from '../data/greenItems';

export default function AddGreenForm({ onAdd, onClose }) {
  const [form, setForm] = useState({
    type: 'tree',
    name: '',
    scientificName: '',
    address: '',
    lat: '35.6888',
    lng: '139.6925',
    plantedYear: '',
    height: '',
    trunkDiameter: '',
    description: '',
    tags: '',
  });

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim()) return;
    onAdd({
      type: form.type,
      name: form.name.trim(),
      scientificName: form.scientificName.trim() || null,
      location: {
        lat: parseFloat(form.lat) || 35.6888,
        lng: parseFloat(form.lng) || 139.6925,
        address: form.address.trim(),
      },
      plantedYear: form.plantedYear ? parseInt(form.plantedYear) : null,
      height: form.height ? parseFloat(form.height) : null,
      trunkDiameter: form.trunkDiameter ? parseFloat(form.trunkDiameter) : null,
      condition: 'healthy',
      moisture: 60,
      description: form.description.trim(),
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
            <input
              className="form-input"
              name="name"
              placeholder="例：ソメイヨシノ、ラベンダー花壇"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">学名（任意）</label>
            <input
              className="form-input"
              name="scientificName"
              placeholder="例：Prunus × yedoensis"
              value={form.scientificName}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label className="form-label">住所 *</label>
            <input
              className="form-input"
              name="address"
              placeholder="例：渋谷区神南1丁目"
              value={form.address}
              onChange={handleChange}
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div className="form-group">
              <label className="form-label">緯度</label>
              <input className="form-input" name="lat" value={form.lat} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">経度</label>
              <input className="form-input" name="lng" value={form.lng} onChange={handleChange} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">説明</label>
            <textarea
              className="form-textarea"
              name="description"
              placeholder="この木・花・雨庭について教えてください"
              value={form.description}
              onChange={handleChange}
            />
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
            <input
              className="form-input"
              name="tags"
              placeholder="例：桜、街路樹、春"
              value={form.tags}
              onChange={handleChange}
            />
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
