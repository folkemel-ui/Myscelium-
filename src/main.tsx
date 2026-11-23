import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './style.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// In the published game, keep its files on the device so it works offline (see src/sw-template.js).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      // Look for a newer build now and whenever the game comes back to the front (a Home Screen app
      // is often resumed rather than reopened); it is fetched in the background and used next start.
      const check = () => reg.update().catch(() => {});
      check();
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) check();
      });
    }).catch(() => {
      // No offline copy (a private window, say); the game still plays online.
    });
  });
}
