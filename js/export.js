// 匯出報表：CSV / Excel 下載，以及瀏覽器列印（可另存為 PDF）。

import { convertToBase, convertToTWD, baseAmountToTWD } from './currency.js';
import { buildXlsx } from './xlsx-writer.js';

function memberNameOf(trip) {
  return (id) => trip.members.find((m) => m.id === id)?.name || '（已刪除成員）';
}
function categoryNameOf(trip) {
  return (id) => trip.categories.find((c) => c.id === id)?.name || '未分類';
}

// 回傳表頭 + 每筆花費一列的表格資料（數字欄位維持 number 型別，方便 Excel 直接加總）
function buildExpenseTable(trip, ratesCache) {
  const memberName = memberNameOf(trip);
  const categoryName = categoryNameOf(trip);
  const needsTwd = trip.baseCurrency.toUpperCase() !== 'TWD';
  const header = ['日期', '分類', '說明', '金額', '幣別', '換算後金額', ...(needsTwd ? ['台幣金額'] : []), '付款人', '分攤成員'];

  const rows = [...trip.expenses]
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .map((exp) => {
      const splitNames =
        exp.splitType === 'custom' && exp.splitCustom
          ? Object.keys(exp.splitCustom).map(memberName).join('、')
          : (exp.splitMembers || []).map(memberName).join('、');
      const converted = convertToBase(exp.amount, exp.currency, trip.baseCurrency, ratesCache);
      const twd = convertToTWD(exp.amount, exp.currency, trip.baseCurrency, ratesCache);
      return [
        exp.date || '',
        categoryName(exp.categoryId),
        exp.description || '',
        exp.amount,
        exp.currency,
        converted !== null ? Number(converted.toFixed(2)) : '（無匯率資料）',
        ...(needsTwd ? [twd !== null ? Number(twd.toFixed(2)) : '（無匯率資料）'] : []),
        memberName(exp.paidBy),
        splitNames,
      ];
    });

  return [header, ...rows];
}

// 每人「實際花費」（分攤到的金額）／「已付款」（實際掏錢付款的金額）——這兩個數字
// 不是同一件事：付款人有時候是幫大家代墊，實際分攤到自己身上的金額可能比付出去的少
// （或反過來），淨餘額（應收/應付）只是兩者相減，看不出各自實際是多少，所以另外列出來。
function buildMemberSummaryTable(trip, memberStats, ratesCache) {
  const memberName = memberNameOf(trip);
  const needsTwd = trip.baseCurrency.toUpperCase() !== 'TWD';
  const { paid = {}, spent = {} } = memberStats || {};
  const header = ['成員', '實際花費', ...(needsTwd ? ['實際花費(台幣)'] : []), '已付款', ...(needsTwd ? ['已付款(台幣)'] : [])];
  const toTwdCell = (amount) => {
    const twd = baseAmountToTWD(amount, trip.baseCurrency, ratesCache);
    return twd !== null ? Number(twd.toFixed(2)) : '（無匯率資料）';
  };
  return [
    header,
    ...trip.members.map((m) => {
      const spentAmt = spent[m.id] || 0;
      const paidAmt = paid[m.id] || 0;
      return [
        memberName(m.id),
        Number(spentAmt.toFixed(2)),
        ...(needsTwd ? [toTwdCell(spentAmt)] : []),
        Number(paidAmt.toFixed(2)),
        ...(needsTwd ? [toTwdCell(paidAmt)] : []),
      ];
    }),
  ];
}

function buildSettleTable(trip, transactions, ratesCache) {
  const memberName = memberNameOf(trip);
  const needsTwd = trip.baseCurrency.toUpperCase() !== 'TWD';
  const header = ['誰', '付給', '金額', ...(needsTwd ? ['台幣金額'] : [])];
  if (!transactions.length) return [header, ['已全部結清 🎉', '', '', ...(needsTwd ? [''] : [])]];
  return [
    header,
    ...transactions.map((t) => {
      const twd = baseAmountToTWD(t.amount, trip.baseCurrency, ratesCache);
      return [memberName(t.from), memberName(t.to), Number(t.amount.toFixed(2)), ...(needsTwd ? [twd !== null ? Number(twd.toFixed(2)) : '（無匯率資料）'] : [])];
    }),
  ];
}

export function exportExpensesCsv(trip, ratesCache) {
  const table = buildExpenseTable(trip, ratesCache);
  const csvLines = table.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, "'")}"`).join(','));
  const csvContent = '﻿' + csvLines.join('\r\n');
  downloadBlob(csvContent, `${trip.name}-花費紀錄.csv`, 'text/csv;charset=utf-8;');
}

export function exportExpensesXlsx(trip, ratesCache, transactions, memberStats) {
  // 「分帳結算」這張工作表裡放兩張表：上面是每人實際花費/已付款的摘要，下面是建議轉帳
  // 明細，中間留一個空白列隔開（.xlsx 這裡沒有「表格」這種結構，整張工作表本來就是
  // 一格一格的儲存格，兩張表接在一起、留白列隔開是最簡單可靠的做法）。
  const summaryRows = buildMemberSummaryTable(trip, memberStats, ratesCache);
  const settleRows = buildSettleTable(trip, transactions, ratesCache);
  const bytes = buildXlsx([
    { name: '花費明細', rows: buildExpenseTable(trip, ratesCache) },
    { name: '分帳結算', rows: [...summaryRows, [], ...settleRows] },
  ]);
  downloadBlob(bytes, `${trip.name}-花費紀錄.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

