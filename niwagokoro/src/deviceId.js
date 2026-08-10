// この端末を区別するための匿名ID。
// ログインの代わりに使い、「自分の投稿かどうか」の判定に用いる。
// 個人を特定する情報は含まない。ブラウザのデータを消すと作り直される。
const KEY = 'niwagokoro.deviceId.v1';

export function getDeviceId() {
  let id = null;
  try {
    id = localStorage.getItem(KEY);
  } catch {
    // localStorageが使えない環境では毎回一時IDになる
  }
  if (!id) {
    id = 'dev-' + (crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(16).slice(2));
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // 保存できなくても動作は継続する
    }
  }
  return id;
}
