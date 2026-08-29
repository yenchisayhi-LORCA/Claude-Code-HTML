// 主要渲染 + 事件綁定：把其他模組串起來。整體模式是「任何資料變動都呼叫 storage 的
// CRUD／ledger.addLedgerEntry → persist() → notify() 觸發 subscribe(render) → 全畫面重繪」，
// 所以這裡的 render 系列函式基本上是無狀態、每次都用目前的 storage 資料整份重畫。

import * as storage from './storage.js';
import { getBalance, getStreak, getMonthCalendar, todayStr } from './ledger.js';
import { completeTask, uncompleteTask, hasCompletedTaskToday, manualAdjust, getTaskHistory, deleteTaskHistoryEntry } from './tasks.js';
import { computeSuggestedStars, submitExercise, approveExercise, rejectExercise, deleteExerciseSubmission } from './exercise.js';
import { canRedeem, redeemShopItem } from './shop.js';
import { renderCertificateCanvas, downloadCertificatePng, printCertificateImage } from './certificate.js';
import { formatMonthLabel, renderCalendarGrid, renderSleepCalendarGrid, renderStreakBadge } from './calendar.js';
import { celebrate } from './confetti.js';
import { initPin, withPinGate } from './pin.js';
import { compressImage } from './image.js';
import { computeSleepStars, submitSleep, clearSleep, getSleepMonthCalendar, getSleepHistory } from './sleep.js';
import { TASK_ICONS, SHOP_ICONS, EXERCISE_ICON, CHIP_COLORS, MASCOT_COLORS } from './icons.js';
import { initCloudSync, requestSignInLink, signOutOfSync, debugSyncInfo } from './cloud-sync.js';

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------- 手繪風格小工具（圖示色塊、小怪獸頭像）

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// 不規則圓角：四角各自算一個 40~64% 的值，每個 seed 都不一樣，符合設計系統「每個實例都略有不同」的要求
function blobRadius(seed) {
  const h = hashStr(seed);
  const a = 40 + (h % 25);
  const c = 40 + ((h >> 6) % 25);
  const e = 40 + ((h >> 12) % 25);
  const g = 40 + ((h >> 18) % 25);
  return `${a}% ${100 - a}% ${c}% ${100 - c}% / ${e}% ${100 - g}% ${g}% ${100 - e}%`;
}

function blobRotate(seed) {
  return (hashStr(`${seed}r`) % 9) - 4; // -4 ~ 4 度
}

// 任務/商店/獎狀共用的手繪圖示色塊
function iconChip(iconId, seed, { size = 60, iconSize = 34 } = {}) {
  const bg = CHIP_COLORS[hashStr(seed) % CHIP_COLORS.length];
  return `<div class="icon-chip" style="width:${size}px;height:${size}px;background:${bg};border-radius:${blobRadius(seed)};transform:rotate(${blobRotate(seed)}deg);"><svg width="${iconSize}" height="${iconSize}"><use href="#${iconId}"></use></svg></div>`;
}

// 小孩沒有大頭貼時的預設頭像：色塊小怪獸（圓潤色塊 + 兩個圓點眼睛 + 微笑線）
function mascotSvg(seed, size = 44) {
  const color = MASCOT_COLORS[hashStr(seed) % MASCOT_COLORS.length];
  return `<svg class="mascot" viewBox="0 0 60 60" width="${size}" height="${size}"><path d="M30 3c16 0 28 14 28 31 0 14-12 23-28 23S2 48 2 34C2 17 14 3 30 3Z" fill="${color}"></path><circle cx="21" cy="30" r="3" fill="#262261"></circle><circle cx="39" cy="30" r="3" fill="#262261"></circle><path d="M22 39c4 5 13 5 17-1" fill="none" stroke="#262261" stroke-width="3" stroke-linecap="round"></path></svg>`;
}

function kidAvatarHtml(kid, size, imgClass) {
  if (kid && kid.avatar) return `<img class="${imgClass}" src="${kid.avatar}" alt="" style="width:${size}px;height:${size}px;">`;
  return mascotSvg(kid ? kid.id : 'x', size);
}

function iconSvg(iconId, size = 18, cls = '') {
  return `<svg class="${cls}" width="${size}" height="${size}"><use href="#${iconId}"></use></svg>`;
}

// ---------------------------------------------------------------- 畫面狀態（不進 localStorage，只是目前畫面焦點）

let currentTab = 'tasks';
const now = new Date();
let calYear = now.getFullYear();
let calMonth = now.getMonth();
let pendingKidAvatar = null;
let certQueue = [];
let certDialogOpen = false;
let reviewingSubmissionId = null;
let currentCertCanvas = null;
let syncStatus = { available: false };

function getActiveKid() {
  const s = storage.getState();
  return storage.getKid(s.activeKidId) || storage.getKids()[0] || null;
}

function formulaLabelForKind(kind) {
  const f = storage.getExerciseFormulas().find((x) => x.kind === kind);
  return f ? f.label : kind;
}

function scopeLabel(scope) {
  if (scope === 'all') return '全部小孩';
  const kid = storage.getKid(scope);
  return kid ? kid.name : '（已刪除的小孩）';
}

// ================================================================== render：小孩切換器 + 主要區塊

function renderKidSwitcher(kids) {
  const activeId = storage.getState().activeKidId;
  const el = document.getElementById('kid-switcher');
  el.innerHTML =
    kids
      .map((k) => {
        const balance = getBalance(k.id);
        const avatar = kidAvatarHtml(k, 44, 'kid-tab-avatar');
        return `<button type="button" class="kid-tab ${k.id === activeId ? 'active' : ''}" data-kid-id="${k.id}">${avatar}<span><div>${esc(k.name)}</div><div class="kid-tab-balance">${balance}</div></span></button>`;
      })
      .join('') + `<button type="button" class="btn-add-kid" id="btn-switcher-add-kid">+</button>`;
}

function renderSyncArea() {
  const el = document.getElementById('sync-area');
  if (!syncStatus || !syncStatus.available) {
    el.innerHTML = '';
    return;
  }
  if (!syncStatus.signedIn) {
    el.innerHTML = `<button type="button" id="btn-sync-login" class="btn btn-ghost">登入同步</button>`;
    if (syncStatus.error) el.innerHTML += `<span class="sync-status error">${esc(syncStatus.error)}</span>`;
    return;
  }
  const statusLabel = syncStatus.error
    ? `<span class="sync-status error">${esc(syncStatus.error)}</span>`
    : `<span class="sync-status ${syncStatus.syncing ? '' : 'ok'}">${syncStatus.syncing ? '同步中…' : '已同步'}</span>`;
  el.innerHTML = `<span class="sync-user"><span class="sync-email">${esc(syncStatus.user?.email || '')}</span>${statusLabel}<button type="button" id="btn-sync-debug" class="btn btn-ghost">偵錯</button><button type="button" id="btn-sync-logout" class="btn btn-ghost">登出</button></span>`;
}

function renderBalanceHero(kid) {
  const el = document.getElementById('balance-hero');
  const balance = getBalance(kid.id);
  const avatar = kidAvatarHtml(kid, 76, 'balance-hero-avatar');
  el.innerHTML = `${avatar}<div class="balance-hero-info"><div class="balance-hero-name">${esc(kid.name)}</div><div class="balance-hero-amount">${iconSvg('ic-star', 30, 'star-ic')}${balance}<span class="unit">顆星星</span></div></div>`;
}

// ================================================================== render：今日任務

function renderTasksTab(kid) {
  const templates = storage.getTaskTemplates().filter((t) => t.active !== false);
  const list = document.getElementById('task-list');
  document.getElementById('task-empty-hint').hidden = templates.length > 0;
  list.innerHTML = templates
    .map((t) => {
      const done = hasCompletedTaskToday(kid.id, t.id);
      const chip = done
        ? `<div class="icon-chip" style="width:60px;height:60px;background:#fff;border-radius:${blobRadius('task-' + t.id)};transform:rotate(${blobRotate('task-' + t.id)}deg);"><svg width="34" height="34"><use href="#${t.icon}"></use></svg></div>`
        : iconChip(t.icon, `task-${t.id}`, { size: 60, iconSize: 34 });
      const right = done
        ? iconSvg('ic-check', 30, 'task-done-mark')
        : `<span class="stars-badge">${iconSvg('ic-star')}${t.stars}</span>`;
      return `<button type="button" class="task-card ${done ? 'done' : ''}" data-task-id="${t.id}" title="${done ? '再點一下可以取消' : ''}">
        ${chip}
        <span class="task-name">${esc(t.name)}</span>
        ${right}
      </button>`;
    })
    .join('');
  renderTaskHistory(kid);
}

function renderTaskHistory(kid) {
  const history = getTaskHistory(kid.id);
  document.getElementById('task-history-list').innerHTML =
    history
      .map(
        (e) => `<li><div class="item-main">${esc(e.label)}（${e.date}）</div>
          <div class="item-actions"><span class="stars-badge">${iconSvg('ic-star')}${e.amount}</span><button type="button" class="btn-delete-task-history btn-icon-only" data-entry-id="${e.id}" style="font-size:20px;font-weight:900;">×</button></div></li>`
      )
      .join('') || '<li class="hint">還沒有作業歷程</li>';
}

// ================================================================== render：運動回報

function renderExerciseTab(kid) {
  const formulas = storage.getExerciseFormulas();
  const select = document.getElementById('exercise-kind-input');
  const hasFormula = formulas.length > 0;
  document.getElementById('exercise-no-formula-hint').hidden = hasFormula;
  document.getElementById('form-exercise-submit').hidden = !hasFormula;
  const prevValue = select.value;
  select.innerHTML = formulas.map((f) => `<option value="${f.id}">${esc(f.label)}</option>`).join('');
  if (formulas.some((f) => f.id === prevValue)) select.value = prevValue;
  updateExerciseSuggestHint();

  const pending = storage.getExerciseSubmissions(kid.id).filter((s) => s.status === 'pending');
  document.getElementById('exercise-pending-list').innerHTML =
    pending
      .map(
        (s) => `<li class="pending-item" data-sub-id="${s.id}">
          <div class="item-main">${iconChip(EXERCISE_ICON, `ex-${s.id}`, { size: 40, iconSize: 22 })}${esc(formulaLabelForKind(s.kind))}：${s.reportedValue}（建議 ${s.suggestedStars} 顆）</div>
          <div class="item-actions"><button type="button" class="btn-review" data-sub-id="${s.id}">審核</button></div>
        </li>`
      )
      .join('') || '<li class="hint">目前沒有待審核的回報</li>';
}

function renderExerciseHistory(kid) {
  const history = storage.getExerciseSubmissions(kid.id).filter((s) => s.status !== 'pending').slice(0, 30);
  document.getElementById('exercise-history-list').innerHTML =
    history
      .map((s) => {
        const badge = s.status === 'approved' ? `<span class="badge badge-approved">核准 ${s.approvedStars}</span>` : `<span class="badge badge-rejected">退回</span>`;
        return `<li><div class="item-main">${esc(formulaLabelForKind(s.kind))}：${s.reportedValue}（${s.date}）</div>
          <div class="item-actions">${badge}<button type="button" class="btn-delete-exercise btn-icon-only" data-sub-id="${s.id}" style="font-size:20px;font-weight:900;">×</button></div></li>`;
      })
      .join('') || '<li class="hint">還沒有回報歷史</li>';
}

function updateExerciseSuggestHint() {
  const select = document.getElementById('exercise-kind-input');
  const formula = storage.getExerciseFormulas().find((f) => f.id === select.value);
  const value = Number(document.getElementById('exercise-value-input').value) || 0;
  const hint = document.getElementById('exercise-suggest-hint');
  hint.textContent = formula ? `預估可得 ${computeSuggestedStars(formula, value)} 顆星（家長審核後才會入帳）` : '';
}

function openExerciseReview(submissionId) {
  const s = storage.getExerciseSubmission(submissionId);
  if (!s) return;
  reviewingSubmissionId = submissionId;
  document.getElementById('exercise-review-detail').textContent = `${formulaLabelForKind(s.kind)}：回報 ${s.reportedValue}，系統建議 ${s.suggestedStars} 顆星`;
  document.getElementById('exercise-review-stars-input').value = s.suggestedStars;
  document.getElementById('dialog-exercise-review').showModal();
}

// ================================================================== render：星星商店

function renderShopTab(kid) {
  const items = storage.getShopCatalog().filter((i) => i.active !== false);
  const grid = document.getElementById('shop-grid');
  document.getElementById('shop-empty-hint').hidden = items.length > 0;
  const balance = getBalance(kid.id);
  grid.innerHTML = items
    .map((item) => {
      const affordable = balance >= item.cost;
      return `<div class="shop-card">
        ${iconChip(item.icon, `shop-${item.id}`, { size: 72, iconSize: 40 })}
        <div class="shop-name">${esc(item.name)}</div>
        <span class="shop-kind-badge">${esc(item.kind)}</span>
        <span class="stars-badge">${iconSvg('ic-star')}${item.cost}</span>
        <button type="button" class="btn btn-accent btn-redeem" data-item-id="${item.id}" ${affordable ? '' : 'disabled'}>兌換</button>
      </div>`;
    })
    .join('');
}

// ================================================================== render：獎狀牆 + 獎狀 canvas 預覽

const AWARD_COLORS = [
  { bg: 'var(--sun-yellow)', text: 'var(--ink-navy)' },
  { bg: 'var(--block-blue)', text: '#fff' },
  { bg: 'var(--lake-teal)', text: 'var(--ink-navy)' },
  { bg: 'var(--bubble-pink)', text: 'var(--ink-navy)' },
];

function renderCertificatesTab(kid) {
  const balance = getBalance(kid.id);
  const tiers = storage.getCertificateTiers();
  const nextTier = tiers.find((t) => t.threshold > balance);
  const progressWrap = document.getElementById('cert-progress-wrap');
  if (nextTier) {
    const prevThreshold = tiers.filter((t) => t.threshold <= balance).slice(-1)[0]?.threshold || 0;
    const span = Math.max(1, nextTier.threshold - prevThreshold);
    const pct = Math.min(100, Math.round(((balance - prevThreshold) / span) * 100));
    progressWrap.hidden = false;
    progressWrap.innerHTML = `
      <div class="progress-head"><strong>下一張：${esc(nextTier.title)}</strong><span class="progress-frac">${balance} / ${nextTier.threshold}</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div>${iconSvg('ic-star', 48, 'progress-star')}</div>`;
  } else {
    progressWrap.hidden = true;
    progressWrap.innerHTML = '';
  }

  const certs = storage.getAwardedCertificates(kid.id);
  const achievedThresholds = new Set(certs.map((c) => c.thresholdSnapshot));
  const lockedTiers = tiers.filter((t) => !achievedThresholds.has(t.threshold) && t.threshold > balance);

  const gallery = document.getElementById('cert-gallery');
  document.getElementById('cert-empty-hint').hidden = certs.length > 0 || lockedTiers.length > 0;

  const unlockedCards = certs.map((c, i) => {
    const color = AWARD_COLORS[i % AWARD_COLORS.length];
    const photo = c.photoDataUrl || kid.avatar;
    const thumb = photo
      ? `<img class="cert-photo" src="${photo}" alt="">`
      : iconSvg('ic-trophy', 44);
    return `<div class="cert-card" data-cert-id="${c.id}" style="background:${color.bg};color:${color.text};transform:rotate(${blobRotate('cert-' + c.id)}deg);">
      ${thumb}
      <div class="cert-title">${esc(c.tierTitleSnapshot)}</div>
      <div class="cert-stars">${c.thresholdSnapshot} STARS</div>
    </div>`;
  });

  const lockedCards = lockedTiers.map((t) => `<div class="cert-card locked" style="transform:rotate(${blobRotate('tier-' + t.id)}deg);">
      ${iconSvg('ic-lock', 44)}
      <div class="cert-title">${esc(t.title)}</div>
      <div class="cert-stars">還差 ${t.threshold - balance} 顆</div>
    </div>`);

  gallery.innerHTML = unlockedCards.join('') + lockedCards.join('');
}

async function openCertPreview(cert, { isNewUnlock = false } = {}) {
  const dialog = document.getElementById('dialog-cert-preview');
  document.getElementById('cert-preview-title').innerHTML = isNewUnlock
    ? `${iconSvg('ic-sparkle', 26, 'heading-icon')}解鎖新獎狀！`
    : `${iconSvg('ic-trophy', 26, 'heading-icon')}獎狀`;
  const kid = storage.getKid(cert.kidId);
  const wrap = document.getElementById('cert-canvas-wrap');
  wrap.innerHTML = '<p class="hint">產生中…</p>';

  const canvas = await renderCertificateCanvas({
    kidName: kid ? kid.name : '',
    tierTitle: cert.tierTitleSnapshot,
    threshold: cert.thresholdSnapshot,
    stars: cert.starsAtAward,
    date: cert.date,
    photoDataUrl: cert.photoDataUrl || (kid ? kid.avatar : null),
  });
  currentCertCanvas = canvas;
  wrap.innerHTML = '';
  wrap.appendChild(canvas);

  const photoInput = document.getElementById('cert-photo-input');
  photoInput.value = '';
  photoInput.onchange = async () => {
    const file = photoInput.files[0];
    if (!file) return;
    const dataUrl = await compressImage(file, { maxWidth: 500, quality: 0.7 });
    storage.updateAwardedCertificate(cert.id, { photoDataUrl: dataUrl });
    cert.photoDataUrl = dataUrl;
    const newCanvas = await renderCertificateCanvas({
      kidName: kid ? kid.name : '',
      tierTitle: cert.tierTitleSnapshot,
      threshold: cert.thresholdSnapshot,
      stars: cert.starsAtAward,
      date: cert.date,
      photoDataUrl: dataUrl,
    });
    currentCertCanvas = newCanvas;
    wrap.innerHTML = '';
    wrap.appendChild(newCanvas);
  };

  document.getElementById('btn-cert-download').onclick = () => downloadCertificatePng(currentCertCanvas, `獎狀-${kid ? kid.name : ''}-${cert.tierTitleSnapshot}.png`);
  document.getElementById('btn-cert-print').onclick = () => printCertificateImage(currentCertCanvas);

  dialog.showModal();
}

function showNextCertFromQueue() {
  const cert = certQueue.shift();
  if (!cert) {
    certDialogOpen = false;
    return;
  }
  certDialogOpen = true;
  openCertPreview(cert, { isNewUnlock: true });
}

function handleNewCertificates(certs) {
  if (!certs || !certs.length) return;
  certQueue.push(...certs);
  if (!certDialogOpen) showNextCertFromQueue();
}

// ================================================================== render：日曆 + 連續天數

function renderCalendarTab(kid) {
  document.getElementById('cal-month-label').textContent = formatMonthLabel(calYear, calMonth);
  const cells = getMonthCalendar(kid.id, calYear, calMonth);
  document.getElementById('calendar-wrap').innerHTML = renderCalendarGrid(cells);
  document.getElementById('streak-badge-wrap').innerHTML = renderStreakBadge(getStreak(kid.id));

  const sleepCells = getSleepMonthCalendar(kid.id, calYear, calMonth);
  document.getElementById('sleep-calendar-wrap').innerHTML = renderSleepCalendarGrid(sleepCells, todayStr());
  renderSleepHistory(kid);
}

function renderSleepHistory(kid) {
  const history = getSleepHistory(kid.id);
  document.getElementById('sleep-history-list').innerHTML =
    history
      .map((e) => `<li><div class="item-main">${iconChip('ic-bed', `sleep-${e.id}`, { size: 40, iconSize: 22 })}${e.date}：${e.label.replace('睡眠回報：', '')}</div><span class="badge badge-approved">+${e.amount}</span></li>`)
      .join('') || '<li class="hint">還沒有睡眠紀錄</li>';
}

function openSleepDialog(dateStr) {
  const kid = getActiveKid();
  if (!kid) return;
  const existing = storage.getSleepRecord(kid.id, dateStr);
  document.getElementById('sleep-date-input').value = dateStr;
  document.getElementById('sleep-date-label').textContent = dateStr;
  document.getElementById('sleep-time-value-input').value = existing ? existing.bedtime : '';
  document.getElementById('btn-sleep-clear').hidden = !existing;
  updateSleepSuggestHint();
  document.getElementById('dialog-sleep').showModal();
}

function updateSleepSuggestHint() {
  const value = document.getElementById('sleep-time-value-input').value;
  const hint = document.getElementById('sleep-suggest-hint');
  hint.textContent = value ? `預估可得 ${computeSleepStars(value)} 顆星（送出立即入帳）` : '';
}

// ================================================================== render：家長設定

const EDIT_DELETE_BTNS = (editCls, delCls, id) => `<div class="item-actions">
  <button type="button" class="${editCls} btn-icon-only" data-id="${id}">${iconSvg('ic-pencil', 18)}</button>
  <button type="button" class="${delCls} btn-icon-only" data-id="${id}" style="font-size:20px;font-weight:900;">×</button>
</div>`;

function renderSettingsKidList() {
  const kids = storage.getKids();
  document.getElementById('settings-kid-list').innerHTML =
    kids
      .map(
        (k) => `<li><div class="item-main">${kidAvatarHtml(k, 32, 'kid-tab-avatar')} ${esc(k.name)}</div>
          <div class="item-actions">
            <button type="button" class="btn-edit-kid btn-icon-only" data-kid-id="${k.id}">${iconSvg('ic-pencil', 18)}</button>
            <button type="button" class="btn-delete-kid btn-icon-only" data-kid-id="${k.id}" style="font-size:20px;font-weight:900;">×</button>
          </div></li>`
      )
      .join('') || '<li class="hint">還沒有小孩</li>';
}

function renderSettingsTaskList() {
  const list = storage.getTaskTemplates();
  document.getElementById('settings-task-list').innerHTML =
    list
      .map(
        (t) => `<li><div class="item-main">${iconChip(t.icon, `stask-${t.id}`, { size: 40, iconSize: 22 })}${esc(t.name)} <span class="badge">${t.stars}</span></div>
          ${EDIT_DELETE_BTNS('btn-edit', 'btn-delete', t.id)}</li>`
      )
      .join('') || '<li class="hint">還沒有作業項目</li>';
}

function renderSettingsFormulaList() {
  const list = storage.getExerciseFormulas();
  document.getElementById('settings-formula-list').innerHTML =
    list
      .map(
        (f) => `<li><div class="item-main">${iconChip(EXERCISE_ICON, `sform-${f.id}`, { size: 40, iconSize: 22 })}${esc(f.label)} <span class="hint">(${esc(f.kind)})・每${f.unitsPerStar}=1顆</span></div>
          ${EDIT_DELETE_BTNS('btn-edit', 'btn-delete', f.id)}</li>`
      )
      .join('') || '<li class="hint">還沒有運動換算公式</li>';
}

function renderSettingsTierList() {
  const list = storage.getCertificateTiers();
  document.getElementById('settings-tier-list').innerHTML =
    list
      .map(
        (t) => `<li><div class="item-main">${iconSvg('ic-trophy', 22)}${t.threshold} 顆：${esc(t.title)}</div>
          ${EDIT_DELETE_BTNS('btn-edit', 'btn-delete', t.id)}</li>`
      )
      .join('') || '<li class="hint">還沒有設定獎狀門檻</li>';
}

function renderSettingsChallengeList() {
  const list = storage.getSavingsChallenges();
  document.getElementById('settings-challenge-list').innerHTML =
    list
      .map(
        (c) => `<li><div class="item-main">${esc(c.name)}<br><span class="hint">${esc(scopeLabel(c.scope))}・維持${c.minBalance}顆・連續${c.targetDays}天・獎勵${c.bonusStars}顆</span></div>
          ${EDIT_DELETE_BTNS('btn-edit', 'btn-delete', c.id)}</li>`
      )
      .join('') || '<li class="hint">還沒有儲蓄挑戰</li>';
}

function renderSettingsShopList() {
  const list = storage.getShopCatalog();
  document.getElementById('settings-shop-list').innerHTML =
    list
      .map(
        (i) => `<li><div class="item-main">${iconChip(i.icon, `sshop-${i.id}`, { size: 40, iconSize: 22 })}${esc(i.name)} <span class="badge">${i.cost}</span></div>
          ${EDIT_DELETE_BTNS('btn-edit', 'btn-delete', i.id)}</li>`
      )
      .join('') || '<li class="hint">還沒有商店品項</li>';
}

function renderPinStatus() {
  const pin = storage.getPin();
  document.getElementById('pin-status').textContent = pin ? '目前已設定 PIN 保護。' : '目前尚未設定 PIN，家長功能任何人都能操作。';
  document.getElementById('btn-clear-pin').disabled = !pin;
}

function renderSettingsTab() {
  renderSettingsKidList();
  renderSettingsTaskList();
  renderSettingsFormulaList();
  renderSettingsTierList();
  renderSettingsChallengeList();
  renderSettingsShopList();
  renderPinStatus();
}

// ================================================================== 主渲染入口

function render() {
  renderSyncArea();
  const kids = storage.getKids();
  renderKidSwitcher(kids);
  const emptyState = document.getElementById('empty-state');
  const kidView = document.getElementById('kid-view');
  if (!kids.length) {
    emptyState.hidden = false;
    kidView.hidden = true;
    return;
  }
  emptyState.hidden = true;
  kidView.hidden = false;
  const kid = getActiveKid();
  if (!kid) return;
  renderBalanceHero(kid);
  renderTasksTab(kid);
  renderExerciseTab(kid);
  renderExerciseHistory(kid);
  renderShopTab(kid);
  renderCertificatesTab(kid);
  renderCalendarTab(kid);
  renderSettingsTab();
}

// ================================================================== icon picker（作業/商店共用）

function renderIconPicker(containerEl, hiddenInputEl, icons, selected) {
  const initial = selected || icons[0];
  containerEl.innerHTML = icons
    .map((ic) => `<button type="button" class="icon-option ${ic === initial ? 'selected' : ''}" data-icon="${ic}">${iconSvg(ic, 26)}</button>`)
    .join('');
  hiddenInputEl.value = initial;
  containerEl.querySelectorAll('.icon-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      containerEl.querySelectorAll('.icon-option').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      hiddenInputEl.value = btn.dataset.icon;
    });
  });
}

// ================================================================== 小孩 新增/編輯 dialog

function openKidDialog(kid = null) {
  document.getElementById('kid-dialog-title').textContent = kid ? '編輯小孩' : '新增小孩';
  document.getElementById('kid-id-input').value = kid ? kid.id : '';
  document.getElementById('kid-name-input').value = kid ? kid.name : '';
  document.getElementById('kid-avatar-input').value = '';
  pendingKidAvatar = kid ? kid.avatar || null : null;
  document.getElementById('kid-avatar-preview').innerHTML = pendingKidAvatar ? `<img src="${pendingKidAvatar}" alt="">` : '';
  document.getElementById('dialog-kid').showModal();
}

// ================================================================== 作業 新增/編輯 dialog

function openTaskDialog(task = null) {
  document.getElementById('task-dialog-title').textContent = task ? '編輯作業' : '新增作業';
  document.getElementById('task-id-input').value = task ? task.id : '';
  document.getElementById('task-name-input').value = task ? task.name : '';
  document.getElementById('task-stars-input').value = task ? task.stars : 1;
  renderIconPicker(document.getElementById('task-icon-picker'), document.getElementById('task-icon-input'), TASK_ICONS, task ? task.icon : null);
  document.getElementById('dialog-task').showModal();
}

// ================================================================== 運動換算公式 新增/編輯 dialog

function openFormulaDialog(formula = null) {
  document.getElementById('formula-dialog-title').textContent = formula ? '編輯運動換算公式' : '新增運動換算公式';
  document.getElementById('formula-id-input').value = formula ? formula.id : '';
  document.getElementById('formula-kind-input').value = formula ? formula.kind : '';
  document.getElementById('formula-label-input').value = formula ? formula.label : '';
  document.getElementById('formula-units-input').value = formula ? formula.unitsPerStar : '';
  document.getElementById('dialog-formula').showModal();
}

// ================================================================== 獎狀門檻 新增/編輯 dialog

function openTierDialog(tier = null) {
  document.getElementById('tier-dialog-title').textContent = tier ? '編輯獎狀門檻' : '新增獎狀門檻';
  document.getElementById('tier-id-input').value = tier ? tier.id : '';
  document.getElementById('tier-threshold-input').value = tier ? tier.threshold : '';
  document.getElementById('tier-title-input').value = tier ? tier.title : '';
  document.getElementById('dialog-tier').showModal();
}

// ================================================================== 儲蓄挑戰 新增/編輯 dialog

function openChallengeDialog(challenge = null) {
  document.getElementById('challenge-dialog-title').textContent = challenge ? '編輯儲蓄挑戰' : '新增儲蓄挑戰';
  document.getElementById('challenge-id-input').value = challenge ? challenge.id : '';
  document.getElementById('challenge-name-input').value = challenge ? challenge.name : '';
  const scopeSelect = document.getElementById('challenge-scope-input');
  scopeSelect.innerHTML = `<option value="all">全部小孩</option>` + storage.getKids().map((k) => `<option value="${k.id}">${esc(k.name)}</option>`).join('');
  scopeSelect.value = challenge ? challenge.scope : 'all';
  document.getElementById('challenge-min-balance-input').value = challenge ? challenge.minBalance : '';
  document.getElementById('challenge-days-input').value = challenge ? challenge.targetDays : '';
  document.getElementById('challenge-bonus-input').value = challenge ? challenge.bonusStars : '';
  document.getElementById('dialog-challenge').showModal();
}

// ================================================================== 商店品項 新增/編輯 dialog

function openShopItemDialog(item = null) {
  document.getElementById('shop-item-dialog-title').textContent = item ? '編輯商店品項' : '新增商店品項';
  document.getElementById('shop-item-id-input').value = item ? item.id : '';
  document.getElementById('shop-item-name-input').value = item ? item.name : '';
  document.getElementById('shop-item-cost-input').value = item ? item.cost : '';
  document.getElementById('shop-item-kind-input').value = item ? item.kind : '實體禮物';
  renderIconPicker(document.getElementById('shop-icon-picker'), document.getElementById('shop-item-icon-input'), SHOP_ICONS, item ? item.icon : null);
  document.getElementById('dialog-shop-item').showModal();
}

// ================================================================== 事件綁定

function initEventListeners() {
  // tab 切換
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tab-panel').forEach((p) => (p.hidden = p.id !== `tab-${currentTab}`));
    });
  });

  // dialog 通用關閉按鈕（dialog-pin 自己在 pin.js 裡處理，這裡跳過避免重複）
  document.querySelectorAll('dialog').forEach((dialog) => {
    if (dialog.id === 'dialog-pin') return;
    dialog.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', () => dialog.close()));
  });

  document.getElementById('dialog-cert-preview').addEventListener('close', () => {
    if (certDialogOpen) showNextCertFromQueue();
  });

  // 雲端同步
  document.getElementById('sync-area').addEventListener('click', (e) => {
    if (e.target.closest('#btn-sync-login')) {
      document.getElementById('signin-email-status').textContent = '';
      document.getElementById('form-email-signin').reset();
      document.getElementById('dialog-email-signin').showModal();
    }
    if (e.target.closest('#btn-sync-logout')) {
      signOutOfSync();
    }
    if (e.target.closest('#btn-sync-debug')) {
      debugSyncInfo().then((info) => alert(JSON.stringify(info, null, 2)));
    }
  });
  document.getElementById('form-email-signin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signin-email-input').value.trim();
    const statusEl = document.getElementById('signin-email-status');
    if (!email) return;
    try {
      await requestSignInLink(email);
      statusEl.textContent = `已寄出登入連結到 ${email}，去信箱點連結完成登入（這個分頁不用關）。`;
    } catch (err) {
      statusEl.textContent = `寄送失敗：${err.code || err.message}`;
    }
  });

  // 小孩切換器
  document.getElementById('kid-switcher').addEventListener('click', (e) => {
    if (e.target.closest('#btn-switcher-add-kid')) {
      openKidDialog(null);
      return;
    }
    const tab = e.target.closest('.kid-tab');
    if (tab) storage.setActiveKid(tab.dataset.kidId);
  });
  document.getElementById('btn-create-first-kid').addEventListener('click', () => openKidDialog(null));
  document.getElementById('btn-add-kid').addEventListener('click', () => openKidDialog(null));

  document.getElementById('kid-avatar-input').addEventListener('change', async () => {
    const file = document.getElementById('kid-avatar-input').files[0];
    if (!file) return;
    pendingKidAvatar = await compressImage(file, { maxWidth: 400, quality: 0.75 });
    document.getElementById('kid-avatar-preview').innerHTML = `<img src="${pendingKidAvatar}" alt="">`;
  });

  document.getElementById('form-kid').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('kid-id-input').value;
    const name = document.getElementById('kid-name-input').value.trim();
    if (!name) return;
    if (id) storage.updateKid(id, { name, avatar: pendingKidAvatar });
    else storage.addKid({ name, avatar: pendingKidAvatar });
    document.getElementById('dialog-kid').close();
  });

  document.getElementById('settings-kid-list').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit-kid');
    const delBtn = e.target.closest('.btn-delete-kid');
    if (editBtn) openKidDialog(storage.getKid(editBtn.dataset.kidId));
    if (delBtn) {
      withPinGate(() => {
        if (confirm('確定要刪除這個小孩嗎？所有紀錄都會一併刪除，無法復原。')) storage.deleteKid(delBtn.dataset.kidId);
      })();
    }
  });

  // 今日任務
  document.getElementById('task-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.task-card');
    if (!btn) return;
    const task = storage.getTaskTemplates().find((t) => t.id === btn.dataset.taskId);
    const kid = getActiveKid();
    if (!task || !kid) return;
    if (btn.classList.contains('done')) {
      uncompleteTask(kid.id, task.id);
      return;
    }
    const result = completeTask(kid.id, task);
    celebrate();
    handleNewCertificates(result.newlyUnlockedTiers);
  });

  document.getElementById('task-history-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-delete-task-history');
    if (!btn) return;
    withPinGate(() => {
      if (confirm('確定要刪除這筆作業歷程嗎？只會刪除紀錄本身，已經入帳的星星不會變動。')) {
        deleteTaskHistoryEntry(btn.dataset.entryId);
      }
    })();
  });

  document.getElementById('btn-manual-adjust').addEventListener('click', withPinGate(() => {
    document.getElementById('form-manual-adjust').reset();
    document.getElementById('dialog-manual-adjust').showModal();
  }));

  document.getElementById('form-manual-adjust').addEventListener('submit', (e) => {
    e.preventDefault();
    const direction = document.querySelector('input[name="manual-direction"]:checked').value;
    let amount = Number(document.getElementById('manual-amount-input').value);
    const reason = document.getElementById('manual-reason-input').value.trim();
    if (!amount || !reason) return;
    if (direction === 'subtract') amount = -amount;
    const kid = getActiveKid();
    const result = manualAdjust(kid.id, { amount, reason });
    document.getElementById('dialog-manual-adjust').close();
    if (amount > 0) {
      celebrate();
      handleNewCertificates(result.newlyUnlockedTiers);
    }
  });

  // 運動回報
  document.getElementById('exercise-kind-input').addEventListener('change', updateExerciseSuggestHint);
  document.getElementById('exercise-value-input').addEventListener('input', updateExerciseSuggestHint);

  document.getElementById('form-exercise-submit').addEventListener('submit', (e) => {
    e.preventDefault();
    const formula = storage.getExerciseFormulas().find((f) => f.id === document.getElementById('exercise-kind-input').value);
    const value = Number(document.getElementById('exercise-value-input').value);
    const kid = getActiveKid();
    if (!formula || !kid || !(value >= 0)) return;
    submitExercise(kid.id, formula, value);
    document.getElementById('exercise-value-input').value = '';
    updateExerciseSuggestHint();
  });

  document.getElementById('exercise-pending-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-review');
    if (btn) openExerciseReview(btn.dataset.subId);
  });

  document.getElementById('exercise-history-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-delete-exercise');
    if (!btn) return;
    withPinGate(() => {
      if (confirm('確定要刪除這筆回報紀錄嗎？只會刪除紀錄本身，已經核准入帳的星星不會變動。')) {
        deleteExerciseSubmission(btn.dataset.subId);
      }
    })();
  });

  document.getElementById('btn-exercise-approve').addEventListener('click', withPinGate(() => {
    const stars = Number(document.getElementById('exercise-review-stars-input').value) || 0;
    const result = approveExercise(reviewingSubmissionId, stars);
    document.getElementById('dialog-exercise-review').close();
    if (result) {
      celebrate();
      handleNewCertificates(result.newlyUnlockedTiers);
    }
  }));

  document.getElementById('btn-exercise-reject').addEventListener('click', withPinGate(() => {
    rejectExercise(reviewingSubmissionId);
    document.getElementById('dialog-exercise-review').close();
  }));

  // 星星商店
  document.getElementById('shop-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-redeem');
    if (!btn) return;
    withPinGate(() => {
      const item = storage.getShopCatalog().find((i) => i.id === btn.dataset.itemId);
      const kid = getActiveKid();
      if (item && kid && canRedeem(kid.id, item)) redeemShopItem(kid.id, item);
    })();
  });

  // 獎狀牆
  document.getElementById('cert-gallery').addEventListener('click', (e) => {
    const card = e.target.closest('.cert-card');
    if (!card) return;
    const cert = storage.getAwardedCertificates().find((c) => c.id === card.dataset.certId);
    if (cert) openCertPreview(cert, { isNewUnlock: false });
  });

  // 日曆
  document.getElementById('btn-cal-prev').addEventListener('click', () => {
    calMonth -= 1;
    if (calMonth < 0) {
      calMonth = 11;
      calYear -= 1;
    }
    const kid = getActiveKid();
    if (kid) renderCalendarTab(kid);
  });
  document.getElementById('btn-cal-next').addEventListener('click', () => {
    calMonth += 1;
    if (calMonth > 11) {
      calMonth = 0;
      calYear += 1;
    }
    const kid = getActiveKid();
    if (kid) renderCalendarTab(kid);
  });

  // 睡眠回報
  document.getElementById('sleep-calendar-wrap').addEventListener('click', (e) => {
    const cell = e.target.closest('.cal-sleep-cell');
    if (cell && !cell.disabled) openSleepDialog(cell.dataset.date);
  });
  document.getElementById('sleep-time-value-input').addEventListener('input', updateSleepSuggestHint);
  document.getElementById('form-sleep').addEventListener('submit', (e) => {
    e.preventDefault();
    const kid = getActiveKid();
    const dateStr = document.getElementById('sleep-date-input').value;
    const bedtime = document.getElementById('sleep-time-value-input').value;
    if (!kid || !dateStr || !bedtime) return;
    const result = submitSleep(kid.id, dateStr, bedtime);
    document.getElementById('dialog-sleep').close();
    if (result.entry.amount > 0) {
      celebrate();
      handleNewCertificates(result.newlyUnlockedTiers);
    }
  });
  document.getElementById('btn-sleep-clear').addEventListener('click', () => {
    const kid = getActiveKid();
    const dateStr = document.getElementById('sleep-date-input').value;
    if (!kid || !dateStr) return;
    clearSleep(kid.id, dateStr);
    document.getElementById('dialog-sleep').close();
  });

  // 家長設定：作業清單
  document.getElementById('btn-add-task').addEventListener('click', withPinGate(() => openTaskDialog(null)));
  document.getElementById('form-task').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('task-id-input').value;
    const name = document.getElementById('task-name-input').value.trim();
    const icon = document.getElementById('task-icon-input').value;
    const stars = Number(document.getElementById('task-stars-input').value);
    if (!name || !stars) return;
    if (id) storage.updateTaskTemplate(id, { name, icon, stars });
    else storage.addTaskTemplate({ name, icon, stars });
    document.getElementById('dialog-task').close();
  });
  document.getElementById('settings-task-list').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit');
    const delBtn = e.target.closest('.btn-delete');
    if (editBtn) withPinGate(() => openTaskDialog(storage.getTaskTemplates().find((t) => t.id === editBtn.dataset.id)))();
    if (delBtn) withPinGate(() => { if (confirm('確定要刪除這個作業項目嗎？')) storage.deleteTaskTemplate(delBtn.dataset.id); })();
  });

  // 家長設定：運動換算公式
  document.getElementById('btn-add-formula').addEventListener('click', withPinGate(() => openFormulaDialog(null)));
  document.getElementById('form-formula').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('formula-id-input').value;
    const kind = document.getElementById('formula-kind-input').value.trim();
    const label = document.getElementById('formula-label-input').value.trim();
    const unitsPerStar = Number(document.getElementById('formula-units-input').value);
    if (!kind || !label || !unitsPerStar) return;
    if (id) storage.updateExerciseFormula(id, { kind, label, unitsPerStar });
    else storage.addExerciseFormula({ kind, label, unitsPerStar });
    document.getElementById('dialog-formula').close();
  });
  document.getElementById('settings-formula-list').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit');
    const delBtn = e.target.closest('.btn-delete');
    if (editBtn) withPinGate(() => openFormulaDialog(storage.getExerciseFormulas().find((f) => f.id === editBtn.dataset.id)))();
    if (delBtn) withPinGate(() => { if (confirm('確定要刪除這個換算公式嗎？')) storage.deleteExerciseFormula(delBtn.dataset.id); })();
  });

  // 家長設定：獎狀門檻
  document.getElementById('btn-add-tier').addEventListener('click', withPinGate(() => openTierDialog(null)));
  document.getElementById('form-tier').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('tier-id-input').value;
    const threshold = Number(document.getElementById('tier-threshold-input').value);
    const title = document.getElementById('tier-title-input').value.trim();
    if (!threshold || !title) return;
    if (id) storage.updateCertificateTier(id, { threshold, title });
    else storage.addCertificateTier({ threshold, title });
    document.getElementById('dialog-tier').close();
  });
  document.getElementById('settings-tier-list').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit');
    const delBtn = e.target.closest('.btn-delete');
    if (editBtn) withPinGate(() => openTierDialog(storage.getCertificateTiers().find((t) => t.id === editBtn.dataset.id)))();
    if (delBtn) withPinGate(() => { if (confirm('確定要刪除這個獎狀門檻嗎？')) storage.deleteCertificateTier(delBtn.dataset.id); })();
  });

  // 家長設定：儲蓄挑戰
  document.getElementById('btn-add-challenge').addEventListener('click', withPinGate(() => openChallengeDialog(null)));
  document.getElementById('form-challenge').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('challenge-id-input').value;
    const name = document.getElementById('challenge-name-input').value.trim();
    const scope = document.getElementById('challenge-scope-input').value;
    const minBalance = Number(document.getElementById('challenge-min-balance-input').value);
    const targetDays = Number(document.getElementById('challenge-days-input').value);
    const bonusStars = Number(document.getElementById('challenge-bonus-input').value);
    if (!name || !minBalance || !targetDays || !bonusStars) return;
    if (id) storage.updateSavingsChallenge(id, { name, scope, minBalance, targetDays, bonusStars });
    else storage.addSavingsChallenge({ name, scope, minBalance, targetDays, bonusStars });
    document.getElementById('dialog-challenge').close();
  });
  document.getElementById('settings-challenge-list').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit');
    const delBtn = e.target.closest('.btn-delete');
    if (editBtn) withPinGate(() => openChallengeDialog(storage.getSavingsChallenges().find((c) => c.id === editBtn.dataset.id)))();
    if (delBtn) withPinGate(() => { if (confirm('確定要刪除這個儲蓄挑戰嗎？')) storage.deleteSavingsChallenge(delBtn.dataset.id); })();
  });

  // 家長設定：星星商店
  document.getElementById('btn-add-shop-item').addEventListener('click', withPinGate(() => openShopItemDialog(null)));
  document.getElementById('form-shop-item').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('shop-item-id-input').value;
    const name = document.getElementById('shop-item-name-input').value.trim();
    const icon = document.getElementById('shop-item-icon-input').value;
    const cost = Number(document.getElementById('shop-item-cost-input').value);
    const kind = document.getElementById('shop-item-kind-input').value;
    if (!name || !cost) return;
    if (id) storage.updateShopItem(id, { name, icon, cost, kind });
    else storage.addShopItem({ name, icon, cost, kind });
    document.getElementById('dialog-shop-item').close();
  });
  document.getElementById('settings-shop-list').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit');
    const delBtn = e.target.closest('.btn-delete');
    if (editBtn) withPinGate(() => openShopItemDialog(storage.getShopCatalog().find((i) => i.id === editBtn.dataset.id)))();
    if (delBtn) withPinGate(() => { if (confirm('確定要刪除這個商店品項嗎？')) storage.deleteShopItem(delBtn.dataset.id); })();
  });

  // 家長設定：PIN
  document.getElementById('btn-set-pin').addEventListener('click', withPinGate(() => {
    document.getElementById('form-pin-setup').reset();
    document.getElementById('dialog-pin-setup').showModal();
  }));
  document.getElementById('form-pin-setup').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = document.getElementById('pin-setup-input').value.trim();
    if (!/^[0-9]{4}$/.test(val)) return;
    storage.setPin(val);
    document.getElementById('dialog-pin-setup').close();
  });
  document.getElementById('btn-clear-pin').addEventListener('click', withPinGate(() => {
    if (confirm('確定要移除 PIN 保護嗎？')) storage.setPin(null);
  }));
}

// ================================================================== 啟動

initPin();
initEventListeners();
storage.subscribe(render);
render();

initCloudSync({
  onRemoteChange: render,
  onStatusChange: (status) => {
    syncStatus = status;
    renderSyncArea();
  },
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
