// 写真まわりの共通処理。登録フォームと定点観測の両方から使う。

// 写真は共有データベースに載せるため、縮小・圧縮してから使う。
// 長辺1000pxまで縮め、JPEG品質0.6に。これで数十KB程度に収まる。
export function fileToCompressed(file) {
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

// 日付（YYYY-MM-DD または Date）から「2026年 春」のような季節ラベルを作る。
// 定点観測でメモが空のとき、既定のキャプションに使う。
export function seasonLabel(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1; // 1〜12
  const season =
    m <= 2 || m === 12 ? '冬' :
    m <= 5 ? '春' :
    m <= 8 ? '夏' : '秋';
  return `${y}年 ${season}の様子`;
}
