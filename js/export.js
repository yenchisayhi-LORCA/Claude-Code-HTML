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

export function exportExpensesXlsx(trip, ratesCache, transactions) {
  const bytes = buildXlsx([
    { name: '花費明細', rows: buildExpenseTable(trip, ratesCache) },
    { name: '分帳結算', rows: buildSettleTable(trip, transactions, ratesCache) },
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

