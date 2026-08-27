// 星星帳本的核心邏輯：所有會影響星星餘額的動作都要透過 addLedgerEntry()，
// 這樣「餘額」「獎狀門檻跨越偵測」「儲蓄挑戰連續天數」才會永遠是一致的衍生結果，
// 不會有其他模組各自土法煉鋼算餘額、算漏某個異動的問題。

import {
  getState,
  persist,
  pushLedgerEntryRaw,
  getKid,
  getCertificateTiers,
  addAwardedCertificate,
  getSavingsChallenges,
  getChallengeProgress,
  uid,
} from './storage.js';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getBalance(kidId) {
  return getState()
    .ledger.filter((e) => e.kidId === kidId)
    .reduce((sum, e) => sum + e.amount, 0);
}

// 內部用：只把帳本紀錄寫進去，不 persist、不做任何衍生判斷（給遞迴呼叫用，避免重複觸發）
function rawAdd(kidId, { amount, type, refId = null, label, date = todayStr() }) {
  const entry = { id: uid(), kidId, date, createdAt: Date.now(), amount: Number(amount), type, refId, label };
  pushLedgerEntryRaw(entry);
  return entry;
}

function checkTierCrossings(kidId, prevBalance, newBalance) {
  if (newBalance <= prevBalance) return [];
  const kid = getKid(kidId);
  if (!kid) return [];
  const newlyUnlocked = [];
  for (const tier of getCertificateTiers()) {
    if (prevBalance < tier.threshold && tier.threshold <= newBalance) {
      const cert = addAwardedCertificate({
        kidId,
        tierId: tier.id,
        tierTitleSnapshot: tier.title,
        thresholdSnapshot: tier.threshold,
        starsAtAward: newBalance,
        date: todayStr(),
        photoDataUrl: kid.avatar || null,
      });
      newlyUnlocked.push(cert);
    }
  }
  return newlyUnlocked;
}

function challengeAppliesTo(challenge, kidId) {
  return challenge.active && (challenge.scope === 'all' || challenge.scope === kidId);
}

// 儲蓄挑戰：每次帳本異動後檢查一次。同一天只計一次連續天數（用 lastCountedDate 擋重複），
// 達標就發一筆 savings_bonus 正數紀錄並歸零重來（可重複挑戰）。
// 這是「有開 app 才會被計入」的簡化版，不是逐日回溯歷史餘額快照。
function evaluateSavingsChallenges(kidId) {
  const kid = getKid(kidId);
  if (!kid) return [];
  const today = todayStr();
  const bonusesAwarded = [];
  for (const challenge of getSavingsChallenges()) {
    if (!challengeAppliesTo(challenge, kidId)) continue;
    const progress = getChallengeProgress(kidId, challenge.id);
    const balance = getBalance(kidId);
    if (balance < challenge.minBalance) {
      if (progress.streakDays !== 0) progress.streakDays = 0;
      continue;
    }
    if (progress.lastCountedDate === today) continue; // 今天已經計過了
    progress.streakDays += 1;
    progress.lastCountedDate = today;
    if (progress.streakDays >= challenge.targetDays) {
      progress.streakDays = 0; // 達標，歸零重新開始下一輪挑戰
      const prevBalance = getBalance(kidId);
      const entry = rawAdd(kidId, {
        amount: challenge.bonusStars,
        type: 'savings_bonus',
        refId: challenge.id,
        label: `儲蓄挑戰達成：${challenge.name}`,
        date: today,
      });
      bonusesAwarded.push(entry);
      const newBalance = getBalance(kidId);
      checkTierCrossings(kidId, prevBalance, newBalance);
    }
  }
  return bonusesAwarded;
}

/**
 * 唯一的帳本寫入入口。回傳 { entry, newlyUnlockedTiers, savingsBonuses }。
 */
export function addLedgerEntry(kidId, { amount, type, refId = null, label, date = todayStr() }) {
  const prevBalance = getBalance(kidId);
  const entry = rawAdd(kidId, { amount, type, refId, label, date });
  const newBalance = getBalance(kidId);

  const newlyUnlockedTiers = checkTierCrossings(kidId, prevBalance, newBalance);
  const savingsBonuses = evaluateSavingsChallenges(kidId);

  persist();
  return { entry, newlyUnlockedTiers, savingsBonuses };
}

export function getStreak(kidId) {
  const dates = new Set(
    getState()
      .ledger.filter((e) => e.kidId === kidId && (e.type === 'task' || e.type === 'exercise'))
      .map((e) => e.date)
  );
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (!dates.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getMonthCalendar(kidId, year, month) {
  const dates = new Set(
    getState()
      .ledger.filter((e) => e.kidId === kidId && (e.type === 'task' || e.type === 'exercise'))
      .map((e) => e.date)
  );
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay.getDay(); i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ day, dateStr: key, hasActivity: dates.has(key) });
  }
  return cells;
}

export { todayStr };
