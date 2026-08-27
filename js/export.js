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

export function buildPrintableReport(trip, ratesCache, balances, transactions) {
  const memberName = memberNameOf(trip);
  const categoryName = categoryNameOf(trip);
  const needsTwd = trip.baseCurrency.toUpperCase() !== 'TWD';
  const total = trip.expenses.reduce((sum, e) => sum + (convertToBase(e.amount, e.currency, trip.baseCurrency, ratesCache) || 0), 0);
  const totalTwd = baseAmountToTWD(total, trip.baseCurrency, ratesCache);

  const rows = [...trip.expenses]
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .map((exp) => {
      const twd = convertToTWD(exp.amount, exp.currency, trip.baseCurrency, ratesCache);
      return `<tr>
        <td>${exp.date || ''}</td>
        <td>${categoryName(exp.categoryId)}</td>
        <td>${exp.description || ''}</td>
        <td>${exp.amount} ${exp.currency}</td>
        ${needsTwd ? `<td>${twd !== null ? `≈ ${twd.toFixed(0)} TWD` : ''}</td>` : ''}
        <td>${memberName(exp.paidBy)}</td>
      </tr>`;
    })
    .join('');

  const settleRows = transactions
    .map((t) => {
      const twd = baseAmountToTWD(t.amount, trip.baseCurrency, ratesCache);
      return `<tr><td>${memberName(t.from)}</td><td>付給</td><td>${memberName(t.to)}</td><td>${t.amount.toFixed(2)} ${trip.baseCurrency}</td>${
        needsTwd ? `<td>${twd !== null ? `≈ ${twd.toFixed(0)} TWD` : ''}</td>` : ''
      }</tr>`;
    })
    .join('') || `<tr><td colspan="${needsTwd ? 5 : 4}">已全部結清 🎉</td></tr>`;

  return `
    <h1>${trip.name} 旅遊花費報表</h1>
    <p>期間：${trip.startDate || '—'} ~ ${trip.endDate || '—'}　｜　基準貨幣：${trip.baseCurrency}</p>
    <p>總花費：約 ${total.toFixed(2)} ${trip.baseCurrency}${needsTwd && totalTwd !== null ? `（≈ ${totalTwd.toFixed(0)} TWD）` : ''}</p>
    <h2>花費明細</h2>
    <table><thead><tr><th>日期</th><th>分類</th><th>說明</th><th>金額</th>${needsTwd ? '<th>約合台幣</th>' : ''}<th>付款人</th></tr></thead><tbody>${rows}</tbody></table>
    <h2>分帳結算</h2>
    <table><thead><tr><th>誰</th><th></th><th>付給誰</th><th>金額</th>${needsTwd ? '<th>約合台幣</th>' : ''}</tr></thead><tbody>${settleRows}</tbody></table>
  `;
}

export function printReport(html) {
  const win = window.open('', '_blank');
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>旅遊花費報表</title>
    <style>
      body { font-family: -apple-system, "Noto Sans TC", sans-serif; padding: 24px; color: #1e293b; }
      h1 { margin-bottom: 4px; } h2 { margin-top: 28px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 14px; text-align: left; }
      th { background: #f1f5f9; }
    </style>
  </head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}
