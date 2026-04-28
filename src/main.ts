import './style.css'
import { initApp } from './app'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const swUrl = `${import.meta.env.BASE_URL}sw.js`
  navigator.serviceWorker.register(swUrl).catch(() => {})
}

initApp()
