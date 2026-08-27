import { useEffect, useState } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { ref, update, remove } from 'firebase/database';
import { db, auth, googleProvider } from '../firebase';
import { GREEN_TYPES } from '../data/greenItems';

// 承認・削除ができるのはデータベースのルールで許可された人だけ。
// この画面を開けても、権限が無ければ操作は拒否される。
export default function AdminPanel({ items, onClose }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('pending'); // 'pending' | 'approved'
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

  function copyUid() {
    navigator.clipboard?.writeText(user.uid).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
      () => {}
    );
  }

  const pending = items.filter(i => i.status !== 'approved');
  const approved = items.filter(i => i.status === 'approved');
  const list = tab === 'pending' ? pending : approved;

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
            </div>

            {error && <div className="admin-error">{error}</div>}

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
          </>
        )}
      </div>
    </div>
  );
}
