// 本地資料持久化：所有資料存在 localStorage，不需要任何後端伺服器。
// 跟根目錄旅遊記帳系統的 js/storage.js 是同一套模式，但這是完全獨立的一份資料，key 不同。

const STORAGE_KEY = 'kids-reward-tracker/v1';

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
export { uid };

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('讀取本地資料失敗，將重設資料', err);
    return null;
  }
}

function emptyState() {
  return {
    activeKidId: null,
    kids: {},
    taskTemplates: [],
    ledger: [],
    exerciseFormulas: [],
    exerciseSubmissions: [],
    certificateTiers: [],
    awardedCertificates: [],
    savingsChallenges: [],
    shopCatalog: [],
    pin: { plain: null },
    updatedAt: 0,
  };
}

function sanitize(s) {
  if (!s.kids || typeof s.kids !== 'object') s.kids = {};
  for (const kid of Object.values(s.kids)) {
    if (!kid.challengeProgress || typeof kid.challengeProgress !== 'object') kid.challengeProgress = {};
    if (!kid.sleepRecords || typeof kid.sleepRecords !== 'object') kid.sleepRecords = {};
  }
  if (!Array.isArray(s.taskTemplates)) s.taskTemplates = [];
  if (!Array.isArray(s.ledger)) s.ledger = [];
  if (!Array.isArray(s.exerciseFormulas)) s.exerciseFormulas = [];
  if (!Array.isArray(s.exerciseSubmissions)) s.exerciseSubmissions = [];
  if (!Array.isArray(s.certificateTiers)) s.certificateTiers = [];
  if (!Array.isArray(s.awardedCertificates)) s.awardedCertificates = [];
  // 一次性清理：獎狀曾經在每次頒發時都複製一份小孩大頭貼存進 photoDataUrl，同一個門檻
  // 反覆跨越就會複製一堆重複的照片，很容易把整包資料撐爆 Firestore 單一文件 1MB 的上限
  // 導致同步失敗（見 ledger.js 的說明）。這裡把「跟小孩目前大頭貼完全一樣」的複製本清掉
  // （畫面上會自動改用小孩目前的大頭貼顯示，效果不變），只保留家長曾經手動補傳、
  // 跟目前大頭貼不同的照片。
  for (const cert of s.awardedCertificates) {
    const kid = s.kids[cert.kidId];
    if (kid && cert.photoDataUrl && cert.photoDataUrl === kid.avatar) cert.photoDataUrl = null;
  }
  if (!Array.isArray(s.savingsChallenges)) s.savingsChallenges = [];
  if (!Array.isArray(s.shopCatalog)) s.shopCatalog = [];
  if (!s.pin || typeof s.pin !== 'object') s.pin = { plain: null };
  if (typeof s.activeKidId !== 'string') s.activeKidId = s.activeKidId || null;
  if (typeof s.updatedAt !== 'number') s.updatedAt = 0; // 相容舊版本存的資料
  return s;
}

let state = sanitize(loadRaw() || emptyState());

export function getState() {
  return state;
}

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((fn) => fn());
}

// 雲端同步曾經靠「這次是不是剛點信件連結登入」這種跟資料新舊完全無關的訊號，去猜「本機
// 跟雲端不一樣時該用哪一份」——這在同一帳號同時在多台裝置使用時是錯的：切到另一台裝置、
// 單純重新整理（不是剛點連結）時，那台裝置的本機快取通常比較舊，一開機就把自己這份舊資料
// 蓋回雲端，把剛剛在別的裝置做的修改整個抹掉。改成每次真正修改資料時，都用這個共用的
// persist() 記錄一個 updatedAt 時間戳記（這個 app 全部資料存成一份 JSON，不像旅遊記帳系統
// 拆成每趟旅程各自一份，所以只需要一個整體的時間戳記，不用逐項分開記）；cloud-sync.js
// 收到雲端資料時直接比較本機與雲端誰的時間比較新，新的那份才生效，不再用「有沒有剛點
// 登入連結」去猜。注意：這裡刻意只在「真的是本機自己做了修改」時才更新時間戳記，套用從
// 雲端拉下來的資料（applySyncedState）不能經過這裡，不然每次同步都會把本機的時間戳記
// 洗成「現在」，之後永遠都會誤判成本機比較新。
export function persist() {
  state.updatedAt = Date.now();
  writeAndNotify();
}

function writeAndNotify() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('儲存本地資料失敗（可能是空間不足）', err);
    alert('儲存失敗：瀏覽器儲存空間可能已滿（常見原因是照片太多），請刪除部分照片或舊獎狀。');
  }
  notify();
}

// ---------------------------------------------------------------- 多裝置同步（選用）

// 這裡沒有任何「只存在本機、不用同步」的欄位（不像旅遊記帳系統的 ratesCache 那樣），
// 所以整個 state 就是可同步的內容。
export function getSyncableState() {
  return state;
}

// 用雲端資料整批覆蓋本機狀態（cloud-sync.js 收到遠端快照時呼叫）。刻意呼叫 writeAndNotify()
// 而不是 persist()：這裡套用的是雲端已經決定好、帶著自己 updatedAt 的資料，不能被這裡
// 洗成「現在」，理由見 persist() 上面的說明。
export function applySyncedState(remote) {
  state = sanitize(remote);
  writeAndNotify();
}

// ---------------------------------------------------------------- 小孩

export function getKids() {
  return Object.values(state.kids).sort((a, b) => a.createdAt - b.createdAt);
}

export function getKid(kidId) {
  return state.kids[kidId] || null;
}

export function addKid({ name, avatar = null }) {
  const id = uid();
  state.kids[id] = { id, name: name.trim(), avatar, createdAt: Date.now(), challengeProgress: {}, sleepRecords: {} };
  if (!state.activeKidId) state.activeKidId = id;
  persist();
  return state.kids[id];
}

export function updateKid(kidId, patch) {
  const kid = state.kids[kidId];
  if (!kid) return;
  Object.assign(kid, patch);
  persist();
}

export function deleteKid(kidId) {
  delete state.kids[kidId];
  state.ledger = state.ledger.filter((e) => e.kidId !== kidId);
  state.exerciseSubmissions = state.exerciseSubmissions.filter((e) => e.kidId !== kidId);
  state.awardedCertificates = state.awardedCertificates.filter((c) => c.kidId !== kidId);
  if (state.activeKidId === kidId) {
    const remaining = getKids();
    state.activeKidId = remaining.length ? remaining[0].id : null;
  }
  persist();
}

export function setActiveKid(kidId) {
  state.activeKidId = kidId;
  persist();
}

// ---------------------------------------------------------------- 作業清單

export function getTaskTemplates() {
  return state.taskTemplates;
}

export function addTaskTemplate({ name, icon, stars, category = null }) {
  const t = { id: uid(), name: name.trim(), icon, stars: Number(stars), category, active: true };
  state.taskTemplates.push(t);
  persist();
  return t;
}

export function updateTaskTemplate(id, patch) {
  const t = state.taskTemplates.find((x) => x.id === id);
  if (!t) return;
  Object.assign(t, patch);
  persist();
}

export function deleteTaskTemplate(id) {
  state.taskTemplates = state.taskTemplates.filter((x) => x.id !== id);
  persist();
}

// ---------------------------------------------------------------- 帳本（唯讀存取，寫入請走 ledger.js）

export function getLedger(kidId) {
  return state.ledger.filter((e) => e.kidId === kidId).sort((a, b) => a.createdAt - b.createdAt);
}

export function pushLedgerEntryRaw(entry) {
  state.ledger.push(entry);
  return entry;
}

export function removeLedgerEntryRaw(id) {
  state.ledger = state.ledger.filter((e) => e.id !== id);
}

// 從「歷程」畫面上隱藏一筆帳本紀錄，但不動星星：getBalance()／getStreak()／
// getMonthCalendar() 都不會理會這個旗標，一樣照常把這筆算進餘額/連續天數/日曆標記。
export function hideLedgerEntryFromHistory(id) {
  const e = state.ledger.find((x) => x.id === id);
  if (e) e.hiddenFromHistory = true;
}

// ---------------------------------------------------------------- 睡眠回報（掛在小孩身上，同一天可覆蓋修正）

export function getSleepRecord(kidId, dateStr) {
  const kid = state.kids[kidId];
  return (kid && kid.sleepRecords[dateStr]) || null;
}

export function setSleepRecord(kidId, dateStr, record) {
  const kid = state.kids[kidId];
  if (!kid) return;
  if (record) kid.sleepRecords[dateStr] = record;
  else delete kid.sleepRecords[dateStr];
}

// ---------------------------------------------------------------- 運動換算公式 + 回報

export function getExerciseFormulas() {
  return state.exerciseFormulas;
}

export function addExerciseFormula({ kind, label, unitsPerStar }) {
  const f = { id: uid(), kind: kind.trim(), label: label.trim(), unitsPerStar: Number(unitsPerStar) };
  state.exerciseFormulas.push(f);
  persist();
  return f;
}

export function updateExerciseFormula(id, patch) {
  const f = state.exerciseFormulas.find((x) => x.id === id);
  if (!f) return;
  Object.assign(f, patch);
  persist();
}

export function deleteExerciseFormula(id) {
  state.exerciseFormulas = state.exerciseFormulas.filter((x) => x.id !== id);
  persist();
}

export function getExerciseSubmissions(kidId = null) {
  const list = kidId ? state.exerciseSubmissions.filter((s) => s.kidId === kidId) : state.exerciseSubmissions;
  return list.slice().sort((a, b) => b.createdAt - a.createdAt);
}

export function addExerciseSubmission({ kidId, kind, reportedValue, suggestedStars, date }) {
  const s = {
    id: uid(),
    kidId,
    createdAt: Date.now(),
    date,
    kind,
    reportedValue: Number(reportedValue),
    suggestedStars,
    status: 'pending',
    approvedStars: null,
    reviewedAt: null,
    ledgerEntryId: null,
  };
  state.exerciseSubmissions.push(s);
  persist();
  return s;
}

export function getExerciseSubmission(id) {
  return state.exerciseSubmissions.find((s) => s.id === id) || null;
}

export function updateExerciseSubmission(id, patch) {
  const s = state.exerciseSubmissions.find((x) => x.id === id);
  if (!s) return null;
  Object.assign(s, patch);
  persist();
  return s;
}

export function deleteExerciseSubmissionRaw(id) {
  state.exerciseSubmissions = state.exerciseSubmissions.filter((s) => s.id !== id);
}

// ---------------------------------------------------------------- 獎狀門檻 + 獎狀牆

export function getCertificateTiers() {
  return state.certificateTiers.slice().sort((a, b) => a.threshold - b.threshold);
}

export function addCertificateTier({ threshold, title }) {
  const t = { id: uid(), threshold: Number(threshold), title: title.trim(), order: state.certificateTiers.length };
  state.certificateTiers.push(t);
  persist();
  return t;
}

export function updateCertificateTier(id, patch) {
  const t = state.certificateTiers.find((x) => x.id === id);
  if (!t) return;
  Object.assign(t, patch);
  persist();
}

export function deleteCertificateTier(id) {
  state.certificateTiers = state.certificateTiers.filter((x) => x.id !== id);
  persist();
}

export function getAwardedCertificates(kidId = null) {
  const list = kidId ? state.awardedCertificates.filter((c) => c.kidId === kidId) : state.awardedCertificates;
  return list.slice().sort((a, b) => b.createdAt - a.createdAt);
}

export function addAwardedCertificate(cert) {
  const c = { id: uid(), createdAt: Date.now(), photoDataUrl: null, ...cert };
  state.awardedCertificates.push(c);
  persist();
  return c;
}

export function updateAwardedCertificate(id, patch) {
  const c = state.awardedCertificates.find((x) => x.id === id);
  if (!c) return;
  Object.assign(c, patch);
  persist();
}

// ---------------------------------------------------------------- 儲蓄挑戰

export function getSavingsChallenges() {
  return state.savingsChallenges;
}

export function addSavingsChallenge({ name, scope, minBalance, targetDays, bonusStars }) {
  const c = {
    id: uid(),
    name: name.trim(),
    scope,
    minBalance: Number(minBalance),
    targetDays: Number(targetDays),
    bonusStars: Number(bonusStars),
    active: true,
  };
  state.savingsChallenges.push(c);
  persist();
  return c;
}

export function updateSavingsChallenge(id, patch) {
  const c = state.savingsChallenges.find((x) => x.id === id);
  if (!c) return;
  Object.assign(c, patch);
  persist();
}

export function deleteSavingsChallenge(id) {
  state.savingsChallenges = state.savingsChallenges.filter((x) => x.id !== id);
  persist();
}

export function getChallengeProgress(kidId, challengeId) {
  const kid = state.kids[kidId];
  if (!kid) return { streakDays: 0, lastCountedDate: null };
  if (!kid.challengeProgress[challengeId]) kid.challengeProgress[challengeId] = { streakDays: 0, lastCountedDate: null };
  return kid.challengeProgress[challengeId];
}

// ---------------------------------------------------------------- 星星商店

export function getShopCatalog() {
  return state.shopCatalog;
}

export function addShopItem({ name, icon, cost, kind }) {
  const item = { id: uid(), name: name.trim(), icon, cost: Number(cost), kind, active: true };
  state.shopCatalog.push(item);
  persist();
  return item;
}

export function updateShopItem(id, patch) {
  const item = state.shopCatalog.find((x) => x.id === id);
  if (!item) return;
  Object.assign(item, patch);
  persist();
}

export function deleteShopItem(id) {
  state.shopCatalog = state.shopCatalog.filter((x) => x.id !== id);
  persist();
}

// ---------------------------------------------------------------- PIN

export function getPin() {
  return state.pin.plain;
}

export function setPin(pin) {
  state.pin.plain = pin || null;
  persist();
}
