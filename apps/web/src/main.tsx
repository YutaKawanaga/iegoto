import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { AppProviders } from '@/providers/app-providers'
import { router } from '@/routers/router'
import '@/styles/global.css'

// Web Push 受信用 Service Worker (F-08)。失敗してもアプリ本体は動かす
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

const rootElement = document.getElementById('root')
if (rootElement === null) {
  throw new Error('#root が見つかりません')
}
createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
