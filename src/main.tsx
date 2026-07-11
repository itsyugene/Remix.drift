import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register the Service Worker for offline/app-shell caching in PRODUCTION only.
// In dev it caches stale assets and hijacks the page across Vite's changing
// ports, causing reload loops - so it's disabled there and any previously
// registered worker is torn down.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('[Service Worker] Registered:', reg.scope))
        .catch((err) => console.error('[Service Worker] Registration failed:', err));
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    if ('caches' in window) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

