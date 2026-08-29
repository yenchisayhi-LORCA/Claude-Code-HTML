// 睡眠回報：小孩在日曆上點一天、輸入那天的睡覺時間，立即依「越早睡越多顆星」的規則
// 換算星星入帳，不用家長審核（跟作業打勾一樣是自主、即時的）。同一天可以重新輸入修正，
// 會先移除舊的那筆帳本紀錄，再依新時間重新入帳一次。
//
// 星星規則：晚上 10 點睡 = 1 顆星，每提早 30 分鐘再加 1 顆（無條件四捨五入到最近的
// 30 分鐘，剛好在正中間 15 分鐘時，用比較早、比較多顆星的那一邊，例如 9:45 算 9:30、
// 9:46 算 10:00），最多封頂 5 顆星（晚上 8 點、或比 8 點更早，都算 5 顆，不會再往上加）。
// 同樣的捨入規則也套用在比 10 點晚的情況：超過 10 點太多（捨入後仍晚於 10 點）就沒有
// 星星，半夜到隔天中午前的時間（例如熬夜到凌晨 0 點多）當然也是 0 顆——但當天的睡覺
// 時間還是會顯示在日曆上。

import { getSleepRecord, setSleepRecord, getState, persist } from './storage.js';
import { addLedgerEntry, removeLedgerEntry } from './ledger.js';

const TARGET_MINUTES = 22 * 60; // 晚上 10 點基準
const MAX_SLEEP_STARS = 5; // 晚上 8 點（或更早）封頂

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  let minutes = h * 60 + m;
  // 半夜到中午這段時間不可能是「提早睡」，是熬夜到隔天凌晨，要當成「隔天」處理
  // （加一整天的分鐘數），這樣算出來的提早量才會是一大筆「遲到」而不是被誤判成
  // 提早了快一整天、算出離譜的星星數（例如凌晨 0:10 曾經被誤判成 45 顆星）。
  if (minutes < 12 * 60) minutes += 24 * 60;
  return minutes;
}

export function computeSleepStars(bedtime) {
  const advance = TARGET_MINUTES - timeToMinutes(bedtime);
  const rounded = Math.round(advance / 30) * 30;
  if (rounded < 0) return 0;
  return Math.min(rounded / 30 + 1, MAX_SLEEP_STARS);
}

export function submitSleep(kidId, dateStr, bedtime) {
  const existing = getSleepRecord(kidId, dateStr);
  if (existing && existing.ledgerEntryId) removeLedgerEntry(existing.ledgerEntryId);
  const stars = computeSleepStars(bedtime);
  const result = addLedgerEntry(kidId, { amount: stars, type: 'sleep', refId: dateStr, label: `睡眠回報：${bedtime}`, date: dateStr });
  setSleepRecord(kidId, dateStr, { bedtime, stars, ledgerEntryId: result.entry.id });
  persist();
  return result;
}

export function clearSleep(kidId, dateStr) {
  const existing = getSleepRecord(kidId, dateStr);
  if (!existing) return;
  if (existing.ledgerEntryId) removeLedgerEntry(existing.ledgerEntryId);
  setSleepRecord(kidId, dateStr, null);
  persist();
}

export function getSleepMonthCalendar(kidId, year, month) {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay.getDay(); i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ day, dateStr, record: getSleepRecord(kidId, dateStr) });
  }
  return cells;
}

// 只列出目前日曆檢視的那個月份（year/month，month 從 0 開始），跟切換上/下個月連動，
// 不是不分月份、只看最近幾筆。
export function getSleepHistory(kidId, year, month) {
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  return getState()
    .ledger.filter((e) => e.kidId === kidId && e.type === 'sleep' && e.date.startsWith(monthPrefix))
    .sort((a, b) => b.date.localeCompare(a.date));
}
