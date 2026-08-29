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
          return fallback || offlineResponse();
        }
        // 非導覽請求（圖片、字型、JS 等）如果連快取都沒有，就讓這次 fetch 失敗自然往上拋，
        // 讓瀏覽器照平常的方式處理載入失敗（例如 <img> 顯示壞圖示），而不是硬塞一個
        // 純文字的「離線」假回應——那樣圖片會直接整張消失、看起來像資料不見了，
        // 但其實只是行動網路一時不穩，之後重新整理通常就會恢復正常。
        throw err;
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
