// Firebase（共有データベース）への接続。
// ここに書かれた apiKey などは秘密情報ではなく、クライアントに埋め込んで公開してよいもの。
// 安全は Realtime Database のセキュリティルールで守っている。
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBgwAxyVOgqG0e2gmMmacVZv8hVsbBUHz8',
  authDomain: 'niwashin0512.firebaseapp.com',
  databaseURL: 'https://niwashin0512-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'niwashin0512',
  storageBucket: 'niwashin0512.firebasestorage.app',
  messagingSenderId: '536389755142',
  appId: '1:536389755142:web:e0043df2958fa4c5ffbe87',
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// 管理者（承認する人）のログインに使う。
// 「誰が承認できるか」はデータベース側のルールで決めているため、
// ここを突破されても他人が承認できるようにはならない。
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
