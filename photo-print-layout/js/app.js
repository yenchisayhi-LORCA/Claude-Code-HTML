import * as storage from './storage.js';
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

function renderGallery() {
  const templates = storage.listTemplates();
  const grid = document.getElementById('template-grid');
  const empty = document.getElementById('template-empty');
  empty.hidden = templates.length > 0;
  grid.innerHTML = '';

  templates.forEach((tpl) => {
    const card = document.createElement('div');
    card.className = 'template-card';

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
      thumb.appendChild(box);
    });
    card.appendChild(thumb);

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
      openExport(tpl.id);
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
    grid.appendChild(card);
  });
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
