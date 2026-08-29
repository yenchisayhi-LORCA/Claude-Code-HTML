// 樣板資料存取：所有樣板（底稿圖 + 照片框位置）存在 localStorage，不需要後端伺服器。
// 上傳的照片本身不會被存起來（只在編輯/匯出當下存在記憶體裡），存起來的只有底稿圖，
// 這樣才不會讓 localStorage 的 5MB 左右容量很快被大量照片塞滿。

const STORAGE_KEY = 'photo-print-layout/v1';

export const PRINT_SIZES = {
  '4x6': { label: '4×6 吋', canvasW: 1200, canvasH: 1800 },
  '5x7': { label: '5×7 吋', canvasW: 1500, canvasH: 2100 },
};

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && Array.isArray(parsed.templates) ? parsed : { templates: [] };
  } catch (err) {
    console.error('讀取樣板資料失敗，將重設資料', err);
    return { templates: [] };
  }
}

let state = loadRaw();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('儲存樣板失敗（可能是空間不足）', err);
    alert('儲存失敗：瀏覽器儲存空間可能已滿。請刪除不需要的舊樣板後再試一次。');
    return false;
  }
}

export function listTemplates() {
  return state.templates.slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getTemplate(id) {
  return state.templates.find((t) => t.id === id) || null;
}

export function saveTemplate(template) {
  const now = Date.now();
  const idx = state.templates.findIndex((t) => t.id === template.id);
  if (idx >= 0) {
    state.templates[idx] = { ...template, updatedAt: now };
  } else {
    state.templates.push({ ...template, createdAt: now, updatedAt: now });
  }
  return persist();
}

export function deleteTemplate(id) {
  state.templates = state.templates.filter((t) => t.id !== id);
  return persist();
}

export function makeId() {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
