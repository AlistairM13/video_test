/* coi-serviceworker.js — adds COOP/COEP via service worker so SharedArrayBuffer
   works on hosts (like GitHub Pages) that don't set those headers.
   Adapted from https://github.com/gzuidhof/coi-serviceworker (MIT). */
if (typeof window === 'undefined') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
  self.addEventListener('fetch', (e) => {
    if (e.request.cache === 'only-if-cached' && e.request.mode !== 'same-origin') return;
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          if (r.status === 0) return r;
          const h = new Headers(r.headers);
          h.set('Cross-Origin-Embedder-Policy', 'require-corp');
          h.set('Cross-Origin-Opener-Policy', 'same-origin');
          return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
        })
        .catch((err) => console.error('[coi-sw] fetch error:', err)),
    );
  });
} else {
  (() => {
    if (window.crossOriginIsolated) return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register(window.document.currentScript.src).then(
      (reg) => {
        reg.addEventListener('updatefound', () => window.location.reload());
        if (reg.active && !navigator.serviceWorker.controller) window.location.reload();
      },
      (err) => console.error('[coi-sw] register failed:', err),
    );
  })();
}
