// 運動自主回報：小孩送出實際數字（例如今天走了幾步）→ 依家長設定的換算比例
// 自動算出建議星星數（無條件捨去）→ 進待審核佇列 → 家長核准（可調整星星數）才真正寫進帳本。

import { addExerciseSubmission, getExerciseSubmission, updateExerciseSubmission, deleteExerciseSubmissionRaw, persist } from './storage.js';
import { addLedgerEntry, todayStr } from './ledger.js';

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

// 刪除一筆回報歷史（例如小孩亂測試打進去的離譜數字）。只刪紀錄本身，不動星星餘額——
// 已經核准入帳的星星維持不變，家長想調整的話自己走「手動調整星星」。
export function deleteExerciseSubmission(submissionId) {
  deleteExerciseSubmissionRaw(submissionId);
  persist();
}
