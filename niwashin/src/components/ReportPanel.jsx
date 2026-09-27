import { useEffect, useState } from 'react';
import { buildReportText, resolveReportTargets, scopeOf } from '../report';
import { SCOPE_ROAD, MULTI_MUNI_SERVICES } from '../data/reportChannels';
import { reverseGeocode } from '../geocode';

const APP_URL = 'https://niwashin-app.vercel.app/';

// 「手入れが要りそう」と気づいたことを、窓口に伝えるための下書きを作る。
//
// 庭心は通報を送らない。どの窓口も外部から内容を流し込む仕組みを持たないため。
// ここでできるのは、必要な情報を整えてコピーできるようにし、窓口へ案内するところまで。
// 「庭心が送った」と誤解されないよう、画面にもそう書いてある。
//
// 窓口はその緑地の市区町村コードから決める。コードを持たない古い記録では、
// 開いたときに座標から引き直す。
export default function ReportPanel({ item, onClose }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [resolved, setResolved] = useState(() => ({
    muniCd: item.location?.muniCd || null,
    muniName: item.location?.muniName || null,
    // 記録にコードがあれば調べ直す必要はない
    loading: !item.location?.muniCd,
  }));

  // 古い記録（市区町村コードを持たない）のための引き直し。
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
    // 開いたときに一度だけ。item は同じものを見続ける前提。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const targets = resolveReportTargets({
    muniCd: resolved.muniCd,
    muniName: resolved.muniName,
    type: item.type,
  });
  const text = buildReportText(item, { appUrl: APP_URL, muniName: targets.muniName });
  const isRoad = scopeOf(item.type) === SCOPE_ROAD;

  async function copyText() {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
      return true;
    } catch {
      setCopyFailed(true);
      return false;
    }
  }

  // コピーと窓口を開くのを1回の操作にまとめる。押した流れの中で開くので
  // ポップアップ扱いにならない。コピーに失敗しても窓口は開く（文面は画面にある）。
  async function copyAndOpen(url) {
    await copyText();
    window.open(url, '_blank', 'noopener');
  }

  function renderChannel(ch, key) {
    return (
      <div className="report-channel" key={key}>
        <div className="report-channel-label">{ch.label}</div>
        {ch.note && <div className="report-channel-note">{ch.note}</div>}

        {ch.kind === 'phone' ? (
          <a className="report-line-btn" href={`tel:${ch.tel.replace('#', '%23')}`}>
            📞 {ch.tel} に電話する
          </a>
        ) : (
          <button type="button" className="report-copy-btn" onClick={() => copyAndOpen(ch.url)}>
            {copied ? '✓ コピーしました。窓口へ →' : `📋 コピーして${ch.kind === 'line' ? 'LINE' : '窓口'}を開く`}
          </button>
        )}

        {ch.steps && (
          <ol className="report-steps">
            {ch.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        )}
        {ch.caution && <div className="report-channel-caution">{ch.caution}</div>}

        {/* いつ確認した情報かを出す。古くなったときに、黙って間違っているより気づけるほうがよい */}
        <div className="report-channel-src">
          <a href={ch.sourceUrl} target="_blank" rel="noopener noreferrer">出典</a>
          <span>（{ch.verifiedOn} 時点）</span>
        </div>
      </div>
    );
  }

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
          {/* 1段目：この自治体で確認できた窓口 */}
          {targets.verified.length > 0 && (
            <section className="report-tier">
              <div className="report-tier-title">
                この場所の自治体（{targets.muniName}）の窓口
              </div>
              {targets.verified.map((ch, i) => renderChannel(ch, `v${i}`))}
            </section>
          )}

          {/* 2段目：全国共通。道路のものだけ。 */}
          {targets.nationwide.length > 0 && (
            <section className="report-tier">
              <div className="report-tier-title">
                {targets.verified.length > 0
                  ? '全国共通の窓口も使えます'
                  : '全国どこからでも使える窓口'}
              </div>
              <p className="report-lead">
                {targets.verified.length === 0 && targets.muniName && (
                  <>{targets.muniName}の専用窓口は庭心では確認できていません。<br /></>
                )}
                街路樹など道路にあるものは、国土交通省の道路緊急ダイヤルが受け付け、
                その道路の管理者へ取り次いでくれます。
              </p>
              {targets.nationwide.map((ch, i) => renderChannel(ch, `n${i}`))}
            </section>
          )}

          {/* 3段目：検索。道路以外や、1段目が無いとき。 */}
          {targets.search && (
            <section className="report-tier">
              <div className="report-tier-title">
                {isRoad ? '公園の木など、道路以外のことは' : '自治体の窓口を探す'}
              </div>
              <p className="report-lead">
                {isRoad
                  ? '道路緊急ダイヤルは道路が対象です。公園の樹木や剪定の相談は自治体へ。'
                  : '雨庭や公園の樹木は道路緊急ダイヤルの対象外です。自治体の窓口を探してください。'}
              </p>
              <div className="report-channel">
                <button type="button" className="report-copyonly-btn" onClick={copyText}>
                  📋 文面をコピー
                </button>
                <a className="report-line-btn" href={targets.search.url} target="_blank" rel="noopener noreferrer">
                  🔍 {targets.search.label}
                </a>
              </div>
            </section>
          )}

          {/* 自治体名すら分からなかったとき。2段目だけが頼りになる。 */}
          {!targets.search && targets.nationwide.length === 0 && (
            <p className="report-lead">
              この場所の自治体を特定できませんでした。下の文面をコピーして、
              お住まいの自治体の道路・公園の担当課にお伝えください。
            </p>
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
            ※ 倒木など<b>急を要する場合は、道路緊急ダイヤル #9910（24時間・通話無料）へ電話</b>してください。<br />
            ※ このほか、参加している自治体なら{' '}
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
