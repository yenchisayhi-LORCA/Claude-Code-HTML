// 套用樣板匯出：把使用者上傳的照片放進樣板的每個照片框，可拖曳調整位置、滑桿縮放，
// 最後用滿版解析度（300 DPI）重畫一次並輸出 PNG。

import { loadImageSource, loadImageElement } from './image.js';
import { drawTemplate, drawPhotoInRect, computeDrawParams, clamp, canvasToDownload } from './compositor.js';

const PREVIEW_MAX_W = 800;
const SLOT_CARD_W = 380;

let els = null;
let template = null;
let bgImg = null;
let fgImg = null;
let slotPhotos = []; // 跟 template.slots 對應，每格是 null 或 { img, imgW, imgH, zoom, offX, offY, cleanup }
let previewCtx = null;

export function initExporter() {
  els = {
    title: document.getElementById('export-title'),
    previewCanvas: document.getElementById('export-preview-canvas'),
    slotCards: document.getElementById('export-slot-cards'),
    downloadBtn: document.getElementById('btn-export-download'),
  };
  previewCtx = els.previewCanvas.getContext('2d');
  els.downloadBtn.addEventListener('click', doExport);
}

export async function openExport(tpl) {
  disposeExport();
  template = tpl;
  if (!template) return;

  els.title.textContent = `套用樣板：${template.name}`;
  bgImg = await loadImageElement(template.background);
  fgImg = template.foreground ? await loadImageElement(template.foreground) : null;

  const previewW = Math.min(PREVIEW_MAX_W, template.canvasW);
  const previewH = Math.round((previewW * template.canvasH) / template.canvasW);
  els.previewCanvas.width = previewW;
  els.previewCanvas.height = previewH;

  slotPhotos = template.slots.map(() => null);
  renderSlotCards();
  renderPreview();
}

export function disposeExport() {
  slotPhotos.forEach((p) => p && p.cleanup && p.cleanup());
  slotPhotos = [];
}

function renderPreview() {
  drawTemplate(previewCtx, els.previewCanvas.width, els.previewCanvas.height, bgImg, template.slots, slotPhotos, { showPlaceholders: true, foreground: fgImg });
}

function renderSlotCards() {
  els.slotCards.innerHTML = '';
  template.slots.forEach((slot, i) => {
    els.slotCards.appendChild(buildSlotCard(slot, i));
  });
}

function buildSlotCard(slot, index) {
  const card = document.createElement('div');
  card.className = 'slot-card';

  const head = document.createElement('div');
  head.className = 'slot-card-head';
  head.innerHTML = `<span>照片 ${index + 1}</span>`;
  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn btn-ghost';
  removeBtn.textContent = '移除照片';
  removeBtn.hidden = true;
  head.appendChild(removeBtn);
  card.appendChild(head);

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'slot-canvas-wrap';
  const slotAspect = (slot.w * template.canvasW) / (slot.h * template.canvasH);
  canvasWrap.style.aspectRatio = `${slotAspect}`;

  const canvas = document.createElement('canvas');
  canvas.width = SLOT_CARD_W;
  canvas.height = Math.round(SLOT_CARD_W / slotAspect);
  canvasWrap.appendChild(canvas);

  const emptyHint = document.createElement('div');
  emptyHint.className = 'slot-empty-hint';
  emptyHint.textContent = '點擊上傳這一格的照片';
  canvasWrap.appendChild(emptyHint);
  card.appendChild(canvasWrap);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.hidden = true;
  card.appendChild(fileInput);

  const zoom = document.createElement('input');
  zoom.type = 'range';
  zoom.className = 'slot-zoom';
  zoom.min = '1';
  zoom.max = '3';
  zoom.step = '0.01';
  zoom.value = '1';
  zoom.disabled = true;
  card.appendChild(zoom);

  const ctx = canvas.getContext('2d');

  function renderCard() {
    const photo = slotPhotos[index];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (photo) drawPhotoInRect(ctx, 0, 0, canvas.width, canvas.height, photo);
    emptyHint.hidden = !!photo;
    removeBtn.hidden = !photo;
    zoom.disabled = !photo;
    renderPreview();
  }

  canvasWrap.addEventListener('click', () => {
    if (!slotPhotos[index]) fileInput.click();
  });

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (slotPhotos[index] && slotPhotos[index].cleanup) slotPhotos[index].cleanup();
    const { source, width, height, cleanup } = await loadImageSource(file);
    slotPhotos[index] = { img: source, imgW: width, imgH: height, zoom: 1, offX: 0, offY: 0, cleanup };
    zoom.value = '1';
    renderCard();
  });

  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (slotPhotos[index] && slotPhotos[index].cleanup) slotPhotos[index].cleanup();
    slotPhotos[index] = null;
    renderCard();
  });

  zoom.addEventListener('input', () => {
    const photo = slotPhotos[index];
    if (!photo) return;
    photo.zoom = parseFloat(zoom.value);
    renderCard();
  });

  canvas.addEventListener('pointerdown', (e) => {
    const photo = slotPhotos[index];
    if (!photo) return;
    e.preventDefault();
    e.stopPropagation();
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const startX = e.clientX;
    const startY = e.clientY;
    const { excessW, excessH } = computeDrawParams(canvas.width, canvas.height, photo.imgW, photo.imgH, photo.zoom);
    const origOffX = photo.offX;
    const origOffY = photo.offY;

    function onMove(ev) {
      const dxCanvas = (ev.clientX - startX) * scaleX;
      const dyCanvas = (ev.clientY - startY) * scaleY;
      if (excessW > 0.001) photo.offX = clamp(origOffX - dxCanvas / (excessW / 2), -1, 1);
      if (excessH > 0.001) photo.offY = clamp(origOffY - dyCanvas / (excessH / 2), -1, 1);
      renderCard();
    }
    function onUp() {
      canvas.releasePointerCapture(e.pointerId);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
    }
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
  });

  return card;
}

function doExport() {
  const canvas = document.createElement('canvas');
  canvas.width = template.canvasW;
  canvas.height = template.canvasH;
  const ctx = canvas.getContext('2d');
  drawTemplate(ctx, canvas.width, canvas.height, bgImg, template.slots, slotPhotos, { showPlaceholders: false, foreground: fgImg });
  const safeName = template.name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'photo';
  canvasToDownload(canvas, `${safeName}-${template.printSize}-${Date.now()}.png`);
}
