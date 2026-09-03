import { useState } from 'react';
import { GREEN_TYPES } from '../data/greenItems';

const CONDITION_LABELS = {
  healthy: '健全',
  needs_care: '要ケア',
  poor: '不良',
};

export default function DetailPanel({ item, currentUserId, onBack, onSupport, onAddObservation, onDelete }) {
  const [obsText, setObsText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
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
        {/* 公開待ちの案内（自分の投稿だけに表示） */}
        {item.isMinePending && (
          <div className="pending-notice">
            🕓 この投稿は公開待ちです。管理者が承認すると、他の人にも表示されます。
            今はあなたにだけ見えています。
          </div>
        )}

        {/* 写真 */}
        {item.photo && (
          <img src={item.photo} alt={item.name} className="detail-photo" />
        )}
        {Array.isArray(item.photos) && item.photos.length > 1 && (
          <div className="detail-photo-gallery">
            {item.photos.slice(1).map((src, i) => (
              <img key={i} src={src} alt="" className="detail-photo-thumb" />
            ))}
          </div>
        )}

        {/* 説明 */}
        {item.description && (
          <>
            <div className="section-title">📋 説明</div>
            <p className="description-text">{item.description}</p>
          </>
        )}

        {/* データ（記録がある場合のみ。実際に測った値だけを出す） */}
        {(item.plantedYear || item.height != null || item.trunkDiameter != null) && (
          <>
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
            </div>
          </>
        )}

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

        {onDelete && (
          <div className="delete-section">
            {!confirmDelete ? (
              <button className="delete-btn" onClick={() => setConfirmDelete(true)}>
                🗑️ この登録を取り消す
              </button>
            ) : (
              <div className="delete-confirm">
                <div className="delete-confirm-text">
                  「{item.name}」を削除します。写真や観察記録も一緒に消え、元に戻せません。よろしいですか？
                </div>
                <div className="delete-confirm-actions">
                  <button className="delete-cancel-btn" onClick={() => setConfirmDelete(false)}>
                    キャンセル
                  </button>
                  <button className="delete-confirm-btn" onClick={() => onDelete(item.id)}>
                    削除する
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
