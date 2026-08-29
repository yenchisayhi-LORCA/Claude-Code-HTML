// 樣板編輯器：上傳底稿圖、用滑鼠/觸控拖曳與縮放照片框，存成可重複使用的樣板。
// 框的位置/大小一律存成 0~1 的比例（相對於底稿畫布），跟實際像素解析度無關，
// 這樣同一份框定義可以直接套用在預覽用的小尺寸畫布，也可以套用在匯出用的滿版解析度。

import * as storage from './storage.js';
import { renderCoverToDataURL, recoverExistingBackground } from './image.js';
import { clamp } from './compositor.js';

const MIN_SLOT_FRAC = 0.1;
const MAX_SLOTS = 3;

let els = null;
let onSaved = null;
let editing = null; // { id, name, printSize, background, slots: [{id,x,y,w,h}] }

export function initEditor({ onSaved: cb }) {
  onSaved = cb;
  els = {
    title: document.getElementById('editor-title'),
    wrap: document.getElementById('editor-canvas-wrap'),
    emptyBg: document.getElementById('editor-empty-bg'),
    uploadBgBtn: document.getElementById('btn-upload-bg'),
    changeBgBtn: document.getElementById('btn-change-bg'),
    bgInput: document.getElementById('editor-bg-input'),
    bgImg: document.getElementById('editor-bg-img'),
    slotsLayer: document.getElementById('editor-slots-layer'),
    nameInput: document.getElementById('editor-name-input'),
    sizeSelect: document.getElementById('editor-size-select'),
    sizeHint: document.getElementById('editor-size-hint'),
    slotList: document.getElementById('editor-slot-list'),
    addSlotBtn: document.getElementById('btn-add-slot'),
    saveBtn: document.getElementById('btn-save-template'),
  };

  els.uploadBgBtn.addEventListener('click', () => els.bgInput.click());
  els.changeBgBtn.addEventListener('click', () => els.bgInput.click());
  els.bgInput.addEventListener('change', handleBgFile);
  els.sizeSelect.addEventListener('change', handleSizeChange);
  els.addSlotBtn.addEventListener('click', addSlot);
  els.saveBtn.addEventListener('click', save);
}

export function openEditor(templateId) {
  const tpl = templateId ? storage.getTemplate(templateId) : null;
  editing = tpl
    ? { id: tpl.id, name: tpl.name, printSize: tpl.printSize, background: tpl.background, slots: tpl.slots.map((s) => ({ ...s })) }
    : { id: null, name: '', printSize: '4x6', background: null, slots: [] };

  els.title.textContent = tpl ? '編輯樣板' : '新增樣板';
  els.nameInput.value = editing.name;
  els.sizeSelect.value = editing.printSize;
  renderBackground();
  renderSizeHint();
  renderSlots();
}

function renderSizeHint() {
  const info = storage.PRINT_SIZES[editing.printSize];
  els.wrap.style.aspectRatio = `${info.canvasW} / ${info.canvasH}`;
  els.sizeHint.textContent = `匯出解析度：${info.canvasW}×${info.canvasH} px（300 DPI，適合送洗沖印）`;
}

function renderBackground() {
  if (editing.background) {
    els.bgImg.src = editing.background;
    els.bgImg.hidden = false;
    els.emptyBg.hidden = true;
    els.slotsLayer.hidden = false;
    els.changeBgBtn.hidden = false;
  } else {
    els.bgImg.hidden = true;
    els.emptyBg.hidden = false;
    els.slotsLayer.hidden = true;
    els.changeBgBtn.hidden = true;
  }
}

async function handleBgFile(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const info = storage.PRINT_SIZES[editing.printSize];
  editing.background = await renderCoverToDataURL(file, info.canvasW, info.canvasH);
  renderBackground();
}

async function handleSizeChange() {
  editing.printSize = els.sizeSelect.value;
  renderSizeHint();
  if (editing.background) {
    const info = storage.PRINT_SIZES[editing.printSize];
    editing.background = await recoverExistingBackground(editing.background, info.canvasW, info.canvasH);
    renderBackground();
  }
}

function addSlot() {
  if (editing.slots.length >= MAX_SLOTS) return;
  const n = editing.slots.length;
  editing.slots.push({
    id: `s${Date.now()}_${n}`,
    x: 0.1 + n * 0.06,
    y: 0.1 + n * 0.06,
    w: 0.4,
    h: 0.4,
  });
  renderSlots();
}

function removeSlot(id) {
  editing.slots = editing.slots.filter((s) => s.id !== id);
  renderSlots();
}

function renderSlots() {
  els.slotsLayer.innerHTML = '';
  editing.slots.forEach((slot, i) => {
    els.slotsLayer.appendChild(buildSlotBox(slot, i));
  });

  els.slotList.innerHTML = '';
  editing.slots.forEach((slot, i) => {
    const row = document.createElement('div');
    row.className = 'editor-slot-list-item';
    row.innerHTML = `<span>照片框 ${i + 1}</span>`;
    const del = document.createElement('button');
    del.className = 'btn btn-ghost';
    del.style.padding = '2px 8px';
    del.textContent = '刪除';
    del.addEventListener('click', () => removeSlot(slot.id));
    row.appendChild(del);
    els.slotList.appendChild(row);
  });

  els.addSlotBtn.disabled = editing.slots.length >= MAX_SLOTS;
}

function buildSlotBox(slot, index) {
  const box = document.createElement('div');
  box.className = 'editor-slot-box';
  applyBoxStyle(box, slot);

  const num = document.createElement('span');
  num.className = 'slot-num';
  num.textContent = String(index + 1);
  box.appendChild(num);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'slot-remove-btn';
  removeBtn.type = 'button';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  removeBtn.addEventListener('click', () => removeSlot(slot.id));
  box.appendChild(removeBtn);

  const handle = document.createElement('div');
  handle.className = 'slot-resize-handle';
  box.appendChild(handle);

  box.addEventListener('pointerdown', (e) => startMove(e, box, slot));
  handle.addEventListener('pointerdown', (e) => startResize(e, box, slot));

  return box;
}

function applyBoxStyle(box, slot) {
  box.style.left = `${slot.x * 100}%`;
  box.style.top = `${slot.y * 100}%`;
  box.style.width = `${slot.w * 100}%`;
  box.style.height = `${slot.h * 100}%`;
}

function startMove(e, box, slot) {
  e.preventDefault();
  box.setPointerCapture(e.pointerId);
  const wrapRect = els.wrap.getBoundingClientRect();
  const startX = e.clientX;
  const startY = e.clientY;
  const origX = slot.x;
  const origY = slot.y;

  function onMove(ev) {
    const dxFrac = (ev.clientX - startX) / wrapRect.width;
    const dyFrac = (ev.clientY - startY) / wrapRect.height;
    slot.x = clamp(origX + dxFrac, 0, 1 - slot.w);
    slot.y = clamp(origY + dyFrac, 0, 1 - slot.h);
    applyBoxStyle(box, slot);
  }
  function onUp(ev) {
    box.releasePointerCapture(e.pointerId);
    box.removeEventListener('pointermove', onMove);
    box.removeEventListener('pointerup', onUp);
  }
  box.addEventListener('pointermove', onMove);
  box.addEventListener('pointerup', onUp);
}

function startResize(e, box, slot) {
  e.preventDefault();
  e.stopPropagation();
  const handle = e.currentTarget;
  handle.setPointerCapture(e.pointerId);
  const wrapRect = els.wrap.getBoundingClientRect();
  const startX = e.clientX;
  const startY = e.clientY;
  const origW = slot.w;
  const origH = slot.h;

  function onMove(ev) {
    const dwFrac = (ev.clientX - startX) / wrapRect.width;
    const dhFrac = (ev.clientY - startY) / wrapRect.height;
    slot.w = clamp(origW + dwFrac, MIN_SLOT_FRAC, 1 - slot.x);
    slot.h = clamp(origH + dhFrac, MIN_SLOT_FRAC, 1 - slot.y);
    applyBoxStyle(box, slot);
  }
  function onUp() {
    handle.releasePointerCapture(e.pointerId);
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onUp);
  }
  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onUp);
}

function save() {
  const name = els.nameInput.value.trim();
  if (!name) {
    alert('請輸入樣板名稱');
    return;
  }
  if (!editing.background) {
    alert('請先上傳底稿圖片');
    return;
  }
  if (editing.slots.length === 0) {
    alert('請至少新增一個照片框');
    return;
  }
  const info = storage.PRINT_SIZES[editing.printSize];
  const ok = storage.saveTemplate({
    id: editing.id || storage.makeId(),
    name,
    printSize: editing.printSize,
    canvasW: info.canvasW,
    canvasH: info.canvasH,
    background: editing.background,
    slots: editing.slots,
  });
  if (ok && onSaved) onSaved();
}
