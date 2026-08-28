// 本地資料持久化：所有資料存在 localStorage，不需要任何後端伺服器。

const STORAGE_KEY = 'travel-expense-tracker/v1';
// 雲端同步曾經好幾次因為判斷邏輯的 bug，把這台裝置本來就有、比較新的旅程資料整批蓋掉
// （applySyncedState 直接整批覆蓋 activeTripId/trips/people）。這種覆蓋一旦發生就沒有回頭路，
// 使用者往往要過一陣子才會發現東西不見了，那時候要復原已經來不及。與其每次都在同步邏輯裡
// 抓還有沒有漏掉的 bug，這裡多一道最後防線：只要「即將要蓋掉的本機資料裡有雲端沒有的旅程」，
// 蓋之前就先把本機現有內容整份備份起來，就算判斷邏輯又有什麼沒想到的 bug，資料還在，
// 用 getLocalBackup()/restoreLocalBackup() 就能拿回來，不會真的憑空消失。
const BACKUP_KEY = 'travel-expense-tracker/v1/backup-before-remote-overwrite';

export const DEFAULT_CATEGORIES = [
  { id: 'food', name: '餐飲', icon: '🍲', color: '#f97316' },
  { id: 'stay', name: '住宿', icon: '🏠', color: '#22c55e' },
  { id: 'transport', name: '交通', icon: '🚌', color: '#0ea5e9' },
  { id: 'ticket', name: '票券門票', icon: '🎫', color: '#a855f7' },
  { id: 'shopping', name: '購物', icon: '🛍️', color: '#ec4899' },
  { id: 'fun', name: '娛樂', icon: '🎉', color: '#f59e0b' },
  { id: 'comm', name: '通訊網路', icon: '📱', color: '#14b8a6' },
  { id: 'medical', name: '醫療', icon: '🩺', color: '#ef4444' },
  { id: 'other', name: '其他', icon: '•••', color: '#64748b' },
];

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
  return { activeTripId: null, trips: {}, ratesCache: {}, people: [] };
}

let state = loadRaw() || emptyState();
if (!Array.isArray(state.people)) state.people = []; // 相容舊版本存的資料（還沒有成員名單功能）

export function getState() {
  return state;
}

// 讓其他模組（例如雲端同步）能在資料變動時收到通知，storage.js 本身不需要知道是誰在監聽
const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((fn) => fn());
}

export function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('儲存本地資料失敗（可能是空間不足）', err);
    alert('儲存失敗：瀏覽器儲存空間可能已滿（常見原因是收據照片太多），請刪除部分收據照片或舊旅程。');
  }
  notify();
}

// 只有 activeTripId + trips + people 需要跨裝置同步，ratesCache 只是本機快取，各裝置自己抓即可
export function getSyncableState() {
  return { activeTripId: state.activeTripId, trips: state.trips, people: state.people };
}

// 用雲端資料整批覆蓋本機的 activeTripId + trips + people（不動 ratesCache）
export function applySyncedState(remote) {
  const remoteTrips = remote.trips || {};
  const willLoseTrips = Object.keys(state.trips).some((id) => !(id in remoteTrips));
  if (willLoseTrips) {
    try {
      localStorage.setItem(
        BACKUP_KEY,
        JSON.stringify({ activeTripId: state.activeTripId, trips: state.trips, people: state.people, backedUpAt: Date.now() })
      );
    } catch (err) {
      console.error('備份本機資料失敗（可能是空間不足）', err);
    }
  }
  state.activeTripId = remote.activeTripId ?? null;
  state.trips = remoteTrips;
  state.people = remote.people || [];
  persist();
}

// 有沒有一份「上次被雲端資料整批覆蓋掉之前」的本機備份可以拿回來
export function getLocalBackup() {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('讀取本機備份失敗', err);
    return null;
  }
}

// 把備份的內容還原成目前的本機資料。還原後就把這份備份刪掉：一開始設計成「用過也留著」是
// 想避免使用者還原後手滑又被蓋一次、備份也跟著不見，但實際使用下來發現這個按鈕一直留在畫面上
// 反而更容易造成誤會——使用者搞不清楚「按鈕還在＝還沒還原成功」還是「按鈕還在＝可以重複按」，
// 結果對著同一份舊備份重複按下去，把還原之後才新增的旅程又蓋掉一次。改成用過就刪，真的需要
// 再救援時，下一次任何一次「即將覆蓋本機資料」的同步都會重新產生一份最新的備份，不會少這個保護。
export function restoreLocalBackup() {
  const backup = getLocalBackup();
  if (!backup) return false;
  state.activeTripId = backup.activeTripId ?? null;
  state.trips = backup.trips || {};
  state.people = backup.people || [];
  persist();
  try {
    localStorage.removeItem(BACKUP_KEY);
  } catch (err) {
    console.error('清除本機備份失敗', err);
  }
  return true;
}

// ---------------------------------------------------------------- 成員名單（跨旅程通用）

export function getPeople() {
  return state.people;
}

// 依姓名去重複：同名的人會直接沿用既有的那筆（連同他的照片），這樣不同旅程輸入同一個名字就能共用大頭貼
export function addPerson(name) {
  const trimmed = name.trim();
  const existing = state.people.find((p) => p.name === trimmed);
  if (existing) return existing;
  const person = { id: uid('person'), name: trimmed, avatar: null };
  state.people.push(person);
  persist();
  return person;
}

export function renamePerson(personId, name) {
  const person = state.people.find((p) => p.id === personId);
  if (!person) return;
  person.name = name;
  persist();
}

export function setPersonAvatar(personId, avatarDataUrl) {
  const person = state.people.find((p) => p.id === personId);
  if (!person) return;
  person.avatar = avatarDataUrl;
  // 旅程成員在加入當下是複製姓名/照片過去的獨立資料（見 addTripMember/createTrip 的註解），
  // 之後不會自動跟名單同步。這裡額外用姓名比對，把新照片同時套用到所有旅程裡「同名」的
  // 成員身上，這樣改一次名單裡的大頭貼，之前已經加入各旅程的縮圖也會一起更新，不用逐一
  // 進到每趟旅程手動改。跟 app.js 裡「旅程成員改照片時用姓名比對回寫名單」是同一個方向反過來。
  Object.values(state.trips).forEach((trip) => {
    trip.members.forEach((m) => {
      if (m.name === person.name) m.avatar = avatarDataUrl;
    });
  });
  persist();
}

export function removePerson(personId) {
  state.people = state.people.filter((p) => p.id !== personId);
  persist();
}

// 把名單裡的人加進某個旅程（複製當下的姓名/照片，之後在名單裡改照片不會回頭更新已加入的旅程）
export function addTripMember(tripId, personId) {
  const trip = state.trips[tripId];
  const person = state.people.find((p) => p.id === personId);
  if (!trip || !person) return;
  const member = { id: uid('member'), name: person.name, avatar: person.avatar };
  trip.members.push(member);
  persist();
  return member;
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getTrips() {
  return Object.values(state.trips).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function getActiveTrip() {
  return state.activeTripId ? state.trips[state.activeTripId] : null;
}

export function setActiveTrip(tripId) {
  state.activeTripId = tripId;
  persist();
}

// memberPersonIds：從成員名單挑選的人（見 getPeople/addPerson），會複製當下的姓名/照片成為旅程成員
export function createTrip({ name, baseCurrency, startDate, endDate, budgetTotal, budgetDaily, memberPersonIds }) {
  const id = uid('trip');
  const picked = (memberPersonIds || [])
    .map((pid) => state.people.find((p) => p.id === pid))
    .filter(Boolean)
    .map((person) => ({ id: uid('member'), name: person.name, avatar: person.avatar }));
  const trip = {
    id,
    name,
    baseCurrency,
    startDate: startDate || '',
    endDate: endDate || '',
    budgetTotal: budgetTotal || null,
    budgetDaily: budgetDaily || null,
    coverPhoto: null,
    members: picked.length ? picked : [{ id: uid('member'), name: '我', avatar: null }],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    expenses: [],
    createdAt: Date.now(),
  };
  state.trips[id] = trip;
  state.activeTripId = id;
  persist();
  return trip;
}

export function updateTrip(tripId, patch) {
  const trip = state.trips[tripId];
  if (!trip) return;
  Object.assign(trip, patch);
  persist();
}

// 分享此旅程的唯讀連結給誰看（用 Email 清單當白名單）。清空清單等於停止分享。
export function setTripShareViewers(tripId, emails) {
  const trip = state.trips[tripId];
  if (!trip) return;
  trip.shareViewers = emails;
  persist();
}

export function deleteTrip(tripId) {
  delete state.trips[tripId];
  if (state.activeTripId === tripId) {
    const remaining = getTrips();
    state.activeTripId = remaining.length ? remaining[0].id : null;
  }
  persist();
}

export function renameMember(tripId, memberId, name) {
  const trip = state.trips[tripId];
  const member = trip && trip.members.find((m) => m.id === memberId);
  if (!member) return;
  member.name = name;
  persist();
}

export function setMemberAvatar(tripId, memberId, avatarDataUrl) {
  const trip = state.trips[tripId];
  const member = trip && trip.members.find((m) => m.id === memberId);
  if (!member) return;
  member.avatar = avatarDataUrl;
  persist();
}

export function removeMember(tripId, memberId) {
  const trip = state.trips[tripId];
  if (!trip) return;
  trip.members = trip.members.filter((m) => m.id !== memberId);
  trip.expenses.forEach((exp) => {
    if (exp.paidBy === memberId) exp.paidBy = trip.members[0] ? trip.members[0].id : null;
    exp.splitMembers = (exp.splitMembers || []).filter((id) => id !== memberId);
    if (exp.splitCustom) delete exp.splitCustom[memberId];
  });
  persist();
}

export function addCategory(tripId, { name, icon, color }) {
  const trip = state.trips[tripId];
  if (!trip) return;
  const category = { id: uid('cat'), name, icon: icon || '🏷️', color: color || '#64748b' };
  trip.categories.push(category);
  persist();
  return category;
}

export function removeCategory(tripId, categoryId) {
  const trip = state.trips[tripId];
  if (!trip) return;
  trip.categories = trip.categories.filter((c) => c.id !== categoryId);
  persist();
}

export function addExpense(tripId, expense) {
  const trip = state.trips[tripId];
  if (!trip) return;
  const record = { id: uid('exp'), createdAt: Date.now(), ...expense };
  trip.expenses.push(record);
  persist();
  return record;
}

export function updateExpense(tripId, expenseId, patch) {
  const trip = state.trips[tripId];
  const exp = trip && trip.expenses.find((e) => e.id === expenseId);
  if (!exp) return;
  Object.assign(exp, patch);
  persist();
}

export function removeExpense(tripId, expenseId) {
  const trip = state.trips[tripId];
  if (!trip) return;
  trip.expenses = trip.expenses.filter((e) => e.id !== expenseId);
  persist();
}

export function getRatesCache(baseCurrency) {
  return state.ratesCache[baseCurrency] || null;
}

export function setRatesCache(baseCurrency, data) {
  state.ratesCache[baseCurrency] = data;
  persist();
}
