import * as store from './storage.js';
import { fetchRates, COMMON_CURRENCIES, convertToBase } from './currency.js';
import { computeBalances, simplifyDebts } from './split.js';
import { renderPieChart, renderBarChart } from './charts.js';
import { exportExpensesCsv, exportExpensesXlsx, buildPrintableReport, printReport } from './export.js';
import { compressImage } from './image.js';
import { initCloudSync, isSyncAvailable, requestSignInLink, signOutOfSync } from './cloud-sync.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let activeRates = null; // 目前旅程基準貨幣的即時匯率快取
let pendingReceipt = null; // 新增/編輯花費時，暫存尚未儲存的收據 base64
let currentFilterCategory = '';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------- 初始化

async function init() {
  populateCurrencySelects();
  wireGlobalEvents();
  renderSyncArea({ signedIn: false, available: isSyncAvailable() });
  await refreshAll();
  initCloudSync({
    onRemoteChange: refreshAll,
    onStatusChange: renderSyncArea,
  });
}

function renderSyncArea(status) {
  const el = $('#sync-area');
  if (!status.available) {
    el.innerHTML = '';
    return;
  }
  if (!status.signedIn) {
    const errorText = status.error ? `<span class="sync-status error">⚠️ ${escapeHtml(status.error)}</span>` : '';
    el.innerHTML = `<button id="btn-sync-signin" class="btn btn-ghost" title="用 Email 登入，讓不同裝置同步旅程資料">☁️ 登入同步</button>${errorText}`;
    $('#btn-sync-signin').addEventListener('click', openEmailSignInDialog);
    return;
  }
  const name = escapeHtml(status.user.displayName || status.user.email || '已登入');
  const avatar = status.user.photoURL ? `<img class="sync-avatar" src="${status.user.photoURL}" alt="" />` : '';
  const statusText = status.error ? `<span class="sync-status error">⚠️ ${escapeHtml(status.error)}</span>` : status.syncing ? '<span class="sync-status">同步中…</span>' : '<span class="sync-status ok">☁️ 已同步</span>';
  el.innerHTML = `
    <div class="sync-user">${avatar}<span>${name}</span></div>
    ${statusText}
    <button id="btn-sync-signout" class="btn btn-ghost">登出</button>
  `;
  $('#btn-sync-signout').addEventListener('click', signOutOfSync);
}

function openEmailSignInDialog() {
  $('#signin-email-input').value = '';
  $('#signin-email-status').textContent = '';
  $('#dialog-email-signin').showModal();
}

async function handleEmailSignInSubmit(e) {
  e.preventDefault();
  const email = $('#signin-email-input').value.trim();
  const statusEl = $('#signin-email-status');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  statusEl.textContent = '傳送中…';
  try {
    await requestSignInLink(email);
    statusEl.textContent = `登入連結已寄到 ${email}，請到信箱點連結完成登入（同一個瀏覽器點開最順利）。`;
  } catch (err) {
    console.error('寄送登入連結失敗', err);
    statusEl.textContent = `寄送失敗：${err.code || err.message}`;
  } finally {
    submitBtn.disabled = false;
  }
}

function populateCurrencySelects() {
  const options = COMMON_CURRENCIES.map((c) => `<option value="${c}">${c}</option>`).join('');
  $('#trip-currency-input').innerHTML = options;
  $('#expense-currency-input').innerHTML = options;
}

async function refreshAll() {
  renderTripSelect();
  const trip = store.getActiveTrip();
  if (!trip) {
    $('#empty-state').hidden = false;
    $('#trip-view').hidden = true;
    return;
  }
  $('#empty-state').hidden = true;
  $('#trip-view').hidden = false;

  // 先用現有的匯率快取（可能是舊資料或 null）立刻畫面，避免離線/網路慢時整個畫面卡住等待 fetch
  const ratesKey = `${trip.id}:${trip.baseCurrency}`;
  const needsFreshRates = ratesLoadedKey !== ratesKey;
  if (needsFreshRates) activeRates = store.getRatesCache(trip.baseCurrency);
  renderTripView(trip);

  if (needsFreshRates) {
    await loadRatesForTrip(trip);
    ratesLoadedKey = ratesKey;
    if (store.getActiveTrip()?.id === trip.id) renderTripView(trip); // 匯率抓回來後再重新渲染一次
  }
}

// 記錄已成功嘗試載入匯率的「旅程 id + 基準貨幣」，避免每次操作（如新增花費）都重打一次匯率 API
let ratesLoadedKey = null;

async function loadRatesForTrip(trip, { force = false } = {}) {
  try {
    activeRates = await fetchRates(trip.baseCurrency, { force });
  } catch (err) {
    console.warn(err);
    activeRates = store.getRatesCache(trip.baseCurrency);
  }
}

// ---------------------------------------------------------------- 渲染

function renderTripSelect() {
  const trips = store.getTrips();
  const sel = $('#trip-select');
  if (!trips.length) {
    sel.innerHTML = '';
    sel.hidden = true;
    return;
  }
  sel.hidden = false;
  sel.innerHTML = trips.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  const active = store.getActiveTrip();
  if (active) sel.value = active.id;
}

function renderTripView(trip) {
  $('#trip-name').textContent = trip.name;
  const dateRange = trip.startDate || trip.endDate ? `${trip.startDate || '?'} ~ ${trip.endDate || '?'}` : '未設定日期';
  const rateNote = activeRates ? '' : '（匯率暫時無法取得，換算金額可能不準）';
  $('#trip-meta').textContent = `${dateRange}　·　基準貨幣 ${trip.baseCurrency}　·　${trip.members.length} 位成員 ${rateNote}`;

  renderBudgetBar(trip);
  renderCategoryFilterOptions(trip);
  renderExpenseList(trip);
  renderSplitTab(trip);
  renderStatsTab(trip);
  renderMembersTab(trip);
}

function totalSpent(trip) {
  return trip.expenses.reduce((sum, e) => sum + (convertToBase(e.amount, e.currency, trip.baseCurrency, activeRates) || 0), 0);
}

function renderBudgetBar(trip) {
  const wrap = $('#budget-bar-wrap');
  if (!trip.budgetTotal) {
    wrap.innerHTML = '';
    return;
  }
  const total = totalSpent(trip);
  const pct = Math.min(100, (total / trip.budgetTotal) * 100);
  const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '';
  wrap.innerHTML = `
    <div class="budget-bar">
      <div class="budget-bar-track"><div class="budget-bar-fill ${cls}" style="width:${pct}%"></div></div>
      <div class="budget-bar-label">已花費 ${total.toFixed(0)} / ${trip.budgetTotal} ${trip.baseCurrency}（${pct.toFixed(0)}%）${
    trip.budgetDaily ? ` ・每日預算 ${trip.budgetDaily} ${trip.baseCurrency}` : ''
  }</div>
    </div>`;
}

function renderCategoryFilterOptions(trip) {
  const sel = $('#filter-category');
  sel.innerHTML = '<option value="">全部分類</option>' + trip.categories.map((c) => `<option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>`).join('');
  sel.value = currentFilterCategory;
}

function renderExpenseList(trip) {
  const list = $('#expense-list');
  const memberName = (id) => trip.members.find((m) => m.id === id)?.name || '（已刪除成員）';
  const expenses = [...trip.expenses]
    .filter((e) => !currentFilterCategory || e.categoryId === currentFilterCategory)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);

  if (!expenses.length) {
    list.innerHTML = '<p class="empty-hint">還沒有花費紀錄，點右上角「＋ 新增花費」開始記帳吧！</p>';
    return;
  }

  list.innerHTML = expenses
    .map((exp) => {
      const cat = trip.categories.find((c) => c.id === exp.categoryId) || { icon: '📦', name: '未分類' };
      const converted = convertToBase(exp.amount, exp.currency, trip.baseCurrency, activeRates);
      const splitLabel =
        exp.splitType === 'custom'
          ? `自訂分攤・${Object.keys(exp.splitCustom || {}).length} 人`
          : `平均分攤・${(exp.splitMembers || []).length} 人`;
      return `
      <div class="expense-card" data-id="${exp.id}">
        <div class="expense-icon">${cat.icon}</div>
        <div class="expense-main">
          <div class="expense-title">${escapeHtml(exp.description || cat.name)}</div>
          <div class="expense-sub">${exp.date || ''}・${escapeHtml(memberName(exp.paidBy))} 付款・${splitLabel}</div>
        </div>
        ${exp.receipt ? `<img class="receipt-thumb" src="${exp.receipt}" data-action="view-receipt" data-id="${exp.id}" alt="收據" />` : ''}
        <div class="expense-amount">
          ${exp.amount} ${exp.currency}
          ${converted !== null && exp.currency !== trip.baseCurrency ? `<span class="converted">≈ ${converted.toFixed(0)} ${trip.baseCurrency}</span>` : ''}
        </div>
        <div class="expense-actions">
          <button data-action="edit-expense" data-id="${exp.id}" title="編輯">✏️</button>
          <button data-action="delete-expense" data-id="${exp.id}" title="刪除">🗑️</button>
        </div>
      </div>`;
    })
    .join('');
}

function renderSplitTab(trip) {
  const { balances } = computeBalances(trip, activeRates);
  const memberName = (id) => trip.members.find((m) => m.id === id)?.name || '（已刪除成員）';

  $('#balances-summary').innerHTML = trip.members
    .map((m) => {
      const bal = balances[m.id] || 0;
      const cls = bal > 0.01 ? 'positive' : bal < -0.01 ? 'negative' : '';
      const text = bal > 0.01 ? `應收回 ${bal.toFixed(2)}` : bal < -0.01 ? `應付出 ${Math.abs(bal).toFixed(2)}` : '已結清';
      return `<div class="balance-chip"><div class="name">${escapeHtml(m.name)}</div><div class="amount ${cls}">${text} ${trip.baseCurrency}</div></div>`;
    })
    .join('');

  const transactions = simplifyDebts(balances);
  $('#settle-list').innerHTML = transactions.length
    ? transactions
        .map(
          (t) => `<div class="settle-row">
            <strong>${escapeHtml(memberName(t.from))}</strong>
            <span class="arrow">應付給</span>
            <strong>${escapeHtml(memberName(t.to))}</strong>
            <span class="amount">${t.amount.toFixed(2)} ${trip.baseCurrency}</span>
          </div>`
        )
        .join('')
    : '<p class="empty-hint">目前沒有需要結清的款項 🎉</p>';
}

function renderStatsTab(trip) {
  const byCategory = {};
  trip.expenses.forEach((e) => {
    byCategory[e.categoryId] = (byCategory[e.categoryId] || 0) + (convertToBase(e.amount, e.currency, trip.baseCurrency, activeRates) || 0);
  });
  const slices = trip.categories.map((c) => ({ label: c.name, value: byCategory[c.id] || 0, color: c.color }));
  $('#chart-category').innerHTML = renderPieChart(slices);

  const byDate = {};
  trip.expenses.forEach((e) => {
    const key = e.date || '未知日期';
    byDate[key] = (byDate[key] || 0) + (convertToBase(e.amount, e.currency, trip.baseCurrency, activeRates) || 0);
  });
  const points = Object.entries(byDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label: label.length > 5 ? label.slice(5) : label, value }));
  $('#chart-trend').innerHTML = renderBarChart(points);
}

function renderMembersTab(trip) {
  $('#member-list').innerHTML =
    trip.members.map((m) => `<li>${escapeHtml(m.name)} <button data-action="remove-member" data-id="${m.id}" title="移除">✕</button></li>`).join('') ||
    '<li>尚無成員</li>';
  $('#category-list').innerHTML = trip.categories
    .map((c) => `<li>${c.icon} ${escapeHtml(c.name)} <button data-action="remove-category" data-id="${c.id}" title="移除">✕</button></li>`)
    .join('');
}

// ---------------------------------------------------------------- 旅程對話框

function openTripDialog(trip) {
  $('#trip-dialog-title').textContent = trip ? '編輯旅程' : '新增旅程';
  $('#trip-id').value = trip ? trip.id : '';
  $('#trip-name-input').value = trip ? trip.name : '';
  $('#trip-currency-input').value = trip ? trip.baseCurrency : 'TWD';
  $('#trip-start-input').value = trip ? trip.startDate : '';
  $('#trip-end-input').value = trip ? trip.endDate : '';
  $('#trip-budget-total-input').value = trip && trip.budgetTotal ? trip.budgetTotal : '';
  $('#trip-budget-daily-input').value = trip && trip.budgetDaily ? trip.budgetDaily : '';
  $('#trip-members-field').style.display = trip ? 'none' : '';
  $('#trip-members-input').value = '';
  $('#dialog-trip').showModal();
}

function handleTripSubmit(e) {
  e.preventDefault();
  const id = $('#trip-id').value;
  const payload = {
    name: $('#trip-name-input').value.trim() || '未命名旅程',
    baseCurrency: $('#trip-currency-input').value,
    startDate: $('#trip-start-input').value,
    endDate: $('#trip-end-input').value,
    budgetTotal: parseFloat($('#trip-budget-total-input').value) || null,
    budgetDaily: parseFloat($('#trip-budget-daily-input').value) || null,
  };
  if (id) {
    store.updateTrip(id, payload);
  } else {
    const members = $('#trip-members-input').value.split(',').map((s) => s.trim()).filter(Boolean);
    store.createTrip({ ...payload, members });
  }
  $('#dialog-trip').close();
  refreshAll();
}

// ---------------------------------------------------------------- 花費對話框

function renderSplitMembersList(trip, expense) {
  const splitType = document.querySelector('input[name="split-type"]:checked').value;
  const container = $('#split-members-list');
  const checkedIds = expense
    ? expense.splitType === 'equal'
      ? expense.splitMembers || []
      : Object.keys(expense.splitCustom || {})
    : trip.members.map((m) => m.id);

  if (splitType === 'equal') {
    container.innerHTML = trip.members
      .map(
        (m) => `<div class="split-member-row">
          <label><input type="checkbox" value="${m.id}" ${checkedIds.includes(m.id) ? 'checked' : ''} /> ${escapeHtml(m.name)}</label>
        </div>`
      )
      .join('');
  } else {
    container.innerHTML = trip.members
      .map((m) => {
        const val = expense && expense.splitCustom ? expense.splitCustom[m.id] || '' : '';
        return `<div class="split-member-row">
          <label>${escapeHtml(m.name)}</label>
          <input type="number" min="0" step="0.01" data-member="${m.id}" value="${val}" placeholder="0" />
        </div>`;
      })
      .join('');
  }
}

function updateConvertedHint() {
  const trip = store.getActiveTrip();
  const amount = parseFloat($('#expense-amount-input').value) || 0;
  const currency = $('#expense-currency-input').value;
  const hint = $('#expense-converted-hint');
  if (!trip || currency === trip.baseCurrency || !amount) {
    hint.textContent = '';
    return;
  }
  const converted = convertToBase(amount, currency, trip.baseCurrency, activeRates);
  hint.textContent = converted !== null ? `≈ ${converted.toFixed(2)} ${trip.baseCurrency}（依即時匯率換算）` : '目前查無此幣別的匯率資料';
}

function updateReceiptPreview() {
  $('#receipt-preview').innerHTML = pendingReceipt ? `<img src="${pendingReceipt}" alt="收據預覽" />` : '';
}

function openExpenseDialog(expense) {
  const trip = store.getActiveTrip();
  if (!trip.members.length) {
    alert('請先在「成員與分類」新增至少一位成員，才能記錄花費。');
    return;
  }
  pendingReceipt = expense ? expense.receipt || null : null;

  $('#expense-dialog-title').textContent = expense ? '編輯花費' : '新增花費';
  $('#expense-id').value = expense ? expense.id : '';
  $('#expense-date-input').value = expense ? expense.date : new Date().toISOString().slice(0, 10);
  $('#expense-category-input').innerHTML = trip.categories.map((c) => `<option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>`).join('');
  $('#expense-category-input').value = expense ? expense.categoryId : trip.categories[0].id;
  $('#expense-desc-input').value = expense ? expense.description || '' : '';
  $('#expense-amount-input').value = expense ? expense.amount : '';
  $('#expense-currency-input').value = expense ? expense.currency : trip.baseCurrency;
  $('#expense-payer-input').innerHTML = trip.members.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
  $('#expense-payer-input').value = expense ? expense.paidBy : trip.members[0].id;

  const splitType = expense ? expense.splitType : 'equal';
  $$('input[name="split-type"]').forEach((r) => {
    r.checked = r.value === splitType;
  });

  renderSplitMembersList(trip, expense);
  updateReceiptPreview();
  updateConvertedHint();
  $('#expense-receipt-input').value = '';

  $('#dialog-expense').showModal();
}

async function handleReceiptChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    pendingReceipt = await compressImage(file);
    updateReceiptPreview();
  } catch (err) {
    console.error(err);
    alert('收據照片讀取失敗，請換一張圖片再試。');
  }
}

function handleExpenseSubmit(e) {
  e.preventDefault();
  const trip = store.getActiveTrip();
  const id = $('#expense-id').value;
  const splitType = document.querySelector('input[name="split-type"]:checked').value;
  const amount = parseFloat($('#expense-amount-input').value);
  const currency = $('#expense-currency-input').value;

  let splitMembers = [];
  let splitCustom = null;

  if (splitType === 'equal') {
    splitMembers = $$('#split-members-list input[type="checkbox"]:checked').map((i) => i.value);
    if (!splitMembers.length) {
      alert('請至少選擇一位分攤成員');
      return;
    }
  } else {
    splitCustom = {};
    $$('#split-members-list input[type="number"]').forEach((i) => {
      const v = parseFloat(i.value);
      if (v > 0) splitCustom[i.dataset.member] = v;
    });
    if (!Object.keys(splitCustom).length) {
      alert('請至少為一位成員輸入自訂分攤金額');
      return;
    }
    const sum = Object.values(splitCustom).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - amount) > 0.01 && !confirm(`自訂分攤總額（${sum.toFixed(2)}）與花費金額（${amount}）不一致，仍要儲存嗎？`)) {
      return;
    }
  }

  const payload = {
    date: $('#expense-date-input').value,
    categoryId: $('#expense-category-input').value,
    description: $('#expense-desc-input').value.trim(),
    amount,
    currency,
    paidBy: $('#expense-payer-input').value,
    splitType,
    splitMembers,
    splitCustom,
    receipt: pendingReceipt,
  };

  if (id) store.updateExpense(trip.id, id, payload);
  else store.addExpense(trip.id, payload);

  $('#dialog-expense').close();
  refreshAll();
}

// ---------------------------------------------------------------- 事件綁定

function wireGlobalEvents() {
  $$('.tab-btn').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  $$('[data-close]').forEach((btn) => btn.addEventListener('click', () => btn.closest('dialog').close()));
  $('#form-email-signin').addEventListener('submit', handleEmailSignInSubmit);

  $('#trip-select').addEventListener('change', async (e) => {
    store.setActiveTrip(e.target.value);
    await refreshAll();
  });
  $('#btn-new-trip').addEventListener('click', () => openTripDialog(null));
  $('#btn-create-first-trip').addEventListener('click', () => openTripDialog(null));
  $('#btn-edit-trip').addEventListener('click', () => openTripDialog(store.getActiveTrip()));
  $('#form-trip').addEventListener('submit', handleTripSubmit);

  $('#btn-delete-trip').addEventListener('click', () => {
    const trip = store.getActiveTrip();
    if (!trip) return;
    if (confirm(`確定要刪除旅程「${trip.name}」嗎？此動作無法復原。`)) {
      store.deleteTrip(trip.id);
      refreshAll();
    }
  });

  $('#btn-refresh-rates').addEventListener('click', async () => {
    const trip = store.getActiveTrip();
    if (!trip) return;
    await loadRatesForTrip(trip, { force: true });
    ratesLoadedKey = `${trip.id}:${trip.baseCurrency}`;
    renderTripView(trip);
  });

  $('#filter-category').addEventListener('change', (e) => {
    currentFilterCategory = e.target.value;
    renderExpenseList(store.getActiveTrip());
  });

  $('#btn-add-expense').addEventListener('click', () => openExpenseDialog(null));
  $('#form-expense').addEventListener('submit', handleExpenseSubmit);
  $('#expense-amount-input').addEventListener('input', updateConvertedHint);
  $('#expense-currency-input').addEventListener('change', updateConvertedHint);
  $('#expense-receipt-input').addEventListener('change', handleReceiptChange);
  $$('input[name="split-type"]').forEach((r) =>
    r.addEventListener('change', () => {
      const trip = store.getActiveTrip();
      const expenseId = $('#expense-id').value;
      const expense = expenseId ? trip.expenses.find((x) => x.id === expenseId) : null;
      renderSplitMembersList(trip, expense);
    })
  );

  $('#expense-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const trip = store.getActiveTrip();
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit-expense') openExpenseDialog(trip.expenses.find((x) => x.id === id));
    if (btn.dataset.action === 'delete-expense') {
      if (confirm('確定要刪除這筆花費嗎？')) {
        store.removeExpense(trip.id, id);
        refreshAll();
      }
    }
    if (btn.dataset.action === 'view-receipt') {
      const exp = trip.expenses.find((x) => x.id === id);
      $('#dialog-image-img').src = exp.receipt;
      $('#dialog-image').showModal();
    }
  });

  $('#form-add-member').addEventListener('submit', (e) => {
    e.preventDefault();
    const trip = store.getActiveTrip();
    const input = $('#new-member-name');
    if (input.value.trim()) {
      store.addMember(trip.id, input.value.trim());
      input.value = '';
      refreshAll();
    }
  });
  $('#member-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="remove-member"]');
    if (!btn) return;
    const trip = store.getActiveTrip();
    if (confirm('刪除此成員？相關花費的付款人/分攤設定會一併調整。')) {
      store.removeMember(trip.id, btn.dataset.id);
      refreshAll();
    }
  });

  $('#form-add-category').addEventListener('submit', (e) => {
    e.preventDefault();
    const trip = store.getActiveTrip();
    const name = $('#new-category-name').value.trim();
    const icon = $('#new-category-icon').value.trim() || '🏷️';
    if (name) {
      store.addCategory(trip.id, { name, icon });
      $('#new-category-name').value = '';
      $('#new-category-icon').value = '';
      refreshAll();
    }
  });
  $('#category-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="remove-category"]');
    if (!btn) return;
    const trip = store.getActiveTrip();
    store.removeCategory(trip.id, btn.dataset.id);
    refreshAll();
  });

  $('#btn-export-csv').addEventListener('click', () => exportExpensesCsv(store.getActiveTrip(), activeRates));
  $('#btn-export-xlsx').addEventListener('click', () => {
    const trip = store.getActiveTrip();
    const { balances } = computeBalances(trip, activeRates);
    exportExpensesXlsx(trip, activeRates, simplifyDebts(balances));
  });
  $('#btn-print-report').addEventListener('click', () => {
    const trip = store.getActiveTrip();
    const { balances } = computeBalances(trip, activeRates);
    const transactions = simplifyDebts(balances);
    printReport(buildPrintableReport(trip, activeRates, balances, transactions));
  });
}

function switchTab(tab) {
  $$('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.tab-panel').forEach((p) => {
    p.hidden = p.id !== `tab-${tab}`;
  });
}

init();
