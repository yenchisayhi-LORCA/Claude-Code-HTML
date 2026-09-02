// 分帳計算：計算每個成員的淨餘額，並用最少轉帳次數算出「誰該付誰多少錢」。

import { convertToBase } from './currency.js';

// 回傳 { memberId: 淨餘額（以旅程基準貨幣計算，正值代表應收回、負值代表應付出） }，
// 同時也回傳 paid（每人實際付款總額）跟 spent（每人實際分攤/花費總額）——
// 淨餘額只是 paid - spent，但畫面上「每人實際花費多少」「每人實際付了多少」
// 這兩個數字本身也有意義，不是只看淨額，所以這裡一次算好一起回傳，
// 不用另外重複跑一次一模一樣的分攤邏輯。
export function computeBalances(trip, ratesCache) {
  const balances = {};
  const paid = {};
  const spent = {};
  trip.members.forEach((m) => {
    balances[m.id] = 0;
    paid[m.id] = 0;
    spent[m.id] = 0;
  });

  const unresolved = [];

  trip.expenses.forEach((exp) => {
    const amountInBase = convertToBase(exp.amount, exp.currency, trip.baseCurrency, ratesCache);
    if (amountInBase === null) {
      unresolved.push(exp);
      return;
    }
    if (exp.paidBy in balances) {
      balances[exp.paidBy] += amountInBase;
      paid[exp.paidBy] += amountInBase;
    }

    if (exp.splitType === 'custom' && exp.splitCustom) {
      Object.entries(exp.splitCustom).forEach(([memberId, amt]) => {
        const shareInBase = convertToBase(Number(amt) || 0, exp.currency, trip.baseCurrency, ratesCache);
        if (shareInBase !== null && memberId in balances) {
          balances[memberId] -= shareInBase;
          spent[memberId] += shareInBase;
        }
      });
    } else {
      const members = (exp.splitMembers || []).filter((id) => id in balances);
      if (members.length) {
        const share = amountInBase / members.length;
        members.forEach((memberId) => {
          balances[memberId] -= share;
          spent[memberId] += share;
        });
      }
    }
  });

  return { balances, paid, spent, unresolved };
}

// 貪婪演算法：每次讓「餘額最多的債主」與「欠最多的債務人」互相清償，得到最少轉帳筆數
export function simplifyDebts(balances) {
  const EPS = 0.01;
  const creditors = [];
  const debtors = [];

  Object.entries(balances).forEach(([id, amt]) => {
    if (amt > EPS) creditors.push({ id, amt });
    else if (amt < -EPS) debtors.push({ id, amt: -amt });
  });

  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);

  const transactions = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    transactions.push({ from: debtors[i].id, to: creditors[j].id, amount: pay });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt < EPS) i += 1;
    if (creditors[j].amt < EPS) j += 1;
  }

  return transactions;
}
