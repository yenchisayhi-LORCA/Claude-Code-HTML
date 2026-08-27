// 花費分類圖示：內嵌 SVG，來自「琪 旅遊記帳」設計交接包（expense-report-template.html 的 ICONS 物件）。
// key 用的是設計稿原本的英文名稱；我們系統內部的分類 id 跟設計稿有兩個對不上（fun/comm），
// 用 ID_TO_ICON_KEY 做對應，其餘分類 id 剛好跟設計稿 key 同名。

export const ICONS = {
  transport: { bg: '#DCEBF9', svg:
    '<svg width="26" height="26" viewBox="0 0 26 26" fill="none">' +
    '<rect x="4" y="3" width="18" height="15" rx="4" fill="#6FA8DC"/>' +
    '<rect x="7" y="6" width="12" height="6" rx="1.5" fill="#FFFDF8"/>' +
    '<circle cx="8" cy="20" r="2.6" fill="#3B3330"/><circle cx="18" cy="20" r="2.6" fill="#3B3330"/></svg>' },
  stay: { bg: '#DCEFE6', svg:
    '<svg width="26" height="26" viewBox="0 0 26 26" fill="none">' +
    '<path d="M13 3 L23 11 H3 Z" fill="#4AA48E"/>' +
    '<rect x="5" y="11" width="16" height="11" rx="2" fill="#5FBFA8"/>' +
    '<rect x="11" y="15" width="5" height="7" rx="1" fill="#FFFDF8"/></svg>' },
  food: { bg: '#FBE3CF', svg:
    '<svg width="26" height="26" viewBox="0 0 26 26" fill="none">' +
    '<rect x="13.6" y="2" width="2" height="7.5" rx="1" transform="rotate(10 14.6 5.7)" fill="#C4703A"/>' +
    '<rect x="17.4" y="2" width="2" height="7.5" rx="1" transform="rotate(20 18.4 5.7)" fill="#C4703A"/>' +
    '<path d="M4 12.6 H22 A9 9 0 0 1 4 12.6 Z" fill="#F79256"/>' +
    '<rect x="2.5" y="9.4" width="21" height="3.3" rx="1.65" fill="#E0762F"/>' +
    '<rect x="9" y="20.6" width="8" height="2.4" rx="1.2" fill="#C4703A"/></svg>' },
  ticket: { bg: '#E7E0F5', svg:
    '<svg width="26" height="26" viewBox="0 0 26 26" fill="none">' +
    '<rect x="2.5" y="6.5" width="21" height="13" rx="3.5" fill="#9B87D4"/>' +
    '<circle cx="15" cy="6.5" r="2.6" fill="#E7E0F5"/><circle cx="15" cy="19.5" r="2.6" fill="#E7E0F5"/>' +
    '<line x1="15" y1="9.6" x2="15" y2="16.4" stroke="#FFFDF8" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="2 2.4"/>' +
    '<rect x="5.5" y="10" width="6" height="1.8" rx="0.9" fill="#FFFDF8"/>' +
    '<rect x="5.5" y="14.2" width="4" height="1.8" rx="0.9" fill="#FFFDF8"/></svg>' },
  shopping: { bg: '#FBDDE4', svg:
    '<svg width="26" height="26" viewBox="0 0 26 26" fill="none">' +
    '<path d="M9 10 V7 a4 4 0 0 1 8 0 v3" stroke="#C9566F" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
    '<rect x="3.5" y="10.5" width="19" height="11.5" rx="3.5" fill="#E7809A"/>' +
    '<rect x="3.5" y="10.5" width="19" height="3.4" rx="1.7" fill="#F6BECB"/></svg>' },
  entertainment: { bg: '#FBF0CE', svg:
    '<svg width="26" height="26" viewBox="0 0 26 26" fill="none">' +
    '<path d="M5 21 L14 8 L20 14 Z" fill="#EFB93C"/>' +
    '<path d="M5 21 L9.5 19.5 L7 15 Z" fill="#E09A1F"/>' +
    '<circle cx="19" cy="6" r="2" fill="#E7809A"/><circle cx="23" cy="11" r="1.6" fill="#6FA8DC"/>' +
    '<circle cx="15" cy="3.5" r="1.4" fill="#5FBFA8"/></svg>' },
  telecom: { bg: '#D8EEF2', svg:
    '<svg width="26" height="26" viewBox="0 0 26 26" fill="none">' +
    '<rect x="7" y="4" width="12" height="18" rx="3.5" fill="#4FAFC0"/>' +
    '<rect x="9.5" y="7" width="7" height="9" rx="1.5" fill="#FFFDF8"/>' +
    '<circle cx="13" cy="19" r="1.5" fill="#FFFDF8"/></svg>' },
  medical: { bg: '#FBDDDD', svg:
    '<svg width="26" height="26" viewBox="0 0 26 26" fill="none">' +
    '<rect x="4" y="4" width="18" height="18" rx="5" fill="#E37B7B"/>' +
    '<rect x="11.4" y="8" width="3.2" height="10" rx="1.6" fill="#FFFDF8"/>' +
    '<rect x="8" y="11.4" width="10" height="3.2" rx="1.6" fill="#FFFDF8"/></svg>' },
  other: { bg: '#EFE7DA', svg:
    '<svg width="26" height="26" viewBox="0 0 26 26" fill="none">' +
    '<circle cx="7" cy="13" r="2.4" fill="#B0A093"/><circle cx="13" cy="13" r="2.4" fill="#B0A093"/>' +
    '<circle cx="19" cy="13" r="2.4" fill="#B0A093"/></svg>' },
};

// 我們系統內部分類 id 對到設計稿 ICONS key 的對照（大部分同名，只有 fun/comm 兩個對不上）
export const ID_TO_ICON_KEY = {
  fun: 'entertainment',
  comm: 'telecom',
};

export function iconKeyFor(categoryId) {
  return ID_TO_ICON_KEY[categoryId] || categoryId;
}

export function iconFor(categoryId) {
  return ICONS[iconKeyFor(categoryId)] || ICONS.other;
}

// 產生指定尺寸的分類徽章 HTML：底色圓角方塊 + 置中 SVG（SVG 尺寸為容器的 0.6 倍，圓角比例依設計稿 28px→9px、72px→24px 抓 0.33）
export function categoryBadgeHtml(category, size = 32) {
  const icon = iconFor(category && category.id);
  const svgSize = Math.round(size * 0.6);
  const radius = Math.round(size * 0.33);
  const svg = icon.svg.replace('width="26" height="26"', `width="${svgSize}" height="${svgSize}"`);
  return `<span class="category-badge" style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${icon.bg}">${svg}</span>`;
}
