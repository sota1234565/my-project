import { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, AttributionControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GREEN_TYPES, CONDITIONS } from '../data/greenItems';
import { getLocationHelp } from '../platform';
import { reverseGeocode } from '../geocode';
import { fileToCompressed } from '../image';
import { GSI_ATTRIBUTION, TILE_STYLES, nextTileStyle, TILE_MAX_NATIVE_ZOOM, TILE_MAX_ZOOM } from '../tiles';

const LOCATION_HELP = getLocationHelp();

// 場所がまだ何も分からないときに最初に映す範囲（日本全体）。
// 全国で使うため、特定の市を初期値にしない。
const JAPAN_CENTER = [36.5, 138.0];
const JAPAN_ZOOM = 5;

// 1本の木に登録できる写真の上限（1枚目=全体、以降=アップ）
const MAX_PHOTOS = 4;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function LocationPicker({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function SetCenter({ center }) {
  const map = useMap();

  // このフォームはモーダルの中にあり、開くアニメーションが終わるまで
  // 地図の大きさが確定しない。Leafletに正しい大きさを教え直す。
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [map]);

  useEffect(() => {
    if (!center) return;
    map.invalidateSize();
    // animate: true だとモーダル内でアニメーションが中断され、地図が動かないことがある。
    // 確実に移動させるため、アニメーションなしで切り替える。
    map.setView(center, 16, { animate: false });
  }, [center, map]);

  return null;
}

// initialCenter: 地図画面で最後に見ていた場所。登録のたびに日本全体まで
// 引き戻されないよう、直前に見ていたあたりから始める。
export default function AddGreenForm({ onAdd, onClose, initialCenter = null }) {
  // 項目は、通りがかりの人がその場で答えられるものだけに絞る。
  // 学名・植栽年・高さ・タグは専門知識が要るため置かない。
  const [form, setForm] = useState({
    type: 'tree',
    // 見た目の状態。既定は健全。手入れが要りそうなものはここで「要ケア」にする。
    condition: 'healthy',
    name: '',
    address: '',
    lat: '',
    lng: '',
    description: '',
    // 写真判定で得られた学名。入力欄は設けず、裏側で記録だけしておく。
    scientificName: '',
  });
  const [gpsStatus, setGpsStatus] = useState('idle');
  // 場所を指定する地図の見た目（'pale'＝地図 / 'photo'＝航空写真）
  const [tileStyle, setTileStyle] = useState('pale');
  const [addressLoading, setAddressLoading] = useState(false);
  // 座標から判定した自治体。通報の窓口判定と、将来の地域別集計に使う。
  const [geo, setGeo] = useState(null);
  const [pinPos, setPinPos] = useState(null);
  // nullのあいだは地図を動かさない（開いた直後の表示範囲を保つ）
  const [mapCenter, setMapCenter] = useState(null);
  // 写真は複数持てる。photos[0] が全体写真（地図・詳細で表示される「顔」）、
  // 以降は葉や花のアップ（名前判定の精度を上げるため）。
  const [photos, setPhotos] = useState([]);
  // 写真からの名前判定（候補を出すだけで、確定はしない）
  const [identifying, setIdentifying] = useState(false);
  const [candidates, setCandidates] = useState(null);
  const [identifyError, setIdentifyError] = useState(null);
  const [pickedFromAI, setPickedFromAI] = useState(false);

  // 候補の表示名。日本語名を最優先し、無ければ学名を使う。
  function candidateLabel(c) {
    const jaFromCommon = (c.commonNames || []).find(n => /[぀-ヿ一-鿿]/.test(n));
    return c.japaneseName || jaFromCommon || c.scientificName || '名前不明';
  }

  async function handleIdentify() {
    if (!photos.length) return;
    setIdentifying(true);
    setIdentifyError(null);
    setCandidates(null);
    try {
      const res = await fetch('/api/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: photos }),
      });
      const data = await res.json();
      if (data.error || !data.results?.length) {
        setIdentifyError(data.error || 'no_match');
      } else {
        setCandidates(data.results);
      }
    } catch {
      setIdentifyError('failed');
    }
    setIdentifying(false);
  }

  function pickCandidate(c) {
    setForm(prev => ({
      ...prev,
      name: candidateLabel(c),
      scientificName: c.scientificName || '',
    }));
    setPickedFromAI(true);
    setCandidates(null);
  }

  // フォームを開いたとき自動で現在地を取得してマップ中心に
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMapCenter([lat, lng]);
      },
      () => {},
      // iPhoneは高精度測位が遅いので、粗い位置でよいから素早く返してもらう。
      // 直前に取得した位置があればそれを使う。
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
  }, []);

  async function handleAddPhoto(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const dataUrl = await fileToCompressed(file);
    setPhotos((prev) => (prev.length >= MAX_PHOTOS ? prev : [...prev, dataUrl]));
    setCandidates(null);
    setIdentifyError(null);
  }

  function removePhoto(idx) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    setCandidates(null);
    setIdentifyError(null);
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  // recenter: 地図の表示位置も動かすか。
  // GPS取得のときだけ動かす。地図タップのたびに動くと操作しづらいため。
  const applyLocation = useCallback(async (lat, lng, recenter = false) => {
    setPinPos([lat, lng]);
    if (recenter) setMapCenter([lat, lng]);
    setForm(prev => ({ ...prev, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
    setAddressLoading(true);
    const geo = await reverseGeocode(lat, lng);
    // 住所は利用者が手で直せるので form に置く。
    // 市区町村コードは座標から決まるもので、手入力させるものではないので別に持つ。
    setForm(prev => ({ ...prev, address: geo.address }));
    setGeo({ muniCd: geo.muniCd, muniName: geo.muniName });
    setAddressLoading(false);
  }, []);

  function handleGetGPS() {
    if (!navigator.geolocation) { setGpsStatus('error'); return; }
    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyLocation(pos.coords.latitude, pos.coords.longitude, true);
        setGpsStatus('success');
      },
      (err) => setGpsStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error'),
      // iPhoneでの取得失敗を減らすため、待ち時間を長めにしキャッシュも許容する
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 30000 }
    );
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    // 場所は必須。以前は未指定のとき藤沢市の座標を黙って入れていたが、
    // 全国で使う以上それは「その人の木を藤沢に置く」ことになるので許さない。
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const address = form.address.trim();
    onAdd({
      type: form.type,
      condition: form.condition,
      name: form.name.trim(),
      location: {
        lat,
        lng,
        // 住所は空で保存しない（データベース側が1文字以上を要求するため）。
        // 分からないときは省き、あとから「住所を直す」で入れてもらう。
        ...(address ? { address } : {}),
        ...(geo?.muniCd ? { muniCd: geo.muniCd } : {}),
        ...(geo?.muniName ? { muniName: geo.muniName } : {}),
      },
      description: form.description.trim(),
      photo: photos[0] || null,
      photos,
      scientificName: form.scientificName.trim() || null,
      // 名前を写真判定から選んだかどうか（推定であることを記録に残す）
      aiIdentified: pickedFromAI,
    });
  }

  return (
    <div className="add-form-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="add-form-box">
        <form onSubmit={handleSubmit} className="add-form">
          {/* 上下は固定。長いフォームでも「登録する」が常に押せる */}
          <div className="sheet-topbar">
            <div className="add-form-title">🌱 新しい緑地を登録</div>
            <button type="button" className="sheet-close" onClick={onClose} aria-label="閉じる">✕</button>
          </div>

          <div className="add-form-body">
          <div className="form-group">
            <label className="form-label">種別 *</label>
            <select className="form-select" name="type" value={form.type} onChange={handleChange}>
              {Object.entries(GREEN_TYPES).map(([key, val]) => (
                <option key={key} value={key}>{val.emoji} {val.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">名前 *</label>
            <input className="form-input" name="name" placeholder="例：ソメイヨシノ" value={form.name} onChange={handleChange} required />
          </div>

          {/* 状態。枝折れや枯れかけを「要ケア」として記録できるようにする。
              これが無いと、一覧の「⚠️ 要ケア」で絞り込んでも永遠に0件になる。 */}
          <div className="form-group">
            <label className="form-label">いまの状態</label>
            <select className="form-select" name="condition" value={form.condition} onChange={handleChange}>
              {Object.entries(CONDITIONS).map(([key, val]) => (
                <option key={key} value={key}>{val.emoji} {val.label}（{val.hint}）</option>
              ))}
            </select>
          </div>

          {/* 地図タップで場所指定 */}
          <div className="form-group">
            <label className="form-label">📍 地図をタップして場所を指定 *</label>
            <div className="location-map-wrap">
              <MapContainer
                center={pinPos || mapCenter || initialCenter || JAPAN_CENTER}
                zoom={pinPos || mapCenter || initialCenter ? 14 : JAPAN_ZOOM}
                style={{ width: '100%', height: '320px' }}
                zoomControl={true}
                attributionControl={false}
              >
                <AttributionControl position="bottomright" prefix={false} />
                <TileLayer
                  key={tileStyle}
                  url={TILE_STYLES[tileStyle].url}
                  attribution={GSI_ATTRIBUTION}
                  maxNativeZoom={TILE_MAX_NATIVE_ZOOM}
                  maxZoom={TILE_MAX_ZOOM}
                />
                <SetCenter center={mapCenter} />
                <LocationPicker onPick={applyLocation} />
                {pinPos && <Marker position={pinPos} />}
              </MapContainer>
              {/* 航空写真に切り替えられるようにする。木や花は地図記号では表せないため、
                  実際の樹冠や花壇を見ながら位置を決められたほうが正確に指せる。
                  type="button" を明示しないと、フォーム内では送信ボタン扱いになる。 */}
              <button
                type="button"
                className={`picker-style-toggle ${tileStyle === 'photo' ? 'on-photo' : ''}`}
                onClick={() => setTileStyle(nextTileStyle)}
                title={`${TILE_STYLES[tileStyle].label}に切り替え`}
              >
                <span className="picker-style-icon">{TILE_STYLES[tileStyle].icon}</span>
                <span className="picker-style-label">{TILE_STYLES[tileStyle].label}</span>
              </button>
              <div className="map-tap-hint">
                {pinPos
                  ? 'タップした場所にピンが立ち、住所が自動入力されます'
                  : '⚠️ 場所がまだ指定されていません。地図をタップするか、下の「GPSで現在地を取得」を押してください'}
              </div>
            </div>
          </div>

          {/* GPS取得ボタン */}
          <div className="form-group">
            <button type="button" className="btn-gps" onClick={handleGetGPS} disabled={gpsStatus === 'loading'}>
              {gpsStatus === 'loading' ? '📡 取得中...' : '📍 GPSで現在地を取得'}
            </button>
            {gpsStatus === 'success' && <div className="gps-success">✅ 現在地を取得しました</div>}
            {gpsStatus === 'error' && <div className="gps-error">⚠️ 取得できませんでした。地図をタップして指定してください。</div>}
            {gpsStatus === 'denied' && (
              <div className="gps-error">
                ⚠️ 位置情報が許可されていません。
                <ol className="locate-error-steps">
                  {LOCATION_HELP.steps.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
                許可しなくても、地図をタップすれば場所を指定できます。
              </div>
            )}
          </div>

          {/* 住所（自動入力・修正可） */}
          <div className="form-group">
            <label className="form-label">
              住所
              {addressLoading && <span className="address-loading"> 取得中...</span>}
            </label>
            <input
              className="form-input"
              name="address"
              placeholder="地図をタップすると自動入力されます"
              value={form.address}
              onChange={handleChange}
            />
          </div>

          {/* 写真：全体写真＋アップ写真を複数登録できる */}
          <div className="form-group">
            <label className="form-label">📷 写真（任意）</label>

            {/* 仕組みの説明。ここが伝わらないと「撮っても名前が出ない」で困る */}
            <div className="photo-guide">
              <div>📸 <strong>1枚目は木の「全体」</strong>を撮ってください。地図で見た人に、木の姿や場所が伝わります。</div>
              <div>🔍 <strong>名前を調べたいときは、葉や花に近づいた「アップ」も足して</strong>ください。全体写真だけでは名前は判別できません。</div>
            </div>

            {photos.length > 0 && (
              <div className="photo-thumbs">
                {photos.map((src, i) => (
                  <div key={i} className="photo-thumb">
                    <img src={src} alt="" />
                    <span className="photo-thumb-tag">{i === 0 ? '全体' : 'アップ'}</span>
                    <button
                      type="button"
                      className="photo-thumb-remove"
                      onClick={() => removePhoto(i)}
                      aria-label="この写真を削除"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            {photos.length < MAX_PHOTOS && (
              <div className="photo-btn-row">
                <label className="photo-btn">
                  📷 写真を撮る
                  <input type="file" accept="image/*" capture="environment" onChange={handleAddPhoto} style={{ display: 'none' }} />
                </label>
                <label className="photo-btn">
                  🖼 フォルダから選ぶ
                  <input type="file" accept="image/*" onChange={handleAddPhoto} style={{ display: 'none' }} />
                </label>
              </div>
            )}

            {photos.length > 0 && (
              <>
                <button
                  type="button"
                  className="identify-btn"
                  onClick={handleIdentify}
                  disabled={identifying}
                >
                  {identifying ? '🔍 調べています…' : '🔍 この木の名前を調べる'}
                </button>
                <div className="identify-tip">
                  💡 葉や花の<strong>アップ写真</strong>があるほど正確に判定できます。全体写真だけだと、ほぼ当たりません。
                </div>

                {candidates && (
                  <div className="candidates">
                    <div className="candidates-hint">
                      撮った写真と見比べて、近いものを選んでください
                    </div>
                    {candidates.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        className="candidate"
                        onClick={() => pickCandidate(c)}
                      >
                        {c.image
                          ? <img src={c.image} alt="" className="candidate-photo" />
                          : <div className="candidate-photo candidate-nophoto">写真なし</div>}
                        <div className="candidate-body">
                          <div className="candidate-name">{candidateLabel(c)}</div>
                          {c.scientificName && (
                            <div className="candidate-sci">{c.scientificName}</div>
                          )}
                        </div>
                        <div className="candidate-score">{Math.round(c.score * 100)}%</div>
                      </button>
                    ))}
                    <button
                      type="button"
                      className="candidate-none"
                      onClick={() => setCandidates(null)}
                    >
                      どれでもない（自分で入力する）
                    </button>
                  </div>
                )}

                {identifyError && (
                  <div className="identify-error">
                    {identifyError === 'no_match' && '似た植物が見つかりませんでした。葉や花に近づいたアップ写真を足して、もう一度試してみてください。'}
                    {identifyError === 'quota_exceeded' && '本日の判定回数の上限に達しました。明日また試してください。'}
                    {identifyError === 'not_configured' && 'この機能はまだ準備中です。名前は手で入力してください。'}
                    {identifyError === 'bad_key' && '判定サービスに接続できませんでした。名前は手で入力してください。'}
                    {identifyError === 'failed' && 'うまく調べられませんでした。通信環境を確認するか、名前を手で入力してください。'}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">ひとこと（任意）</label>
            <textarea
              className="form-textarea"
              name="description"
              placeholder="気づいたことを自由に。例：毎年きれいに咲きます／最近元気がなさそう"
              value={form.description}
              onChange={handleChange}
            />
          </div>

          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>キャンセル</button>
            <button type="submit" className="btn-primary" disabled={!pinPos || !form.name.trim()}>
              ✅ 登録する (+30pt)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
