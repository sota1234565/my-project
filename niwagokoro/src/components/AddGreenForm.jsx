import { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, AttributionControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GREEN_TYPES } from '../data/greenItems';
import { getLocationHelp } from '../platform';

const LOCATION_HELP = getLocationHelp();

// 位置がまだ分からないときに表示する場所（藤沢市のあたり）
const FUJISAWA_CENTER = [35.3386, 139.4875];

// 1本の木に登録できる写真の上限（1枚目=全体、以降=アップ）
const MAX_PHOTOS = 4;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ja`,
      { headers: { 'User-Agent': 'NiwaGokoro-App' } }
    );
    const data = await res.json();
    const a = data.address || {};
    const parts = [a.prefecture, a.city || a.town || a.village, a.suburb || a.neighbourhood, a.road].filter(Boolean);
    return parts.join('') || data.display_name || '';
  } catch {
    return '';
  }
}

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

export default function AddGreenForm({ onAdd, onClose }) {
  // 項目は、通りがかりの人がその場で答えられるものだけに絞る。
  // 学名・植栽年・高さ・タグは専門知識が要るため置かない。
  const [form, setForm] = useState({
    type: 'tree',
    name: '',
    address: '',
    lat: '',
    lng: '',
    description: '',
    // 写真判定で得られた学名。入力欄は設けず、裏側で記録だけしておく。
    scientificName: '',
  });
  const [gpsStatus, setGpsStatus] = useState('idle');
  const [addressLoading, setAddressLoading] = useState(false);
  const [pinPos, setPinPos] = useState(null);
  // nullのあいだは地図を動かさない（開いた直後は藤沢市全体が見える状態を保つ）
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

  // 写真は共有データベースに載せるため、縮小・圧縮してから使う。
  // 長辺1000pxまで縮め、JPEG品質0.6に。これで数十KB程度に収まる。
  function fileToCompressed(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 1000;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            const scale = MAX / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = () => resolve(ev.target.result);
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

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
    const address = await reverseGeocode(lat, lng);
    setForm(prev => ({ ...prev, address }));
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
    onAdd({
      type: form.type,
      name: form.name.trim(),
      location: {
        lat: parseFloat(form.lat) || FUJISAWA_CENTER[0],
        lng: parseFloat(form.lng) || FUJISAWA_CENTER[1],
        address: form.address.trim() || '藤沢市',
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
        <div className="add-form-title">🌱 新しい緑地を登録</div>
        <form onSubmit={handleSubmit}>
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

          {/* 地図タップで場所指定 */}
          <div className="form-group">
            <label className="form-label">📍 地図をタップして場所を指定</label>
            <div className="location-map-wrap">
              <MapContainer
                center={pinPos || mapCenter || FUJISAWA_CENTER}
                zoom={14}
                style={{ width: '100%', height: '320px' }}
                zoomControl={true}
                attributionControl={false}
              >
                <AttributionControl position="bottomright" prefix={false} />
                <TileLayer
                  url="https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png"
                  attribution='<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>'
                  maxNativeZoom={18}
                  maxZoom={19}
                />
                <SetCenter center={mapCenter} />
                <LocationPicker onPick={applyLocation} />
                {pinPos && <Marker position={pinPos} />}
              </MapContainer>
              <div className="map-tap-hint">タップした場所にピンが立ち、住所が自動入力されます</div>
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

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>キャンセル</button>
            <button type="submit" className="btn-primary">✅ 登録する (+30pt)</button>
          </div>
        </form>
      </div>
    </div>
  );
}
