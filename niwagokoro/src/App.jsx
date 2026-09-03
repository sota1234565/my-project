import { useEffect, useRef, useState } from 'react';
import { ref, onValue, push, set } from 'firebase/database';
import './App.css';
import GreenMap from './components/GreenMap';
import DetailPanel from './components/DetailPanel';
import RankingPanel from './components/RankingPanel';
import AddGreenForm from './components/AddGreenForm';
import AdminPanel from './components/AdminPanel';
import LeafMark from './components/LeafMark';
import { GREEN_TYPES, CURRENT_USER } from './data/greenItems';
import { db } from './firebase';
import { getDeviceId } from './deviceId';
import {
  loadPoints, savePoints,
  loadSupports, saveSupports,
  loadMyObs, saveMyObs,
  clearLocalData,
} from './localData';

const VIEWS = { map: '地図', ranking: 'ランキング' };
const FILTERS = [
  { key: 'all', label: 'すべて' },
  { key: 'tree', label: '🌳 木' },
  { key: 'flower', label: '🌸 花' },
  { key: 'rain_garden', label: '🌿 雨庭' },
  { key: 'needs_care', label: '⚠️ 要ケア' },
];

const CONDITION_LABELS = { healthy: '健全', needs_care: '要ケア', poor: '不良' };

// ?reset 付きURLで開いたら、この端末のローカル記録（ポイント・推し・観察）を
// 消してから通常URLに戻す。テストデータを初期状態に戻すための入口。
// 共有データ（Firebase上の緑地）には触れない。
if (new URLSearchParams(window.location.search).has('reset')) {
  clearLocalData();
  window.location.replace(window.location.pathname);
}

const deviceId = getDeviceId();
const MY_ID = CURRENT_USER.id;

// 表示用の見た目だけのラベル（本当のIDはFirebaseが振るキー）
function generateCode(type) {
  const prefix = type === 'tree' ? 'T' : type === 'flower' ? 'F' : 'R';
  return `${prefix}-${Date.now().toString().slice(-4)}`;
}

export default function App() {
  const [allItems, setAllItems] = useState([]);   // Firebaseから来る全データ
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [myPoints, setMyPoints] = useState(() => loadPoints());
  const [supports, setSupports] = useState(() => loadSupports()); // { itemId: true }
  const [myObs, setMyObs] = useState(() => loadMyObs());          // { itemId: [obs] }
  const [selectedId, setSelectedId] = useState(null);
  const [activeView, setActiveView] = useState('map');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [mobileTab, setMobileTab] = useState('map'); // 'map' | 'list' | 'ranking'
  // 管理画面は ?admin 付きURL、またはロゴの5回連続タップで開く。
  // 一般の利用者には入口が見えないが、安全を守っているのはこの隠し方ではなく
  // データベース側のルール（管理者のIDだけが承認・削除できる）である。
  const [showAdmin, setShowAdmin] = useState(
    () => new URLSearchParams(window.location.search).has('admin')
  );
  const logoTapRef = useRef({ count: 0, timer: null });

  function handleLogoTap() {
    const s = logoTapRef.current;
    clearTimeout(s.timer);
    s.count += 1;
    if (s.count >= 5) {
      s.count = 0;
      setShowAdmin(true);
      return;
    }
    // 間が空いたら数え直す
    s.timer = setTimeout(() => { s.count = 0; }, 1500);
  }

  // 共有データベースを購読（誰かが登録・承認すると自動で反映される）
  useEffect(() => {
    const itemsRef = ref(db, 'greenItems');
    const unsub = onValue(itemsRef, (snap) => {
      const val = snap.val() || {};
      const arr = Object.entries(val).map(([id, v]) => ({ id, ...v }));
      arr.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setAllItems(arr);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  useEffect(() => { savePoints(myPoints); }, [myPoints]);

  // 表示するのは「承認済み」＋「自分が登録した承認待ち」。
  // 推し・観察は各自の端末の記録を重ねる。
  const items = allItems
    .filter(it => it.status === 'approved' || it.authorId === deviceId)
    .map(it => ({
      ...it,
      condition: it.condition || 'healthy',
      tags: it.tags || [],
      // 写真は複数対応。古いデータ（photo単数）も配列に揃える。photo は表示用の「顔」。
      photos: Array.isArray(it.photos) ? it.photos : (it.photo ? [it.photo] : []),
      photo: it.photo || (Array.isArray(it.photos) ? it.photos[0] : null) || null,
      supporters: supports[it.id] ? [MY_ID] : [],
      observations: myObs[it.id] || [],
      isMinePending: it.status !== 'approved' && it.authorId === deviceId,
    }));

  const selectedItem = items.find(i => i.id === selectedId) || null;

  const users = myPoints > 0 || items.length > 0
    ? [{ ...CURRENT_USER, points: myPoints }]
    : [];

  const filteredItems = items.filter(item => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'needs_care') return item.condition === 'needs_care' || item.condition === 'poor';
    return item.type === activeFilter;
  });

  function handleSelectItem(item) {
    setSelectedId(item.id);
    setShowDetail(true);
    setActiveView('map');
    setMobileTab('map');
  }

  function handleBack() {
    setShowDetail(false);
    setSelectedId(null);
  }

  // 推しは自分の端末の記録として保存する
  function handleSupport(itemId) {
    const already = !!supports[itemId];
    const next = { ...supports };
    if (already) delete next[itemId];
    else next[itemId] = true;
    setSupports(next);
    saveSupports(next);
    if (!already) setMyPoints(p => p + 5);
  }

  // 観察記録も自分の端末に保存する
  function handleAddObservation(itemId, text) {
    const newObs = {
      id: `obs-${Date.now()}`,
      userId: MY_ID,
      userName: 'あなた',
      date: new Date().toISOString().slice(0, 10),
      text,
      photo: null,
    };
    const next = { ...myObs, [itemId]: [...(myObs[itemId] || []), newObs] };
    setMyObs(next);
    saveMyObs(next);
    setMyPoints(p => p + 10);
  }

  // 新しい緑地を共有データベースに登録する（承認待ちで入る）
  async function handleAddGreen(data) {
    const record = {
      code: generateCode(data.type),
      type: data.type,
      name: data.name,
      location: data.location,
      description: data.description ?? '',
      photo: data.photo ?? (data.photos?.[0] ?? null), // 表示用の「顔」
      photos: data.photos ?? (data.photo ? [data.photo] : []), // 全部（詳細ギャラリー用）
      scientificName: data.scientificName ?? null,
      // 名前が写真判定によるものかどうか。推定を事実と混同しないための記録。
      aiIdentified: data.aiIdentified ?? false,
      condition: 'healthy',
      authorId: deviceId,
      status: 'pending',
      createdAt: Date.now(),
    };
    const newRef = push(ref(db, 'greenItems'));
    try {
      await set(newRef, record);
      setSaveError(false);
      setMyPoints(p => p + 30);
      setShowAddForm(false);
      setSelectedId(newRef.key);
      setShowDetail(true);
      setActiveView('map');
      setMobileTab('map');
    } catch {
      setSaveError(true);
    }
  }

  const totalSupporters = items.reduce((sum, i) => sum + i.supporters.length, 0);
  const totalObs = items.reduce((sum, i) => sum + i.observations.length, 0);
  const pendingCount = items.filter(i => i.isMinePending).length;

  return (
    <div className="app">
      <header className="header">
        <h1 className="header-logo" onClick={handleLogoTap}>
          <LeafMark size={26} />
          庭心
        </h1>
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
        <div className="stat-item" style={{ color: pendingCount > 0 ? '#f4a261' : 'inherit' }}>
          <span className="stat-num">{pendingCount}</span>
          <span>件 公開待ち</span>
        </div>
      </div>

      {saveError && (
        <div className="storage-warning">
          ⚠️ 登録の送信に失敗しました。通信環境を確認して、もう一度お試しください。
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
                {loading && (
                  <div className="empty-state">
                    <div className="empty-text">読み込み中…</div>
                  </div>
                )}
                {!loading && items.length === 0 && (
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
                {!loading && items.length > 0 && filteredItems.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-text">この条件に合う緑地はまだありません。</div>
                  </div>
                )}
                {filteredItems.map(item => {
                  const typeInfo = GREEN_TYPES[item.type];
                  return (
                    <div
                      key={item.id}
                      className={`green-card ${selectedId === item.id ? 'selected' : ''}`}
                      onClick={() => handleSelectItem(item)}
                    >
                      <div className="card-header">
                        <span className="card-id">{item.code || ''}</span>
                        <span
                          className="card-type-badge"
                          style={{ background: typeInfo.color + '22', color: typeInfo.color }}
                        >
                          {typeInfo.emoji} {typeInfo.label}
                        </span>
                      </div>
                      <div className="card-name">{item.name}</div>
                      <div className="card-address">📍 {item.location.address}</div>
                      {item.isMinePending && (
                        <div className="pending-badge">🕓 公開待ち（今はあなたにだけ表示）</div>
                      )}
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

                {/* アプリの説明。初めて訪れた人への案内であり、
                    検索エンジンがページの内容を判断する材料にもなる。 */}
                <section className="about-section">
                  <h2 className="about-title">庭心（にわしん）について</h2>
                  <p className="about-text">
                    庭心は、神奈川県藤沢市の木・花・雨庭を、まちに暮らす人が写真と地図で記録し、
                    みんなで見守るためのアプリです。
                  </p>
                  <p className="about-text">
                    散歩の途中で気になった木や花を見つけたら、写真を撮って地図をタップするだけで登録できます。
                    住所は自動で入り、写真から植物の名前を調べることもできます。
                  </p>
                  <p className="about-text">
                    登録された緑地は地図上に並び、近くを通りかかった人が見られるようになります。
                    ふだん見過ごしている街路樹や小さな花壇に目を向けるきっかけになればと思って作りました。
                  </p>
                  <h2 className="about-title">できること</h2>
                  <ul className="about-list">
                    <li>木・花・雨庭を写真つきで地図に登録する</li>
                    <li>写真から植物の名前の候補を調べる</li>
                    <li>現在地を表示して、近くの緑地を探す</li>
                    <li>気に入った緑地を「推し」として記録する</li>
                    <li>観察したことを記録して残す</li>
                  </ul>
                </section>
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
        <button className="mobile-tab-btn" onClick={() => setShowAddForm(true)}>
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

      {showAdmin && (
        <AdminPanel
          items={allItems}
          onClose={() => setShowAdmin(false)}
        />
      )}
    </div>
  );
}
