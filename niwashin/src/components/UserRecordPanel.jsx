import { GREEN_TYPES } from '../data/greenItems';

// ある利用者の「登録した緑地」と「推し」をまとめて見せる画面。
//
// 【公開の考え方】
// 緑地そのもの（写真・住所）は元から誰でも見られる。危ないのは、それが
// 特定の人に紐づいて一覧になること。登録した場所が数件集まると、その人の
// 生活圏が推測できてしまう（最初に登録する木は自宅付近になりやすい）。
// そのため他人の記録は、本人が「公開する」を選んだときだけ表示する。
// 自分の記録はいつでも見られる（自分にしか見えないため危険がない）。
export default function UserRecordPanel({
  user,          // { id, name, points, isMe }
  registered,    // その人が登録した緑地
  supported,     // その人が推した緑地
  isPublic,      // 本人が公開を選んでいるか
  onSelectItem,
  onBack,
}) {
  const visible = user.isMe || isPublic;

  function renderList(list, emptyText) {
    if (list.length === 0) {
      return <div className="user-record-empty">{emptyText}</div>;
    }
    return list.map(item => {
      const typeInfo = GREEN_TYPES[item.type] || {};
      return (
        <div key={item.id} className="ranking-item" onClick={() => onSelectItem(item)}>
          {item.photo
            ? <img src={item.photo} alt="" className="ranking-thumb" loading="lazy" />
            : <div className="ranking-thumb ranking-thumb-empty">{typeInfo.emoji}</div>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ranking-item-name">{typeInfo.emoji} {item.name}</div>
            <div className="ranking-item-sub">{item.code || ''} {item.location?.address}</div>
          </div>
          {item.isMinePending && <span className="user-record-pending">公開待ち</span>}
        </div>
      );
    });
  }

  return (
    <div className="ranking-view">
      <button className="user-record-back" onClick={onBack}>← ランキングに戻る</button>

      <div className="user-record-head">
        <div className="user-record-name">
          {user.name}
          {user.isMe && <span className="admin-user-me">自分</span>}
        </div>
        <div className="user-record-points">{user.points}pt</div>
      </div>

      {!visible ? (
        // 「データが無い」ではなく「公開していない」だと分かるように書く。
        // 非公開は初期状態であって、その人が何もしていないという意味ではない。
        <div className="my-ranking-note">
          <div className="my-ranking-note-title">🔒 記録は公開されていません</div>
          <div className="my-ranking-note-text">
            この人は、登録した緑地や推しの一覧を公開していません。
            公開するかどうかは本人が選べます。
          </div>
        </div>
      ) : (
        <>
          <div className="ranking-section-title">🌱 登録した緑地（{registered.length}）</div>
          {renderList(registered, 'まだ登録した緑地はありません。')}

          <div className="ranking-section-title" style={{ marginTop: '1.5rem' }}>
            💚 推し（{supported.length}）
          </div>
          {renderList(supported, 'まだ推した緑地はありません。')}

          {user.isMe && (
            <div className="user-record-note">
              この画面は、公開していなければ自分にしか見えません。
            </div>
          )}
        </>
      )}
    </div>
  );
}
