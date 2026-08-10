import { useEffect, useState } from 'react';
import './App.css';
import GreenMap from './components/GreenMap';
import DetailPanel from './components/DetailPanel';
import RankingPanel from './components/RankingPanel';
import AddGreenForm from './components/AddGreenForm';
import { initialGreenItems, GREEN_TYPES, CURRENT_USER } from './data/greenItems';
import { loadItems, loadPoints, saveItems, savePoints } from './storage';

const VIEWS = { map: '地図', ranking: 'ランキング' };
const FILTERS = [
  { key: 'all', label: 'すべて' },
  { key: 'tree', label: '🌳 木' },
  { key: 'flower', label: '🌸 花' },
  { key: 'rain_garden', label: '🌿 雨庭' },
  { key: 'needs_care', label: '⚠️ 要ケア' },
];

const CONDITION_LABELS = { healthy: '健全', needs_care: '要ケア', poor: '不良' };

// 既存データの続き番号を振る（リロード後もIDが重複しないように）
function generateId(type, existing) {
  const prefix = type === 'tree' ? 'T' : type === 'flower' ? 'F' : 'R';
  const max = existing
    .filter(i => typeof i.id === 'string' && i.id.startsWith(`${prefix}-`))
    .map(i => parseInt(i.id.slice(prefix.length + 1), 10))
    .filter(n => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

export default function App() {
  const [items, setItems] = useState(() => loadItems(initialGreenItems));
  const [myPoints, setMyPoints] = useState(() => loadPoints());
  const [storageFull, setStorageFull] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeView, setActiveView] = useState('map');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [mobileTab, setMobileTab] = useState('map'); // 'map' | 'list' | 'ranking'

  const MY_ID = CURRENT_USER.id;

  useEffect(() => {
    savePoints(myPoints);
  }, [myPoints]);

  // 緑地の更新は必ずここを通す。state更新と同時に端末へ保存する。
  // （サーバーがないため、データはこの端末にのみ残る）
  function commitItems(next) {
    setItems(next);
    setStorageFull(!saveItems(next));
  }

  // ランキングに出すのは実際に使った人だけ。今はサーバーがないので自分ひとり。
  const users = myPoints > 0 || items.length > 0
    ? [{ ...CURRENT_USER, points: myPoints }]
    : [];

  const filteredItems = items.filter(item => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'needs_care') return item.condition === 'needs_care' || item.condition === 'poor';
    return item.type === activeFilter;
  });

  function handleSelectItem(item) {
    setSelectedItem(item);
    setShowDetail(true);
    setActiveView('map');
    setMobileTab('map');
  }

  function handleBack() {
    setShowDetail(false);
    setSelectedItem(null);
  }

  function handleSupport(itemId) {
    const target = items.find(i => i.id === itemId);
    if (!target) return;
    const alreadySupported = target.supporters.includes(MY_ID);

    const next = items.map(item =>
      item.id !== itemId ? item : {
        ...item,
        supporters: alreadySupported
          ? item.supporters.filter(id => id !== MY_ID)
          : [...item.supporters, MY_ID],
      }
    );
    commitItems(next);
    if (!alreadySupported) setMyPoints(p => p + 5);
    setSelectedItem(prev => (prev && prev.id === itemId ? next.find(i => i.id === itemId) : prev));
  }

  function handleAddObservation(itemId, text) {
    const newObs = {
      id: `obs-${Date.now()}`,
      userId: MY_ID,
      userName: 'あなた',
      date: new Date().toISOString().slice(0, 10),
      text,
      photo: null,
    };
    const next = items.map(item =>
      item.id === itemId
        ? { ...item, observations: [...item.observations, newObs] }
        : item
    );
    commitItems(next);
    setSelectedItem(prev => (prev && prev.id === itemId ? next.find(i => i.id === itemId) : prev));
    setMyPoints(p => p + 10);
  }

  function handleAddGreen(data) {
    const newItem = {
      ...data,
      id: generateId(data.type, items),
      moisture: 60,
    };
    commitItems([...items, newItem]);
    setMyPoints(p => p + 30);
    setShowAddForm(false);
    setSelectedItem(newItem);
    setShowDetail(true);
    setActiveView('map');
  }

  function handleDeleteGreen(itemId) {
    commitItems(items.filter(item => item.id !== itemId));
    setShowDetail(false);
    setSelectedItem(null);
  }

  const totalSupporters = items.reduce((sum, i) => sum + i.supporters.length, 0);
  const totalObs = items.reduce((sum, i) => sum + i.observations.length, 0);
  const needsCareCount = items.filter(i => i.condition === 'needs_care' || i.condition === 'poor').length;

  return (
    <div className="app">
      <header className="header">
        <div className="header-logo">
          <span className="emoji">🌿</span>
          庭心
        </div>
        <nav className="header-nav">
          {Object.entries(VIEWS).map(([key, label]) => (
            <button
              key={key}
              className={`nav-btn ${activeView === key && !showDetail ? 'active' : ''}`}
              onClick={() => { setActiveView(key); setShowDetail(false); }}
            >
              {key === 'map' ? '🗺️' : '🏆'} {label}
            </button>
          ))}
        </nav>
        <div className="header-user">
          <span>👤 あなた</span>
          <span className="user-points">{myPoints}pt</span>
        </div>
      </header>

      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-num">{items.length}</span>
          <span>件の緑地</span>
        </div>
        <div className="stat-item">
          <span className="stat-num">{totalSupporters}</span>
          <span>件の推し登録</span>
        </div>
        <div className="stat-item">
          <span className="stat-num">{totalObs}</span>
          <span>件の観察記録</span>
        </div>
        <div className="stat-item" style={{ color: needsCareCount > 0 ? '#f4a261' : 'inherit' }}>
          <span className="stat-num">{needsCareCount}</span>
          <span>件 要ケア</span>
        </div>
      </div>

      {storageFull && (
        <div className="storage-warning">
          ⚠️ 端末の保存容量がいっぱいで、最新の変更を保存できませんでした。
          写真の少ない登録にするか、不要な記録を削除してください。
        </div>
      )}

      <div className={`main ${mobileTab === 'list' || mobileTab === 'ranking' ? 'list-mode' : ''}`}>
        {(activeView === 'map' || mobileTab === 'map') && (
          <GreenMap
            items={filteredItems}
            selectedItem={selectedItem}
            onSelectItem={handleSelectItem}
          />
        )}

        <div className={`sidebar ${mobileTab === 'list' || mobileTab === 'ranking' ? 'mobile-visible' : ''}`}>
          {activeView === 'ranking' && !showDetail ? (
            <RankingPanel
              items={items}
              users={users}
              onSelectItem={handleSelectItem}
            />
          ) : showDetail && selectedItem ? (
            <DetailPanel
              item={selectedItem}
              currentUserId={MY_ID}
              onBack={handleBack}
              onSupport={handleSupport}
              onAddObservation={handleAddObservation}
              onDelete={handleDeleteGreen}
            />
          ) : (
            <>
              <div className="sidebar-header">
                <div className="sidebar-title">緑地一覧</div>
                <div className="filter-row">
                  {FILTERS.map(f => (
                    <button
                      key={f.key}
                      className={`filter-btn ${activeFilter === f.key ? 'active' : ''}`}
                      onClick={() => setActiveFilter(f.key)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sidebar-list">
                {items.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-emoji">🌱</div>
                    <div className="empty-title">まだ登録がありません</div>
                    <div className="empty-text">
                      近くの木や花を見つけたら、右下の「＋」から登録してみましょう。
                      写真を撮って地図をタップするだけで記録できます。
                    </div>
                    <button className="empty-cta" onClick={() => setShowAddForm(true)}>
                      🌱 最初の緑地を登録する
                    </button>
                  </div>
                )}
                {items.length > 0 && filteredItems.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-text">この条件に合う緑地はまだありません。</div>
                  </div>
                )}
                {filteredItems.map(item => {
                  const typeInfo = GREEN_TYPES[item.type];
                  return (
                    <div
                      key={item.id}
                      className={`green-card ${selectedItem?.id === item.id ? 'selected' : ''}`}
                      onClick={() => handleSelectItem(item)}
                    >
                      <div className="card-header">
                        <span className="card-id">{item.id}</span>
                        <span
                          className="card-type-badge"
                          style={{ background: typeInfo.color + '22', color: typeInfo.color }}
                        >
                          {typeInfo.emoji} {typeInfo.label}
                        </span>
                      </div>
                      <div className="card-name">{item.name}</div>
                      <div className="card-address">📍 {item.location.address}</div>
                      <div className="card-footer">
                        <span className={`condition-badge condition-${item.condition}`}>
                          {CONDITION_LABELS[item.condition]}
                        </span>
                        <span className="supporter-count">
                          💚 {item.supporters.length}人が推し
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {(activeView === 'map' && mobileTab === 'map') && (
        <button className="fab" onClick={() => setShowAddForm(true)} title="新しい緑地を登録">
          +
        </button>
      )}

      {/* モバイル用タブバー */}
      <nav className="mobile-tab-bar">
        <button className={`mobile-tab-btn ${mobileTab === 'map' ? 'active' : ''}`} onClick={() => { setMobileTab('map'); setActiveView('map'); }}>
          <span className="tab-icon">🗺️</span>地図
        </button>
        <button className={`mobile-tab-btn ${mobileTab === 'map' ? 'active' : ''}`} onClick={() => setShowAddForm(true)}>
          <span className="tab-icon">➕</span>登録
        </button>
        <button className={`mobile-tab-btn ${mobileTab === 'list' ? 'active' : ''}`} onClick={() => { setMobileTab('list'); setActiveView('map'); }}>
          <span className="tab-icon">🌿</span>一覧
        </button>
        <button className={`mobile-tab-btn ${mobileTab === 'ranking' ? 'active' : ''}`} onClick={() => { setMobileTab('ranking'); setActiveView('ranking'); }}>
          <span className="tab-icon">🏆</span>ランキング
        </button>
      </nav>

      {showAddForm && (
        <AddGreenForm
          onAdd={handleAddGreen}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
}
