// Service Worker：快取網站本身的檔案（HTML/CSS/JS），讓瀏覽器開過一次之後，
// 沒有網路也能重新打開這個記帳網頁。記帳資料本來就存在 localStorage，離線不受影響，
// 這裡只解決「網頁本身要能被打開」這件事。
//
// 策略：
// - 有版號（網址帶 ?v=commit-sha）的檔案，內容不會變，快取後直接沿用，不用每次重新驗證。
// - 沒有版號的檔案（主要是 index.html），先用快取讓畫面能馬上出現，同時在背景重新抓最新版本更新快取，
//   這樣下次連上網路時能自動拿到新版，離線時則永遠有上一次成功載入的版本可用。
// - 其他網域的請求（匯率 API、Firebase 等）完全不經過這裡，一律直接走網路。

const CACHE_NAME = 'travel-expense-shell-v1';

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
  if (url.origin !== self.location.origin) return; // 外部網域（匯率 API、Firebase）不快取，交給瀏覽器正常處理

  const isVersioned = url.searchParams.has('v');

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);

      if (cached && isVersioned) return cached; // 版號固定的檔案內容不會變，快取後不用再驗證

      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);

      if (cached) {
        networkFetch; // 背景更新快取，不擋畫面
        return cached;
      }

      const fresh = await networkFetch;
      if (fresh) return fresh;

      // 離線又沒有任何快取版本：導覽（打開網頁）就退回上次成功快取的首頁，其他檔案就只能失敗
      if (req.mode === 'navigate') {
        const fallback = await cache.match(new URL('./index.html', self.location.href));
        if (fallback) return fallback;
      }
      return new Response('目前離線，且這個檔案還沒有被快取過。', {
        status: 503,
        statusText: 'Offline',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    })
  );
});
