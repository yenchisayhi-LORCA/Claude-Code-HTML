// 分享連結的唯讀檢視頁：網址帶 ?share=<tripId> 時，js/app.js 會呼叫這裡的 initShareView()
// 取代整個一般編輯流程。全程不碰 storage.js／localStorage，也不會用到整帳號同步
// （initCloudSync），確保同行者只看得到這一趟被分享的旅程，看不到分享者的其他旅程或成員名單。

import { initShareViewerAuth, isSyncAvailable } from './cloud-sync.js';
import { categoryBadgeHtml } from './category-icons.js';
import { renderPieChart, renderBarChart } from './charts.js';
import { computeBalances, simplifyDebts } from './split.js';

const $ = (sel) => document.querySelector(sel);

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function avatarHtml(member, size = 28) {
  if (!member) return '';
  const style = `style="width:${size}px;height:${size}px;font-size:${Math.max(10, Math.round(size * 0.4))}px"`;
  if (member.avatar) return `<img class="member-avatar" ${style} src="${member.avatar}" alt="" title="${escapeHtml(member.name)}" />`;
  return `<span class="member-avatar-placeholder" ${style} title="${escapeHtml(member.name || '')}">${escapeHtml((member.name || '').slice(0, 1))}</span>`;
}

export async function initShareView(tripId) {
  document.body.classList.add('share-view-mode');
  $('#app-main').hidden = true;
  const shareRoot = $('#share-view-main');
  shareRoot.hidden = false;

  if (!isSyncAvailable()) {
    shareRoot.innerHTML = errorScreen('這個分享連結需要雲端同步功能，但這個網站還沒有設定，請聯絡分享者。');
    return;
  }

  shareRoot.innerHTML = loadingScreen('準備中…');

  // 用一個物件包住 conn 再讀取（而不是直接在 closure 裡抓 const conn），避免 onUser 萬一在
  // initShareViewerAuth 的 await 完成、conn 被賦值「之前」就被呼叫時抓到 undefined。
  const box = {};
  box.conn = await initShareViewerAuth({
    onUser: (user) => handleAuthChange(tripId, shareRoot, box.conn, user),
    onError: () => {
      shareRoot.innerHTML = errorScreen('分享功能載入失敗，請檢查網路連線後重新整理頁面。');
    },
  });
  if (!box.conn) return;
}

function handleAuthChange(tripId, shareRoot, conn, user) {
  if (!user) {
    renderLoginForm(tripId, shareRoot, conn);
    return;
  }
  loadSharedTrip(tripId, shareRoot, conn, user);
}

function renderLoginForm(tripId, shareRoot, conn) {
  shareRoot.innerHTML = `
    <div class="share-login-box">
      <h1>檢視分享的旅程</h1>
      <p class="hint">分享者已經把這趟旅程設定成你可以用 Email 登入唯讀檢視。輸入你的 Email，我們會寄一封登入連結給你（不需要密碼，也不會建立額外的記帳資料）。</p>
      <form id="share-login-form" class="inline-form">
        <input type="email" id="share-login-email" required placeholder="you@example.com" />
        <button type="submit" class="btn btn-primary">傳送登入連結</button>
      </form>
      <div id="share-login-status" class="hint"></div>
    </div>`;
  const form = $('#share-login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#share-login-email').value.trim();
    const statusEl = $('#share-login-status');
    const btn = form.querySelector('button');
    btn.disabled = true;
    statusEl.textContent = '傳送中…';
    try {
      await conn.requestLink(email);
      statusEl.textContent = `登入連結已寄到 ${email}，請到信箱點連結（同一個瀏覽器點開最順利）。`;
    } catch (err) {
      console.error('寄送分享檢視登入連結失敗', err);
      statusEl.textContent = `寄送失敗：${err.code || err.message}`;
    } finally {
      btn.disabled = false;
    }
  });
}

async function loadSharedTrip(tripId, shareRoot, conn, user) {
  shareRoot.innerHTML = loadingScreen('讀取旅程資料中…');
  const { doc, getDoc, onSnapshot } = conn.firestoreModule;
  const ref = doc(conn.db, 'shared_trips', tripId);

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (err) {
    console.error('讀取分享旅程失敗', err);
    shareRoot.innerHTML = errorScreen(`你目前登入的帳號（${escapeHtml(user.email || '')}）沒有權限檢視這趟旅程，請確認分享者已經把你的 Email 加進分享名單，且這個 Email 跟你登入用的完全一致。`);
    return;
  }
  if (!snap.exists()) {
    shareRoot.innerHTML = errorScreen('這個分享連結已經失效（分享者可能已經停止分享，或刪除了這趟旅程）。');
    return;
  }

  renderSharedTrip(shareRoot, snap.data());
  onSnapshot(
    ref,
    (liveSnap) => {
      if (!liveSnap.exists()) {
        shareRoot.innerHTML = errorScreen('分享者已經停止分享這趟旅程。');
        return;
      }
      renderSharedTrip(shareRoot, liveSnap.data());
    },
    (err) => console.error('分享旅程即時更新失敗', err)
  );
}

function loadingScreen(text) {
  return `<div class="share-login-box"><p class="hint">${escapeHtml(text)}</p></div>`;
}
function errorScreen(text) {
  return `<div class="share-login-box"><h1>無法檢視</h1><p class="hint">${escapeHtml(text)}</p></div>`;
}

export function renderSharedTrip(shareRoot, data) {
  const trip = data.trip;
  const findMember = (id) => trip.members.find((m) => m.id === id);
  const memberName = (id) => findMember(id)?.name || '（已刪除成員）';

  const range = trip.startDate && trip.endDate ? `${trip.startDate} ~ ${trip.endDate}` : '';
  const total = trip.expenses.reduce((sum, e) => sum + (e.currency === trip.baseCurrency ? Number(e.amount) || 0 : 0), 0);

  const expenseRows = [...trip.expenses]
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0))
    .map((exp) => {
      const cat = trip.categories.find((c) => c.id === exp.categoryId) || { icon: '📦', name: '未分類' };
      const splitMemberIds = exp.splitType === 'custom' ? Object.keys(exp.splitCustom || {}) : exp.splitMembers || [];
      const splitAvatars = splitMemberIds.map((id) => avatarHtml(findMember(id), 24)).join('');
      return `
      <div class="expense-card">
        <div class="expense-icon">${categoryBadgeHtml(cat, 40)}</div>
        <div class="expense-main">
          <div class="expense-title">${escapeHtml(exp.description || cat.name)}</div>
          <div class="expense-sub">${exp.date || ''}・${avatarHtml(findMember(exp.paidBy), 18)}${escapeHtml(memberName(exp.paidBy))} 付款</div>
        </div>
        ${exp.receipt ? `<img class="receipt-thumb" src="${exp.receipt}" alt="收據" />` : ''}
        ${splitAvatars ? `<div class="split-avatar-group" title="分攤成員">${splitAvatars}</div>` : ''}
        <div class="expense-amount">${exp.amount} ${exp.currency}</div>
      </div>`;
    })
    .join('');

  const { balances } = computeBalances(trip, null);
  const balanceChips = trip.members
    .map((m) => {
      const bal = balances[m.id] || 0;
      const cls = bal > 0.01 ? 'positive' : bal < -0.01 ? 'negative' : '';
      const text = bal > 0.01 ? `應收回 ${bal.toFixed(2)}` : bal < -0.01 ? `應付出 ${Math.abs(bal).toFixed(2)}` : '已結清';
      return `<div class="balance-chip"><div class="name">${avatarHtml(m)}${escapeHtml(m.name)}</div><div class="amount ${cls}">${text} ${trip.baseCurrency}</div></div>`;
    })
    .join('');
  const transactions = simplifyDebts(balances);
  const settleRows = transactions.length
    ? transactions
        .map(
          (t) => `<div class="settle-row">
            <strong>${avatarHtml(findMember(t.from))}${escapeHtml(memberName(t.from))}</strong>
            <span class="arrow">應付給</span>
            <strong>${avatarHtml(findMember(t.to))}${escapeHtml(memberName(t.to))}</strong>
            <span class="amount">${t.amount.toFixed(2)} ${trip.baseCurrency}</span>
          </div>`
        )
        .join('')
    : '<p class="empty-hint">目前沒有需要結清的款項 🎉</p>';

  const byCategory = {};
  trip.expenses.forEach((e) => {
    if (e.currency !== trip.baseCurrency) return; // 唯讀分享頁不換算匯率，混幣別的花費只算同幣別部分
    byCategory[e.categoryId] = (byCategory[e.categoryId] || 0) + (Number(e.amount) || 0);
  });
  const slices = trip.categories.map((c) => ({ label: c.name, value: byCategory[c.id] || 0, color: c.color }));

  const byDate = {};
  trip.expenses.forEach((e) => {
    if (e.currency !== trip.baseCurrency) return;
    const key = e.date || '未知日期';
    byDate[key] = (byDate[key] || 0) + (Number(e.amount) || 0);
  });
  const points = Object.entries(byDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label: label.length > 5 ? label.slice(5) : label, value }));

  shareRoot.innerHTML = `
    <div class="share-view-header">
      <h1>${escapeHtml(trip.name)}</h1>
      <p class="hint">由 ${escapeHtml(data.ownerEmail || '分享者')} 分享的唯讀檢視${range ? `・${escapeHtml(range)}` : ''}・${escapeHtml(trip.baseCurrency)}</p>
      <div class="stat-box"><span>總花費（${escapeHtml(trip.baseCurrency)} 部分）</span><strong>${total.toLocaleString('en-US')} ${escapeHtml(trip.baseCurrency)}</strong></div>
    </div>
    <h3>分類花費比例</h3>
    ${renderPieChart(slices, { currency: trip.baseCurrency })}
    <h3>每日花費趨勢</h3>
    ${renderBarChart(points, { currency: trip.baseCurrency })}
    <h3>花費明細</h3>
    <div class="expense-list">${expenseRows || '<p class="empty-hint">還沒有花費紀錄</p>'}</div>
    <h3>分帳結算</h3>
    <div class="balances-summary">${balanceChips}</div>
    <div class="settle-list">${settleRows}</div>
    <p class="hint share-view-footnote">這是唯讀檢視，畫面會隨分享者更新自動更新；混合幣別的花費目前只計入跟旅程基準貨幣相同的部分。</p>
  `;
}
