import { useState } from 'react';
import './App.css';
import GreenMap from './components/GreenMap';
import DetailPanel from './components/DetailPanel';
import RankingPanel from './components/RankingPanel';
import AddGreenForm from './components/AddGreenForm';
import { initialGreenItems, initialUsers, GREEN_TYPES, CURRENT_USER } from './data/greenItems';

const VIEWS = { map: '地図', ranking: 'ランキング' };
const FILTERS = [
  { key: 'all', label: 'すべて' },
  { key: 'tree', label: '🌳 木' },
  { key: 'flower', label: '🌸 花' },
  { key: 'rain_garden', label: '🌿 雨庭' },
  { key: 'needs_care', label: '⚠️ 要ケア' },
];

const CONDITION_LABELS = { healthy: '健全', needs_care: '要ケア', poor: '不良' };

let idCounter = 100;
function generateId(type) {
  const prefix = type === 'tree' ? 'T' : type === 'flower' ? 'F' : 'R';
  idCounter++;
  return `${prefix}-${String(idCounter).padStart(3, '0')}`;
}

export default function App() {
  const [items, setItems] = useState(initialGreenItems);
  const [users, setUsers] = useState(initialUsers);
  const [myPoints, setMyPoints] = useState(0);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeView, setActiveView] = useState('map');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const MY_ID = CURRENT_USER.id;

  const filteredItems = items.filter(item => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'needs_care') return item.condition === 'needs_care' || item.condition === 'poor';
    return item.type === activeFilter;
  });

  function handleSelectItem(item) {
    setSelectedItem(item);
    setShowDetail(true);
    setActiveView('map');
  }

  function handleBack() {
    setShowDetail(false);
    setSelectedItem(null);
  }

  function handleSupport(itemId) {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const alreadySupported = item.supporters.includes(MY_ID);
      if (alreadySupported) {
        return { ...item, supporters: item.supporters.filter(id => id !== MY_ID) };
      } else {
        setMyPoints(p => p + 5);
        return { ...item, supporters: [...item.supporters, MY_ID] };
      }
    }));
    setSelectedItem(prev => {
      if (!prev || prev.id !== itemId) return prev;
      const alreadySupported = prev.supporters.includes(MY_ID);
      if (alreadySupported) {
        return { ...prev, supporters: prev.supporters.filter(id => id !== MY_ID) };
      } else {
        return { ...prev, supporters: [...prev.supporters, MY_ID] };
      }
    });
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
    setItems(prev => prev.map(item =>
      item.id === itemId
        ? { ...item, observations: [...item.observations, newObs] }
        : item
    ));
    setSelectedItem(prev =>
      prev && prev.id === itemId
        ? { ...prev, observations: [...prev.observations, newObs] }
        : prev
    );
    setMyPoints(p => p + 10);
  }

  function handleAddGreen(data) {
    const newItem = {
      ...data,
      id: generateId(data.type),
      moisture: 60,
    };
    setItems(prev => [...prev, newItem]);
    setMyPoints(p => p + 30);
    setShowAddForm(false);
    setSelectedItem(newItem);
    setShowDetail(true);
    setActiveView('map');
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

      <div className="main">
        {activeView === 'map' && (
          <GreenMap
            items={filteredItems}
            selectedItem={selectedItem}
            onSelectItem={handleSelectItem}
          />
        )}

        <div className="sidebar">
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

      {activeView === 'map' && (
        <button className="fab" onClick={() => setShowAddForm(true)} title="新しい緑地を登録">
          +
        </button>
      )}

      {showAddForm && (
        <AddGreenForm
          onAdd={handleAddGreen}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
}
