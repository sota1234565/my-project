// 位置情報を許可する手順は、端末とブラウザによって全く違う。
// 利用者に合った案内を出すため、ここで判別する。

export function detectPlatform() {
  const ua = navigator.userAgent || '';

  // iPadOS 13以降はMacを名乗るため、タッチ対応かどうかも見る
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);

  // ホーム画面から起動した場合は、ブラウザとは別のアプリとして扱われる
  const isStandalone =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    navigator.standalone === true;

  // iOS版のChrome/Edge/Firefoxは CriOS / EdgiOS / FxiOS と名乗る。
  // これらはSafariも名乗るので、先に判定する必要がある。
  let browser = null;
  if (/CriOS/.test(ua)) browser = 'Chrome';
  else if (/EdgiOS/.test(ua) || /Edg\//.test(ua)) browser = 'Edge';
  else if (/FxiOS/.test(ua) || /Firefox/.test(ua)) browser = 'Firefox';
  else if (/OPiOS|OPR\//.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari/.test(ua)) browser = 'Safari';

  return { isIOS, isAndroid, isStandalone, browser };
}

// 位置情報を許可してもらうための手順を、端末に合わせて返す
export function getLocationHelp() {
  const { isIOS, isAndroid, isStandalone, browser } = detectPlatform();

  if (isIOS) {
    // ホーム画面から起動していれば、設定にはアプリ名で載る。
    // Safariだけは「Safari Webサイト」という項目名になる。
    const appName = isStandalone
      ? '庭心'
      : browser === 'Safari'
      ? 'Safari Webサイト'
      : browser || 'お使いのブラウザ';

    const steps = [
      '「設定」→「プライバシーとセキュリティ」→「位置情報サービス」を開く',
      `一覧から「${appName}」を選び、「このAppの使用中」にする`,
      'このページを開き直す',
    ];

    // Safariは、設定側で拒否されているとダイアログ自体が出ない
    const note = browser === 'Safari'
      ? `一覧に無いときは「設定」→「Safari」→「位置情報」が「拒否」になっていないか確認してください。`
      : `一覧に「${appName}」が無いときは、まだ許可を聞かれていない状態です。`;

    return { steps, note };
  }

  if (isAndroid) {
    return {
      steps: [
        `「設定」→「アプリ」→「${browser || 'お使いのブラウザ'}」を開く`,
        '「権限」→「位置情報」→「許可」にする',
        'このページを開き直す',
      ],
      note: '端末によってメニュー名が少し違うことがあります。',
    };
  }

  // パソコン（Chrome / Edge / Firefox / Safari 共通の考え方）
  return {
    steps: [
      'アドレスバーの左にあるアイコン（🔒 や ⓘ）をクリック',
      '「位置情報」を「許可」に変える',
      'ページを再読み込みする',
    ],
    note: null,
  };
}
