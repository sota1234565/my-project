// この端末を区別するための匿名ID。
// ログインの代わりに使い、「自分の投稿かどうか」の判定に用いる。
// 個人を特定する情報は含まない。ブラウザのデータを消すと作り直される。
// キー名は旧表記（niwagokoro）のまま据え置く。読みを「にわしん」に統一した際も
// ここを変えると既存ユーザーの匿名IDが作り直され、ニックネーム・ポイント・
// 「自分の投稿」の判定がすべて失われるため、意図的に変更していない。
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
