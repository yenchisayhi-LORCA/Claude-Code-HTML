// 運動自主回報：小孩送出數字 → 依家長設定的換算公式算出建議星星數 → 進待審核佇列 →
// 家長核准（可調整星星數）才真正寫進帳本。

import { addExerciseSubmission, getExerciseSubmission, updateExerciseSubmission } from './storage.js';
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
