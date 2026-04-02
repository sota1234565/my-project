import { useState } from 'react';
import { GREEN_TYPES } from '../data/greenItems';

const CONDITION_LABELS = {
  healthy: '健全',
  needs_care: '要ケア',
  poor: '不良',
};

function getMoistureColor(val) {
  if (val >= 70) return '#52b788';
  if (val >= 40) return '#f4a261';
  return '#e63946';
}

export default function DetailPanel({ item, currentUserId, onBack, onSupport, onAddObservation }) {
  const [obsText, setObsText] = useState('');
  const typeInfo = GREEN_TYPES[item.type];
  const isSupported = item.supporters.includes(currentUserId);

  function handleSubmitObs(e) {
    e.preventDefault();
    if (!obsText.trim()) return;
    onAddObservation(item.id, obsText.trim());
    setObsText('');
  }

  return (
    <div className="detail-panel">
      <div className="detail-panel-header">
        <button className="back-btn" onClick={onBack}>← 一覧に戻る</button>
        <div className="detail-id">{item.id}</div>
        <div className="detail-name">{typeInfo.emoji} {item.name}</div>
        {item.scientificName && (
          <div className="detail-sci">{item.scientificName}</div>
        )}
        <div className="detail-meta">
          <span
            className="condition-badge"
            style={{}}
          >
            <span className={`condition-badge condition-${item.condition}`}>
              {CONDITION_LABELS[item.condition]}
            </span>
          </span>
          <span style={{ fontSize: '0.75rem', color: '#777' }}>
            {item.location.address}
          </span>
        </div>
      </div>

      <div className="detail-body">
        {/* 説明 */}
        <div className="section-title">📋 説明</div>
        <p className="description-text">{item.description}</p>

        {/* データ */}
        <div className="section-title">📊 データ</div>
        <div className="stats-grid">
          {item.plantedYear && (
            <div className="stat-box">
              <div className="stat-label">植栽年</div>
              <div className="stat-value">{item.plantedYear}<span className="stat-unit">年</span></div>
            </div>
          )}
          {item.height != null && (
            <div className="stat-box">
              <div className="stat-label">高さ</div>
              <div className="stat-value">{item.height}<span className="stat-unit">m</span></div>
            </div>
          )}
          {item.trunkDiameter != null && (
            <div className="stat-box">
              <div className="stat-label">幹回り</div>
              <div className="stat-value">{item.trunkDiameter}<span className="stat-unit">cm</span></div>
            </div>
          )}
          <div className="stat-box">
            <div className="stat-label">水分量</div>
            <div className="stat-value" style={{ color: getMoistureColor(item.moisture) }}>
              {item.moisture}<span className="stat-unit">%</span>
            </div>
            <div className="moisture-bar-bg">
              <div
                className="moisture-bar-fill"
                style={{
                  width: `${item.moisture}%`,
                  background: getMoistureColor(item.moisture),
                }}
              />
            </div>
          </div>
        </div>

        {/* タグ */}
        {item.tags.length > 0 && (
          <>
            <div className="section-title">🏷️ タグ</div>
            <div className="tags-row">
              {item.tags.map(tag => (
                <span key={tag} className="tag">#{tag}</span>
              ))}
            </div>
          </>
        )}

        {/* 推しの木 */}
        <div className="section-title">💚 推しの{typeInfo.label}</div>
        <div className="supporter-section">
          <div className="supporter-count-big">{item.supporters.length}</div>
          <div className="supporter-label">人が推しています</div>
          <button
            className={`support-btn ${isSupported ? 'supported' : ''}`}
            onClick={() => onSupport(item.id)}
          >
            {isSupported ? '💚 推し登録済み' : '🤍 推しに登録する'}
          </button>
        </div>

        {/* 観察記録 */}
        <div className="section-title">🔍 観察記録</div>
        <div className="obs-list">
          {item.observations.length === 0 ? (
            <p className="no-obs">まだ観察記録がありません。最初の記録を残しましょう！</p>
          ) : (
            [...item.observations].reverse().map(obs => (
              <div key={obs.id} className="obs-item">
                <span className="obs-user">{obs.userName}</span>
                <span className="obs-date">{obs.date}</span>
                <div className="obs-text">{obs.text}</div>
              </div>
            ))
          )}
        </div>

        <form className="obs-form" onSubmit={handleSubmitObs}>
          <textarea
            placeholder="観察したことを記録してみよう（例：新芽が出てきました、少し元気がなさそうです…）"
            value={obsText}
            onChange={e => setObsText(e.target.value)}
          />
          <button type="submit" className="obs-submit-btn">
            📝 記録を投稿する (+10pt)
          </button>
        </form>
      </div>
    </div>
  );
}
