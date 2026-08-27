// 匯出報表：CSV 下載 + 瀏覽器列印（可另存為 PDF）。

import { convertToBase } from './currency.js';

export function exportExpensesCsv(trip, ratesCache) {
  const header = ['日期', '分類', '說明', '金額', '幣別', '換算後金額', '付款人', '分攤成員'];
  const memberName = (id) => trip.members.find((m) => m.id === id)?.name || '（已刪除成員）';
  const categoryName = (id) => trip.categories.find((c) => c.id === id)?.name || '未分類';

  const rows = [...trip.expenses]
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .map((exp) => {
      const splitNames =
        exp.splitType === 'custom' && exp.splitCustom
          ? Object.keys(exp.splitCustom).map(memberName).join('、')
          : (exp.splitMembers || []).map(memberName).join('、');
      const converted = convertToBase(exp.amount, exp.currency, trip.baseCurrency, ratesCache);
      return [
        exp.date || '',
        categoryName(exp.categoryId),
        (exp.description || '').replace(/"/g, "'"),
        exp.amount,
        exp.currency,
        converted !== null ? `${trip.baseCurrency} ${converted.toFixed(2)}` : '（無匯率資料）',
        memberName(exp.paidBy),
        splitNames,
      ];
    });

  const csvLines = [header, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(','));
  const csvContent = '﻿' + csvLines.join('\r\n');
  downloadBlob(csvContent, `${trip.name}-花費紀錄.csv`, 'text/csv;charset=utf-8;');
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
  const memberName = (id) => trip.members.find((m) => m.id === id)?.name || '（已刪除成員）';
  const categoryName = (id) => trip.categories.find((c) => c.id === id)?.name || '未分類';
  const total = trip.expenses.reduce((sum, e) => sum + (convertToBase(e.amount, e.currency, trip.baseCurrency, ratesCache) || 0), 0);

  const rows = [...trip.expenses]
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .map(
      (exp) => `<tr>
        <td>${exp.date || ''}</td>
        <td>${categoryName(exp.categoryId)}</td>
        <td>${exp.description || ''}</td>
        <td>${exp.amount} ${exp.currency}</td>
        <td>${memberName(exp.paidBy)}</td>
      </tr>`
    )
    .join('');

  const settleRows = transactions
    .map((t) => `<tr><td>${memberName(t.from)}</td><td>付給</td><td>${memberName(t.to)}</td><td>${t.amount.toFixed(2)} ${trip.baseCurrency}</td></tr>`)
    .join('') || '<tr><td colspan="4">已全部結清 🎉</td></tr>';

  return `
    <h1>${trip.name} 旅遊花費報表</h1>
    <p>期間：${trip.startDate || '—'} ~ ${trip.endDate || '—'}　｜　基準貨幣：${trip.baseCurrency}</p>
    <p>總花費：約 ${total.toFixed(2)} ${trip.baseCurrency}</p>
    <h2>花費明細</h2>
    <table><thead><tr><th>日期</th><th>分類</th><th>說明</th><th>金額</th><th>付款人</th></tr></thead><tbody>${rows}</tbody></table>
    <h2>分帳結算</h2>
    <table><thead><tr><th>誰</th><th></th><th>付給誰</th><th>金額</th></tr></thead><tbody>${settleRows}</tbody></table>
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
