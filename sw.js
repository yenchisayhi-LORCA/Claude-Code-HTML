// Service Worker：快取網站本身的檔案（HTML/CSS/JS），讓瀏覽器開過一次之後，
// 沒有網路也能重新打開這個記帳網頁。記帳資料本來就存在 localStorage，離線不受影響，
// 這裡只解決「網頁本身要能被打開」這件事。
//
// 策略：
// - 有版號（網址帶 ?v=commit-sha）的檔案，內容不會變，快取後直接沿用，不用每次重新驗證。
// - 沒有版號的檔案（主要是 index.html），優先用網路拿最新版本，成功的話同時更新快取；
//   只有真的離線（fetch 失敗）才退回上一次成功快取的版本。
//   （原本是「先用快取讓畫面馬上出現、背景才更新」，聽起來比較快，但代價是每次部署新版後，
//   使用者下一次打開網頁一定還是先吃到舊版，快取要等這一次背景更新完，「再下一次」才會是
//   新版——沒有網路問題時完全沒必要接受這個延遲。這個專案已經修過好幾次會搞丟資料的緊急
//   bug，任何一次修好後使用者卻因為這一輪延遲繼續吃到舊版、繼續搞丟資料，都不能接受，所以
//   只要連得上網路就一定要拿當下最新的版本，快取只當離線時的備援。）
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

  if (isVersioned) {
    // 版號固定的檔案內容不會變，快取後直接沿用，不用每次重新驗證
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

  // 沒有版號的檔案（主要是 index.html）：優先用網路拿最新版本，只有真的離線才退回快取
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        const cached = await cache.match(req);
        if (cached) return cached;
        // 離線又沒有任何快取版本：導覽（打開網頁）就退回上次成功快取的首頁，其他檔案就只能失敗
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
