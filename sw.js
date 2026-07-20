const CACHE_NAME = 'snapsy-v6';
const ASSETS = ['./index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = req.url;

  // Selalu network-only untuk API dinamis — jangan pernah di-cache/di-intercept.
  // .catch() di sini WAJIB ada — tanpa ini, kalau fetch gagal (koneksi putus sebentar dll),
  // promise-nya reject tanpa ada yang nangkep → "Uncaught (in promise) TypeError: Failed to fetch".
  if (url.includes('api.github.com') || url.includes('googleapis.com') || url.includes('accounts.google.com')) {
    e.respondWith(fetch(req).catch(() => new Response(null, { status: 503, statusText: 'Network error' })));
    return;
  }

  // Cuma coba cache untuk GET request dengan skema http/https (skip chrome-extension:// dll)
  const isCacheable = req.method === 'GET' && url.startsWith('http');
  if (!isCacheable) {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  e.respondWith(
    fetch(req)
      .then(res => {
        // Jangan cache response yang gagal/bukan basic (opaque, redirect, dll juga aman di-skip)
        if (res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
