import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
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
