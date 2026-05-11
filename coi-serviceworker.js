/* coi-serviceworker.js — credentialless variant.
   Adapted from github.com/gzuidhof/coi-serviceworker (MIT).

   Why credentialless: the previous `require-corp` mode forced the browser
   to reject every cross-origin response that didn't carry a
   Cross-Origin-Resource-Policy header — including S3 presigned video
   URLs — surfacing as "FetchEvent ... promise was rejected".

   Strategy:
   - Only rewrite headers on top-level same-origin document responses
     (that's where COOP/COEP actually need to land for cross-origin
     isolation).
   - Pass every other fetch (sub-resources, cross-origin, media, opaque
     responses) through untouched, so S3 / CDN fetches work normally.
*/

if (typeof window === 'undefined') {
  // ---------- Service worker context ----------
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

  self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Only touch top-level document navigations on the same origin.
    const url = new URL(req.url);
    const isSameOrigin = url.origin === self.location.origin;
    const isTopLevelDoc =
      req.mode === 'navigate' && req.destination === 'document';

    if (!isSameOrigin || !isTopLevelDoc) {
      // Let the browser handle it directly — no rewrite, no opaque-body issues.
      return;
    }

    if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

    event.respondWith(
      fetch(req).then((r) => {
        if (r.status === 0) return r;
        const h = new Headers(r.headers);
        h.set('Cross-Origin-Embedder-Policy', 'credentialless');
        h.set('Cross-Origin-Opener-Policy', 'same-origin');
        return new Response(r.body, {
          status: r.status,
          statusText: r.statusText,
          headers: h,
        });
      }),
    );
  });
} else {
  // ---------- Window context: register / unregister ----------
  (() => {
    const params = new URLSearchParams(location.search);
    if (params.has('coi-reload')) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .then(() => location.replace(location.pathname));
      return;
    }
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
