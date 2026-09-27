import { useEffect, useState } from 'react';
import { buildReportText, resolveReportTargets } from '../report';
import { MULTI_MUNI_SERVICES } from '../data/reportChannels';
import { reverseGeocode } from '../geocode';

const APP_URL = 'https://niwashin-app.vercel.app/';

// 「手入れが要りそう」と気づいたことを、窓口に伝えるための下書きを作る。
//
// 庭心は通報を送らない。どの窓口も外部から内容を流し込む仕組みを持たないため。
// ここでできるのは、必要な情報を整えてコピーできるようにし、窓口へ案内するところまで。
// 「庭心が送った」と誤解されないよう、画面にもそう書いてある。
//
// 街路樹に全国共通の窓口は無いので、宛先はその緑地の市区町村コードから決める。
// コードを持たない古い記録では、開いたときに座標から引き直す。
export default function ReportPanel({ item, onClose }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [resolved, setResolved] = useState(() => ({
    muniCd: item.location?.muniCd || null,
    muniName: item.location?.muniName || null,
    loading: !item.location?.muniCd, // 記録にコードがあれば調べ直す必要はない
  }));

  useEffect(() => {
    if (!resolved.loading) return;
    let cancelled = false;
    const { lat, lng } = item.location || {};
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setResolved(r => ({ ...r, loading: false }));
      return;
    }
    reverseGeocode(lat, lng).then(geo => {
      if (cancelled) return;
      setResolved({ muniCd: geo.muniCd, muniName: geo.muniName, loading: false });
    });
    return () => { cancelled = true; };
    // 開いたときに一度だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { muniName, channel, search, emergency } = resolveReportTargets({
    muniCd: resolved.muniCd,
    muniName: resolved.muniName,
    type: item.type,
  });
  const text = buildReportText(item, { appUrl: APP_URL, muniName });

  async function copyText() {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    } catch {
      setCopyFailed(true);
    }
  }

  // コピーと窓口を開くのを1回の操作にまとめる。押した流れの中で開くので
  // ポップアップ扱いにならない。コピーに失敗しても窓口は開く（文面は画面にある）。
  async function copyAndOpen(url) {
    await copyText();
    window.open(url, '_blank', 'noopener');
  }

  const src = (ch) => (
    <div className="report-channel-src">
      <a href={ch.sourceUrl} target="_blank" rel="noopener noreferrer">出典</a>
      <span>（{ch.verifiedOn} 時点）</span>
    </div>
  );

  return (
    <div className="report-panel">
      <div className="report-head">
        <div className="report-title">📮 窓口に伝える</div>
        <button className="report-close" onClick={onClose} title="閉じる">✕</button>
      </div>

      {resolved.loading ? (
        <p className="report-lead">窓口を調べています…</p>
      ) : (
        <>
          {/* 1段目：確認できたこの自治体の窓口。これが本命。 */}
          {channel && (
            <section className="report-tier">
              <div className="report-tier-title">{muniName}の窓口</div>
              <div className="report-channel">
                <div className="report-channel-label">{channel.label}</div>
                {channel.note && <div className="report-channel-note">{channel.note}</div>}
                <button type="button" className="report-copy-btn" onClick={() => copyAndOpen(channel.url)}>
                  {copied ? '✓ コピーしました。窓口へ →' : '📋 コピーして窓口を開く'}
                </button>
                {channel.steps && (
                  <ol className="report-steps">
                    {channel.steps.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                )}
                {src(channel)}
              </div>
            </section>
          )}

          {/* 2段目：表に無い自治体。全国の既定の行き先。 */}
          {!channel && search && (
            <section className="report-tier">
              <div className="report-tier-title">{muniName}の窓口を探す</div>
              <p className="report-lead">
                街路樹の手入れは自治体が行っていますが、{muniName}の窓口は庭心ではまだ確認できていません。
                下の検索から「道路・公園の損傷通報」の案内を探してください。
                見つからないときは、市役所・区役所の道路（または公園）の担当課にお伝えください。
              </p>
              <div className="report-channel">
                <button type="button" className="report-copy-btn" onClick={copyText}>
                  {copied ? '✓ コピーしました' : '📋 文面をコピー'}
                </button>
                <a className="report-line-btn" href={search.url} target="_blank" rel="noopener noreferrer">
                  🔍 {search.label}
                </a>
              </div>
            </section>
          )}

          {/* 自治体が分からなかったとき */}
          {!channel && !search && (
            <p className="report-lead">
              この場所の自治体を特定できませんでした。下の文面をコピーして、
              お住まいの自治体の道路・公園の担当課にお伝えください。
            </p>
          )}

          {/* 3段目：緊急時の電話のみ。
              #9910 のLINEは通報種別に樹木が無いため出さない。 */}
          {emergency && (
            <section className="report-tier">
              <div className="report-tier-title">⚠️ 倒れた木や落ちた枝が道をふさいでいるときは</div>
              <div className="report-channel">
                <div className="report-channel-label">{emergency.label}</div>
                <div className="report-channel-note">{emergency.note}</div>
                <a className="report-line-btn" href={`tel:${emergency.tel.replace('#', '%23')}`}>
                  📞 {emergency.tel} に電話する
                </a>
                <div className="report-channel-caution">
                  危険がなく「枯れかけている」「剪定してほしい」という相談は、
                  この番号ではなく上の窓口へお願いします。
                </div>
                {src(emergency)}
              </div>
            </section>
          )}

          <details className="report-details">
            <summary>送られる文面を見る</summary>
            <textarea className="report-text" value={text} readOnly rows={14} />
            <button type="button" className="report-copyonly-btn" onClick={copyText}>
              📋 文面だけコピー
            </button>
          </details>

          {copyFailed && (
            <div className="report-note report-note-warn">
              コピーできませんでした。上の文面を長押しして選択し、手でコピーしてください。
            </div>
          )}

          <div className="report-note">
            ※ 庭心が窓口に送るわけではありません。送信はご自身で行ってください。<br />
            ※ 参加している自治体なら{' '}
            {MULTI_MUNI_SERVICES.map(s => (
              <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>
            ))}
            {' '}も使えます。
          </div>
        </>
      )}
    </div>
  );
}
