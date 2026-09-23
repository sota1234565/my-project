import { useEffect, useState } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { ref, update, remove, set } from 'firebase/database';
import { db, auth, googleProvider } from '../firebase';
import { GREEN_TYPES } from '../data/greenItems';

// 承認・削除ができるのはデータベースのルールで許可された人だけ。
// この画面を開けても、権限が無ければ操作は拒否される。
export default function AdminPanel({ items, users = [], onClose }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('pending'); // 'pending' | 'approved' | 'users'
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setChecking(false);
    });
    return () => unsub();
  }, []);

  async function handleLogin() {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      if (e.code === 'auth/operation-not-allowed') {
        setError('Firebaseで Google ログインがまだ有効になっていません。');
      } else if (e.code === 'auth/popup-closed-by-user') {
        setError(null);
      } else {
        setError('ログインできませんでした：' + (e.code || e.message));
      }
    }
  }

  async function changeStatus(id, status) {
    setBusyId(id);
    setError(null);
    try {
      await update(ref(db, `greenItems/${id}`), { status });
    } catch {
      setError('操作できませんでした。下のIDがルールに登録されているか確認してください。');
    }
    setBusyId(null);
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`「${name}」を完全に削除します。元に戻せません。よろしいですか？`)) return;
    setBusyId(id);
    setError(null);
    try {
      await remove(ref(db, `greenItems/${id}`));
    } catch {
      setError('削除できませんでした。下のIDがルールに登録されているか確認してください。');
    }
    setBusyId(null);
  }

  // 不適切な観察記録を消す。フィルターをすり抜けたときの最後の砦（管理者のみ可）。
  async function deleteObs(itemId, obsId, text) {
    if (!window.confirm(`この観察記録を削除します。
「${text}」
よろしいですか？`)) return;
    setBusyId(obsId);
    setError(null);
    try {
      await remove(ref(db, `greenItems/${itemId}/observations/${obsId}`));
    } catch {
      setError('観察記録を削除できませんでした。');
    }
    setBusyId(null);
  }

  // 不適切なニックネームを消す。フィルターをすり抜けたときの最後の砦。
  async function resetName(uid, name) {
    if (!window.confirm(`「${name}」の名前をリセットします。よろしいですか？`)) return;
    setBusyId(uid);
    setError(null);
    try {
      await set(ref(db, `users/${uid}/name`), null);
    } catch {
      setError('名前をリセットできませんでした。');
    }
    setBusyId(null);
  }

  // 利用者をランキングから外す。名前も消える。
  // 本人の投稿（緑地・観察記録）は消さない。必要ならそれぞれの画面から個別に消す。
  async function hideUser(uid, name) {
    const label = name || `利用者 ${uid.slice(-4)}`;
    if (!window.confirm(
      `${label} をランキングから外します。\n\n`
      + '・設定した名前は消えます\n'
      + '・登録した緑地や観察記録は消えません\n'
      + '・あとから戻せます\n\n'
      + 'よろしいですか？'
    )) return;
    setBusyId(uid);
    setError(null);
    try {
      await update(ref(db, `users/${uid}`), { hidden: true, name: null });
    } catch {
      setError('ランキングから外せませんでした。');
    }
    setBusyId(null);
  }

  async function unhideUser(uid) {
    setBusyId(uid);
    setError(null);
    try {
      await set(ref(db, `users/${uid}/hidden`), null);
    } catch {
      setError('ランキングに戻せませんでした。');
    }
    setBusyId(null);
  }

  function copyUid() {
    navigator.clipboard?.writeText(user.uid).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
      () => {}
    );
  }

  const pending = items.filter(i => i.status !== 'approved');
  const approved = items.filter(i => i.status === 'approved');
  const list = tab === 'pending' ? pending : approved;
  // 名前を付けた人だけでなく、ポイントを持つ人も対象にする
  // （名前が無い人もランキングには載るため、そこから外せる必要がある）
  const manageableUsers = users.filter(u => u.points > 0 || (u.name && u.name.trim()) || u.hidden);

  return (
    <div className="admin-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-box">
        <div className="admin-header">
          <div className="admin-title">🔑 管理画面</div>
          <button className="admin-close" onClick={onClose}>✕</button>
        </div>

        {checking ? (
          <div className="admin-empty">確認中…</div>
        ) : !user ? (
          <div className="admin-login">
            <p className="admin-login-text">
              投稿を承認・削除するには、管理者としてログインしてください。
            </p>
            <button className="admin-login-btn" onClick={handleLogin}>
              Googleでログイン
            </button>
            {error && <div className="admin-error">{error}</div>}
          </div>
        ) : (
          <>
            {/* 端末ごとに別アカウントでログインしてしまうことがあるため、
                どのアカウントか分かるようメールアドレスも出す */}
            <div className="admin-user">
              <span className="admin-account">
                {user.displayName && <strong>{user.displayName}</strong>}
                {user.email && <span className="admin-email">{user.email}</span>}
              </span>
              <button className="admin-logout" onClick={() => signOut(auth)}>ログアウト</button>
            </div>

            <div className="admin-uid">
              あなたのID：<code>{user.uid}</code>
              <button className="admin-copy" onClick={copyUid}>
                {copied ? '✓ コピーしました' : 'コピー'}
              </button>
            </div>

            <div className="admin-tabs">
              <button
                className={`admin-tab ${tab === 'pending' ? 'active' : ''}`}
                onClick={() => setTab('pending')}
              >
                公開待ち {pending.length}
              </button>
              <button
                className={`admin-tab ${tab === 'approved' ? 'active' : ''}`}
                onClick={() => setTab('approved')}
              >
                公開中 {approved.length}
              </button>
              <button
                className={`admin-tab ${tab === 'users' ? 'active' : ''}`}
                onClick={() => setTab('users')}
              >
                利用者 {manageableUsers.length}
              </button>
            </div>

            {error && <div className="admin-error">{error}</div>}

            {tab === 'users' ? (
              <div className="admin-list">
                {manageableUsers.length === 0 && (
                  <div className="admin-empty">まだ利用者がいません。</div>
                )}
                {manageableUsers.map(u => {
                  const busy = busyId === u.id;
                  return (
                    <div key={u.id} className="admin-user-row">
                      <div className="admin-user-body">
                        <div className="admin-user-name">
                          {u.name || <span className="admin-user-noname">（名前なし）</span>}
                          {u.hidden && <span className="admin-user-hidden">非表示</span>}
                        </div>
                        <div className="admin-user-id">{u.points}pt ・ {u.id}</div>
                      </div>
                      <div className="admin-user-actions">
                        {u.name && (
                          <button
                            className="admin-user-btn"
                            disabled={busy}
                            onClick={() => resetName(u.id, u.name)}
                          >
                            {busy ? '…' : '名前をリセット'}
                          </button>
                        )}
                        {u.hidden ? (
                          <button
                            className="admin-user-btn"
                            disabled={busy}
                            onClick={() => unhideUser(u.id)}
                          >
                            {busy ? '…' : 'ランキングに戻す'}
                          </button>
                        ) : (
                          <button
                            className="admin-delete"
                            disabled={busy}
                            onClick={() => hideUser(u.id, u.name)}
                          >
                            {busy ? '…' : 'ランキングから外す'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
            <div className="admin-list">
              {list.length === 0 && (
                <div className="admin-empty">
                  {tab === 'pending' ? '公開待ちの投稿はありません。' : '公開中の投稿はありません。'}
                </div>
              )}

              {list.map(item => {
                const typeInfo = GREEN_TYPES[item.type] || {};
                const busy = busyId === item.id;
                return (
                  <div key={item.id} className="admin-item">
                    {item.photo && <img src={item.photo} alt={item.name} className="admin-photo" />}
                    <div className="admin-item-body">
                      <div className="admin-item-name">
                        {typeInfo.emoji} {item.name}
                      </div>
                      <div className="admin-item-meta">📍 {item.location?.address}</div>
                      {item.description && (
                        <div className="admin-item-desc">{item.description}</div>
                      )}
                      {/* 観察記録。不適切なものはここから個別に消せる */}
                      {Object.entries(item.observations || {}).length > 0 && (
                        <div className="admin-obs-list">
                          {Object.entries(item.observations).map(([obsId, o]) => (
                            <div key={obsId} className="admin-obs-row">
                              <span className="admin-obs-text">{o.text}</span>
                              <button
                                className="admin-obs-delete"
                                disabled={busyId === obsId}
                                onClick={() => deleteObs(item.id, obsId, o.text)}
                              >
                                {busyId === obsId ? '…' : '削除'}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="admin-actions">
                        {tab === 'pending' ? (
                          <button
                            className="admin-approve"
                            disabled={busy}
                            onClick={() => changeStatus(item.id, 'approved')}
                          >
                            {busy ? '…' : '✅ 公開する'}
                          </button>
                        ) : (
                          <button
                            className="admin-unapprove"
                            disabled={busy}
                            onClick={() => changeStatus(item.id, 'pending')}
                          >
                            {busy ? '…' : '↩ 公開を取り消す'}
                          </button>
                        )}
                        <button
                          className="admin-delete"
                          disabled={busy}
                          onClick={() => handleDelete(item.id, item.name)}
                        >
                          🗑 削除
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
