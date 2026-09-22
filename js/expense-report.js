// 旅遊花費報表：renderExpenseReport(data) 是設計交接包 expense-report-template.html 的原樣移植
// （794×1123 px、A4 @96dpi，可列印/轉 PDF/截圖分享）。buildReportData 把我們系統的 trip/expense
// 資料轉成這份樣板要的 ReportData 格式。

import { ICONS, iconKeyFor } from './category-icons.js';
import { convertToBase, convertToTWD, baseAmountToTWD } from './currency.js';

function _esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
function _num(n) {
  return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function renderExpenseReport(data) {
  var cur = data.currency || 'TWD';
  var total = data.total != null
    ? data.total
    : (data.expenses || []).reduce(function (s, e) { return s + Number(e.amount || 0); }, 0);
  var range = data.startDate && data.endDate
    ? data.startDate.slice(5) + ' – ' + data.endDate.slice(5)
    : (data.dateRange || '');

  var rows = (data.expenses || []).map(function (e) {
    var ic = ICONS[e.type] || ICONS.other;
    return '' +
      '<div style="background:#FFFFFF; border:2px solid #F2E3D2; border-radius:20px; padding:14px 20px; display:flex; align-items:center; gap:16px;">' +
        '<div style="width:46px; height:46px; border-radius:15px; background:' + ic.bg + '; display:flex; align-items:center; justify-content:center; flex:none;">' + ic.svg + '</div>' +
        '<div style="display:flex; flex-direction:column; gap:4px; flex:1; min-width:0;">' +
          '<div style="font-size:16px; font-weight:900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + _esc(e.title) + '</div>' +
          '<div style="display:flex; gap:8px; align-items:center; font-size:12.5px; color:#9A8A7D; font-weight:700;">' +
            '<span>' + _esc(e.date) + '</span>' +
            '<span style="width:3px; height:3px; border-radius:99px; background:#D6C6B6;"></span>' +
            '<span style="background:#F6EDE2; color:#8A6E56; border-radius:999px; padding:2px 9px;">' + _esc(e.category || e.type) + '</span>' +
            '<span style="width:3px; height:3px; border-radius:99px; background:#D6C6B6;"></span>' +
            '<span>' + _esc(e.payer) + ' 付款</span>' +
          '</div>' +
        '</div>' +
        '<div style="text-align:right;">' +
          '<div style="font-size:19px; font-weight:900; white-space:nowrap;">' + _num(e.amount) +
            '<span style="font-size:12px; color:#A08C7D; margin-left:4px;">' + _esc(e.currency || cur) + '</span></div>' +
          (e.twdAmount != null ? '<div style="font-size:11.5px; color:#B0A093; font-weight:700; white-space:nowrap;">≈ ' + _num(e.twdAmount) + ' TWD</div>' : '') +
        '</div>' +
      '</div>';
  }).join('');

  var settle = (data.settlements || []).map(function (s) {
    return '' +
      '<div style="background:#FFFFFF; border:2px dashed #B9DFD1; border-radius:20px; padding:16px 24px; display:flex; align-items:center; gap:14px;">' +
        '<div style="display:flex; align-items:center; gap:10px;">' +
          '<div style="width:38px; height:38px; border-radius:999px; background:#FBE3CF; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:900; color:#C4703A;">' + _esc(String(s.from || '').slice(-1)) + '</div>' +
          '<div style="font-size:16px; font-weight:900;">' + _esc(s.from) + '</div>' +
        '</div>' +
        '<div style="display:flex; align-items:center; gap:6px;">' +
          '<div style="width:34px; height:3px; background:#5FBFA8; border-radius:2px;"></div>' +
          '<div style="width:0; height:0; border-left:9px solid #5FBFA8; border-top:6px solid transparent; border-bottom:6px solid transparent;"></div>' +
        '</div>' +
        '<div style="display:flex; align-items:center; gap:10px;">' +
          '<div style="width:38px; height:38px; border-radius:999px; background:#DCEFE6; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:900; color:#3F8B76;">' + _esc(String(s.to || '').slice(-1)) + '</div>' +
          '<div style="font-size:16px; font-weight:900;">' + _esc(s.to) + '</div>' +
        '</div>' +
        '<div style="margin-left:auto; text-align:right;">' +
          '<div style="background:#5FBFA8; color:#FFFDF8; border-radius:999px; padding:9px 18px; font-size:17px; font-weight:900; box-shadow:0 3px 0 #4AA48E; white-space:nowrap; display:inline-block;">' + _num(s.amount) + ' ' + _esc(s.currency || cur) + '</div>' +
          (s.twdAmount != null ? '<div style="font-size:11.5px; color:#B0A093; font-weight:700; margin-top:4px;">≈ ' + _num(s.twdAmount) + ' TWD</div>' : '') +
        '</div>' +
      '</div>';
  }).join('');

  return '' +
  '<div style="width:794px; height:1123px; box-sizing:border-box; background:#FDF8F0; font-family:\'Zen Maru Gothic\',\'Noto Sans TC\',sans-serif; color:#3B3330; position:relative; overflow:hidden; padding:0 0 48px; display:flex; flex-direction:column;">' +
    '<div style="position:absolute; top:-70px; right:-60px; width:230px; height:230px; border-radius:999px; background:#FBE3CF;"></div>' +
    '<div style="position:absolute; top:120px; right:60px; width:70px; height:70px; border-radius:999px; background:#F9D9B8;"></div>' +
    '<div style="position:absolute; bottom:-60px; left:-50px; width:200px; height:200px; border-radius:999px; background:#DCEFE6;"></div>' +
    '<div style="position:absolute; bottom:150px; left:52px; width:44px; height:44px; border-radius:999px; background:#CDE7DA;"></div>' +
    '<div style="position:relative; flex:1; min-height:0; padding:44px 56px 0; display:flex; flex-direction:column; gap:26px;">' +

      '<div style="display:flex; align-items:flex-start; gap:18px;">' +
        '<div style="width:56px; height:56px; position:relative; flex:none; margin-top:4px;">' +
          '<div style="position:absolute; top:0; left:50%; transform:translateX(-50%); width:22px; height:10px; border:4px solid #E8734A; border-bottom:none; border-radius:8px 8px 0 0;"></div>' +
          '<div style="position:absolute; bottom:0; width:56px; height:48px; background:#F79256; border-radius:15px; display:flex; align-items:center; justify-content:center; font-size:29px; font-weight:900; color:#FFFDF8; box-shadow:inset 0 -4px 0 rgba(0,0,0,0.08);">琪</div>' +
        '</div>' +
        '<div style="display:flex; flex-direction:column; gap:6px;">' +
          '<div style="font-size:13px; font-weight:700; letter-spacing:0.14em; color:#B08A6E;">TRAVEL EXPENSE REPORT</div>' +
          '<div style="font-size:32px; font-weight:900; line-height:1.25;">' + _esc(data.title) + '</div>' +
        '</div>' +
      '</div>' +

      '<div style="display:flex; gap:14px;">' +
        '<div style="flex:1; background:#FFFFFF; border:2px solid #F2E3D2; border-radius:20px; padding:16px 20px; display:flex; flex-direction:column; gap:6px;">' +
          '<div style="font-size:12.5px; font-weight:700; color:#A08C7D;">旅行期間</div>' +
          '<div style="font-size:16px; font-weight:900;">' + _esc(range) + '</div></div>' +
        '<div style="flex:1; background:#FFFFFF; border:2px solid #F2E3D2; border-radius:20px; padding:16px 20px; display:flex; flex-direction:column; gap:6px;">' +
          '<div style="font-size:12.5px; font-weight:700; color:#A08C7D;">基準貨幣</div>' +
          '<div style="font-size:16px; font-weight:900;">' + _esc(cur) + '</div></div>' +
        '<div style="flex:1.4; background:#F79256; border:2px solid #F79256; border-radius:20px; padding:16px 20px; display:flex; flex-direction:column; gap:6px; box-shadow:0 4px 0 #E0762F;">' +
          '<div style="font-size:12.5px; font-weight:700; color:#FFEBD9;">總花費</div>' +
          '<div style="font-size:22px; font-weight:900; color:#FFFDF8; line-height:1;">' + _num(total) +
            '<span style="font-size:14px; margin-left:5px;">' + _esc(cur) + '</span></div>' +
          (data.totalTwd != null ? '<div style="font-size:12px; color:#FFEBD9; font-weight:700;">≈ ' + _num(data.totalTwd) + ' TWD</div>' : '') +
        '</div>' +
      '</div>' +

      '<div style="display:flex; flex-direction:column; gap:12px;">' +
        '<div style="display:flex; align-items:center; gap:10px;">' +
          '<div style="width:14px; height:14px; border-radius:5px; background:#F79256;"></div>' +
          '<div style="font-size:20px; font-weight:900;">花費明細</div>' +
          '<div style="flex:1; height:2px; background:#F0E2D2; border-radius:2px;"></div></div>' +
        '<div style="display:flex; flex-direction:column; gap:10px;">' + rows + '</div>' +
      '</div>' +

      '<div style="display:flex; flex-direction:column; gap:12px;">' +
        '<div style="display:flex; align-items:center; gap:10px;">' +
          '<div style="width:14px; height:14px; border-radius:5px; background:#5FBFA8;"></div>' +
          '<div style="font-size:20px; font-weight:900;">分帳結算</div>' +
          '<div style="flex:1; height:2px; background:#F0E2D2; border-radius:2px;"></div></div>' +
        '<div style="display:flex; flex-direction:column; gap:10px;">' + settle + '</div>' +
      '</div>' +

      '<div style="margin-top:auto; padding-top:12px; display:flex; align-items:center; gap:10px; font-size:12.5px; color:#B0A093; font-weight:700;">' +
        '<div style="flex:1; height:2px; background:#F0E2D2; border-radius:2px;"></div>' +
        '<span>' + _esc(data.footerText || '琪 · 旅遊記帳') + '</span>' +
        '<div style="flex:1; height:2px; background:#F0E2D2; border-radius:2px;"></div>' +
      '</div>' +

    '</div>' +
  '</div>';
}

// 匯出圖卡每位成員要各自上色，讓「花費明細」的付款人/分攤名單、「每人結算」卡片、
// 「建議轉帳」的頭像都用同一套顏色，一眼就能對起來是同一個人——顏色就從網站背景色塊的
// 四色系抽（原色見 css/style.css :root 的 --primary/--teal/--danger/--warn），text 用對應的
// -dark 版本疊在白色卡片上維持可讀性，bg 用對應的 -tint 版本給頭像圓底用。
// 一開始是每次匯出都重新洗牌一次，結果同一個人在「這次匯出」跟「下次匯出」（甚至只是
// 分兩次點「總覽」「明細」各自匯出）會拿到不同顏色，使用者對照兩張圖卡或前後兩次匯出時
// 會被搞混。改成用成員 id 算雜湊決定顏色——id 建立後不會變，所以同一個人不管匯出幾次、
// 什麼時候匯出、甚至過幾天再匯出，顏色都固定一樣；同一趟旅程裡兩個人剛好雜湊到同一種
// 顏色時，往後找下一個還沒用過的顏色，讓同一次匯出裡的人盡量兩兩不同、更好分辨。
const MEMBER_COLOR_PALETTE = [
  { text: '#2A3789', bg: '#EDEFFB' },
  { text: '#2E8C84', bg: '#EDF9F4' },
  { text: '#B93E34', bg: '#FDECEA' },
  { text: '#D9971A', bg: '#FEF6E4' },
];
const DEFAULT_MEMBER_COLOR = { text: '#6B5B4E', bg: '#F6EDE2' };
function hashMemberId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(hash);
}
function assignMemberColors(members) {
  const map = {};
  const used = new Set();
  members.forEach((m) => {
    let idx = hashMemberId(m.id) % MEMBER_COLOR_PALETTE.length;
    let tries = 0;
    while (used.has(idx) && tries < MEMBER_COLOR_PALETTE.length) {
      idx = (idx + 1) % MEMBER_COLOR_PALETTE.length;
      tries += 1;
    }
    used.add(idx);
    map[m.id] = MEMBER_COLOR_PALETTE[idx];
  });
  return map;
}

// 把系統內的 trip/expense/分帳結果轉成 renderExpenseReport 要的 ReportData 格式。
// memberStats 是 split.js computeBalances() 的完整回傳值（{ balances, paid, spent }），
// 選填——只有匯出圖卡需要顯示每人統計，列印/PDF 報表目前沒有用到就不用特別傳。
export function buildReportData(trip, ratesCache, transactions, memberStats) {
  const memberName = (id) => trip.members.find((m) => m.id === id)?.name || '（已刪除成員）';
  const categoryOf = (id) => trip.categories.find((c) => c.id === id);
  const needsTwd = trip.baseCurrency.toUpperCase() !== 'TWD';
  const memberColors = assignMemberColors(trip.members);

  const total = trip.expenses.reduce(
    (sum, e) => sum + (convertToBase(e.amount, e.currency, trip.baseCurrency, ratesCache) || 0),
    0
  );
  const totalTwd = needsTwd ? baseAmountToTWD(total, trip.baseCurrency, ratesCache) : null;

  const start = trip.startDate || '';
  const titleDate = start ? `${start.slice(0, 4)}/${Number(start.slice(5, 7))}` : '';

  const expenses = [...trip.expenses]
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || 0) - (b.createdAt || 0))
    .map((exp) => {
      const cat = categoryOf(exp.categoryId);
      const showTwd = needsTwd && exp.currency.toUpperCase() !== 'TWD';
      const splitIds =
        exp.splitType === 'custom' && exp.splitCustom
          ? Object.keys(exp.splitCustom)
          : (exp.splitMembers || []);
      const splitNames = splitIds.map(memberName).join('、');
      const splitEntries = splitIds.map((id) => ({ name: memberName(id), color: (memberColors[id] || DEFAULT_MEMBER_COLOR).text }));
      return {
        date: exp.date || '',
        type: iconKeyFor(cat ? cat.id : 'other'),
        category: cat ? cat.name : '未分類',
        title: exp.description || (cat ? cat.name : '未分類'),
        amount: exp.amount,
        currency: exp.currency,
        twdAmount: showTwd ? convertToTWD(exp.amount, exp.currency, trip.baseCurrency, ratesCache) : null,
        payer: memberName(exp.paidBy),
        payerColor: (memberColors[exp.paidBy] || DEFAULT_MEMBER_COLOR).text,
        splitNames,
        splitEntries,
      };
    });

  const settlements = transactions.map((t) => ({
    from: memberName(t.from),
    fromColor: memberColors[t.from] || DEFAULT_MEMBER_COLOR,
    to: memberName(t.to),
    toColor: memberColors[t.to] || DEFAULT_MEMBER_COLOR,
    amount: t.amount,
    currency: trip.baseCurrency,
    twdAmount: needsTwd ? baseAmountToTWD(t.amount, trip.baseCurrency, ratesCache) : null,
  }));

  // 每人「實際花費」（分攤到的金額）、「已付款」（實際掏錢付款的金額）、「淨餘額」
  // （應收/應付，正值代表應收回、負值代表應付出）——三個數字用途不同，見 split.js
  // computeBalances() 開頭的說明，這裡一次算好給匯出圖卡的「每人結算」區塊用。
  const memberBalance = memberStats
    ? trip.members.map((m) => {
        const spentAmt = memberStats.spent[m.id] || 0;
        const paidAmt = memberStats.paid[m.id] || 0;
        const balance = memberStats.balances[m.id] || 0;
        return {
          name: m.name,
          color: memberColors[m.id] || DEFAULT_MEMBER_COLOR,
          currency: trip.baseCurrency,
          spent: spentAmt,
          spentTwd: needsTwd ? baseAmountToTWD(spentAmt, trip.baseCurrency, ratesCache) : null,
          paid: paidAmt,
          paidTwd: needsTwd ? baseAmountToTWD(paidAmt, trip.baseCurrency, ratesCache) : null,
          balance,
          balanceTwd: needsTwd ? baseAmountToTWD(Math.abs(balance), trip.baseCurrency, ratesCache) : null,
        };
      })
    : [];

  return {
    // 旅程名稱通常使用者自己就會輸入年月（例如「2026/8暑假趴趴走」），標題前面不再自動疊加
    // 一次年月，避免重複；titleDate 改放到頁尾當作小備註就好。
    title: `${trip.name} 旅遊花費報表`,
    footerText: titleDate ? `${titleDate} · 琪 · 旅遊記帳` : undefined,
    startDate: trip.startDate,
    endDate: trip.endDate,
    currency: trip.baseCurrency,
    total,
    totalTwd,
    memberBalance,
    expenses,
    settlements,
  };
}

// 開新分頁列印報表 / 存成 PDF。這是一般網頁渲染（不是 canvas），可以安全載入設計稿指定的
// Google Fonts；離線時字型載入失敗也只是 fallback 回 Noto Sans TC，不影響列印。
export function printExpenseReport(reportHtml) {
  const win = window.open('', '_blank');
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>旅遊花費報表</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&family=Noto+Sans+TC:wght@500;700;900&display=swap" rel="stylesheet">
    <style>
      body { margin: 0; background: #EFE7DA; display: flex; justify-content: center; padding: 24px; }
      @media print { body { background: #fff; padding: 0; } @page { size: A4; margin: 0; } }
    </style>
  </head><body>${reportHtml}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}
