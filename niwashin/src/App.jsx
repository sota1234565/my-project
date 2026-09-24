import { useEffect, useRef, useState } from 'react';
import { ref, onValue, push, set, update } from 'firebase/database';
import './App.css';
import GreenMap from './components/GreenMap';
import DetailPanel from './components/DetailPanel';
import RankingPanel from './components/RankingPanel';
import UserRecordPanel from './components/UserRecordPanel';
import AddGreenForm from './components/AddGreenForm';
import AdminPanel from './components/AdminPanel';
import LeafMark from './components/LeafMark';
import { GREEN_TYPES } from './data/greenItems';
import { db } from './firebase';
import { getDeviceId } from './deviceId';

const VIEWS = { map: '地図', ranking: 'ランキング' };
const FILTERS = [
  { key: 'all', label: 'すべて' },
  { key: 'tree', label: '🌳 木' },
  { key: 'flower', label: '🌸 花' },
  { key: 'rain_garden', label: '🌿 雨庭' },
  { key: 'needs_care', label: '⚠️ 要ケア' },
];

const CONDITION_LABELS = { healthy: '健全', needs_care: '要ケア', poor: '不良' };

// この端末の匿名ID。推し・観察記録・登録の「誰がやったか」はすべてこれで記録する。
const deviceId = getDeviceId();
const MY_ID = deviceId;

// ポイントの配点。保存はせず、Firebase上の実データから毎回計算する（ズルができない）。
const POINTS_PER_TREE = 30;
const POINTS_PER_SUPPORT = 5;
const POINTS_PER_OBS = 10;

// 表示名。ニックネームがあればそれを使う。無ければ自分は「あなた」、他人はIDの末尾で区別する。
function displayNameOf(id, names, selfId) {
  const n = names[id];
  if (typeof n === 'string' && n.trim()) return n.trim();
  if (id === selfId) return 'あなた';
  return `利用者 ${String(id).slice(-4)}`;
}

// 表示用の見た目だけのラベル（本当のIDはFirebaseが振るキー）
function generateCode(type) {
  const prefix = type === 'tree' ? 'T' : type === 'flower' ? 'F' : 'R';
  return `${prefix}-${Date.now().toString().slice(-4)}`;
}

export default function App() {
  const [allItems, setAllItems] = useState([]);   // Firebaseから来る全データ
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [names, setNames] = useState({});          // { deviceId: ニックネーム }（Firebaseから）
  const [hiddenUsers, setHiddenUsers] = useState({}); // { deviceId: true }＝ランキングに載らない人
  // { deviceId: true }＝「自分の記録を他の人にも見せる」を選んだ人。既定は非公開。
  const [publicProfiles, setPublicProfiles] = useState({});
  const [selectedUserId, setSelectedUserId] = useState(null); // 記録を表示している利用者
  const [selectedId, setSelectedId] = useState(null);
  const [routeTarget, setRouteTarget] = useState(null); // 経路を表示中の緑地（nullで非表示）
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

  // 利用者のニックネームを購読（ランキングや観察記録の表示名に使う）
  useEffect(() => {
    const unsub = onValue(ref(db, 'users'), (snap) => {
      const val = snap.val() || {};
      const map = {};
      const hidden = {};
      const open = {};
      for (const [id, v] of Object.entries(val)) {
        if (v && typeof v.name === 'string') map[id] = v.name;
        // 本人または管理者が「ランキングに載せない」を選んだ人
        if (v && v.hidden === true) hidden[id] = true;
        // 本人が明示的に選んだときだけ true。値が無い人は非公開として扱う。
        if (v && v.publicProfile === true) open[id] = true;
      }
      setNames(map);
      setHiddenUsers(hidden);
      setPublicProfiles(open);
    }, () => {});
    return () => unsub();
  }, []);

  const nameOf = (id) => displayNameOf(id, names, deviceId);

  // 表示するのは「承認済み」＋「自分が登録した承認待ち」。
  // 推し・観察記録はFirebase上の共有データなので、誰が見ても同じ数字になる。
  const items = allItems
    .filter(it => it.status === 'approved' || it.authorId === deviceId)
    .map(it => ({
      ...it,
      condition: it.condition || 'healthy',
      tags: it.tags || [],
      // 写真は複数対応。古いデータ（photo単数）も配列に揃える。photo は表示用の「顔」。
      photos: Array.isArray(it.photos) ? it.photos : (it.photo ? [it.photo] : []),
      photo: it.photo || (Array.isArray(it.photos) ? it.photos[0] : null) || null,
      // 推した人のIDの一覧。人数は length で分かる。
      supporters: Object.keys(it.supporters || {}),
      // 観察記録は古い順。投稿者名は保存せず、表示のたびにIDから引く。
      observations: Object.entries(it.observations || {})
        .map(([id, o]) => ({ id, ...o, userName: nameOf(o.userId) }))
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
      isMinePending: it.status !== 'approved' && it.authorId === deviceId,
    }));

  const selectedItem = items.find(i => i.id === selectedId) || null;

  // ポイントは保存せず、全データ（承認前も含む）から毎回計算する。
  // 登録 +30 / 推し +5 / 観察 +10。実際の行動からしか増えないのでズルができない。
  const pointsById = {};
  // 管理画面用の内訳。ポイントだけでは「何をした人か」が分からないため、
  // 登録・推し・観察の件数と、登録した緑地の名前を集めておく。
  const statsById = {};
  const add = (id, n) => { if (id) pointsById[id] = (pointsById[id] || 0) + n; };
  const bump = (id, key, label) => {
    if (!id) return;
    const st = statsById[id] || (statsById[id] = { trees: 0, supports: 0, obs: 0, treeNames: [] });
    st[key] += 1;
    if (label && st.treeNames.length < 3) st.treeNames.push(label);
  };
  for (const it of allItems) {
    add(it.authorId, POINTS_PER_TREE);
    bump(it.authorId, 'trees', it.name);
    for (const uid of Object.keys(it.supporters || {})) { add(uid, POINTS_PER_SUPPORT); bump(uid, 'supports'); }
    for (const o of Object.values(it.observations || {})) { add(o?.userId, POINTS_PER_OBS); bump(o?.userId, 'obs'); }
  }
  const myPoints = pointsById[deviceId] || 0;

  // ランキングに載せるのは「1pt以上あり」かつ「本人が参加を取り消していない」人だけ。
  // ポイントは行動からしか増えないため、0pt は一度も参加していない人を意味する。
  // 自分も例外ではなく、0pt のあいだは載らない（名前の設定もできない）。
  const users = Object.entries(pointsById)
    .filter(([id, points]) => points > 0 && !hiddenUsers[id])
    .map(([id, points]) => ({ id, points, name: nameOf(id), avatar: id === deviceId ? '🌱' : '👤' }))
    .sort((a, b) => b.points - a.points);

  // 管理画面用。ランキングに出ていない人（非表示にした人）も操作できるよう、
  // ポイントを持つ人と名前を付けた人をすべて含める。
  const adminUsers = Object.entries(
    [...Object.keys(pointsById), ...Object.keys(names)]
      .reduce((acc, id) => { acc[id] = true; return acc; }, {})
  )
    .map(([id]) => ({
      id,
      points: pointsById[id] || 0,
      name: names[id] || '',
      hidden: !!hiddenUsers[id],
      isMe: id === deviceId,
      stats: statsById[id] || { trees: 0, supports: 0, obs: 0, treeNames: [] },
    }))
    .sort((a, b) => b.points - a.points);

  // 記録を表示している利用者。ランキングから外れた人でも、タップ済みなら表示を保つ。
  const selectedUser = selectedUserId
    ? {
        id: selectedUserId,
        name: nameOf(selectedUserId),
        points: pointsById[selectedUserId] || 0,
        isMe: selectedUserId === deviceId,
      }
    : null;

  // その人の記録。items は「承認済み＋自分の承認待ち」なので、
  // 他人の承認待ちがここに混ざることはない（絞り込みを足す必要がない）。
  const selectedUserRegistered = selectedUserId
    ? items.filter(it => it.authorId === selectedUserId)
    : [];
  const selectedUserSupported = selectedUserId
    ? items.filter(it => it.supporters.includes(selectedUserId))
    : [];

  // 自分がいまどの状態かをランキング画面に伝える
  const myRankingState = myPoints <= 0
    ? 'no-points'      // まだポイントが無い
    : hiddenUsers[deviceId]
      ? 'opted-out'    // 自分で参加を取り消した
      : 'listed';      // 載っている

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

  // 現在地からその緑地までの経路を地図に描く。
  // スマホではシートが地図を覆っているので、閉じて地図を全面に出す。
  function handleShowRoute(item) {
    setRouteTarget(item);
    setSelectedId(item.id);
    setShowDetail(false);
    setActiveView('map');
    setMobileTab('map');
  }

  function handleClearRoute() {
    setRouteTarget(null);
  }

  // 推しは共有データベースに「誰が推したか」として記録する。もう一度押すと取り消し。
  // ポイントは記録から計算されるので、ここで足し引きはしない。
  async function handleSupport(itemId) {
    const already = allItems.find(i => i.id === itemId)?.supporters?.[deviceId] === true;
    try {
      await set(ref(db, `greenItems/${itemId}/supporters/${deviceId}`), already ? null : true);
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }

  // 観察記録も共有データベースに載せ、誰でも読めるようにする。
  // 投稿者名は保存しない（表示のたびにIDから引く。他人の記録が「あなた」と出ないように）。
  async function handleAddObservation(itemId, text) {
    const obs = {
      userId: deviceId,
      text,
      date: new Date().toISOString().slice(0, 10),
      createdAt: Date.now(),
    };
    try {
      await set(push(ref(db, `greenItems/${itemId}/observations`)), obs);
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }

  // ニックネームを設定する（空なら削除）
  async function handleSetName(name) {
    const trimmed = (name || '').trim().slice(0, 20);
    try {
      await set(ref(db, `users/${deviceId}/name`), trimmed || null);
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }

  // ランキングへの参加をやめる。名前も消す。
  // 登録した緑地や観察記録は「まちの共有データ」なので消さない。
  async function handleLeaveRanking() {
    try {
      // 親（users/自分）ごと書き換えるとルール上は管理者専用の操作になるため、
      // 子のキーを個別に更新する。update は子パスごとに権限が判定される。
      await update(ref(db, `users/${deviceId}`), { hidden: true, name: null });
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }

  // 「自分の記録を他の人にも見せる」の切り替え。既定は非公開で、本人が選んだときだけ公開。
  // 登録した場所の集合はその人の生活圏を推測させるため、勝手に公開しない。
  async function handleSetPublicProfile(on) {
    try {
      await update(ref(db, `users/${deviceId}`), { publicProfile: on ? true : null });
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }

  // ランキングに戻る（名前は消えたままなので、必要なら設定し直す）
  async function handleRejoinRanking() {
    try {
      await set(ref(db, `users/${deviceId}/hidden`), null);
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
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
      {/* トップバー。スマホでは地図の上に浮かぶガラス調のバーになる（CSS側で切り替え） */}
      <header className="topbar">
        <h1 className="brand" onClick={handleLogoTap}>
          <LeafMark size={22} />
          庭心
        </h1>
        <nav className="topbar-nav">
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
        <div className="points-chip" title={`${myPoints}ポイント`}>
          <span className="points-value">{myPoints}</span>
          <span className="points-unit">pt</span>
        </div>
      </header>

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
            routeTarget={routeTarget}
            onClearRoute={handleClearRoute}
          />
        )}

        <div className={`sidebar ${mobileTab === 'list' || mobileTab === 'ranking' || (showDetail && selectedItem) ? 'mobile-visible' : ''}`}>
          {activeView === 'ranking' && !showDetail && selectedUser ? (
            <UserRecordPanel
              user={selectedUser}
              registered={selectedUserRegistered}
              supported={selectedUserSupported}
              isPublic={!!publicProfiles[selectedUser.id]}
              onSelectItem={handleSelectItem}
              onBack={() => setSelectedUserId(null)}
            />
          ) : activeView === 'ranking' && !showDetail ? (
            <RankingPanel
              items={items}
              users={users}
              currentUserId={MY_ID}
              myPoints={myPoints}
              myRankingState={myRankingState}
              myPublicProfile={!!publicProfiles[deviceId]}
              onSelectItem={handleSelectItem}
              onSelectUser={(u) => setSelectedUserId(u.id)}
              onSetName={handleSetName}
              onLeaveRanking={handleLeaveRanking}
              onRejoinRanking={handleRejoinRanking}
              onSetPublicProfile={handleSetPublicProfile}
            />
          ) : showDetail && selectedItem ? (
            <DetailPanel
              item={selectedItem}
              currentUserId={MY_ID}
              onBack={handleBack}
              onSupport={handleSupport}
              onAddObservation={handleAddObservation}
              onShowRoute={handleShowRoute}
            />
          ) : (
            <>
              <div className="sidebar-header">
                <div className="sidebar-title">まちの緑</div>
                {/* 以前は黒い帯だった統計を、ここに軽く置く */}
                <div className="list-stats">
                  <span><b>{items.length}</b> 件</span>
                  <span><b>{totalSupporters}</b> 推し</span>
                  <span><b>{totalObs}</b> 観察</span>
                  {pendingCount > 0 && (
                    <span className="list-stat-pending"><b>{pendingCount}</b> 公開待ち</span>
                  )}
                </div>
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
                      {/* 写真が主役。無い場合は種別の絵文字で穴を埋める */}
                      <div className="card-media">
                        {item.photo ? (
                          <img src={item.photo} alt={item.name} className="card-photo" loading="lazy" />
                        ) : (
                          <div className="card-photo card-photo-empty">{typeInfo.emoji}</div>
                        )}
                        <span
                          className="card-type-badge"
                          style={{ color: typeInfo.color }}
                        >
                          {typeInfo.emoji} {typeInfo.label}
                        </span>
                        {item.isMinePending && (
                          <span className="card-pending">🕓 公開待ち</span>
                        )}
                      </div>
                      <div className="card-body">
                        <div className="card-name">{item.name}</div>
                        <div className="card-address">📍 {item.location.address}</div>
                        <div className="card-footer">
                          <span className={`condition-badge condition-${item.condition}`}>
                            {CONDITION_LABELS[item.condition]}
                          </span>
                          <span className="supporter-count">
                            💚 {item.supporters.length}
                          </span>
                        </div>
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

      {(activeView === 'map' && mobileTab === 'map' && !showDetail) && (
        <button className="fab" onClick={() => setShowAddForm(true)} title="新しい緑地を登録">
          +
        </button>
      )}

      {/* モバイル用タブバー */}
      <nav className="mobile-tab-bar">
        <button className={`mobile-tab-btn ${mobileTab === 'map' ? 'active' : ''}`} onClick={() => { setMobileTab('map'); setActiveView('map'); setShowDetail(false); }}>
          <span className="tab-icon">🗺️</span>地図
        </button>
        <button className="mobile-tab-btn" onClick={() => setShowAddForm(true)}>
          <span className="tab-icon">➕</span>登録
        </button>
        <button className={`mobile-tab-btn ${mobileTab === 'list' ? 'active' : ''}`} onClick={() => { setMobileTab('list'); setActiveView('map'); setShowDetail(false); }}>
          <span className="tab-icon">🌿</span>一覧
        </button>
        <button className={`mobile-tab-btn ${mobileTab === 'ranking' ? 'active' : ''}`} onClick={() => { setMobileTab('ranking'); setActiveView('ranking'); setShowDetail(false); setSelectedUserId(null); }}>
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
          users={adminUsers}
          onClose={() => setShowAdmin(false)}
        />
      )}
    </div>
  );
}
