// 睡眠回報：小孩在日曆上點一天、輸入那天的睡覺時間，立即依「越早睡越多顆星」的規則
// 換算星星入帳，不用家長審核（跟作業打勾一樣是自主、即時的）。同一天可以重新輸入修正，
// 會先移除舊的那筆帳本紀錄，再依新時間重新入帳一次。
//
// 星星規則：晚上 10 點睡 = 1 顆星，每提早 30 分鐘再加 1 顆（無條件四捨五入到最近的
// 30 分鐘，剛好在正中間 15 分鐘時，用比較早、比較多顆星的那一邊，例如 9:45 算 9:30、
// 9:46 算 10:00）。同樣的捨入規則也套用在比 10 點晚的情況：超過 10 點太多（捨入後仍
// 晚於 10 點）就沒有星星，但當天的睡覺時間還是會顯示在日曆上。

import { getSleepRecord, setSleepRecord, getState, persist } from './storage.js';
import { addLedgerEntry, removeLedgerEntry } from './ledger.js';

const TARGET_MINUTES = 22 * 60; // 晚上 10 點基準

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function computeSleepStars(bedtime) {
  const advance = TARGET_MINUTES - timeToMinutes(bedtime);
  const rounded = Math.round(advance / 30) * 30;
  return rounded >= 0 ? rounded / 30 + 1 : 0;
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
