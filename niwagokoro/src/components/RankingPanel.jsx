import { GREEN_TYPES } from '../data/greenItems';

export default function RankingPanel({ items, users, onSelectItem }) {
  const sortedBySupport = [...items].sort((a, b) => b.supporters.length - a.supporters.length);
  const sortedUsers = [...users].sort((a, b) => b.points - a.points);

  function getRankClass(i) {
    if (i === 0) return 'rank-1';
    if (i === 1) return 'rank-2';
    if (i === 2) return 'rank-3';
    return 'rank-other';
  }

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
        <div className="points-guide">
          <div className="points-guide-title">📌 ポイントの獲得方法</div>
          <div>📝 観察を記録する … +10pt</div>
          <div>💚 推し登録する … +5pt</div>
          <div>🌱 新しい緑地を登録する … +30pt</div>
        </div>
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
            <div style={{ flex: 1 }}>
              <div className="ranking-item-name">{typeInfo.emoji} {item.name}</div>
              <div className="ranking-item-sub">{item.id} · {item.location.address}</div>
            </div>
            <div>
              <div className="ranking-item-value">{item.supporters.length}</div>
              <div style={{ fontSize: '0.65rem', color: '#ccc', textAlign: 'right' }}>推し</div>
            </div>
          </div>
        );
      })}

      <div className="ranking-section-title" style={{ marginTop: '1.5rem' }}>
        🏆 市民ポイント ランキング
      </div>
      {sortedUsers.map((user, i) => (
        <div key={user.id} className="user-ranking-item">
          <div className={`rank-badge ${getRankClass(i)}`}>{i + 1}</div>
          <div className="user-avatar">{user.avatar}</div>
          <div className="user-name">{user.name}</div>
          <div>
            <span className="user-points-value">{user.points}</span>
            <span className="points-label">pt</span>
          </div>
        </div>
      ))}

      <div className="points-guide">
        <div className="points-guide-title">📌 ポイントの獲得方法</div>
        <div>📝 観察を記録する … +10pt</div>
        <div>💚 推し登録する … +5pt</div>
        <div>🌱 新しい緑地を登録する … +30pt</div>
      </div>
    </div>
  );
}
