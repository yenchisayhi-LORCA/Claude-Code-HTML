import * as store from './storage.js';
import { fetchRates, COMMON_CURRENCIES, convertToBase, convertToTWD, baseAmountToTWD } from './currency.js';
import { computeBalances, simplifyDebts } from './split.js';
import { renderPieChart, renderBarChart } from './charts.js';
import { exportExpensesCsv, exportExpensesXlsx, buildPrintableReport, printReport } from './export.js';
import { compressImage } from './image.js';
import { initCloudSync, isSyncAvailable, requestSignInLink, signOutOfSync } from './cloud-sync.js';
import { downloadExpenseCard } from './image-card.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let activeRates = null; // 目前旅程基準貨幣的即時匯率快取
let pendingReceipt = null; // 新增/編輯花費時，暫存尚未儲存的收據 base64
let currentFilterCategory = '';
let pendingAvatarMemberId = null; // 目前正在上傳大頭貼的成員 id（旅程內的成員）
let pendingAvatarPersonId = null; // 目前正在上傳大頭貼的成員 id（跨旅程名單）

const CATEGORY_ICON_CHOICES = [
  '🍽️', '🍲', '🍜', '🍔', '🍰', '☕', '🍺', '🍣', '🥐',
  '🏨', '⛺', '🏠', '🚌', '🚕', '🚄', '✈️', '🚢', '🚲',
  '🎫', '🎡', '🎢', '🎭', '🎨', '🎣', '⚽', '🏖️', '🏔️',
  '🛍️', '👗', '💄', '📱', '💻', '🔌', '📶',
  '🏥', '🩺', '💊', '🚑', '📚', '🎁', '💰', '💳', '🧳', '📷', '🎉', '🎶', '🐶', '🐱', '🏷️', '•••',
];

// 內建的 9 個預設分類（食、住、行...）一律套用最新的圖示/顏色設計，
// 不管旅程資料建立當下存的是舊圖示，都用這份對照表覆蓋顯示，這樣舊旅程也會跟著更新。
const DEFAULT_CATEGORY_STYLE = Object.fromEntries(store.DEFAULT_CATEGORIES.map((c) => [c.id, c]));

function categoryVisual(category) {
  if (!category) return { icon: '📦', name: '未分類', color: '#64748b' };
  return DEFAULT_CATEGORY_STYLE[category.id] || category;
}

function lightenHex(hex, amount = 0.82) {
  const c = (hex || '#64748b').replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const mix = (ch) => Math.round(ch + (255 - ch) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function categoryBadgeHtml(category, size = 32) {
  const vis = categoryVisual(category);
  const bg = lightenHex(vis.color, 0.82);
  const fontSize = Math.round(size * 0.5);
  return `<span class="category-badge" style="width:${size}px;height:${size}px;background:${bg};font-size:${fontSize}px" title="${escapeHtml(vis.name || '')}">${vis.icon}</span>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function memberAvatarHtml(member, sizeClass = 'expense-avatar') {
  if (!member) return '';
  if (member.avatar) return `<img class="${sizeClass}" src="${member.avatar}" alt="" />`;
  return '';
}

// 跟 memberAvatarHtml 不同：沒有照片時會畫一個「姓名第一個字」的圓形佔位圖，用在名單/挑選這種需要一眼看出每個人的地方
function avatarOrInitialHtml(person, size = 32) {
  if (!person) return '';
  const name = person.name || '';
  const style = `style="width:${size}px;height:${size}px;font-size:${Math.max(10, Math.round(size * 0.4))}px"`;
  if (person.avatar) return `<img class="member-avatar" ${style} src="${person.avatar}" alt="" title="${escapeHtml(name)}" />`;
  return `<span class="member-avatar-placeholder" ${style} title="${escapeHtml(name)}">${escapeHtml(name.slice(0, 1))}</span>`;
}

// ---------------------------------------------------------------- 初始化

async function init() {
  populateCurrencySelects();
  populateCategoryIconChoices();
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

function populateCategoryIconChoices() {
  $('#new-category-icon').innerHTML = CATEGORY_ICON_CHOICES.map((icon) => `<option value="${icon}">${icon}</option>`).join('');
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

  renderTripCover(trip);
  renderBudgetBar(trip);
  renderCategoryFilterOptions(trip);
  renderExpenseList(trip);
  renderSplitTab(trip);
  renderStatsTab(trip);
  renderMembersTab(trip);
}

function renderTripCover(trip) {
  const wrap = $('#trip-cover-wrap');
  if (trip.coverPhoto) {
    wrap.innerHTML = `
      <div class="trip-cover-frame">
        <button type="button" class="trip-cover-btn" data-action="change-cover" title="更換封面照片">
          <img class="trip-cover-img" src="${trip.coverPhoto}" alt="" />
        </button>
        <button type="button" class="trip-cover-remove" data-action="remove-cover" title="移除封面照片">✕</button>
      </div>`;
  } else {
    wrap.innerHTML = `
      <button type="button" class="trip-cover-btn" data-action="change-cover" title="上傳封面照片">
        <div class="trip-cover-placeholder"><span class="icon">📷</span><span>上傳這趟旅程的封面照片</span></div>
      </button>`;
  }
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
  sel.innerHTML = '<option value="">全部分類</option>' + trip.categories.map((c) => `<option value="${c.id}">${categoryVisual(c).icon} ${escapeHtml(c.name)}</option>`).join('');
  sel.value = currentFilterCategory;
}

function renderExpenseList(trip) {
  const list = $('#expense-list');
  const findMember = (id) => trip.members.find((m) => m.id === id);
  const memberName = (id) => findMember(id)?.name || '（已刪除成員）';
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
      const convertedTWD = convertToTWD(exp.amount, exp.currency, trip.baseCurrency, activeRates);
      const splitMemberIds = exp.splitType === 'custom' ? Object.keys(exp.splitCustom || {}) : exp.splitMembers || [];
      const splitLabel = exp.splitType === 'custom' ? `自訂分攤・${splitMemberIds.length} 人` : `平均分攤・${splitMemberIds.length} 人`;
      const splitAvatars = splitMemberIds
        .map((id) => avatarOrInitialHtml(findMember(id), 22))
        .join('');
      return `
      <div class="expense-card" data-id="${exp.id}">
        <div class="expense-icon">${categoryBadgeHtml(cat, 40)}</div>
        <div class="expense-main">
          <div class="expense-title">${escapeHtml(exp.description || cat.name)}</div>
          <div class="expense-sub">${exp.date || ''}・${memberAvatarHtml(findMember(exp.paidBy))}${escapeHtml(memberName(exp.paidBy))} 付款・${splitLabel}</div>
          ${splitAvatars ? `<div class="split-avatar-group">${splitAvatars}</div>` : ''}
        </div>
        ${exp.receipt ? `<img class="receipt-thumb" src="${exp.receipt}" data-action="view-receipt" data-id="${exp.id}" alt="收據" />` : ''}
        <div class="expense-amount">
          ${exp.amount} ${exp.currency}
          ${converted !== null && exp.currency !== trip.baseCurrency ? `<span class="converted">≈ ${converted.toFixed(0)} ${trip.baseCurrency}</span>` : ''}
          ${convertedTWD !== null && exp.currency !== 'TWD' ? `<span class="converted">≈ ${convertedTWD.toFixed(0)} TWD</span>` : ''}
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
  const findMember = (id) => trip.members.find((m) => m.id === id);
  const memberName = (id) => findMember(id)?.name || '（已刪除成員）';

  const twdNote = (baseAmount) => {
    const twd = baseAmountToTWD(baseAmount, trip.baseCurrency, activeRates);
    return twd !== null ? `<span class="converted">≈ ${twd.toFixed(0)} TWD</span>` : '';
  };

  $('#balances-summary').innerHTML = trip.members
    .map((m) => {
      const bal = balances[m.id] || 0;
      const cls = bal > 0.01 ? 'positive' : bal < -0.01 ? 'negative' : '';
      const text = bal > 0.01 ? `應收回 ${bal.toFixed(2)}` : bal < -0.01 ? `應付出 ${Math.abs(bal).toFixed(2)}` : '已結清';
      return `<div class="balance-chip"><div class="name">${memberAvatarHtml(m)}${escapeHtml(m.name)}</div><div class="amount ${cls}">${text} ${trip.baseCurrency} ${twdNote(Math.abs(bal))}</div></div>`;
    })
    .join('');

  const transactions = simplifyDebts(balances);
  $('#settle-list').innerHTML = transactions.length
    ? transactions
        .map(
          (t) => `<div class="settle-row">
            <strong>${memberAvatarHtml(findMember(t.from))}${escapeHtml(memberName(t.from))}</strong>
            <span class="arrow">應付給</span>
            <strong>${memberAvatarHtml(findMember(t.to))}${escapeHtml(memberName(t.to))}</strong>
            <span class="amount">${t.amount.toFixed(2)} ${trip.baseCurrency} ${twdNote(t.amount)}</span>
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
    trip.members
      .map(
        (m) => `<li>
          <div class="member-row-main">
            <button type="button" class="member-avatar-btn" data-action="change-avatar" data-id="${m.id}" title="更換照片">${avatarOrInitialHtml(m)}</button>
            <span>${escapeHtml(m.name)}</span>
          </div>
          <button data-action="remove-member" data-id="${m.id}" title="移除">✕</button>
        </li>`
      )
      .join('') || '<li>尚無成員</li>';

  const memberNames = new Set(trip.members.map((m) => m.name));
  const availablePeople = store.getPeople().filter((p) => !memberNames.has(p.name));
  $('#member-quick-add').innerHTML = availablePeople
    .map(
      (p) => `<button type="button" class="quick-add-chip" data-action="quick-add-member" data-id="${p.id}">${avatarOrInitialHtml(p)}${escapeHtml(p.name)}</button>`
    )
    .join('');

  $('#category-list').innerHTML = trip.categories
    .map(
      (c) => `<li>
        <div class="member-row-main">${categoryBadgeHtml(c, 28)}<span>${escapeHtml(c.name)}</span></div>
        <button data-action="remove-category" data-id="${c.id}" title="移除">✕</button>
      </li>`
    )
    .join('');
}

function renderPeopleDialog() {
  const people = store.getPeople();
  $('#people-list').innerHTML =
    people
      .map(
        (p) => `<li>
          <div class="member-row-main">
            <button type="button" class="member-avatar-btn" data-action="change-person-avatar" data-id="${p.id}" title="更換照片">${avatarOrInitialHtml(p)}</button>
            <span>${escapeHtml(p.name)}</span>
          </div>
          <button data-action="remove-person" data-id="${p.id}" title="從名單移除">✕</button>
        </li>`
      )
      .join('') || '<li>名單還是空的，在下面新增第一個成員吧！</li>';
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
  $('#trip-members-new-input').value = '';
  renderTripMembersPicker();
  $('#dialog-trip').showModal();
}

function renderTripMembersPicker() {
  const people = store.getPeople();
  $('#trip-members-picker').innerHTML = people.length
    ? people
        .map(
          (p) => `<div class="split-member-row">
            <label><input type="checkbox" value="${p.id}" /> ${avatarOrInitialHtml(p)}${escapeHtml(p.name)}</label>
          </div>`
        )
        .join('')
    : '<p class="empty-hint">名單裡還沒有人，先在下面輸入新成員名字，或到「👤 管理成員」新增。</p>';
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
    const checkedIds = $$('#trip-members-picker input[type="checkbox"]:checked').map((i) => i.value);
    const newNames = $('#trip-members-new-input').value.split(',').map((s) => s.trim()).filter(Boolean);
    const newIds = newNames.map((name) => store.addPerson(name).id);
    store.createTrip({ ...payload, memberPersonIds: [...checkedIds, ...newIds] });
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
  $('#expense-category-input').innerHTML = trip.categories.map((c) => `<option value="${c.id}">${categoryVisual(c).icon} ${escapeHtml(c.name)}</option>`).join('');
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

  $('#trip-cover-wrap').addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-action="remove-cover"]');
    if (removeBtn) {
      const trip = store.getActiveTrip();
      store.updateTrip(trip.id, { coverPhoto: null });
      refreshAll();
      return;
    }
    if (e.target.closest('[data-action="change-cover"]')) {
      $('#trip-cover-input').click();
    }
  });
  $('#trip-cover-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const trip = store.getActiveTrip();
    try {
      const dataUrl = await compressImage(file, { maxWidth: 1000, quality: 0.65 });
      store.updateTrip(trip.id, { coverPhoto: dataUrl });
      refreshAll();
    } catch (err) {
      console.error(err);
      alert('封面照片讀取失敗，請換一張圖片再試。');
    }
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
    const name = input.value.trim();
    if (name) {
      const person = store.addPerson(name);
      store.addTripMember(trip.id, person.id);
      input.value = '';
      refreshAll();
    }
  });
  $('#member-list').addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-action="remove-member"]');
    if (removeBtn) {
      const trip = store.getActiveTrip();
      if (confirm('刪除此成員？相關花費的付款人/分攤設定會一併調整。')) {
        store.removeMember(trip.id, removeBtn.dataset.id);
        refreshAll();
      }
      return;
    }
    const avatarBtn = e.target.closest('[data-action="change-avatar"]');
    if (avatarBtn) {
      pendingAvatarMemberId = avatarBtn.dataset.id;
      $('#member-avatar-input').click();
    }
  });
  $('#member-quick-add').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="quick-add-member"]');
    if (!btn) return;
    const trip = store.getActiveTrip();
    store.addTripMember(trip.id, btn.dataset.id);
    refreshAll();
  });

  $('#btn-manage-people').addEventListener('click', () => {
    renderPeopleDialog();
    $('#dialog-people').showModal();
  });
  $('#form-add-person').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#new-person-name');
    if (input.value.trim()) {
      store.addPerson(input.value.trim());
      input.value = '';
      renderPeopleDialog();
      refreshAll();
    }
  });
  $('#people-list').addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-action="remove-person"]');
    if (removeBtn) {
      if (confirm('從名單移除此成員？已經加入旅程的成員不受影響，只是名單裡不會再看到他。')) {
        store.removePerson(removeBtn.dataset.id);
        renderPeopleDialog();
        refreshAll();
      }
      return;
    }
    const avatarBtn = e.target.closest('[data-action="change-person-avatar"]');
    if (avatarBtn) {
      pendingAvatarPersonId = avatarBtn.dataset.id;
      $('#person-avatar-input').click();
    }
  });
  $('#person-avatar-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !pendingAvatarPersonId) return;
    try {
      const dataUrl = await compressImage(file, { maxWidth: 300, quality: 0.7 });
      store.setPersonAvatar(pendingAvatarPersonId, dataUrl);
      renderPeopleDialog();
      refreshAll();
    } catch (err) {
      console.error(err);
      alert('照片讀取失敗，請換一張圖片再試。');
    } finally {
      pendingAvatarPersonId = null;
    }
  });

  $('#member-avatar-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !pendingAvatarMemberId) return;
    const trip = store.getActiveTrip();
    const member = trip.members.find((m) => m.id === pendingAvatarMemberId);
    try {
      const dataUrl = await compressImage(file, { maxWidth: 300, quality: 0.7 });
      store.setMemberAvatar(trip.id, pendingAvatarMemberId, dataUrl);
      if (member) {
        // 同步存回成員名單（用姓名比對），這樣以後新旅程勾選同一個人時就會自動帶入這張照片
        const person = store.addPerson(member.name);
        store.setPersonAvatar(person.id, dataUrl);
      }
      refreshAll();
    } catch (err) {
      console.error(err);
      alert('照片讀取失敗，請換一張圖片再試。');
    } finally {
      pendingAvatarMemberId = null;
    }
  });

  $('#form-add-category').addEventListener('submit', (e) => {
    e.preventDefault();
    const trip = store.getActiveTrip();
    const name = $('#new-category-name').value.trim();
    const icon = $('#new-category-icon').value || '🏷️';
    if (name) {
      store.addCategory(trip.id, { name, icon });
      $('#new-category-name').value = '';
      $('#new-category-icon').selectedIndex = 0;
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

  $('#btn-export-card').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const trip = store.getActiveTrip();
    const { balances } = computeBalances(trip, activeRates);
    const transactions = simplifyDebts(balances);
    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = '產生圖卡中…';
    try {
      await downloadExpenseCard(trip, activeRates, balances, transactions);
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
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
