// 本地資料持久化：所有資料存在 localStorage，不需要任何後端伺服器。

const STORAGE_KEY = 'travel-expense-tracker/v1';

export const DEFAULT_CATEGORIES = [
  { id: 'food', name: '餐飲', icon: '🍽️', color: '#f97316' },
  { id: 'stay', name: '住宿', icon: '🏨', color: '#6366f1' },
  { id: 'transport', name: '交通', icon: '🚌', color: '#0ea5e9' },
  { id: 'ticket', name: '票券門票', icon: '🎫', color: '#a855f7' },
  { id: 'shopping', name: '購物', icon: '🛍️', color: '#ec4899' },
  { id: 'fun', name: '娛樂', icon: '🎉', color: '#f59e0b' },
  { id: 'comm', name: '通訊網路', icon: '📱', color: '#14b8a6' },
  { id: 'medical', name: '醫療', icon: '🏥', color: '#ef4444' },
  { id: 'other', name: '其他', icon: '📦', color: '#64748b' },
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
  return { activeTripId: null, trips: {}, ratesCache: {} };
}

let state = loadRaw() || emptyState();

export function getState() {
  return state;
}

export function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('儲存本地資料失敗（可能是空間不足）', err);
    alert('儲存失敗：瀏覽器儲存空間可能已滿（常見原因是收據照片太多），請刪除部分收據照片或舊旅程。');
  }
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

export function createTrip({ name, baseCurrency, startDate, endDate, budgetTotal, budgetDaily, members }) {
  const id = uid('trip');
  const trip = {
    id,
    name,
    baseCurrency,
    startDate: startDate || '',
    endDate: endDate || '',
    budgetTotal: budgetTotal || null,
    budgetDaily: budgetDaily || null,
    members: (members && members.length ? members : ['我']).map((n) => ({ id: uid('member'), name: n })),
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

export function deleteTrip(tripId) {
  delete state.trips[tripId];
  if (state.activeTripId === tripId) {
    const remaining = getTrips();
    state.activeTripId = remaining.length ? remaining[0].id : null;
  }
  persist();
}

export function addMember(tripId, name) {
  const trip = state.trips[tripId];
  if (!trip) return;
  const member = { id: uid('member'), name };
  trip.members.push(member);
  persist();
  return member;
}

export function renameMember(tripId, memberId, name) {
  const trip = state.trips[tripId];
  const member = trip && trip.members.find((m) => m.id === memberId);
  if (!member) return;
  member.name = name;
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
