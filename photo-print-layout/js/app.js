import * as storage from './storage.js';
import { BUILTIN_TEMPLATES } from './builtin-templates.js';
import { initEditor, openEditor } from './editor.js';
import { initExporter, openExport, disposeExport } from './exporter.js';

const views = {
  gallery: document.getElementById('view-gallery'),
  editor: document.getElementById('view-editor'),
  export: document.getElementById('view-export'),
};
let currentView = 'gallery';

function showView(name) {
  if (currentView === 'export' && name !== 'export') disposeExport();
  currentView = name;
  Object.entries(views).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
}

document.querySelectorAll('[data-back-to]').forEach((btn) => {
  btn.addEventListener('click', () => showView(btn.dataset.backTo));
});

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function buildThumb(tpl) {
  const thumb = document.createElement('div');
  thumb.className = 'template-thumb';
  thumb.style.aspectRatio = `${tpl.canvasW} / ${tpl.canvasH}`;
  const img = document.createElement('img');
  img.src = tpl.background;
  img.alt = tpl.name;
  thumb.appendChild(img);
  tpl.slots.forEach((slot) => {
    const box = document.createElement('div');
    box.className = 'template-thumb-slot';
    box.style.left = `${slot.x * 100}%`;
    box.style.top = `${slot.y * 100}%`;
    box.style.width = `${slot.w * 100}%`;
    box.style.height = `${slot.h * 100}%`;
    if (slot.blob) {
      const b = slot.blob;
      box.style.borderRadius = `${b.tl[0] * 100}% ${b.tr[0] * 100}% ${b.br[0] * 100}% ${b.bl[0] * 100}% / ${b.tl[1] * 100}% ${b.tr[1] * 100}% ${b.br[1] * 100}% ${b.bl[1] * 100}%`;
    } else if (slot.radius) {
      box.style.borderRadius = `${slot.radius * 100}%`;
    }
    if (slot.rotationDeg) box.style.transform = `rotate(${slot.rotationDeg}deg)`;
    thumb.appendChild(box);
  });
  if (tpl.foreground) {
    const fg = document.createElement('img');
    fg.src = tpl.foreground;
    fg.alt = '';
    fg.style.position = 'absolute';
    fg.style.inset = '0';
    fg.style.width = '100%';
    fg.style.height = '100%';
    fg.style.objectFit = 'cover';
    thumb.appendChild(fg);
  }
  return thumb;
}

function buildBuiltinCard(tpl) {
  const card = document.createElement('div');
  card.className = 'template-card';
  card.appendChild(buildThumb(tpl));

  const body = document.createElement('div');
  body.className = 'template-body';
  body.innerHTML = `
    <div class="template-name">${esc(tpl.name)} <span class="badge-builtin">內建</span></div>
    <div class="template-meta">${storage.PRINT_SIZES[tpl.printSize]?.label || tpl.printSize} · ${tpl.slots.length} 個照片框</div>
    <div class="template-card-actions">
      <button class="btn btn-primary btn-block" data-action="use">使用</button>
    </div>
  `;
  body.querySelector('[data-action="use"]').addEventListener('click', () => {
    showView('export');
    openExport(tpl);
  });
  card.appendChild(body);
  return card;
}

function buildCustomCard(tpl) {
  const card = document.createElement('div');
  card.className = 'template-card';
  card.appendChild(buildThumb(tpl));

  const body = document.createElement('div');
  body.className = 'template-body';
  const sizeLabel = storage.PRINT_SIZES[tpl.printSize]?.label || tpl.printSize;
  body.innerHTML = `
    <div class="template-name">${esc(tpl.name)}</div>
    <div class="template-meta">${sizeLabel} · ${tpl.slots.length} 個照片框</div>
    <div class="template-card-actions">
      <button class="btn btn-primary" data-action="use">使用</button>
      <button class="btn btn-secondary" data-action="edit">編輯</button>
      <button class="btn btn-danger" data-action="delete">刪除</button>
    </div>
  `;
  body.querySelector('[data-action="use"]').addEventListener('click', () => {
    showView('export');
    openExport(tpl);
  });
  body.querySelector('[data-action="edit"]').addEventListener('click', () => {
    showView('editor');
    openEditor(tpl.id);
  });
  body.querySelector('[data-action="delete"]').addEventListener('click', () => {
    if (confirm(`確定要刪除樣板「${tpl.name}」嗎？`)) {
      storage.deleteTemplate(tpl.id);
      renderGallery();
    }
  });
  card.appendChild(body);
  return card;
}

function renderGallery() {
  const customTemplates = storage.listTemplates();
  const grid = document.getElementById('template-grid');
  const empty = document.getElementById('template-empty');
  empty.hidden = BUILTIN_TEMPLATES.length + customTemplates.length > 0;
  grid.innerHTML = '';

  BUILTIN_TEMPLATES.forEach((tpl) => grid.appendChild(buildBuiltinCard(tpl)));
  customTemplates.forEach((tpl) => grid.appendChild(buildCustomCard(tpl)));
}

function goCreateTemplate() {
  showView('editor');
  openEditor(null);
}

document.getElementById('btn-new-template').addEventListener('click', goCreateTemplate);
document.getElementById('btn-new-template-empty').addEventListener('click', goCreateTemplate);

initEditor({
  onSaved: () => {
    showView('gallery');
    renderGallery();
  },
});
initExporter();

renderGallery();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
