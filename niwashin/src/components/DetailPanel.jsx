import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import ReportPanel from './ReportPanel';
import { isReportable } from '../report';
import { GREEN_TYPES, CONDITIONS, CONDITION_LABELS } from '../data/greenItems';
import { hasNgWord } from '../moderation';
import { googleMapsDirUrl } from '../maps';
import { db } from '../firebase';
import { fileToCompressed } from '../image';

export default function DetailPanel({ item, currentUserId, onBack, onSupport, onAddObservation, onShowRoute, onDelete, onSetCondition, onSetAddress, onAddPhotoLog, onDeletePhotoLog, isAdmin }) {
  const [obsText, setObsText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightbox, setLightbox] = useState(null); // 全画面で見せる写真のURL（nullで閉じる）
  const [obsError, setObsError] = useState(null);
  // 市への通報の下書きを開いているか。状態を変えたら閉じる必要はない
  // （文面は item から毎回作り直されるため、常に最新になる）。
  const [showReport, setShowReport] = useState(false);
  // 住所の修正。自動取得がずれたときに、現地の人が直せるようにする。
  const [editAddr, setEditAddr] = useState(null); // null＝編集していない
  // 定点観測の写真。重いので、この詳細を開いているあいだだけ読み込む。
  // photoLogs/$id を購読し、閉じたら解除する（地図・一覧には載せない）。
  const [photoLogs, setPhotoLogs] = useState(null); // null=読み込み中, {}=無し
  const [photoNote, setPhotoNote] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const typeInfo = GREEN_TYPES[item.type];
  const isSupported = item.supporters.includes(currentUserId);

  function handleSubmitObs(e) {
    e.preventDefault();
    if (!obsText.trim()) return;
    // 下ネタ・悪口はここで止める（サーバー側のルールでも同じ基準で弾かれる）
    if (hasNgWord(obsText)) {
      setObsError('その表現は投稿できません。言い方を変えてください。');
      return;
    }
    setObsError(null);
    onAddObservation(item.id, obsText.trim());
    setObsText('');
  }

  // この木の季節写真を、開いているあいだだけ購読する。
  useEffect(() => {
    setPhotoLogs(null);
    const unsub = onValue(ref(db, `photoLogs/${item.id}`), (snap) => {
      setPhotoLogs(snap.val() || {});
    }, () => setPhotoLogs({}));
    return () => unsub();
  }, [item.id]);

  // 「今の様子を追加」。写真を縮小して、メモとともに親へ渡す。
  async function handlePickPhoto(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !onAddPhotoLog) return;
    setPhotoBusy(true);
    try {
      const photo = await fileToCompressed(file);
      await onAddPhotoLog(item.id, { photo, note: photoNote });
      setPhotoNote('');
    } finally {
      setPhotoBusy(false);
    }
  }

  // 写真つきの記録（photoId を持つ観察）を、写真の実体と結びつけて日付順に並べる。
  // 登録時の写真を先頭に置き、そこからの移り変わりとして見せる。
  const photoEntries = [
    ...(item.photo ? [{ id: '__origin__', photo: item.photo, date: null, caption: '登録したときの様子', origin: true }] : []),
    ...item.observations
      .filter(o => o.photoId)
      .map(o => ({
        id: o.id,
        photo: photoLogs ? photoLogs[o.photoId]?.photo : undefined, // undefined=まだ読み込み中
        date: o.date,
        caption: o.text,
        userName: o.userName,
        userId: o.userId,
        // 本人か管理者だけが消せる。登録時の写真（origin）は木の一部なので消せない。
        canDelete: !!onDeletePhotoLog && (o.userId === currentUserId || isAdmin),
      }))
      .sort((a, b) => (a.date || '').localeCompare(b.date || '')),
  ];
  // テキストだけの観察記録（写真つきは上のタイムラインに出すので除く）
  const textObservations = item.observations.filter(o => !o.photoId);

  return (
    <div className="detail-panel">
      {/* スマホでは中身全体がスクロールする。そのとき戻る手段まで流れていかないよう、
          つまみと「戻る」だけを上に貼り付けておく。 */}
      <div className="detail-sticky-top">
        <button className="sheet-handle" onClick={onBack} aria-label="閉じる" />
        <button className="back-btn" onClick={onBack}>← 一覧に戻る</button>
      </div>
      <div className="detail-panel-header">
        <div className="detail-id">{item.id}</div>
        <div className="detail-name">{typeInfo.emoji} {item.name}</div>
        {item.scientificName && (
          <div className="detail-sci">{item.scientificName}</div>
        )}
        <div className="detail-meta">
          <span className={`condition-badge condition-${item.condition}`}>
            {CONDITION_LABELS[item.condition]}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#777' }}>
            {item.location.address}
          </span>
          {onSetAddress && editAddr === null && (
            <button
              type="button"
              className="addr-edit-btn"
              onClick={() => setEditAddr(item.location.address || '')}
            >
              住所を直す
            </button>
          )}
        </div>

        {/* 自動取得の住所はずれることがある。現地にいる人がいちばん正確に知っているので
            あとから直せるようにする。地図上の位置（緯度経度）は変えず、表記だけを直す。 */}
        {onSetAddress && editAddr !== null && (
          <form
            className="addr-edit"
            onSubmit={(e) => { e.preventDefault(); onSetAddress(item.id, editAddr); setEditAddr(null); }}
          >
            <input
              className="addr-edit-input"
              value={editAddr}
              maxLength={100}
              placeholder="例：〇〇県〇〇市〇〇町一丁目"
              autoFocus
              onChange={(e) => setEditAddr(e.target.value)}
            />
            <div className="addr-edit-actions">
              <button type="submit" className="addr-edit-save">保存</button>
              <button type="button" className="addr-edit-cancel" onClick={() => setEditAddr(null)}>
                やめる
              </button>
            </div>
            <div className="addr-edit-hint">
              地図上の位置は変わりません。住所の表記だけを直します。
            </div>
          </form>
        )}

        {/* 手入れが要りそうな状態のときだけ、市に伝える導線を出す。
            健全な木の通報は市の手間を増やすだけなので出さない。 */}
        {isReportable(item.condition) && (
          showReport ? (
            <ReportPanel item={item} onClose={() => setShowReport(false)} />
          ) : (
            <button type="button" className="report-open-btn" onClick={() => setShowReport(true)}>
              📮 この木のことを市に伝える
            </button>
          )
        )}

        {/* 状態は時間とともに変わる（枝が折れた／手入れされた）。
            気づいた人がその場で直せるようにする。見守るアプリの要。 */}
        {onSetCondition && (
          <div className="condition-edit">
            <span className="condition-edit-label">いまの状態は？</span>
            <div className="condition-edit-btns">
              {Object.entries(CONDITIONS).map(([key, val]) => (
                <button
                  key={key}
                  type="button"
                  className={`condition-edit-btn ${item.condition === key ? 'active' : ''}`}
                  onClick={() => onSetCondition(item.id, key)}
                  title={val.hint}
                >
                  {val.emoji} {val.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* 現地へ行く導線。地図に経路を描く／Googleマップで本物のナビへ */}
        <div className="route-btn-row">
          {onShowRoute && (
            <button type="button" className="route-btn route-btn-primary" onClick={() => onShowRoute(item)}>
              🚶 ここまでの経路
            </button>
          )}
          <a
            className="route-btn route-btn-secondary"
            href={googleMapsDirUrl(item.location.lat, item.location.lng)}
            target="_blank"
            rel="noopener noreferrer"
          >
            📍 Googleマップで案内
          </a>
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

        {/* 写真（タップで全画面表示） */}
        {item.photo && (
          <img
            src={item.photo}
            alt={item.name}
            className="detail-photo"
            onClick={() => setLightbox(item.photo)}
          />
        )}
        {Array.isArray(item.photos) && item.photos.length > 1 && (
          <>
            <div className="detail-gallery-label">🔍 判別用に撮ったアップ写真（タップで拡大）</div>
            <div className="detail-photo-gallery">
              {item.photos.slice(1).map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="detail-photo-thumb"
                  onClick={() => setLightbox(src)}
                />
              ))}
            </div>
          </>
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

        {/* 定点観測：同じ木の移り変わり。季節ごとに撮った写真を日付順に並べる。 */}
        <div className="section-title">📸 移り変わりの記録</div>
        <div className="phototl">
          {photoEntries.length <= 1 && (
            <p className="no-obs">
              まだ定点観測の写真はありません。季節ごとに撮ると、同じ木の移り変わりが見られます。
            </p>
          )}
          {photoEntries.length > 1 && (
            <div className="phototl-strip">
              {photoEntries.map(e => (
                <div key={e.id} className="phototl-item">
                  {e.canDelete && (
                    <button
                      type="button"
                      className="phototl-del"
                      title="この写真を消す"
                      onClick={() => {
                        if (window.confirm('この写真を消します。よろしいですか？')) {
                          onDeletePhotoLog(item.id, e.id);
                        }
                      }}
                    >
                      ✕
                    </button>
                  )}
                  {e.photo === undefined ? (
                    // photoLogs をまだ読み込み中。枠だけ出しておく。
                    <div className="phototl-photo phototl-photo-loading" />
                  ) : e.photo ? (
                    <img
                      src={e.photo}
                      alt=""
                      className="phototl-photo"
                      loading="lazy"
                      onClick={() => setLightbox(e.photo)}
                    />
                  ) : (
                    <div className="phototl-photo phototl-photo-missing">写真を読み込めませんでした</div>
                  )}
                  <div className="phototl-caption">
                    {e.date && <span className="phototl-date">{e.date}</span>}
                    <span className="phototl-text">{e.caption}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {onAddPhotoLog && (
          <div className="phototl-add">
            <input
              className="phototl-note"
              type="text"
              maxLength={200}
              placeholder="一言メモ（任意。例：桜が満開になりました）"
              value={photoNote}
              onChange={e => setPhotoNote(e.target.value)}
              disabled={photoBusy}
            />
            <div className="phototl-add-hint">📸 今の様子を残す（+10pt）</div>
            <div className="photo-btn-row">
              <label className={`photo-btn ${photoBusy ? 'is-busy' : ''}`}>
                {photoBusy ? 'アップロード中…' : '📷 写真を撮る'}
                <input type="file" accept="image/*" capture="environment"
                  disabled={photoBusy} onChange={handlePickPhoto} style={{ display: 'none' }} />
              </label>
              <label className={`photo-btn ${photoBusy ? 'is-busy' : ''}`}>
                🖼 フォルダから選ぶ
                <input type="file" accept="image/*"
                  disabled={photoBusy} onChange={handlePickPhoto} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        )}

        {/* 観察記録 */}
        <div className="section-title">🔍 観察記録</div>
        <div className="obs-list">
          {textObservations.length === 0 ? (
            <p className="no-obs">まだ観察記録がありません。最初の記録を残しましょう！</p>
          ) : (
            [...textObservations].reverse().map(obs => (
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
            onChange={e => { setObsText(e.target.value); setObsError(null); }}
          />
          {obsError && <div className="obs-error">{obsError}</div>}
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

      {/* 写真の全画面表示。背景か✕をタップで閉じる。 */}
      {lightbox && (
        <div className="photo-lightbox" onClick={() => setLightbox(null)}>
          <button
            className="photo-lightbox-close"
            onClick={() => setLightbox(null)}
            aria-label="閉じる"
          >
            ✕
          </button>
          <img src={lightbox} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
