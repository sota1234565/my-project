import { useState } from 'react';
import { GREEN_TYPES } from '../data/greenItems';
import { hasNgWord } from '../moderation';

const NAME_MAX = 20;

export default function RankingPanel({
  items,
  users,
  currentUserId,
  myPoints = 0,
  // 'no-points'（まだポイントが無い）/ 'opted-out'（自分で参加を取り消した）/ 'listed'
  myRankingState = 'no-points',
  myPublicProfile = false,
  onSelectItem,
  onSelectUser,
  onSetName,
  onLeaveRanking,
  onRejoinRanking,
  onSetPublicProfile,
}) {
  const sortedBySupport = [...items].sort((a, b) => b.supporters.length - a.supporters.length);
  const sortedUsers = [...users].sort((a, b) => b.points - a.points);

  // ニックネームの編集（自分の行だけ）
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [nameError, setNameError] = useState(null);

  function startEdit(currentName) {
    setDraft(currentName === 'あなた' ? '' : currentName);
    setNameError(null);
    setEditing(true);
  }

  function submitName(e) {
    e.preventDefault();
    // 下ネタ・悪口はここで止める（サーバー側のルールでも同じ基準で弾かれる）
    if (hasNgWord(draft)) {
      setNameError('その名前は使えません。別の名前にしてください。');
      return;
    }
    onSetName(draft);
    setEditing(false);
  }

  function handleLeave() {
    const ok = window.confirm(
      'ランキングに自分を載せないようにします。\n\n'
      + '・設定した名前は消えます\n'
      + '・登録した緑地や観察記録は消えません\n'
      + '・あとからいつでも戻せます\n\n'
      + 'よろしいですか？'
    );
    if (ok) onLeaveRanking?.();
  }

  function handleTogglePublic() {
    if (myPublicProfile) {
      onSetPublicProfile?.(false);
      return;
    }
    const ok = window.confirm(
      '自分が登録した緑地と推しの一覧を、ほかの人も見られるようにします。\n\n'
      + '【注意】登録した場所がまとまって見えるため、\n'
      + '自宅の近くの木ばかり登録している場合は、\n'
      + '住んでいるあたりが分かってしまうことがあります。\n\n'
      + 'いつでも非公開に戻せます。公開しますか？'
    );
    if (ok) onSetPublicProfile?.(true);
  }

  function getRankClass(i) {
    if (i === 0) return 'rank-1';
    if (i === 1) return 'rank-2';
    if (i === 2) return 'rank-3';
    return 'rank-other';
  }

  const guide = (
    <div className="points-guide">
      <div className="points-guide-title">📌 ポイントの獲得方法</div>
      <div>📝 観察を記録する … +10pt</div>
      <div>💚 推し登録する … +5pt</div>
      <div>🌱 新しい緑地を登録する … +30pt</div>
    </div>
  );

  if (items.length === 0) {
    return (
      <div className="ranking-view">
        <div className="empty-state">
          <div className="empty-emoji">🏆</div>
          <div className="empty-title">まだ記録がありません</div>
          <div className="empty-text">
            緑地を登録したり、観察を記録するとポイントがたまり、ここに順位が表示されます。
          </div>
        </div>
        {guide}
      </div>
    );
  }

  return (
    <div className="ranking-view">
      <div className="ranking-section-title">💚 推しの木・花・雨庭 ランキング</div>
      {sortedBySupport.map((item, i) => {
        const typeInfo = GREEN_TYPES[item.type];
        return (
          <div key={item.id} className="ranking-item" onClick={() => onSelectItem(item)}>
            <div className={`rank-badge ${getRankClass(i)}`}>{i + 1}</div>
            {item.photo
              ? <img src={item.photo} alt="" className="ranking-thumb" loading="lazy" />
              : <div className="ranking-thumb ranking-thumb-empty">{typeInfo.emoji}</div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ranking-item-name">{typeInfo.emoji} {item.name}</div>
              {/* 生のデータベースキーではなく、表示用のコードを出す */}
              <div className="ranking-item-sub">{item.code || ''} {item.location.address}</div>
            </div>
            <div className="ranking-value-wrap">
              <div className="ranking-item-value">{item.supporters.length}</div>
              <div className="ranking-value-label">推し</div>
            </div>
          </div>
        );
      })}

      <div className="ranking-section-title" style={{ marginTop: '1.5rem' }}>
        🏆 市民ポイント ランキング
      </div>
      {sortedUsers.length === 0 && (
        <div className="empty-text" style={{ padding: '0.5rem 0 1rem' }}>
          まだポイントを持っている人がいません。
        </div>
      )}
      {sortedUsers.length > 0 && (
        <div className="ranking-note-inline">
          ポイントを持っている人だけが表示されます。タップすると、その人の記録を見られます。
        </div>
      )}
      {sortedUsers.map((user, i) => {
        const isMe = user.id === currentUserId;
        return (
          <div
            key={user.id}
            className={`user-ranking-item ${isMe ? 'is-me' : ''} tappable`}
            onClick={() => onSelectUser?.(user)}
          >
            <div className={`rank-badge ${getRankClass(i)}`}>{i + 1}</div>
            <div className="user-avatar">{user.avatar}</div>
            <div className="user-name-wrap">
              {isMe && editing ? (
                <form className="name-edit" onSubmit={submitName} onClick={e => e.stopPropagation()}>
                  <input
                    className="name-edit-input"
                    value={draft}
                    maxLength={NAME_MAX}
                    placeholder="ニックネーム（20文字まで）"
                    autoFocus
                    onChange={e => { setDraft(e.target.value); setNameError(null); }}
                  />
                  {nameError && <div className="name-edit-error">{nameError}</div>}
                  <button type="submit" className="name-edit-save">保存</button>
                  <button type="button" className="name-edit-cancel" onClick={() => setEditing(false)}>
                    やめる
                  </button>
                </form>
              ) : (
                <>
                  <div className="user-name">{user.name}</div>
                  {/* 行そのものが記録へのリンクなので、中のボタンは伝播を止める */}
                  {isMe && (
                    <div className="my-row-actions" onClick={e => e.stopPropagation()}>
                      <button type="button" className="name-edit-btn" onClick={() => startEdit(user.name)}>
                        ✏️ 名前を設定
                      </button>
                      {/* 自分の記録を他の人にも見せるかどうか。既定は非公開。 */}
                      <button
                        type="button"
                        className={`public-toggle-btn ${myPublicProfile ? 'on' : ''}`}
                        onClick={handleTogglePublic}
                      >
                        {myPublicProfile ? '🔓 記録を公開中' : '🔒 記録は非公開'}
                      </button>
                      {/* 間違えて名前を付けた人や、載りたくない人のための出口。
                          登録した緑地や観察記録は消えない。 */}
                      <button type="button" className="leave-ranking-btn" onClick={handleLeave}>
                        ランキングに載せない
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            <div>
              <span className="user-points-value">{user.points}</span>
              <span className="points-label">pt</span>
            </div>
          </div>
        );
      })}

      {/* 自分がランキングに出ていないときだけ、その理由と次にできることを出す。
          黙って消えていると「バグ？」と思われるため、必ず理由を書く。 */}
      {myRankingState === 'no-points' && (
        <div className="my-ranking-note">
          <div className="my-ranking-note-title">🌱 まだランキングに載っていません</div>
          <div className="my-ranking-note-text">
            緑地の登録・推し・観察の記録でポイントがたまると、ここに載り、
            ニックネームを設定できるようになります。
          </div>
        </div>
      )}

      {myRankingState === 'opted-out' && (
        <div className="my-ranking-note">
          <div className="my-ranking-note-title">🙈 ランキングに載せない設定です</div>
          <div className="my-ranking-note-text">
            いまあなた（{myPoints}pt）はランキングに表示されていません。
            登録した緑地や観察記録はそのまま残っています。
          </div>
          <button type="button" className="rejoin-ranking-btn" onClick={() => onRejoinRanking?.()}>
            ランキングに戻る
          </button>
        </div>
      )}

      {guide}
    </div>
  );
}
