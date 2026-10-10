// BOULPAT MASTER - Service worker (offline-first pour le shell applicatif)
const CACHE = 'boulpat-shell-v9';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './logo.png', './firebase-config.js', './firebase-sync.js', './of-engine.js', './qr.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Ne pas intercepter les appels Firestore / Auth (googleapis) : le SDK gère lui-même le hors ligne
  const url = new URL(e.request.url);
  if (url.origin !== location.origin && !url.href.startsWith('https://www.gstatic.com/firebasejs/')) return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(res => {
        // Fichiers de l'appli + SDK Firebase (gstatic) mis en cache pour le mode hors ligne
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => hit || caches.match('./index.html'));
      return hit || net;
    })
  );
});
