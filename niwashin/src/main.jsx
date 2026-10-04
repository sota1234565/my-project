import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// 訪問者数・ページ閲覧数を数える（Vercel Web Analytics）。
// Cookie を使わず個人を追跡しない。Vercel 上でのみ動き、画面には何も出さない。
// ※Vercel の管理画面で Web Analytics を「オン」にして初めて計測が始まる。
import { Analytics } from '@vercel/analytics/react'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
)

// Service Worker登録（本番ビルドのみ。開発中はキャッシュが邪魔になるため）
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })

  // 新しいService Workerが有効になったら、一度だけ自動でリロードして
  // 最新のコードに切り替える。これがないと、ホーム画面から起動したPWAが
  // 古いままになり、修正が端末に届かない。
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })
}
