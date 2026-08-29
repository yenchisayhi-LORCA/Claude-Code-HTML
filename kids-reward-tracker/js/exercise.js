// 運動自主回報：小孩送出實際數字（例如今天走了幾步）→ 依家長設定的換算比例
// 自動算出建議星星數（無條件捨去）→ 進待審核佇列 → 家長核准（可調整星星數）才真正寫進帳本。

import { addExerciseSubmission, getExerciseSubmission, updateExerciseSubmission, deleteExerciseSubmissionRaw, persist } from './storage.js';
import { addLedgerEntry, removeLedgerEntry, todayStr } from './ledger.js';

export function computeSuggestedStars(formula, reportedValue) {
  if (!formula || !formula.unitsPerStar) return 0;
  return Math.floor(Number(reportedValue) / formula.unitsPerStar);
}

export function submitExercise(kidId, formula, reportedValue) {
  const suggestedStars = computeSuggestedStars(formula, reportedValue);
  return addExerciseSubmission({
    kidId,
    kind: formula.kind,
    reportedValue,
    suggestedStars,
    date: todayStr(),
  });
}

export function approveExercise(submissionId, approvedStars) {
  const submission = getExerciseSubmission(submissionId);
  if (!submission || submission.status !== 'pending') return null;
  const result = addLedgerEntry(submission.kidId, {
    amount: approvedStars,
    type: 'exercise',
    refId: submission.id,
    label: `運動回報核准：${submission.kind}`,
    date: submission.date,
  });
  updateExerciseSubmission(submissionId, {
    status: 'approved',
    approvedStars,
    reviewedAt: Date.now(),
    ledgerEntryId: result.entry.id,
  });
  return result;
}

export function rejectExercise(submissionId) {
  return updateExerciseSubmission(submissionId, { status: 'rejected', reviewedAt: Date.now() });
}

// 刪除一筆回報歷史（例如小孩亂測試打進去的離譜數字）。已核准的那筆如果有對應的帳本紀錄，
// 一併移除，不然歷史紀錄刪掉了、餘額卻還留著已經入帳的星星，會對不起來。
export function deleteExerciseSubmission(submissionId) {
  const submission = getExerciseSubmission(submissionId);
  if (!submission) return;
  if (submission.ledgerEntryId) removeLedgerEntry(submission.ledgerEntryId);
  deleteExerciseSubmissionRaw(submissionId);
  persist();
}
