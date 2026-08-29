// Service Worker：快取這個小工具自己的檔案，離線也能重新打開。
// 跟根目錄旅遊記帳系統的 sw.js 是同一套策略（版號快取優先、無版號網路優先＋離線退回快取），
// 差別只在 CACHE_NAME 不同。因為這支檔案放在 photo-print-layout/ 目錄下註冊，
// scope 會自動限定在 /photo-print-layout/，不會跟根目錄或其他小工具的 sw.js 互相干擾。

const CACHE_NAME = 'photo-print-layout-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isVersioned = url.searchParams.has('v');

  if (isVersioned) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const fresh = await fetch(req).catch(() => null);
        if (fresh && fresh.ok) cache.put(req, fresh.clone());
        return fresh || offlineResponse();
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        const cached = await cache.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') {
          const fallback = await cache.match(new URL('./index.html', self.location.href));
          if (fallback) return fallback;
        }
        return offlineResponse();
      }
    })
  );
});

function offlineResponse() {
  return new Response('目前離線，且這個檔案還沒有被快取過。', {
    status: 503,
    statusText: 'Offline',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
