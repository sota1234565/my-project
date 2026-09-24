import { useState } from 'react';
import { FUJISAWA_LINE_URL, buildReportText } from '../report';

const APP_URL = 'https://niwashin-app.vercel.app/';

// 「手入れが要りそう」と気づいたことを、藤沢市の窓口に伝えるための下書きを作る。
//
// 庭心は通報を送らない。藤沢市の市民レポートはLINEの対話形式で、
// 外部から内容を流し込めないため。ここでできるのは、必要な情報を整えて
// コピーできるようにし、公式の窓口へ案内するところまで。
// 「庭心が市に報告した」と誤解されないよう、画面にもそう書いてある。
export default function ReportPanel({ item, onClose }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const text = buildReportText(item, APP_URL);

  // コピーとLINEを開くのを1回の操作にまとめる。
  // 押した流れの中で開くのでポップアップ扱いにならず、手順も半分になる。
  // コピーに失敗してもLINEは開く（文面は画面に出ているので手で写せる）。
  async function handleCopyAndOpen() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    } catch {
      setCopyFailed(true);
    }
    window.open(FUJISAWA_LINE_URL, '_blank', 'noopener');
    return ok;
  }

  async function handleCopyOnly() {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <div className="report-panel">
      <div className="report-head">
        <div className="report-title">📮 市に伝える</div>
        <button className="report-close" onClick={onClose} title="閉じる">✕</button>
      </div>

      <p className="report-lead">
        藤沢市は、街路樹や公園の樹木の不具合をLINEの「市民レポート」で受け付けています。
        下のボタンで文面をコピーし、そのままLINEへ進めます。
      </p>

      {/* 押す操作は1回。LINEに移ったあとにやることだけを残す。 */}
      <div className="report-actions">
        <button type="button" className="report-copy-btn" onClick={handleCopyAndOpen}>
          {copied ? '✓ コピーしました。LINEへ →' : '📋 コピーして藤沢市LINEを開く'}
        </button>
      </div>

      <ol className="report-steps">
        <li>メニューの<b>「市民レポート」</b>→「レポートを始める」</li>
        <li>案内にそって<b>写真・位置情報</b>を送る</li>
        <li>状況の欄に<b>貼り付け</b>て送信</li>
      </ol>

      <details className="report-details">
        <summary>送られる文面を見る／手で直す</summary>
        <textarea className="report-text" value={text} readOnly rows={14} />
        <button type="button" className="report-copyonly-btn" onClick={handleCopyOnly}>
          📋 文面だけコピー
        </button>
      </details>

      {copyFailed && (
        <div className="report-note report-note-warn">
          コピーできませんでした。上の文面を長押しして選択し、手でコピーしてください。
        </div>
      )}

      <div className="report-note">
        ※ 庭心が市に送るわけではありません。送信はご自身でLINEから行ってください。<br />
        ※ 倒木や通行の妨げなど<b>急を要する場合は、LINEではなく市役所に電話</b>してください。
      </div>
    </div>
  );
}
