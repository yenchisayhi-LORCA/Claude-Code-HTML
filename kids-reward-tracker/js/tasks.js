// 「完成作業」「手動調整星星」都是對帳本的一次寫入，包成小函式讓 app.js 呼叫時語意清楚。

import { getState, persist } from './storage.js';
import { addLedgerEntry, removeLedgerEntry, todayStr } from './ledger.js';

// 同一項作業同一天只能算完成一次（避免重複點擊重複入帳）；隔天日期不同就可以再做一次。
export function hasCompletedTaskToday(kidId, taskId) {
  const today = todayStr();
  return getState().ledger.some((e) => e.kidId === kidId && e.type === 'task' && e.refId === taskId && e.date === today);
}

export function completeTask(kidId, task) {
  return addLedgerEntry(kidId, { amount: task.stars, type: 'task', refId: task.id, label: task.name, date: todayStr() });
}

// 再點一次已完成的作業＝取消今天的完成紀錄，把剛剛入帳的星星退回去。
export function uncompleteTask(kidId, taskId) {
  const today = todayStr();
  const entry = getState().ledger.find((e) => e.kidId === kidId && e.type === 'task' && e.refId === taskId && e.date === today);
  if (!entry) return;
  removeLedgerEntry(entry.id);
  persist();
}

export function manualAdjust(kidId, { amount, reason }) {
  return addLedgerEntry(kidId, { amount, type: 'manual', refId: null, label: reason, date: todayStr() });
}
