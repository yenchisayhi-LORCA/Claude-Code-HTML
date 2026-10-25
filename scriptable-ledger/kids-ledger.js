// 記帳・童趣風快速記帳（Scriptable）
// 在 App 內執行：打開帳本（多本帳本、記一筆、分類、匯出到 Excel）
// 放在主畫面當小工具：顯示最近記帳那本帳本的今天花費，點「＋記一筆」直接記帳
// 記錄只存在這台 iPhone（Scriptable 的本機資料夾），不上 iCloud；記得定期匯出貼到 Excel 帳冊
const K = {
  cream: "#FFFCEF", white: "#FFFFFF", ink: "#262261", body: "#5A5788", tomato: "#D93A2F",
};
const CAT_BG = {
  yellow: "#FFF0AF", orange: "#FFE2BA", green: "#D5F5D0", blue: "#CFDDF8",
  pink: "#FBD3D0", teal: "#C9F0E9", purple: "#E3DAFA", rose: "#FFD8E8",
};
const col = (hex, a = 1) => new Color(hex, a);
const js = v => JSON.stringify(v).replace(/</g, "\\u003c");

// ---- 存檔位置：只放在這台 iPhone
const local = FileManager.local();
const DIR = local.joinPath(local.documentsDirectory(), "kids-ledger");
const DATA_PATH = local.joinPath(DIR, "ledger.json");
const BACKUP_PATH = local.joinPath(DIR, "ledger-backup.json");
const ICON_DIR = local.joinPath(DIR, "icons");
const ART_DIR = local.joinPath(DIR, "art");
const mkdir = p => { if (!local.fileExists(p)) local.createDirectory(p, true); };

function loadData() {
  for (const p of [DATA_PATH, BACKUP_PATH]) {
    try { if (local.fileExists(p)) { const d = JSON.parse(local.readString(p)); if (d && Array.isArray(d.books)) return d; } } catch (e) {}
  }
  return null; // 第一次使用：畫面那邊會建一本「日常」和 7 個分類
}
function saveData(d) {
  if (!d || !Array.isArray(d.books)) return;
  mkdir(DIR);
  // 存之前把上一版留一份，萬一存壞了還有前一次的
  if (local.fileExists(DATA_PATH)) local.writeString(BACKUP_PATH, local.readString(DATA_PATH));
  local.writeString(DATA_PATH, JSON.stringify(d));
}

// ---- 圖示：跟筆記同一套（線條圖示 + 貼紙樣式，由 build.py 塞進來）
const ICONS = ["lion", "pig", "giraffe", "bear", "monkey", "bee", "owl", "fox", "sheep", "penguin", "koala", "frog", "rabbit", "star", "heart", "diamond", "music", "clothes", "rainboot", "flipflop", "pencil", "pets", "sun", "moon", "cloud", "partlycloudy", "cloudynight", "overcast", "rain", "thunderstorm", "lightning", "snow", "rainbow", "gift", "balloon", "fork", "forkknife", "burger", "pizza", "cake", "drink", "apple", "strawberry", "grape", "watermelon", "orange", "cherry", "idea", "shoppingbag", "travel", "plane", "planeside", "train", "steamtrain", "metro", "bus", "car", "carside", "bicycle", "camera", "location"];
const ICON_SVGS = {
    star: '<path d="M12 3l2.4 5.5 6 .6-4.5 4 1.3 5.9L12 16l-5.2 3 1.3-5.9-4.5-4 6-.6Z"/>',
    heart: '<path d="M12 20s-7-4.4-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5c-2.5 4.6-9.5 9-9.5 9Z"/>',
    diamond: '<path d="M12 4L15 12L12 20L9 12Z"/>',
    music: '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
    pencil: '<path d="M4 20l1-4L16 5l3 3L8 19l-4 1Z"/><path d="M14 7l3 3"/>',
    pets: '<circle cx="12" cy="15" r="3.4"/><circle cx="6.5" cy="10" r="1.6"/><circle cx="10" cy="7" r="1.6"/><circle cx="14" cy="7" r="1.6"/><circle cx="17.5" cy="10" r="1.6"/>',
    clothes: '<path d="M8 4 4 7l2 3 2-1.3V20h8V8.7L18 10l2-3-4-3-2 1.5h-4Z"/>',
    rainboot: '<path d="M6 3.4h6.2v9.8l4.2 1.4c2.4.8 4 2 4 3.4H6Z"/><path d="M5.6 18h15v1.2c0 .8-.6 1.4-1.4 1.4H7c-.8 0-1.4-.6-1.4-1.4Z"/><path d="M5.2 3.4h7.8"/>',
    flipflop: '<path d="M12 2.6c3 0 4.6 2.6 4.6 6 0 2.2-.6 3.6-.6 5.4 0 2.2 1.2 3.6 1.2 5.4 0 1.8-2 2.8-5.2 2.8s-5.2-1-5.2-2.8c0-1.8 1.2-3.2 1.2-5.4 0-1.8-.6-3.2-.6-5.4 0-3.4 1.6-6 4.6-6Z"/><path d="M12 6.4 8.2 11.8M12 6.4l3.8 5.4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.1 10.1 4 4 0 0 0 7 18Z"/>',
    partlycloudy: '<circle cx="8" cy="8" r="3"/><path d="M8 3v1.2M8 12.8V14M3 8h1.2M12.8 8H14M4.5 4.5l.9.9M11.5 4.5l-.9.9"/><path d="M10 20h7a3.5 3.5 0 0 0 .4-6.98A4.5 4.5 0 0 0 9.2 12.4 3.2 3.2 0 0 0 10 20Z"/>',
    cloudynight: '<path d="M15 8.2A4 4 0 1 1 10.9 4a3.2 3.2 0 0 0 4.1 4.2Z"/><path d="M9 20h7a3.5 3.5 0 0 0 .4-6.98A4.5 4.5 0 0 0 8.2 12.4 3.2 3.2 0 0 0 9 20Z"/>',
    overcast: '<path d="M7 14h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.1 6.1 4 4 0 0 0 7 14Z"/><line x1="5" y1="18" x2="19" y2="18"/>',
    rain: '<path d="M7 13h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.1 5.1 4 4 0 0 0 7 13Z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
    thunderstorm: '<path d="M7 12h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.1 4.1 4 4 0 0 0 7 12Z"/><path d="M13 13l-3 5h3l-2 4"/>',
    lightning: '<path d="M13 2 4 14h6l-1 8 9-12h-6Z"/>',
    snow: '<path d="M7 11h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.1 3.1 4 4 0 0 0 7 11Z"/><circle cx="8" cy="18" r=".6" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r=".6" fill="currentColor" stroke="none"/><circle cx="16" cy="18" r=".6" fill="currentColor" stroke="none"/>',
    rainbow: '<path d="M3 18a9 9 0 0 1 18 0"/><path d="M6.5 18a5.5 5.5 0 0 1 11 0"/>',
    gift: '<rect x="4" y="10" width="16" height="10" rx="1.5"/><line x1="4" y1="14" x2="20" y2="14"/><line x1="12" y1="10" x2="12" y2="20"/><path d="M12 10c-2-4-6-3-6-1s3 1 6 1Zm0 0c2-4 6-3 6-1s-3 1-6 1Z"/>',
    balloon: '<path d="M12 2.8c3.9 0 6.6 2.9 6.6 6.6s-3.2 6.3-6.6 7.3c-3.4-1-6.6-3.6-6.6-7.3S8.1 2.8 12 2.8Z"/><path d="M10.8 18.4 12 16.7l1.2 1.7Z"/><path d="M12 18.4c-1.6 1.4 1.6 2.4 0 4.2"/><path d="M8.6 8.4c.3-1.5 1.3-2.5 2.6-2.8"/>',
    fork: '<path d="M8.5 2.8v5.4a3.5 3.5 0 0 0 7 0V2.8"/><path d="M12 2.8v5.4"/><path d="M10.8 11.6h2.4l-.3 8.9a.9.9 0 0 1-1.8 0Z"/>',
    forkknife: '<path d="M3.8 2.8v5.4c0 1.8 1.4 3.2 3.4 3.2s3.4-1.4 3.4-3.2V2.8"/><path d="M7.2 2.8v4.6"/><path d="M5.9 12.2h2.6v7.6a1.3 1.3 0 0 1-2.6 0Z"/><path d="M18.6 2.8c-2.8 1.4-4.4 4.6-4.4 8.6h4.4Z"/><path d="M15.9 12.2h2.6v7.6a1.3 1.3 0 0 1-2.6 0Z"/>',
    burger: '<path d="M4 10.4c0-3.6 3.6-6 8-6s8 2.4 8 6Z"/><path d="M3.6 12.4c1.4-1 2.8 1 4.2 0s2.8 1 4.2 0 2.8 1 4.2 0 2.8 1 4.2 0"/><path d="M4 13.8h16v2.6H4Z"/><path d="M4.4 17.6h15.2c0 1.6-1.4 2.8-3.2 2.8H7.6c-1.8 0-3.2-1.2-3.2-2.8Z"/>',
    pizza: '<path d="M12 21 3.6 6.4c2.6-1.6 5.4-2.4 8.4-2.4s5.8.8 8.4 2.4Z"/><path d="M3.6 6.4c2.6-1.6 5.4-2.4 8.4-2.4s5.8.8 8.4 2.4l-1.6 2.8c-2.2-1.2-4.4-1.8-6.8-1.8s-4.6.6-6.8 1.8Z"/><circle cx="10.4" cy="11.6" r="1.3"/><circle cx="13" cy="15.4" r="1.2"/>',
    cake: '<path d="M3.6 10.6h16.8v9.4H3.6Z"/><path d="M3.6 10.6 13.4 6h7v4.6Z"/><circle cx="16.6" cy="4.2" r="2.2"/>',
    drink: '<path d="M6.8 9.4h10.4l-1.3 10.9a1.6 1.6 0 0 1-1.6 1.4H9.7a1.6 1.6 0 0 1-1.6-1.4Z"/><path d="M5.8 9.4h12.4V8a1.8 1.8 0 0 0-1.8-1.8H7.6A1.8 1.8 0 0 0 5.8 8Z"/><path d="M12.8 6.2 14.6 2.4h2.6"/><circle cx="10" cy="18.2" r=".9" fill="currentColor"/><circle cx="12.3" cy="19.2" r=".9" fill="currentColor"/><circle cx="14.4" cy="17.8" r=".9" fill="currentColor"/>',
    apple: '<path d="M12 7.6c-1.6-1.1-4.6-1.3-6.2.6-2 2.3-1.3 6.7.6 9.6 1.4 2.1 3 3 4.2 2.4.9-.4 1.9-.4 2.8 0 1.2.6 2.8-.3 4.2-2.4 1.9-2.9 2.6-7.3.6-9.6-1.6-1.9-4.6-1.7-6.2-.6Z"/><path d="M12 7.6c0-1.8.6-3.2 1.8-4.2"/><path d="M13.4 5c1.2-1.5 3.2-1.8 4.6-1.1-.6 1.6-2.4 2.4-4.6 1.1Z"/>',
    strawberry: '<path d="M12 20.6c-3.2-1.6-6.6-5.6-6.6-9.2 0-2 1.6-3.3 3.6-3.3 1.2 0 2.2.4 3 .9.8-.5 1.8-.9 3-.9 2 0 3.6 1.3 3.6 3.3 0 3.6-3.4 7.6-6.6 9.2Z"/><path d="M8.4 8.4 7.4 5.6l3 1L12 4.2l1.6 2.4 3-1-1 2.8Z"/><circle cx="9.8" cy="12" r=".7" fill="currentColor"/><circle cx="14.2" cy="12" r=".7" fill="currentColor"/><circle cx="12" cy="15.2" r=".7" fill="currentColor"/>',
    grape: '<circle cx="7.6" cy="9.4" r="2.8"/><circle cx="12" cy="9.4" r="2.8"/><circle cx="16.4" cy="9.4" r="2.8"/><circle cx="9.8" cy="14" r="2.8"/><circle cx="14.2" cy="14" r="2.8"/><circle cx="12" cy="18.6" r="2.8"/><path d="M12 6.6V3.4"/><path d="M12 4.8c1.4-1.6 3.6-1.9 5-1-1 1.6-3 2.1-5 1Z"/>',
    watermelon: '<path d="M2.4 8.4h19.2a9.6 9.6 0 0 1-19.2 0Z"/><path d="M4.6 8.4h14.8a7.4 7.4 0 0 1-14.8 0Z"/><circle cx="9.4" cy="11" r=".8" fill="currentColor"/><circle cx="12" cy="13" r=".8" fill="currentColor"/><circle cx="14.6" cy="11" r=".8" fill="currentColor"/>',
    orange: '<circle cx="12" cy="13.6" r="7"/><path d="M12 6.6c.3-1.9 1.9-3 3.8-2.7-.3 1.9-1.9 3-3.8 2.7Z"/><path d="M8.4 11.4c.4-1.2 1.3-2.1 2.4-2.5"/>',
    cherry: '<circle cx="8" cy="16.4" r="3"/><circle cx="16" cy="15.4" r="3"/><path d="M8 13.4c.8-4 2.4-7 5.2-9"/><path d="M16 12.4c-.6-3.6-1.4-6.2-2.8-8"/><path d="M13.2 4.4c1.4-1.3 3.6-1.1 4.8.2-1.4 1.1-3.4 1-4.8-.2Z"/>',
    idea: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5a2.6 2.6 0 0 1 1.1-2.2A6 6 0 0 0 12 3Z"/>',
    shoppingbag: '<path d="M6 8h12l-1 12H7Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    travel: '<path d="M21 4 3 11l6 2 2 6 3-4 5 3Z"/>',
    train: '<rect x="6" y="4" width="12" height="12" rx="4"/><line x1="6" y1="11" x2="18" y2="11"/><circle cx="9" cy="15.5" r=".8" fill="currentColor" stroke="none"/><circle cx="15" cy="15.5" r=".8" fill="currentColor" stroke="none"/><path d="M8 19l-2 2M16 19l2 2"/>',
    bus: '<rect x="3" y="6" width="18" height="10" rx="2"/><line x1="3" y1="11" x2="21" y2="11"/><circle cx="7.5" cy="18.5" r="1.4"/><circle cx="16.5" cy="18.5" r="1.4"/>',
    car: '<path d="M4 16V12l2-4h12l2 4v4"/><path d="M4 16h16"/><circle cx="7.5" cy="16.5" r="1.6"/><circle cx="16.5" cy="16.5" r="1.6"/>',
    bicycle: '<circle cx="6" cy="17" r="3.2"/><circle cx="18" cy="17" r="3.2"/><path d="M6 17l4-9h4l-3 6h7l-3-5"/>',
    steamtrain: '<path d="M3 6.6h6.4v9.6H3Z"/><path d="M9.4 10h9c1 0 1.8.8 1.8 1.8v4.4H9.4Z"/><path d="M14.4 10V5.6h3v4.4"/><circle cx="6.6" cy="17.4" r="2.4"/><circle cx="15.4" cy="17.4" r="2.4"/>',
    metro: '<rect x="5" y="3.4" width="14" height="14.6" rx="3.6"/><path d="M7.4 6.2h9.2v5H7.4Z"/><path d="M5 13.6h14"/><circle cx="8.4" cy="15.8" r=".9" fill="currentColor"/><circle cx="15.6" cy="15.8" r=".9" fill="currentColor"/><path d="M8 18l-2 2.6M16 18l2 2.6"/>',
    plane: '<path d="M12 2.6c.9 0 1.5.9 1.5 2.2v4.6l7 4.2v2l-7-2v4l2.2 1.8v1.6L12 20.2l-3.7.8v-1.6l2.2-1.8v-4l-7 2v-2l7-4.2V4.8c0-1.3.6-2.2 1.5-2.2Z"/>',
    planeside: '<path d="M2.6 12.8c0-1.2 1-2.2 2.2-2.2h12.4c2.4 0 4.4 1.4 4.4 3s-2 3-4.4 3H6.6c-2.2 0-4-1.6-4-3.8Z"/><path d="M4.4 10.6 3 4.8h3l3.6 5.8"/><path d="M9.6 14.6 7.2 20.4h3.2l4.6-5.8"/>',
    carside: '<path d="M2.8 15.8v-2.6c0-1 .6-1.8 1.6-2.1l2.6-.7 2.2-3c.4-.5 1-.8 1.6-.8h4.6c.6 0 1.2.3 1.6.8l2.4 3 1.4.3c.9.2 1.6 1 1.6 2v3.1Z"/><path d="M10.6 8.4h1.8v2.6H8.8Z"/><path d="M14.4 8.4h.8c.3 0 .6.1.8.4l1.6 2.2h-3.2Z"/><circle cx="7.4" cy="16.2" r="2.1"/><circle cx="16.6" cy="16.2" r="2.1"/>',
    camera: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l1.5-3h5L16 7"/><circle cx="12" cy="13.5" r="4"/>',
    location: '<path d="M12 21s7-7.2 7-12a7 7 0 0 0-14 0c0 4.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.3"/>',
    pig: '<path d="M7.5 8.5 9 6 10.5 8.3M13.5 8.3 15 6 16.5 8.5"/><circle cx="12" cy="13.5" r="6.5"/><ellipse cx="12" cy="15.3" rx="2.3" ry="1.6"/><circle cx="11.1" cy="15.3" r=".35" fill="currentColor" stroke="none"/><circle cx="12.9" cy="15.3" r=".35" fill="currentColor" stroke="none"/><circle cx="9.6" cy="12" r=".5" fill="currentColor" stroke="none"/><circle cx="14.4" cy="12" r=".5" fill="currentColor" stroke="none"/>',
    giraffe: '<line x1="9.5" y1="7.8" x2="9" y2="5"/><circle cx="9" cy="4.5" r=".7" fill="currentColor" stroke="none"/><line x1="14.5" y1="7.8" x2="15" y2="5"/><circle cx="15" cy="4.5" r=".7" fill="currentColor" stroke="none"/><circle cx="12" cy="13.5" r="6.5"/><ellipse cx="12" cy="16.8" rx="2" ry="1.3"/><circle cx="9.4" cy="12" r=".5" fill="currentColor" stroke="none"/><circle cx="14.6" cy="12" r=".5" fill="currentColor" stroke="none"/><circle cx="8" cy="14.5" r=".9" fill="currentColor" stroke="none"/><circle cx="16" cy="15" r=".9" fill="currentColor" stroke="none"/>',
    bear: '<circle cx="7.3" cy="8.2" r="2.3"/><circle cx="16.7" cy="8.2" r="2.3"/><circle cx="12" cy="13.8" r="6.5"/><ellipse cx="12" cy="16" rx="2.2" ry="1.5"/><circle cx="9.5" cy="12" r=".5" fill="currentColor" stroke="none"/><circle cx="14.5" cy="12" r=".5" fill="currentColor" stroke="none"/>',
    monkey: '<circle cx="6.3" cy="12.5" r="2.6"/><circle cx="17.7" cy="12.5" r="2.6"/><circle cx="12" cy="13" r="6.5"/><ellipse cx="12" cy="14.7" rx="3.6" ry="3.1"/><circle cx="10" cy="12.8" r=".5" fill="currentColor" stroke="none"/><circle cx="14" cy="12.8" r=".5" fill="currentColor" stroke="none"/><path d="M10.3 16.5q1.7 1.1 3.4 0"/>',
    lion: '<line x1="17.5" y1="13" x2="19.7" y2="13"/><line x1="15.9" y1="9.1" x2="17.4" y2="7.6"/><line x1="12" y1="7.5" x2="12" y2="5.3"/><line x1="8.1" y1="9.1" x2="6.6" y2="7.6"/><line x1="6.5" y1="13" x2="4.3" y2="13"/><line x1="8.1" y1="16.9" x2="6.6" y2="18.4"/><line x1="12" y1="18.5" x2="12" y2="20.7"/><line x1="15.9" y1="16.9" x2="17.4" y2="18.4"/><circle cx="12" cy="13" r="5.5"/><ellipse cx="12" cy="15.2" rx="2" ry="1.4"/><circle cx="9.9" cy="11.7" r=".5" fill="currentColor" stroke="none"/><circle cx="14.1" cy="11.7" r=".5" fill="currentColor" stroke="none"/>'
  };
// 筆記圖示的貼紙樣式：線條圖示（跟日常記帳同一套）加上塗色和不規則底色，畫法跟童趣風月曆的生日貼紙一樣。
// App 畫面和主畫面小工具共用這一份；build.py 會把它塞進 page.html 和 kids-notes.js。
// fill：第幾個圖形要塗什麼顏色（依 ICON_SVGS 裡元素的順序，從 0 開始）；stroke：改線條顏色；chip：底色
const STICKER_INK = "#262261";
const STICKER_CHIP = {
  yellow: "#FFF0AF", orange: "#FFE2BA", green: "#D5F5D0", blue: "#CFDDF8",
  pink: "#FBD3D0", teal: "#C9F0E9", purple: "#E3DAFA", rose: "#FFD8E8",
};
const STICKER_COLORS = {
  yellow: "#FFD426", red: "#EE3E33", orange: "#FF9500", green: "#6BD861", sky: "#8CC4EE", blue: "#3F6FD1",
  teal: "#4FD2C2", pink: "#FF9EC4", lilac: "#B9A3F0", white: "#FFFFFF", mist: "#E4E2F2", balloon: "#7DCB6E", milkTea: "#D9B48F",
};
const STICKERS = {
  star: { chip: "yellow", fill: { 0: STICKER_COLORS.yellow } },
  heart: { chip: "pink", fill: { 0: STICKER_COLORS.red } },
  diamond: { chip: "blue", fill: { 0: STICKER_COLORS.sky } },
  music: { chip: "purple", fill: { 1: STICKER_COLORS.lilac, 2: STICKER_COLORS.lilac } },
  pencil: { chip: "orange", fill: { 0: STICKER_COLORS.yellow } },
  pets: { chip: "rose", fill: { 0: STICKER_COLORS.pink, 1: STICKER_COLORS.pink, 2: STICKER_COLORS.pink, 3: STICKER_COLORS.pink, 4: STICKER_COLORS.pink } },
  clothes: { chip: "green", fill: { 0: STICKER_COLORS.green } },
  sun: { chip: "orange", fill: { 0: STICKER_COLORS.yellow } },
  moon: { chip: "purple", fill: { 0: STICKER_COLORS.yellow } },
  cloud: { chip: "blue", fill: { 0: STICKER_COLORS.white } },
  partlycloudy: { chip: "blue", fill: { 0: STICKER_COLORS.yellow, 2: STICKER_COLORS.white } },
  cloudynight: { chip: "purple", fill: { 0: STICKER_COLORS.yellow, 1: STICKER_COLORS.white } },
  overcast: { chip: "blue", fill: { 0: STICKER_COLORS.mist } },
  rain: { chip: "blue", fill: { 0: STICKER_COLORS.white }, stroke: { 1: STICKER_COLORS.blue } },
  thunderstorm: { chip: "purple", fill: { 0: STICKER_COLORS.mist }, stroke: { 1: STICKER_COLORS.orange } },
  lightning: { chip: "yellow", fill: { 0: STICKER_COLORS.yellow } },
  snow: { chip: "teal", fill: { 0: STICKER_COLORS.white } },
  rainbow: { chip: "yellow", stroke: { 0: STICKER_COLORS.red, 1: STICKER_COLORS.blue } },
  gift: { chip: "blue", fill: { 0: STICKER_COLORS.sky, 3: STICKER_COLORS.red } },
  balloon: { chip: "teal", fill: { 0: STICKER_COLORS.balloon, 1: STICKER_COLORS.balloon } },
  fork: { chip: "orange", fill: { 0: STICKER_COLORS.white, 2: STICKER_COLORS.white } },
  drink: { chip: "teal", fill: { 0: STICKER_COLORS.milkTea, 1: STICKER_COLORS.white } },
  idea: { chip: "yellow", fill: { 1: STICKER_COLORS.yellow } },
  shoppingbag: { chip: "orange", fill: { 0: STICKER_COLORS.orange } },
  travel: { chip: "teal", fill: { 0: STICKER_COLORS.sky } },
  train: { chip: "yellow", fill: { 0: STICKER_COLORS.red, 2: STICKER_COLORS.yellow, 3: STICKER_COLORS.yellow } },
  bus: { chip: "teal", fill: { 0: STICKER_COLORS.green, 2: STICKER_COLORS.white, 3: STICKER_COLORS.white } },
  car: { chip: "blue", fill: { 0: STICKER_COLORS.yellow, 2: STICKER_COLORS.white, 3: STICKER_COLORS.white } },
  bicycle: { chip: "green", fill: { 0: STICKER_COLORS.white, 1: STICKER_COLORS.white } },
  camera: { chip: "purple", fill: { 0: STICKER_COLORS.lilac, 2: STICKER_COLORS.white } },
  location: { chip: "rose", fill: { 0: STICKER_COLORS.red, 1: STICKER_COLORS.white } },
  apple: { chip: "pink", fill: { 0: "#EE3E33", 2: "#6BD861" } },
  strawberry: { chip: "rose", fill: { 0: "#EE3E33", 1: "#6BD861" } },
  grape: { chip: "purple", fill: { 0: "#9B6BE8", 1: "#9B6BE8", 2: "#9B6BE8", 3: "#9B6BE8", 4: "#9B6BE8", 5: "#9B6BE8", 7: "#6BD861" } },
  watermelon: { chip: "green", fill: { 0: "#3FA34D", 1: "#FF5A6E" } },
  orange: { chip: "orange", fill: { 0: "#FF9500", 1: "#6BD861" } },
  cherry: { chip: "rose", fill: { 0: "#D9322B", 1: "#D9322B", 4: "#6BD861" } },
  rainboot: { chip: "teal", fill: { 0: "#FFD426", 1: "#3F6FD1" } },
  flipflop: { chip: "yellow", fill: { 0: "#4FD2C2" }, stroke: { 1: "#EE3E33" } },
  steamtrain: { chip: "blue", fill: { 0: "#EE3E33", 1: "#EE3E33", 2: "#FFD426", 3: "#FFD426", 4: "#FFD426" } },
  metro: { chip: "teal", fill: { 0: "#FFFFFF", 1: "#8CC4EE" }, stroke: { 2: "#4FD2C2" } },
  plane: { chip: "blue", fill: { 0: "#FFFFFF" } },
  planeside: { chip: "teal", fill: { 0: "#FFFFFF", 1: "#EE3E33", 2: "#8CC4EE" } },
  carside: { chip: "yellow", fill: { 0: "#EE3E33", 1: "#FFFFFF", 2: "#FFFFFF", 3: "#FFFFFF", 4: "#FFFFFF" } },
  forkknife: { chip: "orange", fill: { 0: "#FFD426", 2: "#FFD426", 3: "#8CC4EE", 4: "#8CC4EE" } },
  burger: { chip: "orange", fill: { 0: "#FFC93C", 2: "#8B5A3C", 3: "#FFC93C" }, stroke: { 1: "#3FA34D" } },
  pizza: { chip: "rose", fill: { 0: "#FFD426", 1: "#FF9500", 2: "#EE3E33", 3: "#EE3E33" } },
  cake: { chip: "pink", fill: { 0: "#FFFFFF", 1: "#FF9EC4", 2: "#EE3E33" } },
};
// 新增的圖示（24×24，跟其他線條圖示同一個格子）
// 氣球：球、綁口、線、反光；叉子：叉頭、中間的齒、叉柄；飲料杯：杯身、杯蓋、吸管、珍珠
// 水果：蘋果、草莓、葡萄、西瓜、柳橙、櫻桃（果實塗色，葉子塗綠）；雨靴：靴身、鞋底、靴口；夾腳拖：鞋底、夾帶
// 交通：小火車、捷運、飛機（俯視、側面）、小汽車（側面）
// 餐飲：刀叉、漢堡、披薩、蛋糕
const EXTRA_ICON_SVGS = {
  balloon: '<path d="M12 2.8c3.9 0 6.6 2.9 6.6 6.6s-3.2 6.3-6.6 7.3c-3.4-1-6.6-3.6-6.6-7.3S8.1 2.8 12 2.8Z"/><path d="M10.8 18.4 12 16.7l1.2 1.7Z"/><path d="M12 18.4c-1.6 1.4 1.6 2.4 0 4.2"/><path d="M8.6 8.4c.3-1.5 1.3-2.5 2.6-2.8"/>',
  fork: '<path d="M8.5 2.8v5.4a3.5 3.5 0 0 0 7 0V2.8"/><path d="M12 2.8v5.4"/><path d="M10.8 11.6h2.4l-.3 8.9a.9.9 0 0 1-1.8 0Z"/>',
  drink: '<path d="M6.8 9.4h10.4l-1.3 10.9a1.6 1.6 0 0 1-1.6 1.4H9.7a1.6 1.6 0 0 1-1.6-1.4Z"/><path d="M5.8 9.4h12.4V8a1.8 1.8 0 0 0-1.8-1.8H7.6A1.8 1.8 0 0 0 5.8 8Z"/><path d="M12.8 6.2 14.6 2.4h2.6"/><circle cx="10" cy="18.2" r=".9" fill="currentColor"/><circle cx="12.3" cy="19.2" r=".9" fill="currentColor"/><circle cx="14.4" cy="17.8" r=".9" fill="currentColor"/>',
  apple: '<path d="M12 7.6c-1.6-1.1-4.6-1.3-6.2.6-2 2.3-1.3 6.7.6 9.6 1.4 2.1 3 3 4.2 2.4.9-.4 1.9-.4 2.8 0 1.2.6 2.8-.3 4.2-2.4 1.9-2.9 2.6-7.3.6-9.6-1.6-1.9-4.6-1.7-6.2-.6Z"/><path d="M12 7.6c0-1.8.6-3.2 1.8-4.2"/><path d="M13.4 5c1.2-1.5 3.2-1.8 4.6-1.1-.6 1.6-2.4 2.4-4.6 1.1Z"/>',
  strawberry: '<path d="M12 20.6c-3.2-1.6-6.6-5.6-6.6-9.2 0-2 1.6-3.3 3.6-3.3 1.2 0 2.2.4 3 .9.8-.5 1.8-.9 3-.9 2 0 3.6 1.3 3.6 3.3 0 3.6-3.4 7.6-6.6 9.2Z"/><path d="M8.4 8.4 7.4 5.6l3 1L12 4.2l1.6 2.4 3-1-1 2.8Z"/><circle cx="9.8" cy="12" r=".7" fill="currentColor"/><circle cx="14.2" cy="12" r=".7" fill="currentColor"/><circle cx="12" cy="15.2" r=".7" fill="currentColor"/>',
  grape: '<circle cx="7.6" cy="9.4" r="2.8"/><circle cx="12" cy="9.4" r="2.8"/><circle cx="16.4" cy="9.4" r="2.8"/><circle cx="9.8" cy="14" r="2.8"/><circle cx="14.2" cy="14" r="2.8"/><circle cx="12" cy="18.6" r="2.8"/><path d="M12 6.6V3.4"/><path d="M12 4.8c1.4-1.6 3.6-1.9 5-1-1 1.6-3 2.1-5 1Z"/>',
  watermelon: '<path d="M2.4 8.4h19.2a9.6 9.6 0 0 1-19.2 0Z"/><path d="M4.6 8.4h14.8a7.4 7.4 0 0 1-14.8 0Z"/><circle cx="9.4" cy="11" r=".8" fill="currentColor"/><circle cx="12" cy="13" r=".8" fill="currentColor"/><circle cx="14.6" cy="11" r=".8" fill="currentColor"/>',
  orange: '<circle cx="12" cy="13.6" r="7"/><path d="M12 6.6c.3-1.9 1.9-3 3.8-2.7-.3 1.9-1.9 3-3.8 2.7Z"/><path d="M8.4 11.4c.4-1.2 1.3-2.1 2.4-2.5"/>',
  cherry: '<circle cx="8" cy="16.4" r="3"/><circle cx="16" cy="15.4" r="3"/><path d="M8 13.4c.8-4 2.4-7 5.2-9"/><path d="M16 12.4c-.6-3.6-1.4-6.2-2.8-8"/><path d="M13.2 4.4c1.4-1.3 3.6-1.1 4.8.2-1.4 1.1-3.4 1-4.8-.2Z"/>',
  rainboot: '<path d="M6 3.4h6.2v9.8l4.2 1.4c2.4.8 4 2 4 3.4H6Z"/><path d="M5.6 18h15v1.2c0 .8-.6 1.4-1.4 1.4H7c-.8 0-1.4-.6-1.4-1.4Z"/><path d="M5.2 3.4h7.8"/>',
  flipflop: '<path d="M12 2.6c3 0 4.6 2.6 4.6 6 0 2.2-.6 3.6-.6 5.4 0 2.2 1.2 3.6 1.2 5.4 0 1.8-2 2.8-5.2 2.8s-5.2-1-5.2-2.8c0-1.8 1.2-3.2 1.2-5.4 0-1.8-.6-3.2-.6-5.4 0-3.4 1.6-6 4.6-6Z"/><path d="M12 6.4 8.2 11.8M12 6.4l3.8 5.4"/>',
  steamtrain: '<path d="M3 6.6h6.4v9.6H3Z"/><path d="M9.4 10h9c1 0 1.8.8 1.8 1.8v4.4H9.4Z"/><path d="M14.4 10V5.6h3v4.4"/><circle cx="6.6" cy="17.4" r="2.4"/><circle cx="15.4" cy="17.4" r="2.4"/>',
  metro: '<rect x="5" y="3.4" width="14" height="14.6" rx="3.6"/><path d="M7.4 6.2h9.2v5H7.4Z"/><path d="M5 13.6h14"/><circle cx="8.4" cy="15.8" r=".9" fill="currentColor"/><circle cx="15.6" cy="15.8" r=".9" fill="currentColor"/><path d="M8 18l-2 2.6M16 18l2 2.6"/>',
  plane: '<path d="M12 2.6c.9 0 1.5.9 1.5 2.2v4.6l7 4.2v2l-7-2v4l2.2 1.8v1.6L12 20.2l-3.7.8v-1.6l2.2-1.8v-4l-7 2v-2l7-4.2V4.8c0-1.3.6-2.2 1.5-2.2Z"/>',
  planeside: '<path d="M2.6 12.8c0-1.2 1-2.2 2.2-2.2h12.4c2.4 0 4.4 1.4 4.4 3s-2 3-4.4 3H6.6c-2.2 0-4-1.6-4-3.8Z"/><path d="M4.4 10.6 3 4.8h3l3.6 5.8"/><path d="M9.6 14.6 7.2 20.4h3.2l4.6-5.8"/>',
  carside: '<path d="M2.8 15.8v-2.6c0-1 .6-1.8 1.6-2.1l2.6-.7 2.2-3c.4-.5 1-.8 1.6-.8h4.6c.6 0 1.2.3 1.6.8l2.4 3 1.4.3c.9.2 1.6 1 1.6 2v3.1Z"/><path d="M10.6 8.4h1.8v2.6H8.8Z"/><path d="M14.4 8.4h.8c.3 0 .6.1.8.4l1.6 2.2h-3.2Z"/><circle cx="7.4" cy="16.2" r="2.1"/><circle cx="16.6" cy="16.2" r="2.1"/>',
  forkknife: '<path d="M3.8 2.8v5.4c0 1.8 1.4 3.2 3.4 3.2s3.4-1.4 3.4-3.2V2.8"/><path d="M7.2 2.8v4.6"/><path d="M5.9 12.2h2.6v7.6a1.3 1.3 0 0 1-2.6 0Z"/><path d="M18.6 2.8c-2.8 1.4-4.4 4.6-4.4 8.6h4.4Z"/><path d="M15.9 12.2h2.6v7.6a1.3 1.3 0 0 1-2.6 0Z"/>',
  burger: '<path d="M4 10.4c0-3.6 3.6-6 8-6s8 2.4 8 6Z"/><path d="M3.6 12.4c1.4-1 2.8 1 4.2 0s2.8 1 4.2 0 2.8 1 4.2 0 2.8 1 4.2 0"/><path d="M4 13.8h16v2.6H4Z"/><path d="M4.4 17.6h15.2c0 1.6-1.4 2.8-3.2 2.8H7.6c-1.8 0-3.2-1.2-3.2-2.8Z"/>',
  pizza: '<path d="M12 21 3.6 6.4c2.6-1.6 5.4-2.4 8.4-2.4s5.8.8 8.4 2.4Z"/><path d="M3.6 6.4c2.6-1.6 5.4-2.4 8.4-2.4s5.8.8 8.4 2.4l-1.6 2.8c-2.2-1.2-4.4-1.8-6.8-1.8s-4.6.6-6.8 1.8Z"/><circle cx="10.4" cy="11.6" r="1.3"/><circle cx="13" cy="15.4" r="1.2"/>',
  cake: '<path d="M3.6 10.6h16.8v9.4H3.6Z"/><path d="M3.6 10.6 13.4 6h7v4.6Z"/><circle cx="16.6" cy="4.2" r="2.2"/>',
};

// 不規則色塊的 8 個圓角百分比（同童趣風月曆的 R1–R4），依圖示名稱挑一組、旋轉 ±4 度
const STICKER_BLOBS = [[52, 48, 61, 39, 58, 43, 57, 42], [60, 40, 44, 56, 46, 55, 45, 54], [45, 55, 52, 48, 62, 40, 60, 38], [55, 45, 48, 52, 44, 58, 42, 56]];
function stickerHash(s) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }

// 不規則色塊的 SVG 路徑（寬 w、高 h，左上角在 0,0）
function blobPathD(w, h, r) {
  const [a, b, c, d, e, f, g, k] = r.map((v) => v / 100);
  return `M${a * w} 0H${w - b * w}A${b * w} ${f * h} 0 0 1 ${w} ${f * h}V${h - g * h}A${c * w} ${g * h} 0 0 1 ${w - c * w} ${h}`
    + `H${d * w}A${d * w} ${k * h} 0 0 1 0 ${h - k * h}V${e * h}A${a * w} ${e * h} 0 0 1 ${a * w} 0Z`;
}

// 一個圖示的完整貼紙 SVG（viewBox 24×24）：底下不規則色塊，上面是塗好色的線條圖示
// 貼紙底色跟它放上去的卡片同色時看不出來：on 是卡片的顏色（名稱如 "orange"，或色碼），同色就回傳 true
function stickerClash(key, on) {
  if (!on) return false;
  const chip = (STICKERS[key] || { chip: "yellow" }).chip;
  return on === chip || String(on).toLowerCase() === STICKER_CHIP[chip].toLowerCase();
}
// on：放在什麼顏色的卡片上（可省略）；跟貼紙底色一樣時底色改白色
function stickerSVG(key, svgs, on) {
  const spec = STICKERS[key] || { chip: "yellow", fill: {} };
  const inner = svgs[key] || svgs.star;
  let i = 0;
  const body = inner.replace(/<(\w+)([^>]*?)\/>/g, (m, tag, attrs) => {
    const idx = i++;
    if (/fill="currentColor"/.test(attrs)) return `<${tag}${attrs.replace('fill="currentColor"', `fill="${STICKER_INK}"`)}/>`;
    const fill = spec.fill && spec.fill[idx] ? spec.fill[idx] : "none";
    const stroke = spec.stroke && spec.stroke[idx] ? ` stroke="${spec.stroke[idx]}" stroke-width="2.8"` : "";
    return `<${tag}${attrs} fill="${fill}"${stroke}/>`;
  });
  const h = stickerHash(key), deg = (h % 9) - 4;
  // 寫明寬高，畫成 PNG 時才不會被當成 300×150 而變形
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24">`
    + `<path d="${blobPathD(22, 22, STICKER_BLOBS[h % 4])}" transform="translate(1 1) rotate(${deg} 11 11)" fill="${stickerClash(key, on) ? "#FFFFFF" : STICKER_CHIP[spec.chip]}"/>`
    + `<g transform="translate(4.4 4.4) scale(.633)" stroke="${STICKER_INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</g>`
    + `</svg>`;
}
Object.assign(ICON_SVGS, EXTRA_ICON_SVGS);

// 小動物圖示：第一次在 App 內執行時從 GitHub 下載（SVG 先在 WebView 轉成 PNG），存在這台
const ANIMALS = {
  lion: "animal-lion.png", pig: "animal-pig.png", giraffe: "animal-giraffe.png", bear: "animal-bear.png",
  monkey: "animal-monkey.png", bee: "animal-bee.svg", owl: "animal-owl.svg", fox: "animal-fox.svg",
  sheep: "animal-sheep.svg", penguin: "animal-penguin.svg", koala: "animal-koala.svg", frog: "animal-frog.svg",
  rabbit: "animal-rabbit.svg",
};
const ICON_BASES = [
  "https://raw.githubusercontent.com/yenchisayhi-LORCA/Claude-Code-HTML/main/daily-expense-tracker/icons/",
  "https://yenchisayhi-lorca.github.io/Claude-Code-HTML/daily-expense-tracker/icons/",
];
const iconPath = key => local.joinPath(ICON_DIR, key + ".png");
const artPath = key => local.joinPath(ART_DIR, "icon-" + key + ".png");

async function download(file) {
  for (const base of ICON_BASES) {
    try {
      const req = new Request(base + file);
      const data = await req.load();
      if (req.response.statusCode === 200) return data;
    } catch (e) {}
  }
  return null;
}

// 把 SVG 字串（base64 或原文）在 WebView 裡畫成 PNG；回傳 { key: base64 }
async function svgToPNG(svgs, size) {
  if (!Object.keys(svgs).length) return {};
  const wv = new WebView();
  await wv.loadHTML("<html><body></body></html>");
  return await wv.evaluateJavaScript(`
    (async () => {
      const out = {};
      for (const [k, src] of Object.entries(${js(svgs)})) {
        try {
          const im = new Image();
          im.src = src;
          await im.decode();
          const cv = document.createElement("canvas"); cv.width = cv.height = ${size};
          cv.getContext("2d").drawImage(im, 0, 0, ${size}, ${size});
          out[k] = cv.toDataURL("image/png").split(",")[1];
        } catch (e) {}
      }
      completion(out);
    })();
    0;`, true) || {};
}

// 回傳下載失敗的數量
async function ensureAnimalIcons() {
  const missing = Object.keys(ANIMALS).filter(k => !local.fileExists(iconPath(k)));
  if (!missing.length) return 0;
  mkdir(ICON_DIR);
  const svgs = {};
  let failed = 0;
  for (const k of missing) {
    const data = await download(ANIMALS[k]);
    if (!data) { failed++; continue; }
    if (ANIMALS[k].endsWith(".png")) local.write(iconPath(k), data);
    else svgs[k] = "data:image/svg+xml;base64," + data.toBase64String();
  }
  try {
    const res = await svgToPNG(svgs, 160);
    for (const k of Object.keys(svgs)) {
      if (res[k]) local.write(iconPath(k), Data.fromBase64String(res[k]));
      else failed++;
    }
  } catch (e) { failed += Object.keys(svgs).length; }
  return failed;
}

// 貼紙圖示畫成 PNG，給主畫面小工具用（小工具裡不能畫 SVG）；樣式改過就把 STICKER_ART 加 1
const STICKER_ART = 6; // 2：加水果圖示；3：加雨靴、夾腳拖；4：加小火車、捷運、飛機、小汽車；5：加刀叉、漢堡、披薩、蛋糕；6：多畫白底的圖示
async function ensureStickerArt() {
  const meta = local.joinPath(ART_DIR, "meta.json");
  try { if (local.fileExists(meta) && JSON.parse(local.readString(meta)).version === STICKER_ART) return; } catch (e) {}
  const svgs = {};
  for (const k of ICONS) if (!ANIMALS[k]) {
    svgs[k] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(stickerSVG(k, ICON_SVGS));
    // 白底的那張：分類卡片跟貼紙底色同色時用
    svgs[k + "-w"] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(stickerSVG(k, ICON_SVGS, (STICKERS[k] || { chip: "yellow" }).chip));
  }
  try {
    const res = await svgToPNG(svgs, 96);
    mkdir(ART_DIR);
    for (const k in res) local.write(artPath(k), Data.fromBase64String(res[k]));
    local.writeString(meta, JSON.stringify({ version: STICKER_ART }));
  } catch (e) {}
}

async function animalDataURLs() {
  const out = {};
  for (const k of Object.keys(ANIMALS)) {
    if (local.fileExists(iconPath(k))) out[k] = "data:image/png;base64," + local.read(iconPath(k)).toBase64String();
  }
  return out;
}

// ---- 左上角的「彥」和彩色底圖：沿用童趣風月曆、筆記在這台畫好的圖（沒有就只顯示米白底）
const NOTES_ART = local.joinPath(local.documentsDirectory(), "kids-notes-art");
const notesArt = name => { const p = local.joinPath(NOTES_ART, name + ".png"); return local.fileExists(p) ? Image.fromFile(p) : null; };
function logoImages() {
  const cal = local.joinPath(local.joinPath(local.documentsDirectory(), "calendar-widget-kids"), "logo.png");
  if (local.fileExists(cal)) return [Image.fromFile(cal)];
  const first = notesArt("logo-0");
  return first ? [first] : [];
}
const logoDataURLs = () => logoImages().map(im => "data:image/png;base64," + Data.fromPNG(im).toBase64String());

// ---- 小工具右上角的照片：黃色色塊可以換成一張照片（外框跟色塊同一個形狀，跟筆記、行事曆一樣）
// 照片也只放在這台：kids-ledger/corner.jpg；疊好照片的底圖畫在 kids-ledger/art/bg-*.png
const CORNER_PATH = local.joinPath(DIR, "corner.jpg");
const CORNER_META = local.joinPath(ART_DIR, "bg-meta.json");
const readJSON = p => { try { return local.fileExists(p) ? JSON.parse(local.readString(p)) : null; } catch (e) { return null; } };
// 底圖的版本：照片換的時間 + 筆記畫的底圖（-plain）的修改時間，任何一個變了就要重畫
const cornerStamp = () => local.fileExists(CORNER_PATH) ? local.modificationDate(CORNER_PATH).getTime() : 0;
const baseStamp = () => ["small", "medium", "large"].map(f => { try { return local.modificationDate(local.joinPath(NOTES_ART, "bg-" + f + "-plain.png")).getTime(); } catch (e) { return 0; } }).join(",");
function cornerBg(family) {
  const meta = readJSON(CORNER_META), p = local.joinPath(ART_DIR, "bg-" + family + ".png");
  if (!cornerStamp() || !meta || meta.corner !== cornerStamp() || meta.base !== baseStamp() || !local.fileExists(p)) return null;
  return Image.fromFile(p);
}
// 在 App 內執行時：照片換過、或筆記的底圖重畫過，就重畫疊好照片的底圖
async function ensureCornerArt() {
  const corner = cornerStamp(), meta = readJSON(CORNER_META);
  if (!corner || (meta && meta.corner === corner && meta.base === baseStamp())) return;
  const bases = {};
  for (const f of ["small", "medium", "large"]) {
    const p = local.joinPath(NOTES_ART, "bg-" + f + "-plain.png");
    if (local.fileExists(p)) bases[f] = local.read(p).toBase64String();
  }
  if (!Object.keys(bases).length) return;
  const wv = new WebView();
  await wv.loadHTML("<html><body></body></html>");
  const res = await wv.evaluateJavaScript(`
    (async () => {
      try {
        const load = (b64, type) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = "data:image/" + type + ";base64," + b64; });
        const photo = await load(${js(local.read(CORNER_PATH).toBase64String())}, "jpeg");
        const out = {};
        for (const [f, b64] of Object.entries(${js(bases)})) {
          const base = await load(b64, "png"), S = 3, W = base.width / S, H = base.height / S, u = Math.min(W, H) / 170;
          const cv = document.createElement("canvas"); cv.width = base.width; cv.height = base.height;
          const g = cv.getContext("2d"); g.drawImage(base, 0, 0);
          // 跟筆記的底圖同一個黃色色塊：中心 (W-4u, 2u)、92u×80u、轉 -8 度
          const pc = document.createElement("canvas"); pc.width = cv.width; pc.height = cv.height;
          const pg = pc.getContext("2d"); pg.scale(S, S);
          const bx = W - 4 * u, by = 2 * u, bw = 92 * u, bh = 80 * u;
          pg.save(); pg.translate(bx, by); pg.rotate(-8 * Math.PI / 180); pg.translate(-bw / 2, -bh / 2);
          const [a, b, c, d, e, ff, gg, hh] = [52, 48, 61, 39, 58, 43, 57, 42].map(v => v / 100), w = bw, h = bh;
          pg.beginPath(); pg.moveTo(a * w, 0); pg.lineTo(w - b * w, 0);
          pg.ellipse(w - b * w, ff * h, b * w, ff * h, 0, -Math.PI / 2, 0); pg.lineTo(w, h - gg * h);
          pg.ellipse(w - c * w, h - gg * h, c * w, gg * h, 0, 0, Math.PI / 2); pg.lineTo(d * w, h);
          pg.ellipse(d * w, h - hh * h, d * w, hh * h, 0, Math.PI / 2, Math.PI); pg.lineTo(0, e * h);
          pg.ellipse(a * w, e * h, a * w, e * h, 0, Math.PI, Math.PI * 1.5);
          pg.closePath(); pg.fillStyle = "#000"; pg.fill(); pg.restore();
          pg.globalCompositeOperation = "source-in";
          // 照片放滿色塊在小工具裡看得到的那一塊（左下四分之一），照片中間對齊
          const vx = bx - bw / 2 - 2, vw = W - vx, vh = by + bh / 2 + 2, k = Math.max(vw / photo.width, vh / photo.height);
          pg.drawImage(photo, vx + (vw - photo.width * k) / 2, (vh - photo.height * k) / 2, photo.width * k, photo.height * k);
          g.drawImage(pc, 0, 0);
          out[f] = cv.toDataURL("image/png").split(",")[1];
        }
        completion(out);
      } catch (e) { completion({ error: String(e) }); }
    })();
    0;`, true);
  if (!res || res.error) return;
  mkdir(ART_DIR);
  for (const f in res) local.write(local.joinPath(ART_DIR, "bg-" + f + ".png"), Data.fromBase64String(res[f]));
  local.writeString(CORNER_META, JSON.stringify({ corner, base: baseStamp() }));
}
// 從相簿選照片（長邊縮到 900），或拿掉改回黃色色塊；回傳要顯示的訊息，取消回傳 null
async function changeCorner() {
  const a = new Alert();
  a.title = "小工具右上角的照片";
  a.addAction("從相簿選");
  a.addDestructiveAction("拿掉照片，改回黃色色塊");
  a.addCancelAction("取消");
  const i = await a.presentSheet();
  if (i < 0) return null;
  if (i === 1) { if (local.fileExists(CORNER_PATH)) local.remove(CORNER_PATH); return "已改回黃色色塊，主畫面小工具稍後會跟著換"; }
  let img;
  try { img = await Photos.fromLibrary(); } catch (e) { return null; }
  const k = Math.min(1, 900 / Math.max(img.size.width, img.size.height));
  const dc = new DrawContext();
  dc.size = new Size(Math.round(img.size.width * k), Math.round(img.size.height * k));
  dc.respectScreenScale = false; dc.opaque = true;
  dc.drawImageInRect(img, new Rect(0, 0, dc.size.width, dc.size.height));
  mkdir(DIR);
  local.write(CORNER_PATH, Data.fromJPEG(dc.getImage()));
  await ensureCornerArt();
  return local.fileExists(local.joinPath(NOTES_ART, "bg-large-plain.png"))
    ? "照片換好了，主畫面小工具稍後會跟著換"
    : "照片存好了；要先在這台裝好「筆記」並按 ▶︎ 一次，小工具才有彩色底圖可以疊照片";
}

// 點小工具時執行這個腳本的網址，例如 scriptable:///run?scriptName=記帳&add=b1
function runURL(params) {
  const q = { scriptName: Script.name(), ...params };
  return "scriptable:///run?" + Object.keys(q).map(k => k + "=" + encodeURIComponent(q[k])).join("&");
}

// 筆記畫面的 HTML（由 build.py 從 page.html 產生，不要直接改這裡）
function pageHTML() {
  return "<!doctype html>\n<html lang=\"zh-Hant\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n<title>童趣風記帳</title>\n<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Gluten:wght@700;800&family=Noto+Sans+TC:wght@500;700;900&family=Zen+Maru+Gothic:wght@500;700;900&display=swap\">\n<style>\n/* 版面：手機寬的一欄。首頁是帳本卡片，點進去是帳本內頁（依日期列出），記一筆、編輯分類、編輯帳本都是從下面升上來的面板 */\n:root {\n  --refund: #17705F;\n  --cream: #FFFCEF; --ink: #262261; --body: #5A5788; --white: #FFFFFF; --dis: #F0EEE4; --line: #ECE7D2;\n  --sun: #FFD426; --blue: #3F6FD1; --tomato: #D93A2F; --teal-check: #17705F;\n  --yellow-100: #FFF0AF; --orange-100: #FFE2BA; --green-100: #D5F5D0; --blue-100: #CFDDF8;\n  --pink-100: #FBD3D0; --teal-100: #C9F0E9; --purple-100: #E3DAFA; --rose-100: #FFD8E8;\n  --display: Gluten, \"Noto Sans TC\", sans-serif;\n  --sans: \"Noto Sans TC\", -apple-system, \"PingFang TC\", system-ui, sans-serif;\n  /* Scriptable 在畫面最上面疊了自己的「Close」鍵，內容和面板都往下讓出這一條 */\n  --top-bar: max(58px, calc(env(safe-area-inset-top, 0px) + 48px));\n  color-scheme: light;\n}\n* { box-sizing: border-box; }\n[hidden] { display: none !important; }\nhtml, body { margin: 0; background: var(--cream); color: var(--ink); font-family: var(--sans); font-weight: 500; }\nbutton { font: inherit; color: inherit; border: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }\nbutton:focus-visible, input:focus-visible { outline: 3px solid var(--sun); outline-offset: 2px; }\n.money { font-family: var(--display); font-variant-numeric: tabular-nums; }\n\n/* 背景的彩色色塊（跟筆記、小工具同一套） */\n.deco { position: fixed; z-index: 0; border-radius: 52% 48% 61% 39% / 58% 43% 57% 42%; pointer-events: none; }\n.app { position: relative; z-index: 1; max-width: 480px; margin: 0 auto; padding: var(--top-bar) 16px calc(150px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; gap: 14px; }\n.top { display: flex; align-items: center; gap: 10px; min-height: 44px; }\n.top h1 { margin: 0; font-size: 24px; font-weight: 900; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.logo { display: flex; gap: 2px; flex: none; }\n.logo img { width: 44px; height: 44px; display: block; }\n.ibtn { width: 40px; height: 40px; border-radius: 12px; background: var(--white); display: grid; place-items: center; font-weight: 900; font-size: 18px; flex: none; }\n.ibtn.on { background: var(--sun); }\n.ibtn.red { background: var(--tomato); color: var(--white); font-size: 24px; }\n\n/* 圖示（跟筆記同一套：小動物圖片、貼紙） */\n.ic { width: 40px; height: 40px; flex: none; display: block; }\n.ic svg, .ic img { width: 100%; height: 100%; display: block; }\n.ic img { border-radius: 50%; }\n\n/* 首頁：帳本卡片 */\n.books { display: flex; flex-direction: column; gap: 10px; }\n.book { display: flex; align-items: center; gap: 12px; border-radius: 24px; padding: 14px 16px; text-align: left; width: 100%; position: relative; }\n.book .ic { width: 46px; height: 46px; }\n.book .t { flex: 1; min-width: 0; display: flex; flex-direction: column; }\n.book strong { font-size: 18px; font-weight: 900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.book small { font-size: 13px; color: var(--body); font-weight: 700; }\n.book .money { font-size: 22px; }\n.book .del { position: absolute; top: -6px; left: -6px; width: 28px; height: 28px; border-radius: 50%; background: var(--tomato); color: var(--white); font-weight: 900; display: grid; place-items: center; font-size: 14px; }\n.dashed { border: 2.5px dashed var(--body); background: transparent; border-radius: 24px; padding: 14px; font-weight: 900; color: var(--body); font-size: 16px; }\n.hint { font-size: 13px; color: var(--body); line-height: 1.6; margin: 0; }\n\n/* 帳本內頁 */\n.total { background: var(--yellow-100); border-radius: 22px; padding: 12px 16px; display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }\n.total span { font-size: 14px; font-weight: 700; color: var(--body); }\n.total .money { font-size: 32px; }\n.day { font-size: 14px; font-weight: 900; display: flex; justify-content: space-between; padding: 6px 4px 0; }\n.day em { font-style: normal; color: var(--body); }\n.items { display: flex; flex-direction: column; gap: 8px; }\n.item { display: flex; align-items: center; gap: 12px; border-radius: 18px; padding: 10px 12px; width: 100%; text-align: left; position: relative; transition: transform .2s; }\n.swipe { position: relative; border-radius: 18px; overflow: hidden; }\n.swipe:not(.open):not(.drag) .swdel { visibility: hidden; } /* 沒滑的時候藏起來，卡片圓角邊才不會透出紅色 */\n.swdel { position: absolute; top: 0; right: 0; bottom: 0; width: 84px; background: var(--tomato); color: var(--white); font-weight: 900; font-size: 15px; }\n@media (prefers-reduced-motion: reduce) { .item { transition: none; } }\n.item .ic { width: 34px; height: 34px; }\n.item .t { flex: 1; min-width: 0; display: flex; flex-direction: column; }\n.item strong { font-size: 16px; font-weight: 900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.item small { font-size: 12.5px; color: var(--body); font-weight: 700; }\n.item .money { font-size: 20px; }\n.empty { text-align: center; color: var(--body); font-weight: 700; padding: 40px 0; line-height: 1.8; }\n.bottom { z-index: 2; position: fixed; left: 0; right: 0; bottom: 0; padding: 12px 16px calc(14px + env(safe-area-inset-bottom, 0px)); background: linear-gradient(transparent, var(--cream) 30%); display: flex; justify-content: center; }\n.bottom .in { max-width: 480px; width: 100%; display: flex; flex-direction: column; gap: 8px; }\n.bottom .tools { display: flex; gap: 8px; }\n.bottom button { flex: 1; border-radius: 999px; padding: 12px 6px; font-weight: 900; font-size: 15px; background: var(--white); box-shadow: 0 4px 14px rgba(38,34,97,.08); }\n.bottom .go { background: var(--blue); color: var(--white); }\n.bottom .add { background: var(--tomato); color: var(--white); font-size: 18px; padding: 14px; }\n.bottom .warn { background: var(--tomato); color: var(--white); }\n\n/* 面板 */\n.scrim { position: fixed; inset: 0; background: rgba(38,34,97,.28); display: flex; align-items: flex-end; justify-content: center; z-index: 10; padding-top: var(--top-bar); }\n.sheet { background: var(--cream); width: 100%; max-width: 480px; max-height: 100%; overflow-y: auto; border-radius: 34px 34px 0 0; padding: 16px 16px calc(14px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; gap: 10px; }\n.sheet-top { display: flex; align-items: center; gap: 10px; }\n.sheet-top h2 { margin: 0; font-size: 20px; font-weight: 900; flex: 1; min-width: 0; }\n.lbl { font-size: 13px; font-weight: 700; color: var(--body); }\n.lbl-row { display: flex; justify-content: space-between; align-items: center; }\n.link { background: transparent; color: var(--blue); font-weight: 900; font-size: 14px; padding: 4px 6px; border-radius: 8px; }\n\n/* 記一筆 */\n.amount { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; }\n.when { border: 0; background: var(--white); border-radius: 12px; padding: 7px 10px; font: inherit; font-size: 14px; font-weight: 700; color: var(--ink); min-width: 0; max-width: 60%; }\n.amount .num { font-family: var(--sans); font-weight: 900; font-size: 36px; line-height: 1.1; font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; }\n.amount .num small { font-size: 22px; margin-right: 4px; white-space: nowrap; }\n/* 鍵盤左下的「−」：回饋、退款，金額變負的、綠色，總額會扣掉 */\n.key.sign { font-family: var(--sans); font-size: 30px; font-weight: 900; line-height: 1; padding-bottom: 8px; }\n.key.sign[aria-pressed=\"true\"] { background: var(--green-100); color: var(--refund); outline: 3px solid var(--refund); outline-offset: -3px; }\n.amount .num.neg, .money.neg { color: var(--refund); }\n/* 分類小一點、一排 5 個，輸入完金額不用往下滑就看得到「記下來」 */\n.cats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; }\n.cat { background: transparent; padding: 4px 0 3px; border-radius: 14px; display: flex; flex-direction: column; align-items: center; gap: 1px; font-size: 12px; font-weight: 700; min-width: 0; }\n.cat .ic { width: 30px; height: 30px; }\n.cat span { max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-inline: 2px; }\n.cat[aria-pressed=\"true\"] { outline: 3px solid var(--ink); }\n.cat .plus { width: 30px; height: 30px; border-radius: 50%; border: 2px dashed var(--body); display: grid; place-items: center; font-size: 20px; font-weight: 900; color: var(--body); }\n.note { background: var(--white); border-radius: 14px; padding: 10px 12px; font-size: 15px; color: var(--body); display: flex; gap: 8px; align-items: center; }\n.note input { border: 0; outline: 0; font: inherit; font-size: 16px; color: var(--ink); background: transparent; flex: 1; min-width: 0; }\n.keys { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }\n.key { height: 44px; border-radius: 14px; background: var(--white); font-family: var(--display); font-size: 23px; font-weight: 800; }\n.key:active { background: var(--yellow-100); }\n.row2 { display: flex; gap: 8px; }\n.row2 button { flex: 1; border-radius: 999px; padding: 13px; font-weight: 900; font-size: 16px; }\n.save { background: var(--tomato); color: var(--white); }\n.soft { background: var(--dis); }\n.danger { background: var(--tomato); color: var(--white); }\n\n/* 編輯分類、帳本 */\n.prev { display: flex; align-items: center; gap: 10px; }\n.chip { display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; padding: 5px 16px 5px 6px; font-weight: 900; font-size: 16px; }\n.chip .ic { width: 32px; height: 32px; }\n.namein { border: 0; background: var(--white); border-radius: 14px; padding: 11px 14px; font: inherit; font-size: 17px; font-weight: 700; color: var(--ink); width: 100%; }\n.dots { display: flex; flex-wrap: wrap; gap: 8px; }\n.dot { width: 34px; height: 34px; border-radius: 50%; border: 3px solid transparent; padding: 0; }\n.dot[aria-pressed=\"true\"] { border-color: var(--ink); }\n.icons { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 6px; }\n.iopt { background: var(--white); border-radius: 14px; padding: 4px; aspect-ratio: 1; max-width: 100%; display: grid; place-items: center; }\n.iopt .ic { width: 100%; height: 100%; }\n.iopt[aria-pressed=\"true\"] { background: var(--sun); }\n.catlist { display: flex; flex-wrap: wrap; gap: 8px; }\n\n.toast { position: fixed; left: 50%; transform: translateX(-50%); top: var(--top-bar); z-index: 30; background: var(--ink); color: var(--white); border-radius: 999px; padding: 10px 18px; font-weight: 900; font-size: 14px; max-width: calc(100% - 32px); display: flex; gap: 12px; align-items: center; }\n.toast button { background: var(--sun); color: var(--ink); border-radius: 999px; padding: 3px 12px; font-weight: 900; }\n</style>\n</head>\n<body>\n<div class=\"deco\" style=\"width:190px;height:160px;right:-60px;top:-50px;background:var(--sun)\"></div>\n<div class=\"deco\" style=\"width:120px;height:150px;left:-70px;top:45%;background:var(--green-100)\"></div>\n<div class=\"deco\" style=\"width:170px;height:120px;right:-50px;bottom:-40px;background:var(--teal-100)\"></div>\n<main class=\"app\" id=\"app\"></main>\n<div class=\"bottom\" id=\"bottom\"></div>\n<div class=\"scrim\" id=\"scrim\" hidden></div>\n<div class=\"toast\" id=\"toast\" role=\"status\" hidden></div>\n\n<script>\nconst ICONS = [\"lion\", \"pig\", \"giraffe\", \"bear\", \"monkey\", \"bee\", \"owl\", \"fox\", \"sheep\", \"penguin\", \"koala\", \"frog\", \"rabbit\", \"star\", \"heart\", \"diamond\", \"music\", \"clothes\", \"rainboot\", \"pencil\", \"pets\", \"sun\", \"moon\", \"cloud\", \"rain\", \"lightning\", \"rainbow\", \"gift\", \"balloon\", \"forkknife\", \"burger\", \"pizza\", \"cake\", \"drink\", \"apple\", \"strawberry\", \"grape\", \"cherry\", \"idea\", \"shoppingbag\", \"travel\", \"plane\", \"planeside\", \"steamtrain\", \"metro\", \"carside\", \"camera\", \"location\"];\nconst ICON_SVGS = {\n    star: '<path d=\"M12 3l2.4 5.5 6 .6-4.5 4 1.3 5.9L12 16l-5.2 3 1.3-5.9-4.5-4 6-.6Z\"/>',\n    heart: '<path d=\"M12 20s-7-4.4-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5c-2.5 4.6-9.5 9-9.5 9Z\"/>',\n    diamond: '<path d=\"M12 4L15 12L12 20L9 12Z\"/>',\n    music: '<path d=\"M9 18V5l10-2v13\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/><circle cx=\"16\" cy=\"16\" r=\"3\"/>',\n    pencil: '<path d=\"M4 20l1-4L16 5l3 3L8 19l-4 1Z\"/><path d=\"M14 7l3 3\"/>',\n    pets: '<circle cx=\"12\" cy=\"15\" r=\"3.4\"/><circle cx=\"6.5\" cy=\"10\" r=\"1.6\"/><circle cx=\"10\" cy=\"7\" r=\"1.6\"/><circle cx=\"14\" cy=\"7\" r=\"1.6\"/><circle cx=\"17.5\" cy=\"10\" r=\"1.6\"/>',\n    clothes: '<path d=\"M8 4 4 7l2 3 2-1.3V20h8V8.7L18 10l2-3-4-3-2 1.5h-4Z\"/>',\n    rainboot: '<path d=\"M6 3.4h6.2v9.8l4.2 1.4c2.4.8 4 2 4 3.4H6Z\"/><path d=\"M5.6 18h15v1.2c0 .8-.6 1.4-1.4 1.4H7c-.8 0-1.4-.6-1.4-1.4Z\"/><path d=\"M5.2 3.4h7.8\"/>',\n    flipflop: '<path d=\"M12 2.6c3 0 4.6 2.6 4.6 6 0 2.2-.6 3.6-.6 5.4 0 2.2 1.2 3.6 1.2 5.4 0 1.8-2 2.8-5.2 2.8s-5.2-1-5.2-2.8c0-1.8 1.2-3.2 1.2-5.4 0-1.8-.6-3.2-.6-5.4 0-3.4 1.6-6 4.6-6Z\"/><path d=\"M12 6.4 8.2 11.8M12 6.4l3.8 5.4\"/>',\n    sun: '<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1\"/>',\n    moon: '<path d=\"M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z\"/>',\n    cloud: '<path d=\"M7 18h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.1 10.1 4 4 0 0 0 7 18Z\"/>',\n    partlycloudy: '<circle cx=\"8\" cy=\"8\" r=\"3\"/><path d=\"M8 3v1.2M8 12.8V14M3 8h1.2M12.8 8H14M4.5 4.5l.9.9M11.5 4.5l-.9.9\"/><path d=\"M10 20h7a3.5 3.5 0 0 0 .4-6.98A4.5 4.5 0 0 0 9.2 12.4 3.2 3.2 0 0 0 10 20Z\"/>',\n    cloudynight: '<path d=\"M15 8.2A4 4 0 1 1 10.9 4a3.2 3.2 0 0 0 4.1 4.2Z\"/><path d=\"M9 20h7a3.5 3.5 0 0 0 .4-6.98A4.5 4.5 0 0 0 8.2 12.4 3.2 3.2 0 0 0 9 20Z\"/>',\n    overcast: '<path d=\"M7 14h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.1 6.1 4 4 0 0 0 7 14Z\"/><line x1=\"5\" y1=\"18\" x2=\"19\" y2=\"18\"/>',\n    rain: '<path d=\"M7 13h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.1 5.1 4 4 0 0 0 7 13Z\"/><path d=\"M8 17l-1 3M12 17l-1 3M16 17l-1 3\"/>',\n    thunderstorm: '<path d=\"M7 12h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.1 4.1 4 4 0 0 0 7 12Z\"/><path d=\"M13 13l-3 5h3l-2 4\"/>',\n    lightning: '<path d=\"M13 2 4 14h6l-1 8 9-12h-6Z\"/>',\n    snow: '<path d=\"M7 11h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.1 3.1 4 4 0 0 0 7 11Z\"/><circle cx=\"8\" cy=\"18\" r=\".6\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12\" cy=\"19\" r=\".6\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"16\" cy=\"18\" r=\".6\" fill=\"currentColor\" stroke=\"none\"/>',\n    rainbow: '<path d=\"M3 18a9 9 0 0 1 18 0\"/><path d=\"M6.5 18a5.5 5.5 0 0 1 11 0\"/>',\n    gift: '<rect x=\"4\" y=\"10\" width=\"16\" height=\"10\" rx=\"1.5\"/><line x1=\"4\" y1=\"14\" x2=\"20\" y2=\"14\"/><line x1=\"12\" y1=\"10\" x2=\"12\" y2=\"20\"/><path d=\"M12 10c-2-4-6-3-6-1s3 1 6 1Zm0 0c2-4 6-3 6-1s-3 1-6 1Z\"/>',\n    balloon: '<path d=\"M12 2.8c3.9 0 6.6 2.9 6.6 6.6s-3.2 6.3-6.6 7.3c-3.4-1-6.6-3.6-6.6-7.3S8.1 2.8 12 2.8Z\"/><path d=\"M10.8 18.4 12 16.7l1.2 1.7Z\"/><path d=\"M12 18.4c-1.6 1.4 1.6 2.4 0 4.2\"/><path d=\"M8.6 8.4c.3-1.5 1.3-2.5 2.6-2.8\"/>',\n    fork: '<path d=\"M8.5 2.8v5.4a3.5 3.5 0 0 0 7 0V2.8\"/><path d=\"M12 2.8v5.4\"/><path d=\"M10.8 11.6h2.4l-.3 8.9a.9.9 0 0 1-1.8 0Z\"/>',\n    forkknife: '<path d=\"M3.8 2.8v5.4c0 1.8 1.4 3.2 3.4 3.2s3.4-1.4 3.4-3.2V2.8\"/><path d=\"M7.2 2.8v4.6\"/><path d=\"M5.9 12.2h2.6v7.6a1.3 1.3 0 0 1-2.6 0Z\"/><path d=\"M18.6 2.8c-2.8 1.4-4.4 4.6-4.4 8.6h4.4Z\"/><path d=\"M15.9 12.2h2.6v7.6a1.3 1.3 0 0 1-2.6 0Z\"/>',\n    burger: '<path d=\"M4 10.4c0-3.6 3.6-6 8-6s8 2.4 8 6Z\"/><path d=\"M3.6 12.4c1.4-1 2.8 1 4.2 0s2.8 1 4.2 0 2.8 1 4.2 0 2.8 1 4.2 0\"/><path d=\"M4 13.8h16v2.6H4Z\"/><path d=\"M4.4 17.6h15.2c0 1.6-1.4 2.8-3.2 2.8H7.6c-1.8 0-3.2-1.2-3.2-2.8Z\"/>',\n    pizza: '<path d=\"M12 21 3.6 6.4c2.6-1.6 5.4-2.4 8.4-2.4s5.8.8 8.4 2.4Z\"/><path d=\"M3.6 6.4c2.6-1.6 5.4-2.4 8.4-2.4s5.8.8 8.4 2.4l-1.6 2.8c-2.2-1.2-4.4-1.8-6.8-1.8s-4.6.6-6.8 1.8Z\"/><circle cx=\"10.4\" cy=\"11.6\" r=\"1.3\"/><circle cx=\"13\" cy=\"15.4\" r=\"1.2\"/>',\n    cake: '<path d=\"M3.6 10.6h16.8v9.4H3.6Z\"/><path d=\"M3.6 10.6 13.4 6h7v4.6Z\"/><circle cx=\"16.6\" cy=\"4.2\" r=\"2.2\"/>',\n    drink: '<path d=\"M6.8 9.4h10.4l-1.3 10.9a1.6 1.6 0 0 1-1.6 1.4H9.7a1.6 1.6 0 0 1-1.6-1.4Z\"/><path d=\"M5.8 9.4h12.4V8a1.8 1.8 0 0 0-1.8-1.8H7.6A1.8 1.8 0 0 0 5.8 8Z\"/><path d=\"M12.8 6.2 14.6 2.4h2.6\"/><circle cx=\"10\" cy=\"18.2\" r=\".9\" fill=\"currentColor\"/><circle cx=\"12.3\" cy=\"19.2\" r=\".9\" fill=\"currentColor\"/><circle cx=\"14.4\" cy=\"17.8\" r=\".9\" fill=\"currentColor\"/>',\n    apple: '<path d=\"M12 7.6c-1.6-1.1-4.6-1.3-6.2.6-2 2.3-1.3 6.7.6 9.6 1.4 2.1 3 3 4.2 2.4.9-.4 1.9-.4 2.8 0 1.2.6 2.8-.3 4.2-2.4 1.9-2.9 2.6-7.3.6-9.6-1.6-1.9-4.6-1.7-6.2-.6Z\"/><path d=\"M12 7.6c0-1.8.6-3.2 1.8-4.2\"/><path d=\"M13.4 5c1.2-1.5 3.2-1.8 4.6-1.1-.6 1.6-2.4 2.4-4.6 1.1Z\"/>',\n    strawberry: '<path d=\"M12 20.6c-3.2-1.6-6.6-5.6-6.6-9.2 0-2 1.6-3.3 3.6-3.3 1.2 0 2.2.4 3 .9.8-.5 1.8-.9 3-.9 2 0 3.6 1.3 3.6 3.3 0 3.6-3.4 7.6-6.6 9.2Z\"/><path d=\"M8.4 8.4 7.4 5.6l3 1L12 4.2l1.6 2.4 3-1-1 2.8Z\"/><circle cx=\"9.8\" cy=\"12\" r=\".7\" fill=\"currentColor\"/><circle cx=\"14.2\" cy=\"12\" r=\".7\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"15.2\" r=\".7\" fill=\"currentColor\"/>',\n    grape: '<circle cx=\"7.6\" cy=\"9.4\" r=\"2.8\"/><circle cx=\"12\" cy=\"9.4\" r=\"2.8\"/><circle cx=\"16.4\" cy=\"9.4\" r=\"2.8\"/><circle cx=\"9.8\" cy=\"14\" r=\"2.8\"/><circle cx=\"14.2\" cy=\"14\" r=\"2.8\"/><circle cx=\"12\" cy=\"18.6\" r=\"2.8\"/><path d=\"M12 6.6V3.4\"/><path d=\"M12 4.8c1.4-1.6 3.6-1.9 5-1-1 1.6-3 2.1-5 1Z\"/>',\n    watermelon: '<path d=\"M2.4 8.4h19.2a9.6 9.6 0 0 1-19.2 0Z\"/><path d=\"M4.6 8.4h14.8a7.4 7.4 0 0 1-14.8 0Z\"/><circle cx=\"9.4\" cy=\"11\" r=\".8\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"13\" r=\".8\" fill=\"currentColor\"/><circle cx=\"14.6\" cy=\"11\" r=\".8\" fill=\"currentColor\"/>',\n    orange: '<circle cx=\"12\" cy=\"13.6\" r=\"7\"/><path d=\"M12 6.6c.3-1.9 1.9-3 3.8-2.7-.3 1.9-1.9 3-3.8 2.7Z\"/><path d=\"M8.4 11.4c.4-1.2 1.3-2.1 2.4-2.5\"/>',\n    cherry: '<circle cx=\"8\" cy=\"16.4\" r=\"3\"/><circle cx=\"16\" cy=\"15.4\" r=\"3\"/><path d=\"M8 13.4c.8-4 2.4-7 5.2-9\"/><path d=\"M16 12.4c-.6-3.6-1.4-6.2-2.8-8\"/><path d=\"M13.2 4.4c1.4-1.3 3.6-1.1 4.8.2-1.4 1.1-3.4 1-4.8-.2Z\"/>',\n    idea: '<path d=\"M9 18h6M10 21h4\"/><path d=\"M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5a2.6 2.6 0 0 1 1.1-2.2A6 6 0 0 0 12 3Z\"/>',\n    shoppingbag: '<path d=\"M6 8h12l-1 12H7Z\"/><path d=\"M9 8V6a3 3 0 0 1 6 0v2\"/>',\n    travel: '<path d=\"M21 4 3 11l6 2 2 6 3-4 5 3Z\"/>',\n    train: '<rect x=\"6\" y=\"4\" width=\"12\" height=\"12\" rx=\"4\"/><line x1=\"6\" y1=\"11\" x2=\"18\" y2=\"11\"/><circle cx=\"9\" cy=\"15.5\" r=\".8\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"15\" cy=\"15.5\" r=\".8\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M8 19l-2 2M16 19l2 2\"/>',\n    bus: '<rect x=\"3\" y=\"6\" width=\"18\" height=\"10\" rx=\"2\"/><line x1=\"3\" y1=\"11\" x2=\"21\" y2=\"11\"/><circle cx=\"7.5\" cy=\"18.5\" r=\"1.4\"/><circle cx=\"16.5\" cy=\"18.5\" r=\"1.4\"/>',\n    car: '<path d=\"M4 16V12l2-4h12l2 4v4\"/><path d=\"M4 16h16\"/><circle cx=\"7.5\" cy=\"16.5\" r=\"1.6\"/><circle cx=\"16.5\" cy=\"16.5\" r=\"1.6\"/>',\n    bicycle: '<circle cx=\"6\" cy=\"17\" r=\"3.2\"/><circle cx=\"18\" cy=\"17\" r=\"3.2\"/><path d=\"M6 17l4-9h4l-3 6h7l-3-5\"/>',\n    steamtrain: '<path d=\"M3 6.6h6.4v9.6H3Z\"/><path d=\"M9.4 10h9c1 0 1.8.8 1.8 1.8v4.4H9.4Z\"/><path d=\"M14.4 10V5.6h3v4.4\"/><circle cx=\"6.6\" cy=\"17.4\" r=\"2.4\"/><circle cx=\"15.4\" cy=\"17.4\" r=\"2.4\"/>',\n    metro: '<rect x=\"5\" y=\"3.4\" width=\"14\" height=\"14.6\" rx=\"3.6\"/><path d=\"M7.4 6.2h9.2v5H7.4Z\"/><path d=\"M5 13.6h14\"/><circle cx=\"8.4\" cy=\"15.8\" r=\".9\" fill=\"currentColor\"/><circle cx=\"15.6\" cy=\"15.8\" r=\".9\" fill=\"currentColor\"/><path d=\"M8 18l-2 2.6M16 18l2 2.6\"/>',\n    plane: '<path d=\"M12 2.6c.9 0 1.5.9 1.5 2.2v4.6l7 4.2v2l-7-2v4l2.2 1.8v1.6L12 20.2l-3.7.8v-1.6l2.2-1.8v-4l-7 2v-2l7-4.2V4.8c0-1.3.6-2.2 1.5-2.2Z\"/>',\n    planeside: '<path d=\"M2.6 12.8c0-1.2 1-2.2 2.2-2.2h12.4c2.4 0 4.4 1.4 4.4 3s-2 3-4.4 3H6.6c-2.2 0-4-1.6-4-3.8Z\"/><path d=\"M4.4 10.6 3 4.8h3l3.6 5.8\"/><path d=\"M9.6 14.6 7.2 20.4h3.2l4.6-5.8\"/>',\n    carside: '<path d=\"M2.8 15.8v-2.6c0-1 .6-1.8 1.6-2.1l2.6-.7 2.2-3c.4-.5 1-.8 1.6-.8h4.6c.6 0 1.2.3 1.6.8l2.4 3 1.4.3c.9.2 1.6 1 1.6 2v3.1Z\"/><path d=\"M10.6 8.4h1.8v2.6H8.8Z\"/><path d=\"M14.4 8.4h.8c.3 0 .6.1.8.4l1.6 2.2h-3.2Z\"/><circle cx=\"7.4\" cy=\"16.2\" r=\"2.1\"/><circle cx=\"16.6\" cy=\"16.2\" r=\"2.1\"/>',\n    camera: '<rect x=\"3\" y=\"7\" width=\"18\" height=\"13\" rx=\"2\"/><path d=\"M8 7l1.5-3h5L16 7\"/><circle cx=\"12\" cy=\"13.5\" r=\"4\"/>',\n    location: '<path d=\"M12 21s7-7.2 7-12a7 7 0 0 0-14 0c0 4.8 7 12 7 12Z\"/><circle cx=\"12\" cy=\"9\" r=\"2.3\"/>',\n    pig: '<path d=\"M7.5 8.5 9 6 10.5 8.3M13.5 8.3 15 6 16.5 8.5\"/><circle cx=\"12\" cy=\"13.5\" r=\"6.5\"/><ellipse cx=\"12\" cy=\"15.3\" rx=\"2.3\" ry=\"1.6\"/><circle cx=\"11.1\" cy=\"15.3\" r=\".35\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12.9\" cy=\"15.3\" r=\".35\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"9.6\" cy=\"12\" r=\".5\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"14.4\" cy=\"12\" r=\".5\" fill=\"currentColor\" stroke=\"none\"/>',\n    giraffe: '<line x1=\"9.5\" y1=\"7.8\" x2=\"9\" y2=\"5\"/><circle cx=\"9\" cy=\"4.5\" r=\".7\" fill=\"currentColor\" stroke=\"none\"/><line x1=\"14.5\" y1=\"7.8\" x2=\"15\" y2=\"5\"/><circle cx=\"15\" cy=\"4.5\" r=\".7\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12\" cy=\"13.5\" r=\"6.5\"/><ellipse cx=\"12\" cy=\"16.8\" rx=\"2\" ry=\"1.3\"/><circle cx=\"9.4\" cy=\"12\" r=\".5\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"14.6\" cy=\"12\" r=\".5\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"8\" cy=\"14.5\" r=\".9\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"16\" cy=\"15\" r=\".9\" fill=\"currentColor\" stroke=\"none\"/>',\n    bear: '<circle cx=\"7.3\" cy=\"8.2\" r=\"2.3\"/><circle cx=\"16.7\" cy=\"8.2\" r=\"2.3\"/><circle cx=\"12\" cy=\"13.8\" r=\"6.5\"/><ellipse cx=\"12\" cy=\"16\" rx=\"2.2\" ry=\"1.5\"/><circle cx=\"9.5\" cy=\"12\" r=\".5\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"14.5\" cy=\"12\" r=\".5\" fill=\"currentColor\" stroke=\"none\"/>',\n    monkey: '<circle cx=\"6.3\" cy=\"12.5\" r=\"2.6\"/><circle cx=\"17.7\" cy=\"12.5\" r=\"2.6\"/><circle cx=\"12\" cy=\"13\" r=\"6.5\"/><ellipse cx=\"12\" cy=\"14.7\" rx=\"3.6\" ry=\"3.1\"/><circle cx=\"10\" cy=\"12.8\" r=\".5\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"14\" cy=\"12.8\" r=\".5\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M10.3 16.5q1.7 1.1 3.4 0\"/>',\n    lion: '<line x1=\"17.5\" y1=\"13\" x2=\"19.7\" y2=\"13\"/><line x1=\"15.9\" y1=\"9.1\" x2=\"17.4\" y2=\"7.6\"/><line x1=\"12\" y1=\"7.5\" x2=\"12\" y2=\"5.3\"/><line x1=\"8.1\" y1=\"9.1\" x2=\"6.6\" y2=\"7.6\"/><line x1=\"6.5\" y1=\"13\" x2=\"4.3\" y2=\"13\"/><line x1=\"8.1\" y1=\"16.9\" x2=\"6.6\" y2=\"18.4\"/><line x1=\"12\" y1=\"18.5\" x2=\"12\" y2=\"20.7\"/><line x1=\"15.9\" y1=\"16.9\" x2=\"17.4\" y2=\"18.4\"/><circle cx=\"12\" cy=\"13\" r=\"5.5\"/><ellipse cx=\"12\" cy=\"15.2\" rx=\"2\" ry=\"1.4\"/><circle cx=\"9.9\" cy=\"11.7\" r=\".5\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"14.1\" cy=\"11.7\" r=\".5\" fill=\"currentColor\" stroke=\"none\"/>'\n  };\n// 筆記圖示的貼紙樣式：線條圖示（跟日常記帳同一套）加上塗色和不規則底色，畫法跟童趣風月曆的生日貼紙一樣。\n// App 畫面和主畫面小工具共用這一份；build.py 會把它塞進 page.html 和 kids-notes.js。\n// fill：第幾個圖形要塗什麼顏色（依 ICON_SVGS 裡元素的順序，從 0 開始）；stroke：改線條顏色；chip：底色\nconst STICKER_INK = \"#262261\";\nconst STICKER_CHIP = {\n  yellow: \"#FFF0AF\", orange: \"#FFE2BA\", green: \"#D5F5D0\", blue: \"#CFDDF8\",\n  pink: \"#FBD3D0\", teal: \"#C9F0E9\", purple: \"#E3DAFA\", rose: \"#FFD8E8\",\n};\nconst STICKER_COLORS = {\n  yellow: \"#FFD426\", red: \"#EE3E33\", orange: \"#FF9500\", green: \"#6BD861\", sky: \"#8CC4EE\", blue: \"#3F6FD1\",\n  teal: \"#4FD2C2\", pink: \"#FF9EC4\", lilac: \"#B9A3F0\", white: \"#FFFFFF\", mist: \"#E4E2F2\", balloon: \"#7DCB6E\", milkTea: \"#D9B48F\",\n};\nconst STICKERS = {\n  star: { chip: \"yellow\", fill: { 0: STICKER_COLORS.yellow } },\n  heart: { chip: \"pink\", fill: { 0: STICKER_COLORS.red } },\n  diamond: { chip: \"blue\", fill: { 0: STICKER_COLORS.sky } },\n  music: { chip: \"purple\", fill: { 1: STICKER_COLORS.lilac, 2: STICKER_COLORS.lilac } },\n  pencil: { chip: \"orange\", fill: { 0: STICKER_COLORS.yellow } },\n  pets: { chip: \"rose\", fill: { 0: STICKER_COLORS.pink, 1: STICKER_COLORS.pink, 2: STICKER_COLORS.pink, 3: STICKER_COLORS.pink, 4: STICKER_COLORS.pink } },\n  clothes: { chip: \"green\", fill: { 0: STICKER_COLORS.green } },\n  sun: { chip: \"orange\", fill: { 0: STICKER_COLORS.yellow } },\n  moon: { chip: \"purple\", fill: { 0: STICKER_COLORS.yellow } },\n  cloud: { chip: \"blue\", fill: { 0: STICKER_COLORS.white } },\n  partlycloudy: { chip: \"blue\", fill: { 0: STICKER_COLORS.yellow, 2: STICKER_COLORS.white } },\n  cloudynight: { chip: \"purple\", fill: { 0: STICKER_COLORS.yellow, 1: STICKER_COLORS.white } },\n  overcast: { chip: \"blue\", fill: { 0: STICKER_COLORS.mist } },\n  rain: { chip: \"blue\", fill: { 0: STICKER_COLORS.white }, stroke: { 1: STICKER_COLORS.blue } },\n  thunderstorm: { chip: \"purple\", fill: { 0: STICKER_COLORS.mist }, stroke: { 1: STICKER_COLORS.orange } },\n  lightning: { chip: \"yellow\", fill: { 0: STICKER_COLORS.yellow } },\n  snow: { chip: \"teal\", fill: { 0: STICKER_COLORS.white } },\n  rainbow: { chip: \"yellow\", stroke: { 0: STICKER_COLORS.red, 1: STICKER_COLORS.blue } },\n  gift: { chip: \"blue\", fill: { 0: STICKER_COLORS.sky, 3: STICKER_COLORS.red } },\n  balloon: { chip: \"teal\", fill: { 0: STICKER_COLORS.balloon, 1: STICKER_COLORS.balloon } },\n  fork: { chip: \"orange\", fill: { 0: STICKER_COLORS.white, 2: STICKER_COLORS.white } },\n  drink: { chip: \"teal\", fill: { 0: STICKER_COLORS.milkTea, 1: STICKER_COLORS.white } },\n  idea: { chip: \"yellow\", fill: { 1: STICKER_COLORS.yellow } },\n  shoppingbag: { chip: \"orange\", fill: { 0: STICKER_COLORS.orange } },\n  travel: { chip: \"teal\", fill: { 0: STICKER_COLORS.sky } },\n  train: { chip: \"yellow\", fill: { 0: STICKER_COLORS.red, 2: STICKER_COLORS.yellow, 3: STICKER_COLORS.yellow } },\n  bus: { chip: \"teal\", fill: { 0: STICKER_COLORS.green, 2: STICKER_COLORS.white, 3: STICKER_COLORS.white } },\n  car: { chip: \"blue\", fill: { 0: STICKER_COLORS.yellow, 2: STICKER_COLORS.white, 3: STICKER_COLORS.white } },\n  bicycle: { chip: \"green\", fill: { 0: STICKER_COLORS.white, 1: STICKER_COLORS.white } },\n  camera: { chip: \"purple\", fill: { 0: STICKER_COLORS.lilac, 2: STICKER_COLORS.white } },\n  location: { chip: \"rose\", fill: { 0: STICKER_COLORS.red, 1: STICKER_COLORS.white } },\n  apple: { chip: \"pink\", fill: { 0: \"#EE3E33\", 2: \"#6BD861\" } },\n  strawberry: { chip: \"rose\", fill: { 0: \"#EE3E33\", 1: \"#6BD861\" } },\n  grape: { chip: \"purple\", fill: { 0: \"#9B6BE8\", 1: \"#9B6BE8\", 2: \"#9B6BE8\", 3: \"#9B6BE8\", 4: \"#9B6BE8\", 5: \"#9B6BE8\", 7: \"#6BD861\" } },\n  watermelon: { chip: \"green\", fill: { 0: \"#3FA34D\", 1: \"#FF5A6E\" } },\n  orange: { chip: \"orange\", fill: { 0: \"#FF9500\", 1: \"#6BD861\" } },\n  cherry: { chip: \"rose\", fill: { 0: \"#D9322B\", 1: \"#D9322B\", 4: \"#6BD861\" } },\n  rainboot: { chip: \"teal\", fill: { 0: \"#FFD426\", 1: \"#3F6FD1\" } },\n  flipflop: { chip: \"yellow\", fill: { 0: \"#4FD2C2\" }, stroke: { 1: \"#EE3E33\" } },\n  steamtrain: { chip: \"blue\", fill: { 0: \"#EE3E33\", 1: \"#EE3E33\", 2: \"#FFD426\", 3: \"#FFD426\", 4: \"#FFD426\" } },\n  metro: { chip: \"teal\", fill: { 0: \"#FFFFFF\", 1: \"#8CC4EE\" }, stroke: { 2: \"#4FD2C2\" } },\n  plane: { chip: \"blue\", fill: { 0: \"#FFFFFF\" } },\n  planeside: { chip: \"teal\", fill: { 0: \"#FFFFFF\", 1: \"#EE3E33\", 2: \"#8CC4EE\" } },\n  carside: { chip: \"yellow\", fill: { 0: \"#EE3E33\", 1: \"#FFFFFF\", 2: \"#FFFFFF\", 3: \"#FFFFFF\", 4: \"#FFFFFF\" } },\n  forkknife: { chip: \"orange\", fill: { 0: \"#FFD426\", 2: \"#FFD426\", 3: \"#8CC4EE\", 4: \"#8CC4EE\" } },\n  burger: { chip: \"orange\", fill: { 0: \"#FFC93C\", 2: \"#8B5A3C\", 3: \"#FFC93C\" }, stroke: { 1: \"#3FA34D\" } },\n  pizza: { chip: \"rose\", fill: { 0: \"#FFD426\", 1: \"#FF9500\", 2: \"#EE3E33\", 3: \"#EE3E33\" } },\n  cake: { chip: \"pink\", fill: { 0: \"#FFFFFF\", 1: \"#FF9EC4\", 2: \"#EE3E33\" } },\n};\n// 新增的圖示（24×24，跟其他線條圖示同一個格子）\n// 氣球：球、綁口、線、反光；叉子：叉頭、中間的齒、叉柄；飲料杯：杯身、杯蓋、吸管、珍珠\n// 水果：蘋果、草莓、葡萄、西瓜、柳橙、櫻桃（果實塗色，葉子塗綠）；雨靴：靴身、鞋底、靴口；夾腳拖：鞋底、夾帶\n// 交通：小火車、捷運、飛機（俯視、側面）、小汽車（側面）\n// 餐飲：刀叉、漢堡、披薩、蛋糕\nconst EXTRA_ICON_SVGS = {\n  balloon: '<path d=\"M12 2.8c3.9 0 6.6 2.9 6.6 6.6s-3.2 6.3-6.6 7.3c-3.4-1-6.6-3.6-6.6-7.3S8.1 2.8 12 2.8Z\"/><path d=\"M10.8 18.4 12 16.7l1.2 1.7Z\"/><path d=\"M12 18.4c-1.6 1.4 1.6 2.4 0 4.2\"/><path d=\"M8.6 8.4c.3-1.5 1.3-2.5 2.6-2.8\"/>',\n  fork: '<path d=\"M8.5 2.8v5.4a3.5 3.5 0 0 0 7 0V2.8\"/><path d=\"M12 2.8v5.4\"/><path d=\"M10.8 11.6h2.4l-.3 8.9a.9.9 0 0 1-1.8 0Z\"/>',\n  drink: '<path d=\"M6.8 9.4h10.4l-1.3 10.9a1.6 1.6 0 0 1-1.6 1.4H9.7a1.6 1.6 0 0 1-1.6-1.4Z\"/><path d=\"M5.8 9.4h12.4V8a1.8 1.8 0 0 0-1.8-1.8H7.6A1.8 1.8 0 0 0 5.8 8Z\"/><path d=\"M12.8 6.2 14.6 2.4h2.6\"/><circle cx=\"10\" cy=\"18.2\" r=\".9\" fill=\"currentColor\"/><circle cx=\"12.3\" cy=\"19.2\" r=\".9\" fill=\"currentColor\"/><circle cx=\"14.4\" cy=\"17.8\" r=\".9\" fill=\"currentColor\"/>',\n  apple: '<path d=\"M12 7.6c-1.6-1.1-4.6-1.3-6.2.6-2 2.3-1.3 6.7.6 9.6 1.4 2.1 3 3 4.2 2.4.9-.4 1.9-.4 2.8 0 1.2.6 2.8-.3 4.2-2.4 1.9-2.9 2.6-7.3.6-9.6-1.6-1.9-4.6-1.7-6.2-.6Z\"/><path d=\"M12 7.6c0-1.8.6-3.2 1.8-4.2\"/><path d=\"M13.4 5c1.2-1.5 3.2-1.8 4.6-1.1-.6 1.6-2.4 2.4-4.6 1.1Z\"/>',\n  strawberry: '<path d=\"M12 20.6c-3.2-1.6-6.6-5.6-6.6-9.2 0-2 1.6-3.3 3.6-3.3 1.2 0 2.2.4 3 .9.8-.5 1.8-.9 3-.9 2 0 3.6 1.3 3.6 3.3 0 3.6-3.4 7.6-6.6 9.2Z\"/><path d=\"M8.4 8.4 7.4 5.6l3 1L12 4.2l1.6 2.4 3-1-1 2.8Z\"/><circle cx=\"9.8\" cy=\"12\" r=\".7\" fill=\"currentColor\"/><circle cx=\"14.2\" cy=\"12\" r=\".7\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"15.2\" r=\".7\" fill=\"currentColor\"/>',\n  grape: '<circle cx=\"7.6\" cy=\"9.4\" r=\"2.8\"/><circle cx=\"12\" cy=\"9.4\" r=\"2.8\"/><circle cx=\"16.4\" cy=\"9.4\" r=\"2.8\"/><circle cx=\"9.8\" cy=\"14\" r=\"2.8\"/><circle cx=\"14.2\" cy=\"14\" r=\"2.8\"/><circle cx=\"12\" cy=\"18.6\" r=\"2.8\"/><path d=\"M12 6.6V3.4\"/><path d=\"M12 4.8c1.4-1.6 3.6-1.9 5-1-1 1.6-3 2.1-5 1Z\"/>',\n  watermelon: '<path d=\"M2.4 8.4h19.2a9.6 9.6 0 0 1-19.2 0Z\"/><path d=\"M4.6 8.4h14.8a7.4 7.4 0 0 1-14.8 0Z\"/><circle cx=\"9.4\" cy=\"11\" r=\".8\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"13\" r=\".8\" fill=\"currentColor\"/><circle cx=\"14.6\" cy=\"11\" r=\".8\" fill=\"currentColor\"/>',\n  orange: '<circle cx=\"12\" cy=\"13.6\" r=\"7\"/><path d=\"M12 6.6c.3-1.9 1.9-3 3.8-2.7-.3 1.9-1.9 3-3.8 2.7Z\"/><path d=\"M8.4 11.4c.4-1.2 1.3-2.1 2.4-2.5\"/>',\n  cherry: '<circle cx=\"8\" cy=\"16.4\" r=\"3\"/><circle cx=\"16\" cy=\"15.4\" r=\"3\"/><path d=\"M8 13.4c.8-4 2.4-7 5.2-9\"/><path d=\"M16 12.4c-.6-3.6-1.4-6.2-2.8-8\"/><path d=\"M13.2 4.4c1.4-1.3 3.6-1.1 4.8.2-1.4 1.1-3.4 1-4.8-.2Z\"/>',\n  rainboot: '<path d=\"M6 3.4h6.2v9.8l4.2 1.4c2.4.8 4 2 4 3.4H6Z\"/><path d=\"M5.6 18h15v1.2c0 .8-.6 1.4-1.4 1.4H7c-.8 0-1.4-.6-1.4-1.4Z\"/><path d=\"M5.2 3.4h7.8\"/>',\n  flipflop: '<path d=\"M12 2.6c3 0 4.6 2.6 4.6 6 0 2.2-.6 3.6-.6 5.4 0 2.2 1.2 3.6 1.2 5.4 0 1.8-2 2.8-5.2 2.8s-5.2-1-5.2-2.8c0-1.8 1.2-3.2 1.2-5.4 0-1.8-.6-3.2-.6-5.4 0-3.4 1.6-6 4.6-6Z\"/><path d=\"M12 6.4 8.2 11.8M12 6.4l3.8 5.4\"/>',\n  steamtrain: '<path d=\"M3 6.6h6.4v9.6H3Z\"/><path d=\"M9.4 10h9c1 0 1.8.8 1.8 1.8v4.4H9.4Z\"/><path d=\"M14.4 10V5.6h3v4.4\"/><circle cx=\"6.6\" cy=\"17.4\" r=\"2.4\"/><circle cx=\"15.4\" cy=\"17.4\" r=\"2.4\"/>',\n  metro: '<rect x=\"5\" y=\"3.4\" width=\"14\" height=\"14.6\" rx=\"3.6\"/><path d=\"M7.4 6.2h9.2v5H7.4Z\"/><path d=\"M5 13.6h14\"/><circle cx=\"8.4\" cy=\"15.8\" r=\".9\" fill=\"currentColor\"/><circle cx=\"15.6\" cy=\"15.8\" r=\".9\" fill=\"currentColor\"/><path d=\"M8 18l-2 2.6M16 18l2 2.6\"/>',\n  plane: '<path d=\"M12 2.6c.9 0 1.5.9 1.5 2.2v4.6l7 4.2v2l-7-2v4l2.2 1.8v1.6L12 20.2l-3.7.8v-1.6l2.2-1.8v-4l-7 2v-2l7-4.2V4.8c0-1.3.6-2.2 1.5-2.2Z\"/>',\n  planeside: '<path d=\"M2.6 12.8c0-1.2 1-2.2 2.2-2.2h12.4c2.4 0 4.4 1.4 4.4 3s-2 3-4.4 3H6.6c-2.2 0-4-1.6-4-3.8Z\"/><path d=\"M4.4 10.6 3 4.8h3l3.6 5.8\"/><path d=\"M9.6 14.6 7.2 20.4h3.2l4.6-5.8\"/>',\n  carside: '<path d=\"M2.8 15.8v-2.6c0-1 .6-1.8 1.6-2.1l2.6-.7 2.2-3c.4-.5 1-.8 1.6-.8h4.6c.6 0 1.2.3 1.6.8l2.4 3 1.4.3c.9.2 1.6 1 1.6 2v3.1Z\"/><path d=\"M10.6 8.4h1.8v2.6H8.8Z\"/><path d=\"M14.4 8.4h.8c.3 0 .6.1.8.4l1.6 2.2h-3.2Z\"/><circle cx=\"7.4\" cy=\"16.2\" r=\"2.1\"/><circle cx=\"16.6\" cy=\"16.2\" r=\"2.1\"/>',\n  forkknife: '<path d=\"M3.8 2.8v5.4c0 1.8 1.4 3.2 3.4 3.2s3.4-1.4 3.4-3.2V2.8\"/><path d=\"M7.2 2.8v4.6\"/><path d=\"M5.9 12.2h2.6v7.6a1.3 1.3 0 0 1-2.6 0Z\"/><path d=\"M18.6 2.8c-2.8 1.4-4.4 4.6-4.4 8.6h4.4Z\"/><path d=\"M15.9 12.2h2.6v7.6a1.3 1.3 0 0 1-2.6 0Z\"/>',\n  burger: '<path d=\"M4 10.4c0-3.6 3.6-6 8-6s8 2.4 8 6Z\"/><path d=\"M3.6 12.4c1.4-1 2.8 1 4.2 0s2.8 1 4.2 0 2.8 1 4.2 0 2.8 1 4.2 0\"/><path d=\"M4 13.8h16v2.6H4Z\"/><path d=\"M4.4 17.6h15.2c0 1.6-1.4 2.8-3.2 2.8H7.6c-1.8 0-3.2-1.2-3.2-2.8Z\"/>',\n  pizza: '<path d=\"M12 21 3.6 6.4c2.6-1.6 5.4-2.4 8.4-2.4s5.8.8 8.4 2.4Z\"/><path d=\"M3.6 6.4c2.6-1.6 5.4-2.4 8.4-2.4s5.8.8 8.4 2.4l-1.6 2.8c-2.2-1.2-4.4-1.8-6.8-1.8s-4.6.6-6.8 1.8Z\"/><circle cx=\"10.4\" cy=\"11.6\" r=\"1.3\"/><circle cx=\"13\" cy=\"15.4\" r=\"1.2\"/>',\n  cake: '<path d=\"M3.6 10.6h16.8v9.4H3.6Z\"/><path d=\"M3.6 10.6 13.4 6h7v4.6Z\"/><circle cx=\"16.6\" cy=\"4.2\" r=\"2.2\"/>',\n};\n\n// 不規則色塊的 8 個圓角百分比（同童趣風月曆的 R1–R4），依圖示名稱挑一組、旋轉 ±4 度\nconst STICKER_BLOBS = [[52, 48, 61, 39, 58, 43, 57, 42], [60, 40, 44, 56, 46, 55, 45, 54], [45, 55, 52, 48, 62, 40, 60, 38], [55, 45, 48, 52, 44, 58, 42, 56]];\nfunction stickerHash(s) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }\n\n// 不規則色塊的 SVG 路徑（寬 w、高 h，左上角在 0,0）\nfunction blobPathD(w, h, r) {\n  const [a, b, c, d, e, f, g, k] = r.map((v) => v / 100);\n  return `M${a * w} 0H${w - b * w}A${b * w} ${f * h} 0 0 1 ${w} ${f * h}V${h - g * h}A${c * w} ${g * h} 0 0 1 ${w - c * w} ${h}`\n    + `H${d * w}A${d * w} ${k * h} 0 0 1 0 ${h - k * h}V${e * h}A${a * w} ${e * h} 0 0 1 ${a * w} 0Z`;\n}\n\n// 一個圖示的完整貼紙 SVG（viewBox 24×24）：底下不規則色塊，上面是塗好色的線條圖示\n// 貼紙底色跟它放上去的卡片同色時看不出來：on 是卡片的顏色（名稱如 \"orange\"，或色碼），同色就回傳 true\nfunction stickerClash(key, on) {\n  if (!on) return false;\n  const chip = (STICKERS[key] || { chip: \"yellow\" }).chip;\n  return on === chip || String(on).toLowerCase() === STICKER_CHIP[chip].toLowerCase();\n}\n// on：放在什麼顏色的卡片上（可省略）；跟貼紙底色一樣時底色改白色\nfunction stickerSVG(key, svgs, on) {\n  const spec = STICKERS[key] || { chip: \"yellow\", fill: {} };\n  const inner = svgs[key] || svgs.star;\n  let i = 0;\n  const body = inner.replace(/<(\\w+)([^>]*?)\\/>/g, (m, tag, attrs) => {\n    const idx = i++;\n    if (/fill=\"currentColor\"/.test(attrs)) return `<${tag}${attrs.replace('fill=\"currentColor\"', `fill=\"${STICKER_INK}\"`)}/>`;\n    const fill = spec.fill && spec.fill[idx] ? spec.fill[idx] : \"none\";\n    const stroke = spec.stroke && spec.stroke[idx] ? ` stroke=\"${spec.stroke[idx]}\" stroke-width=\"2.8\"` : \"\";\n    return `<${tag}${attrs} fill=\"${fill}\"${stroke}/>`;\n  });\n  const h = stickerHash(key), deg = (h % 9) - 4;\n  // 寫明寬高，畫成 PNG 時才不會被當成 300×150 而變形\n  return `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"96\" height=\"96\" viewBox=\"0 0 24 24\">`\n    + `<path d=\"${blobPathD(22, 22, STICKER_BLOBS[h % 4])}\" transform=\"translate(1 1) rotate(${deg} 11 11)\" fill=\"${stickerClash(key, on) ? \"#FFFFFF\" : STICKER_CHIP[spec.chip]}\"/>`\n    + `<g transform=\"translate(4.4 4.4) scale(.633)\" stroke=\"${STICKER_INK}\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">${body}</g>`\n    + `</svg>`;\n}\nObject.assign(ICON_SVGS, EXTRA_ICON_SVGS);\nconst BOOT = /*BOOT*/null;\n</script>\n<script>\n// Scriptable 打開這一頁時，BOOT 會帶入這台 iPhone 上的帳本、分類、小動物圖示和左上角圖示\nconst boot = BOOT || { data: null, iconImages: {}, logos: [] };\nconst ICON_IMAGES = boot.iconImages || {};\nconst COLORS = [\"yellow\", \"orange\", \"green\", \"blue\", \"pink\", \"teal\", \"purple\", \"rose\"];\nconst COLOR_NAMES = { yellow: \"黃\", orange: \"橘\", green: \"綠\", blue: \"藍\", pink: \"粉\", teal: \"青\", purple: \"紫\", rose: \"桃紅\" };\nconst STRONG = { yellow: \"#FFD426\", orange: \"#FF9500\", green: \"#6BD861\", blue: \"#3F6FD1\", pink: \"#FF9EC4\", teal: \"#4FD2C2\", purple: \"#8E6FD8\", rose: \"#F2649E\" };\nconst WEEK = \"日一二三四五六\";\nconst $ = (s) => document.querySelector(s);\nconst esc = (s) => String(s).replace(/[&<>\"]/g, (c) => ({ \"&\": \"&amp;\", \"<\": \"&lt;\", \">\": \"&gt;\", '\"': \"&quot;\" }[c]));\nconst uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);\nconst bg = (c) => `var(--${COLORS.includes(c) ? c : \"yellow\"}-100)`;\nconst fmt = (n) => (Number(n) < 0 ? \"−$\" : \"$\") + Math.abs(Number(n)).toLocaleString(\"en-US\", { maximumFractionDigits: 2 });\nconst p2 = (n) => String(n).padStart(2, \"0\");\nconst dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };\nconst dayLabel = (ts) => {\n  const d = new Date(ts), t = new Date();\n  const diff = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);\n  const base = `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）`;\n  return diff === 0 ? \"今天 \" + base : diff === 1 ? \"昨天 \" + base : (d.getFullYear() !== t.getFullYear() ? d.getFullYear() + \"/\" : \"\") + base;\n};\nconst hm = (ts) => { const d = new Date(ts); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };\n\n// 第一次打開：一本「日常」和 7 個分類\nfunction starter() {\n  return {\n    version: 1,\n    books: [{ id: \"b1\", name: \"日常\", icon: \"bear\", color: \"yellow\", entries: [] }],\n    cats: [\n      { id: \"c1\", name: \"餐飲\", color: \"orange\", icon: \"fork\" }, { id: \"c2\", name: \"交通\", color: \"blue\", icon: \"bus\" },\n      { id: \"c3\", name: \"購物\", color: \"pink\", icon: \"shoppingbag\" }, { id: \"c4\", name: \"日用\", color: \"green\", icon: \"idea\" },\n      { id: \"c5\", name: \"娛樂\", color: \"purple\", icon: \"music\" }, { id: \"c6\", name: \"醫療\", color: \"teal\", icon: \"heart\" },\n      { id: \"c7\", name: \"孩子\", color: \"yellow\", icon: \"balloon\" },\n    ],\n    lastBook: \"b1\",\n  };\n}\nlet data = boot.data || starter();\nconst bookOf = (id) => data.books.find((b) => b.id === id);\nconst catOf = (id) => data.cats.find((c) => c.id === id);\nconst sum = (list) => list.reduce((s, e) => s + Number(e.amt || 0), 0);\n\n// 小動物用圖片，其他是塗好色、有不規則底色的貼紙（跟筆記一樣）\n// on：放在什麼顏色的卡片上，貼紙底色跟它一樣時改白色\nfunction icon(key, on) {\n  if (ICON_IMAGES[key]) return `<span class=\"ic\"><img src=\"${ICON_IMAGES[key]}\" alt=\"\"></span>`;\n  return `<span class=\"ic\">${stickerSVG(ICON_SVGS[key] ? key : \"star\", ICON_SVGS, on)}</span>`;\n}\n\n/* ---------- 跟 Scriptable 溝通：要做的事放進 outbox，再用 kidsledger:// 網址叫 Scriptable 來拿 ---------- */\nlet outbox = [], pingTimer = null, saveTimer = null;\nfunction ping() {\n  location.href = \"kidsledger://ping?\" + Date.now();\n  clearTimeout(pingTimer);\n  pingTimer = setTimeout(() => { if (outbox.length) ping(); }, 1500);\n}\nfunction send(cmd) { outbox.push(cmd); ping(); }\nwindow.__takeOutbox = () => { const out = outbox; outbox = []; return JSON.stringify(out); };\n// 有改動就在 0.3 秒後存一次\nfunction changed() {\n  clearTimeout(saveTimer);\n  saveTimer = setTimeout(() => { outbox = outbox.filter((c) => c.type !== \"save\"); send({ type: \"save\", data }); }, 300);\n}\n// 關掉畫面前 Scriptable 會直接呼叫這個，確保最後的改動有存到\nwindow.__finalState = () => JSON.stringify(data);\n\nfunction toast(msg, undo) {\n  const t = $(\"#toast\");\n  t.innerHTML = esc(msg) + (undo ? `<button id=\"undo\">復原</button>` : \"\");\n  t.hidden = false;\n  if (undo) $(\"#undo\").onclick = () => { undo(); t.hidden = true; };\n  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, undo ? 5000 : 2200);\n}\nwindow.__toast = toast;\n\n/* ---------- 畫面 ---------- */\nlet view = { page: \"home\", book: null }, managing = false;\n\nfunction render() {\n  if (view.page === \"book\" && !bookOf(view.book)) view = { page: \"home\" };\n  view.page === \"home\" ? renderHome() : renderBook();\n}\n\nfunction logoHTML() {\n  return (boot.logos || []).length ? `<span class=\"logo\">${boot.logos.map((u) => `<img src=\"${u}\" alt=\"\">`).join(\"\")}</span>` : \"\";\n}\n\nfunction renderHome() {\n  $(\"#app\").innerHTML = `\n    <header class=\"top\">${logoHTML()}<h1>我的帳本</h1>\n      <button class=\"ibtn ${managing ? \"on\" : \"\"}\" id=\"manage\" aria-label=\"管理帳本\">${managing ? \"✓\" : \"✎\"}</button></header>\n    ${managing ? `<p class=\"hint\">點帳本可以改名字、圖示和顏色；按左上角的 ✕ 刪除整本。</p><button class=\"dashed\" id=\"corner\">換小工具右上角的照片</button>` : \"\"}\n    <div class=\"books\">${data.books.map((b) => `\n      <button class=\"book\" style=\"background:${bg(b.color)}\" data-book=\"${esc(b.id)}\">\n        ${managing ? `<span class=\"del\" data-del=\"${esc(b.id)}\" aria-label=\"刪除 ${esc(b.name)}\">✕</span>` : \"\"}\n        ${icon(b.icon)}<span class=\"t\"><strong>${esc(b.name)}</strong><small>${b.entries.length} 筆</small></span>\n        <span class=\"money\">${fmt(sum(b.entries))}</span></button>`).join(\"\")}\n    </div>\n    <button class=\"dashed\" id=\"newbook\">＋ 新帳本</button>`;\n  $(\"#bottom\").innerHTML = \"\";\n  $(\"#manage\").onclick = () => { managing = !managing; renderHome(); };\n  $(\"#newbook\").onclick = () => openBookEditor(null);\n  if ($(\"#corner\")) $(\"#corner\").onclick = () => send({ type: \"corner\" });\n  $(\"#app\").querySelector(\".books\").onclick = (e) => {\n    const del = e.target.closest(\"[data-del]\");\n    if (del) { deleteBook(del.dataset.del); return; }\n    const b = e.target.closest(\"[data-book]\"); if (!b) return;\n    if (managing) openBookEditor(bookOf(b.dataset.book));\n    else { view = { page: \"book\", book: b.dataset.book }; data.lastBook = b.dataset.book; changed(); render(); window.scrollTo(0, 0); }\n  };\n}\n\nlet armedDelete = null;\nfunction deleteBook(id) {\n  const b = bookOf(id);\n  if (armedDelete !== id) { armedDelete = id; toast(`再按一次 ✕ 刪除「${b.name}」（${b.entries.length} 筆）`); setTimeout(() => { if (armedDelete === id) armedDelete = null; }, 4000); return; }\n  armedDelete = null;\n  const idx = data.books.indexOf(b);\n  data.books.splice(idx, 1);\n  if (!data.books.length) data.books.push({ id: uid(\"b\"), name: \"日常\", icon: \"bear\", color: \"yellow\", entries: [] });\n  if (data.lastBook === id) data.lastBook = data.books[0].id;\n  changed(); renderHome();\n  toast(`已刪除「${b.name}」`, () => { data.books.splice(idx, 0, b); changed(); renderHome(); });\n}\n\n// 記錄卡片的顏色：先用分類的顏色，跟前面 4 筆有重複時改用附近還沒用過的顏色（同一個分類連著記也不會整排同色）\nconst SPREAD = [\"yellow\", \"blue\", \"pink\", \"green\", \"purple\", \"orange\", \"rose\", \"teal\"];\nfunction spreadColors(list, catColor) {\n  const out = [];\n  list.forEach((e, i) => {\n    const near = out.slice(Math.max(0, i - 4));\n    let c = catColor(e) || \"yellow\";\n    if (near.includes(c)) c = SPREAD.find(x => !near.includes(x)) || c;\n    out.push(c);\n  });\n  return out;\n}\n\nfunction renderBook() {\n  const b = bookOf(view.book);\n  const list = [...b.entries].sort((x, y) => y.ts - x.ts);\n  let html = \"\", day = \"\";\n  const colors = spreadColors(list, (e) => (catOf(e.cat) || {}).color);\n  for (const [i, e] of list.entries()) {\n    const k = dayKey(e.ts);\n    if (k !== day) {\n      day = k;\n      html += `<div class=\"day\">${dayLabel(e.ts)}<em class=\"money\">${fmt(sum(list.filter((x) => dayKey(x.ts) === k)))}</em></div>`;\n    }\n    const c = catOf(e.cat) || { name: \"未分類\", color: \"yellow\", icon: \"star\" };\n    // 往左滑會露出後面紅色的「刪除」\n    html += `<div class=\"swipe\" data-e=\"${esc(e.id)}\"><button class=\"swdel\" data-del=\"${esc(e.id)}\">刪除</button>\n      <button class=\"item\" style=\"background:${bg(colors[i])}\">${icon(c.icon, colors[i])}\n      <span class=\"t\"><strong>${esc(e.note || c.name)}</strong><small>${esc(c.name)}・${hm(e.ts)}</small></span>\n      <span class=\"money${e.amt < 0 ? \" neg\" : \"\"}\">${(e.amt < 0 ? \"−\" : \"\") + Math.abs(Number(e.amt)).toLocaleString(\"en-US\", { maximumFractionDigits: 2 })}</span></button></div>`;\n  }\n  $(\"#app\").innerHTML = `\n    <header class=\"top\"><button class=\"ibtn\" id=\"back\" aria-label=\"回到帳本列表\">‹</button>${icon(b.icon)}<h1>${esc(b.name)}</h1></header>\n    <div class=\"total\"><span>${b.entries.length} 筆，總共</span><span class=\"money\">${fmt(sum(b.entries))}</span></div>\n    ${list.length ? `<div class=\"items\">${html}</div>` : `<p class=\"empty\">還沒有記錄<br>按下面的「＋ 記一筆」開始</p>`}`;\n  $(\"#bottom\").innerHTML = `<div class=\"in\"><button class=\"add\" id=\"add\">＋ 記一筆</button>\n    <div class=\"tools\"><button class=\"go\" id=\"export\">匯出 Excel</button><button id=\"card\">圖卡</button><button id=\"clear\">清空</button></div></div>`;\n  $(\"#back\").onclick = () => { view = { page: \"home\" }; render(); };\n  $(\"#add\").onclick = () => openEntry(b, null);\n  const items = $(\"#app\").querySelector(\".items\");\n  if (items) setupSwipe(items, b);\n  items?.addEventListener(\"click\", (e) => {\n    const del = e.target.closest(\"[data-del]\");\n    if (del) { quickDelete(b, del.dataset.del); return; }\n    const sw = e.target.closest(\".swipe\"); if (!sw) return;\n    if (sw.classList.contains(\"open\")) { closeSwipes(); return; } // 滑開的時候點一下是收回去\n    openEntry(b, b.entries.find((x) => x.id === sw.dataset.e));\n  });\n  $(\"#export\").onclick = () => {\n    if (!b.entries.length) { toast(\"這本還沒有記錄\"); return; }\n    send({ type: \"file\", name: `${b.name}-${dayKey(Date.now())}.xlsx`, b64: xlsx(b) });\n  };\n  $(\"#card\").onclick = () => {\n    if (!b.entries.length) { toast(\"這本還沒有記錄\"); return; }\n    toast(\"正在畫圖卡…\");\n    exportCard(b).then((b64) => send({ type: \"image\", b64 })).catch((e) => toast(\"圖卡畫不出來：\" + e));\n  };\n  $(\"#clear\").onclick = () => clearBook(b);\n}\n\n// 匯出 Excel：日期、時間、帳本、分類、金額、備註，舊的在上面（跟 Excel 帳冊一樣由上往下）\n// 自己組一個最小的 .xlsx（其實是 zip 檔：幾個 XML 不壓縮直接包起來），金額存成數字，Excel 可以直接加總\nfunction rowsOf(b) {\n  return [...b.entries].sort((x, y) => x.ts - y.ts).map((e) => {\n    const d = new Date(e.ts);\n    return [`${d.getFullYear()}/${p2(d.getMonth() + 1)}/${p2(d.getDate())}`, hm(e.ts), b.name, (catOf(e.cat) || { name: \"未分類\" }).name, Number(e.amt), e.note || \"\"];\n  });\n}\nfunction xlsx(b) {\n  const x = (v) => String(v).replace(/[&<>\"]/g, (c) => ({ \"&\": \"&amp;\", \"<\": \"&lt;\", \">\": \"&gt;\", '\"': \"&quot;\" }[c])).replace(/[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]/g, \"\");\n  const rows = [[\"日期\", \"時間\", \"帳本\", \"分類\", \"金額\", \"備註\"], ...rowsOf(b)];\n  const sheetRows = rows.map((r, ri) => `<row r=\"${ri + 1}\">${r.map((v, ci) => {\n    const ref = \"ABCDEF\"[ci] + (ri + 1), st = ri === 0 ? ' s=\"1\"' : \"\";\n    return typeof v === \"number\" ? `<c r=\"${ref}\"${st}><v>${v}</v></c>` : `<c r=\"${ref}\" t=\"inlineStr\"${st}><is><t xml:space=\"preserve\">${x(v)}</t></is></c>`;\n  }).join(\"\")}</row>`).join(\"\");\n  const head = '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>';\n  const files = {\n    \"[Content_Types].xml\": head + '<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/><Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/></Types>',\n    \"_rels/.rels\": head + '<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>',\n    \"xl/workbook.xml\": head + `<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"${x(b.name.replace(/[\\\\/?*\\[\\]:]/g, \" \").slice(0, 31) || \"記帳\")}\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>`,\n    \"xl/_rels/workbook.xml.rels\": head + '<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/></Relationships>',\n    \"xl/styles.xml\": head + '<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><fonts count=\"2\"><font><sz val=\"12\"/><name val=\"Calibri\"/></font><font><b/><sz val=\"12\"/><name val=\"Calibri\"/></font></fonts><fills count=\"2\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill></fills><borders count=\"1\"><border/></borders><cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs><cellXfs count=\"2\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/><xf numFmtId=\"0\" fontId=\"1\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyFont=\"1\"/></cellXfs><cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles></styleSheet>',\n    \"xl/worksheets/sheet1.xml\": head + `<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><cols><col min=\"1\" max=\"1\" width=\"12\" customWidth=\"1\"/><col min=\"2\" max=\"2\" width=\"8\" customWidth=\"1\"/><col min=\"3\" max=\"5\" width=\"10\" customWidth=\"1\"/><col min=\"6\" max=\"6\" width=\"28\" customWidth=\"1\"/></cols><sheetData>${sheetRows}</sheetData></worksheet>`,\n  };\n  return zipBase64(files);\n}\n// 不壓縮的 zip（STORE）：每個檔案一個 local header，最後放目錄\nfunction zipBase64(files) {\n  const enc = new TextEncoder(), table = [];\n  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }\n  const crc32 = (u) => { let c = 0xFFFFFFFF; for (const v of u) c = table[(c ^ v) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };\n  const le = (n, size) => { const a = []; for (let i = 0; i < size; i++) a.push((n >>> (8 * i)) & 0xFF); return a; };\n  const parts = [], central = []; let offset = 0;\n  for (const [name, text] of Object.entries(files)) {\n    const nameU = enc.encode(name), data = enc.encode(text), crc = crc32(data);\n    // 版本、旗標（UTF-8 檔名）、不壓縮、時間、日期、CRC、大小、大小、檔名長度、額外欄位長度\n    const common = [...le(20, 2), ...le(0x0800, 2), ...le(0, 2), ...le(0, 2), ...le(0x21, 2), ...le(crc, 4), ...le(data.length, 4), ...le(data.length, 4), ...le(nameU.length, 2), ...le(0, 2)];\n    const local = new Uint8Array([...le(0x04034b50, 4), ...common, ...nameU]);\n    parts.push(local, data);\n    central.push(new Uint8Array([...le(0x02014b50, 4), ...le(20, 2), ...common, ...le(0, 2), ...le(0, 2), ...le(0, 2), ...le(0, 4), ...le(offset, 4), ...nameU]));\n    offset += local.length + data.length;\n  }\n  const cdSize = central.reduce((s, c) => s + c.length, 0);\n  const end = new Uint8Array([...le(0x06054b50, 4), ...le(0, 2), ...le(0, 2), ...le(central.length, 2), ...le(central.length, 2), ...le(cdSize, 4), ...le(offset, 4), ...le(0, 2)]);\n  const all = new Uint8Array(offset + cdSize + end.length); let pos = 0;\n  for (const u of [...parts, ...central, end]) { all.set(u, pos); pos += u.length; }\n  let bin = \"\"; for (let i = 0; i < all.length; i += 0x8000) bin += String.fromCharCode.apply(null, all.subarray(i, i + 0x8000));\n  return btoa(bin);\n}\n\n// 圖卡：把帳本畫面原樣畫成一張圖（從帳本圖示和名稱，到最後一筆記錄；不含返回鍵和下面的按鈕），回傳 PNG 的 base64\n// 每一筆都會畫進去，記錄再多也不會被切掉；尺寸、顏色、字型都跟畫面一樣，寬 390 點畫成 3 倍\nconst CARD_HEX = { yellow: \"#FFF0AF\", orange: \"#FFE2BA\", green: \"#D5F5D0\", blue: \"#CFDDF8\", pink: \"#FBD3D0\", teal: \"#C9F0E9\", purple: \"#E3DAFA\", rose: \"#FFD8E8\" };\nconst loadImg = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });\nconst iconSrc = (key, on) => ICON_IMAGES[key] || \"data:image/svg+xml;charset=utf-8,\" + encodeURIComponent(stickerSVG(ICON_SVGS[key] ? key : \"star\", ICON_SVGS, on));\nfunction rrect(ctx, x, y, w, h, r) {\n  ctx.beginPath(); ctx.moveTo(x + r, y);\n  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);\n  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();\n}\nfunction blobPath(ctx, cx, cy, w, h) { // 跟畫面背景一樣的不規則色塊\n  const r = [52, 48, 61, 39, 58, 43, 57, 42].map((v) => v / 100), x = cx - w / 2, y = cy - h / 2;\n  ctx.beginPath(); ctx.moveTo(x + r[0] * w, y); ctx.lineTo(x + w - r[1] * w, y);\n  ctx.ellipse(x + w - r[1] * w, y + r[5] * h, r[1] * w, r[5] * h, 0, -Math.PI / 2, 0); ctx.lineTo(x + w, y + h - r[6] * h);\n  ctx.ellipse(x + w - r[2] * w, y + h - r[6] * h, r[2] * w, r[6] * h, 0, 0, Math.PI / 2); ctx.lineTo(x + r[3] * w, y + h);\n  ctx.ellipse(x + r[3] * w, y + h - r[7] * h, r[3] * w, r[7] * h, 0, Math.PI / 2, Math.PI); ctx.lineTo(x, y + r[4] * h);\n  ctx.ellipse(x + r[0] * w, y + r[4] * h, r[0] * w, r[4] * h, 0, Math.PI, Math.PI * 1.5); ctx.closePath();\n}\nfunction fitText(ctx, text, maxW) {\n  if (ctx.measureText(text).width <= maxW) return text;\n  let t = text; while (t.length > 1 && ctx.measureText(t + \"…\").width > maxW) t = t.slice(0, -1);\n  return t + \"…\";\n}\nasync function exportCard(b) {\n  const list = [...b.entries].sort((x, y) => y.ts - x.ts);\n  const sans = '\"Noto Sans TC\", -apple-system, \"PingFang TC\", sans-serif', disp = 'Gluten, \"Noto Sans TC\", sans-serif';\n  const all = b.name + \"筆總共今天昨天\" + list.map((e) => (e.note || \"\") + (catOf(e.cat) || { name: \"未分類\" }).name).join(\"\");\n  try { await Promise.all([document.fonts.load(`900 24px \"Noto Sans TC\"`, all), document.fonts.load(`700 14px \"Noto Sans TC\"`, all), document.fonts.load(`800 20px Gluten`, \"$0123456789,.\")]); } catch (e) {}\n  const imgs = {};\n  imgs[b.icon] = await loadImg(iconSrc(b.icon)).catch(() => null);\n  // 記錄卡片是分類的顏色：同一個圖示放在不同顏色上可能要白底，所以依「圖示|顏色」分開載入\n  const colors = spreadColors(list, (e) => (catOf(e.cat) || {}).color), colorOf = new Map(list.map((e, i) => [e, colors[i]]));\n  for (const e of list) { const c = catOf(e.cat) || { icon: \"star\" }, cc = colorOf.get(e), k = c.icon + \"|\" + cc; if (!(k in imgs)) imgs[k] = await loadImg(iconSrc(c.icon, cc)).catch(() => null); }\n\n  // 先算高度：上下留白 24、標題 44、總額 58、每天一行日期 28、每筆 58，區塊間距 14、記錄間距 8\n  const W = 390, S = 3, side = 26, inner = W - side * 2; // 左右各留 26，卡片不會壓到兩邊的色塊\n  const days = []; for (const e of list) { const k = dayKey(e.ts); if (!days.length || days[days.length - 1].k !== k) days.push({ k, items: [] }); days[days.length - 1].items.push(e); }\n  let H = 24 + 44 + 14 + 58;\n  for (const d of days) H += 14 + 28 + 8 + d.items.length * 58 + (d.items.length - 1) * 8;\n  H += 28;\n  const cv = document.createElement(\"canvas\"); cv.width = W * S; cv.height = H * S;\n  const ctx = cv.getContext(\"2d\"); ctx.scale(S, S);\n  // 背景：米白紙和彩色色塊\n  ctx.fillStyle = \"#FFFCEF\"; ctx.fillRect(0, 0, W, H);\n  // 色塊都停在卡片外面：右上黃色在總額上面、左邊綠色在 26 以內、右下青色在最後一筆下面\n  ctx.fillStyle = \"#FFD426\"; blobPath(ctx, W + 4, 6, 150, 120); ctx.fill();\n  ctx.fillStyle = \"#D5F5D0\"; blobPath(ctx, -22, Math.min(H * 0.45, 420), 80, 130); ctx.fill();\n  ctx.fillStyle = \"#C9F0E9\"; blobPath(ctx, W + 6, H + 22, 130, 80); ctx.fill();\n  let y = 24;\n  // 標題：帳本圖示 + 名稱\n  if (imgs[b.icon]) { ctx.save(); if (ICON_IMAGES[b.icon]) { ctx.beginPath(); ctx.arc(side + 20, y + 22, 20, 0, Math.PI * 2); ctx.clip(); } ctx.drawImage(imgs[b.icon], side, y + 2, 40, 40); ctx.restore(); }\n  ctx.fillStyle = \"#262261\"; ctx.font = `900 24px ${sans}`; ctx.textBaseline = \"middle\";\n  ctx.fillText(fitText(ctx, b.name, inner - 52), side + 52, y + 23);\n  y += 44 + 14;\n  // 總額\n  ctx.fillStyle = \"#FFF0AF\"; rrect(ctx, side, y, inner, 58, 22); ctx.fill();\n  ctx.fillStyle = \"#5A5788\"; ctx.font = `700 14px ${sans}`; ctx.fillText(`${b.entries.length} 筆，總共`, side + 16, y + 31);\n  ctx.fillStyle = \"#5A5788\"; ctx.font = `800 32px ${disp}`; ctx.textAlign = \"right\"; ctx.fillText(fmt(sum(b.entries)), W - side - 16, y + 31); ctx.textAlign = \"left\";\n  y += 58;\n  // 每一天：日期 + 小計，下面是那天的記錄\n  for (const d of days) {\n    y += 14;\n    ctx.fillStyle = \"#262261\"; ctx.font = `900 14px ${sans}`; ctx.fillText(dayLabel(d.items[0].ts), side + 4, y + 16);\n    ctx.fillStyle = \"#5A5788\"; ctx.font = `800 14px ${disp}`; ctx.textAlign = \"right\"; ctx.fillText(fmt(sum(d.items)), W - side - 4, y + 16); ctx.textAlign = \"left\";\n    y += 28 + 8;\n    d.items.forEach((e, i) => {\n      const c = catOf(e.cat) || { name: \"未分類\", color: \"yellow\", icon: \"star\" };\n      const cc = colorOf.get(e);\n      ctx.fillStyle = CARD_HEX[cc] || CARD_HEX.yellow; rrect(ctx, side, y, inner, 58, 18); ctx.fill();\n      const im = imgs[c.icon + \"|\" + cc];\n      if (im) { ctx.save(); if (ICON_IMAGES[c.icon]) { ctx.beginPath(); ctx.arc(side + 12 + 17, y + 29, 17, 0, Math.PI * 2); ctx.clip(); } ctx.drawImage(im, side + 12, y + 12, 34, 34); ctx.restore(); }\n      ctx.fillStyle = e.amt < 0 ? \"#17705F\" : \"#262261\"; ctx.font = `800 20px ${disp}`; ctx.textAlign = \"right\";\n      const amt = (e.amt < 0 ? \"−\" : \"\") + Math.abs(Number(e.amt)).toLocaleString(\"en-US\", { maximumFractionDigits: 2 });\n      ctx.fillText(amt, W - side - 12, y + 30); const aw = ctx.measureText(amt).width; ctx.textAlign = \"left\"; ctx.fillStyle = \"#262261\";\n      ctx.font = `900 16px ${sans}`; ctx.fillText(fitText(ctx, e.note || c.name, inner - 58 - aw - 24), side + 58, y + 21);\n      ctx.fillStyle = \"#5A5788\"; ctx.font = `700 12.5px ${sans}`; ctx.fillText(`${c.name}・${hm(e.ts)}`, side + 58, y + 41);\n      y += 58 + (i < d.items.length - 1 ? 8 : 0);\n    });\n  }\n  return cv.toDataURL(\"image/png\").split(\",\")[1];\n}\n\n// 往左滑刪除：滑過 40 點就停在打開的位置，露出「刪除」；按刪除後 5 秒內可以復原\nconst SWIPE_W = 84;\nfunction closeSwipes(except) {\n  document.querySelectorAll(\".swipe.open\").forEach((sw) => { if (sw !== except) { sw.classList.remove(\"open\"); sw.querySelector(\".item\").style.transform = \"\"; } });\n}\nfunction setupSwipe(list, b) {\n  let sw = null, x0 = 0, y0 = 0, dx = 0, horiz = null;\n  list.addEventListener(\"touchstart\", (e) => {\n    sw = e.target.closest(\".swipe\"); if (!sw) return;\n    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; horiz = null;\n    closeSwipes(sw);\n  }, { passive: true });\n  list.addEventListener(\"touchmove\", (e) => {\n    if (!sw) return;\n    const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;\n    if (horiz === null && Math.abs(mx) + Math.abs(my) > 8) horiz = Math.abs(mx) > Math.abs(my);\n    if (!horiz) return;\n    e.preventDefault();\n    sw.classList.add(\"drag\");\n    const base = sw.classList.contains(\"open\") ? -SWIPE_W : 0;\n    dx = Math.max(-SWIPE_W - 20, Math.min(0, base + mx));\n    const it = sw.querySelector(\".item\"); it.style.transition = \"none\"; it.style.transform = `translateX(${dx}px)`;\n  }, { passive: false });\n  list.addEventListener(\"touchend\", () => {\n    if (!sw || !horiz) { sw = null; return; }\n    const it = sw.querySelector(\".item\"); it.style.transition = \"\";\n    sw.classList.remove(\"drag\");\n    const open = dx < -40;\n    sw.classList.toggle(\"open\", open);\n    it.style.transform = open ? `translateX(${-SWIPE_W}px)` : \"\";\n    sw = null;\n  });\n}\nfunction quickDelete(b, id) {\n  const idx = b.entries.findIndex((x) => x.id === id); if (idx < 0) return;\n  const entry = b.entries[idx];\n  b.entries.splice(idx, 1); changed(); render();\n  toast(\"已刪除這筆\", () => { b.entries.splice(idx, 0, entry); changed(); render(); });\n}\n\nlet armedClear = null;\nfunction clearBook(b) {\n  if (!b.entries.length) { toast(\"這本已經是空的\"); return; }\n  if (armedClear !== b.id) {\n    armedClear = b.id;\n    const btn = $(\"#clear\"); btn.textContent = \"確定清空\"; btn.classList.add(\"warn\");\n    setTimeout(() => { if (armedClear === b.id) { armedClear = null; if (btn.isConnected) { btn.textContent = \"清空\"; btn.classList.remove(\"warn\"); } } }, 4000);\n    return;\n  }\n  armedClear = null;\n  const old = b.entries; b.entries = [];\n  changed(); render();\n  toast(`已清空 ${old.length} 筆`, () => { b.entries = old.concat(b.entries); changed(); render(); });\n}\n\n/* ---------- 面板 ---------- */\nfunction openSheet(html, onMount) {\n  const s = $(\"#scrim\");\n  s.innerHTML = `<div class=\"sheet\" role=\"dialog\" aria-modal=\"true\">${html}</div>`;\n  s.hidden = false;\n  onMount(s.firstElementChild);\n}\nfunction closeSheet() { $(\"#scrim\").hidden = true; $(\"#scrim\").innerHTML = \"\"; }\n$(\"#scrim\").addEventListener(\"click\", (e) => { if (e.target.id === \"scrim\") closeSheet(); });\n\n// 記一筆／修改一筆\nconst toLocalInput = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${hm(ts)}`; };\nlet lastCat = null;\nfunction openEntry(b, entry) {\n  // amt 只放數字，neg：按了「−」（回饋、退款），存成負的\n  const draft = { amt: entry ? String(Math.abs(entry.amt)) : \"\", neg: !!entry && entry.amt < 0, cat: entry ? entry.cat : (catOf(lastCat) ? lastCat : data.cats[0]?.id), note: entry ? entry.note || \"\" : \"\", ts: entry ? entry.ts : Date.now() };\n  openSheet(`\n    <div class=\"sheet-top\"><h2>${esc(b.name)}・${entry ? \"修改\" : \"記一筆\"}</h2><button class=\"ibtn\" data-act=\"close\" aria-label=\"關閉\">✕</button></div>\n    <div class=\"amount\"><input class=\"when\" id=\"when\" type=\"datetime-local\" value=\"${toLocalInput(draft.ts)}\" aria-label=\"日期時間\"><span class=\"num\" id=\"amt\"></span></div>\n    <div class=\"lbl-row\"><span class=\"lbl\">分類</span><button class=\"link\" data-act=\"cats\">編輯分類</button></div>\n    <div class=\"cats\" id=\"cats\"></div>\n    <label class=\"note\" for=\"note\">備註<input id=\"note\" value=\"${esc(draft.note)}\" placeholder=\"可以不填\" autocomplete=\"off\"></label>\n    <div class=\"keys\" id=\"keys\">${[\"1\", \"2\", \"3\", \"4\", \"5\", \"6\", \"7\", \"8\", \"9\", \"−\", \"0\", \"⌫\"].map((k) => k === \"−\"\n      ? `<button class=\"key sign\" id=\"sign\" aria-pressed=\"false\" aria-label=\"回饋、退款（金額變負的）\">−</button>`\n      : `<button class=\"key\" data-k=\"${k}\" ${k === \"⌫\" ? 'aria-label=\"刪除\"' : \"\"}>${k}</button>`).join(\"\")}</div>\n    <div class=\"row2\">${entry ? `<button class=\"soft\" data-act=\"del\">刪除這筆</button>` : \"\"}<button class=\"save\" data-act=\"save\">${entry ? \"儲存\" : \"記下來\"}</button></div>`, (el) => {\n    const paintAmt = () => {\n      el.querySelector(\"#sign\").setAttribute(\"aria-pressed\", draft.neg);\n      el.querySelector(\"#amt\").classList.toggle(\"neg\", draft.neg);\n      const shown = draft.amt ? Number(draft.amt).toLocaleString(\"en-US\", { maximumFractionDigits: 2 }) + (draft.amt.endsWith(\".\") ? \".\" : \"\") : \"0\";\n      el.querySelector(\"#amt\").innerHTML = `<small>${draft.neg ? \"−$\" : \"$\"}</small>${esc(shown)}`;\n      // 金額越長字越小，跟日期擺在同一行不換行\n      const n = shown.length + (draft.neg ? 1 : 0);\n      el.querySelector(\"#amt\").style.fontSize = (n <= 4 ? 36 : n <= 6 ? 30 : n <= 8 ? 25 : 21) + \"px\";\n    };\n    const paintCats = () => {\n      el.querySelector(\"#cats\").innerHTML = data.cats.map((c) => `<button class=\"cat\" style=\"background:${bg(c.color)}\" aria-pressed=\"${c.id === draft.cat}\" data-c=\"${esc(c.id)}\">${icon(c.icon, c.color)}<span>${esc(c.name)}</span></button>`).join(\"\")\n        + `<button class=\"cat\" data-new=\"1\"><span class=\"plus\">＋</span><span>新增</span></button>`;\n    };\n    paintAmt(); paintCats();\n    el.querySelector(\"#sign\").onclick = () => { draft.neg = !draft.neg; paintAmt(); };\n    el.querySelector(\"#keys\").onclick = (e) => {\n      const k = e.target.closest(\"[data-k]\")?.dataset.k; if (!k) return;\n      if (k === \"⌫\") draft.amt = draft.amt.slice(0, -1);\n      else if (draft.amt.replace(\".\", \"\").length < 9 && !/\\.\\d\\d$/.test(draft.amt)) draft.amt = (draft.amt === \"0\" ? \"\" : draft.amt) + k;\n      paintAmt();\n    };\n    // 編輯分類時會換掉這個面板：先記下輸入到一半的內容，回來時帶回去（新增的分類直接選好）\n    const backHere = () => {\n      const keep = { ...draft, note: el.querySelector(\"#note\").value };\n      return (newCat) => { openEntry(b, entry); $(\"#scrim .sheet\").__restore(keep, newCat); };\n    };\n    el.querySelector(\"#cats\").onclick = (e) => {\n      if (e.target.closest(\"[data-new]\")) { openCatEditor(null, backHere()); return; }\n      const c = e.target.closest(\"[data-c]\"); if (!c) return;\n      draft.cat = c.dataset.c; paintCats();\n    };\n    el.__restore = (keep, newCat) => {\n      Object.assign(draft, keep);\n      if (newCat) draft.cat = newCat;\n      if (!catOf(draft.cat)) draft.cat = data.cats[0]?.id; // 原本選的分類被刪掉了\n      el.querySelector(\"#note\").value = draft.note;\n      el.querySelector(\"#when\").value = toLocalInput(draft.ts);\n      paintAmt(); paintCats();\n    };\n    el.querySelector(\"#when\").onchange = (e) => { const t = new Date(e.target.value).getTime(); if (!isNaN(t)) draft.ts = t; };\n    el.addEventListener(\"click\", (e) => {\n      const act = e.target.closest(\"[data-act]\")?.dataset.act;\n      if (act === \"close\") closeSheet();\n      if (act === \"cats\") { const back = backHere(); openCatManager(() => back()); }\n      if (act === \"del\") {\n        const btn = e.target.closest(\"[data-act]\");\n        if (!btn.classList.contains(\"danger\")) { btn.className = \"danger\"; btn.dataset.act = \"del\"; btn.textContent = \"確定刪除\"; return; }\n        const idx = b.entries.indexOf(entry);\n        b.entries.splice(idx, 1); changed(); closeSheet(); render();\n        toast(\"已刪除這筆\", () => { b.entries.splice(idx, 0, entry); changed(); render(); });\n      }\n      if (act === \"save\") {\n        if (!draft.amt || !(Number(draft.amt) > 0)) { toast(\"先輸入金額喔\"); return; }\n        const amt = draft.neg ? -Number(draft.amt) : Number(draft.amt);\n        const note = el.querySelector(\"#note\").value.trim();\n        if (entry) Object.assign(entry, { amt, cat: draft.cat, note, ts: draft.ts });\n        else b.entries.push({ id: uid(\"e\"), ts: draft.ts, amt, cat: draft.cat, note });\n        lastCat = draft.cat; data.lastBook = b.id;\n        changed(); closeSheet(); render();\n        const c = catOf(draft.cat);\n        toast(entry ? \"改好了\" : `記好了：${c ? c.name + \" \" : \"\"}${fmt(amt)}`);\n      }\n    });\n  });\n}\n\n// 分類列表：點一個分類修改，或新增\nfunction openCatManager(back) {\n  openSheet(`\n    <div class=\"sheet-top\"><h2>編輯分類</h2><button class=\"ibtn\" data-act=\"close\" aria-label=\"完成\">✓</button></div>\n    <p class=\"hint\">點分類可以改名字、顏色和圖示；刪掉的分類，用到它的記錄會顯示「未分類」。</p>\n    <div class=\"catlist\">${data.cats.map((c) => `<button class=\"chip\" style=\"background:${bg(c.color)}\" data-c=\"${esc(c.id)}\">${icon(c.icon, c.color)}${esc(c.name)}</button>`).join(\"\")}\n      <button class=\"chip dashed\" data-new=\"1\" style=\"padding:8px 16px\">＋ 新增分類</button></div>`, (el) => {\n    el.addEventListener(\"click\", (e) => {\n      if (e.target.closest('[data-act=\"close\"]')) { back ? back() : closeSheet(); return; }\n      if (e.target.closest(\"[data-new]\")) { openCatEditor(null, () => openCatManager(back)); return; }\n      const c = e.target.closest(\"[data-c]\"); if (c) openCatEditor(catOf(c.dataset.c), () => openCatManager(back));\n    });\n  });\n}\n\n// 新增／修改分類、帳本共用：名字、8 色、圖示\nfunction editorSheet({ title, item, fresh, placeholder, onSave, onDelete, back }) {\n  const draft = item ? { ...item } : { name: \"\", ...fresh };\n  openSheet(`\n    <div class=\"sheet-top\"><button class=\"ibtn\" data-act=\"back\" aria-label=\"返回\">‹</button><h2>${title}</h2></div>\n    <div class=\"prev\"><span class=\"chip\" id=\"chip\"></span></div>\n    <input class=\"namein\" id=\"name\" value=\"${esc(draft.name)}\" maxlength=\"8\" placeholder=\"${esc(placeholder || \"名字\")}\" autocomplete=\"off\" aria-label=\"名字\">\n    <span class=\"lbl\">顏色</span><div class=\"dots\" id=\"dots\"></div>\n    <span class=\"lbl\">圖示</span><div class=\"icons\" id=\"icons\"></div>\n    <div class=\"row2\">${item && onDelete ? `<button class=\"soft\" data-act=\"del\">刪除</button>` : \"\"}<button class=\"save\" data-act=\"ok\" style=\"background:var(--blue)\">${item ? \"儲存\" : \"加入\"}</button></div>`, (el) => {\n    const chip = () => { el.querySelector(\"#chip\").style.background = bg(draft.color); el.querySelector(\"#chip\").innerHTML = icon(draft.icon) + esc(draft.name || \"名字\"); };\n    el.querySelector(\"#dots\").innerHTML = COLORS.map((c) => `<button class=\"dot\" style=\"background:${STRONG[c]}\" aria-pressed=\"${c === draft.color}\" data-c=\"${c}\" aria-label=\"${COLOR_NAMES[c]}\"></button>`).join(\"\");\n    el.querySelector(\"#icons\").innerHTML = ICONS.map((k) => `<button class=\"iopt\" aria-pressed=\"${k === draft.icon}\" data-k=\"${k}\" aria-label=\"${k}\">${icon(k)}</button>`).join(\"\");\n    chip();\n    el.querySelector(\"#name\").oninput = (e) => { draft.name = e.target.value.trim(); chip(); };\n    el.querySelector(\"#dots\").onclick = (e) => { const d = e.target.closest(\"[data-c]\"); if (!d) return; draft.color = d.dataset.c; el.querySelectorAll(\".dot\").forEach((x) => x.setAttribute(\"aria-pressed\", x === d)); chip(); };\n    el.querySelector(\"#icons\").onclick = (e) => { const o = e.target.closest(\"[data-k]\"); if (!o) return; draft.icon = o.dataset.k; el.querySelectorAll(\".iopt\").forEach((x) => x.setAttribute(\"aria-pressed\", x === o)); chip(); };\n    el.addEventListener(\"click\", (e) => {\n      const btn = e.target.closest(\"[data-act]\"); if (!btn) return;\n      if (btn.dataset.act === \"back\") back();\n      if (btn.dataset.act === \"ok\") { if (!draft.name) { el.querySelector(\"#name\").focus(); toast(\"請輸入名字\"); return; } onSave(draft); }\n      if (btn.dataset.act === \"del\") {\n        if (!btn.classList.contains(\"danger\")) { btn.className = \"danger\"; btn.dataset.act = \"del\"; btn.textContent = \"確定刪除\"; return; }\n        onDelete();\n      }\n    });\n  });\n}\nfunction openCatEditor(cat, back) {\n  editorSheet({\n    title: cat ? \"修改分類\" : \"新增分類\", item: cat, placeholder: \"例如：寵物\",\n    // 新分類先挑還沒用過的顏色\n    fresh: { color: COLORS.find((c) => !data.cats.some((x) => x.color === c)) || \"yellow\", icon: \"star\" },\n    onSave: (d) => {\n      if (data.cats.some((c) => c.name === d.name && c !== cat)) { toast(`已經有「${d.name}」了`); return; }\n      let id;\n      if (cat) { Object.assign(cat, { name: d.name, color: d.color, icon: d.icon }); id = cat.id; }\n      else { id = uid(\"c\"); data.cats.push({ id, name: d.name, color: d.color, icon: d.icon }); lastCat = id; }\n      changed(); back(id);\n    },\n    onDelete: cat ? () => { data.cats = data.cats.filter((c) => c !== cat); changed(); back(); } : null,\n    back: () => back(),\n  });\n}\nfunction openBookEditor(book) {\n  editorSheet({\n    title: book ? \"修改帳本\" : \"新帳本\", item: book, placeholder: \"例如：首爾旅行\",\n    fresh: { color: COLORS[data.books.length % COLORS.length], icon: \"travel\" },\n    onSave: (d) => {\n      if (book) Object.assign(book, { name: d.name, color: d.color, icon: d.icon });\n      else data.books.push({ id: uid(\"b\"), name: d.name, color: d.color, icon: d.icon, entries: [] });\n      changed(); closeSheet(); renderHome();\n    },\n    back: closeSheet,\n  });\n}\n\n// Scriptable 回報匯出、複製的結果\nwindow.__exported = (msg) => toast(msg);\n\n/* ---------- 開始 ---------- */\nif (boot.openBook && bookOf(boot.openBook)) view = { page: \"book\", book: boot.openBook };\nrender();\n// 從主畫面小工具點「＋記一筆」進來：直接打開那本帳本的記一筆\nif (boot.add && bookOf(boot.add)) { view = { page: \"book\", book: boot.add }; render(); openEntry(bookOf(boot.add), null); }\nif (boot.warn) toast(boot.warn);\n</script>\n</body>\n</html>\n";
}

// ---- 帳本畫面
async function openApp(params) {
  const data = loadData();
  const iconFailed = await ensureAnimalIcons();
  await ensureStickerArt();
  await ensureCornerArt(); // 筆記的底圖重畫過：疊照片的底圖也跟著重畫
  const boot = {
    data, iconImages: await animalDataURLs(), logos: logoDataURLs(),
    add: params.add || null, openBook: params.book || null,
    warn: iconFailed ? "小動物圖示下載不到，先用線條圖示；連上網路後再打開一次就會補上。" : "",
  };
  const html = pageHTML().replace("/*BOOT*/null", () => js(boot));

  const wv = new WebView();
  let queue = Promise.resolve();
  const run = async cmds => {
    for (const c of cmds) {
      if (c.type === "save") saveData(c.data);
      else if (c.type === "file") {
        // 匯出 Excel：畫面組好的 .xlsx 存成暫存檔，用分享選單存到「檔案」、用 Excel 打開或傳出去
        const p = local.joinPath(local.temporaryDirectory(), c.name.replace(/[\/\\:*?"<>|]/g, "-"));
        local.write(p, Data.fromBase64String(c.b64));
        await ShareSheet.present([p]);
      } else if (c.type === "corner") {
        const msg = await changeCorner();
        if (msg) await wv.evaluateJavaScript(`window.__exported(${js(msg)}); 0;`);
      } else if (c.type === "image") {
        // 圖卡：用分享選單「儲存影像」到照片，或用 LINE 傳出去
        await ShareSheet.present([Image.fromData(Data.fromBase64String(c.b64))]);
      }
    }
  };
  // 畫面用 kidsledger:// 網址叫我們：把它要做的事拿回來處理
  const drain = async () => {
    const raw = await wv.evaluateJavaScript("window.__takeOutbox ? window.__takeOutbox() : '[]'");
    await run(JSON.parse(raw || "[]"));
  };
  wv.shouldAllowRequest = req => {
    if ((req.url || "").startsWith("kidsledger://")) {
      queue = queue.then(drain).catch(e => wv.evaluateJavaScript(`window.__toast(${js("出了點問題：" + e)}); 0;`).catch(() => {}));
      return false;
    }
    return true;
  };
  await wv.loadHTML(html);
  await wv.present(true);

  // 關掉畫面後再拿一次最新的內容，確保最後的改動有存到
  try {
    await queue;
    const raw = await wv.evaluateJavaScript("window.__finalState ? window.__finalState() : ''");
    if (raw) saveData(JSON.parse(raw));
  } catch (e) { console.error(e); }
}

// ---- 主畫面小工具
const SF = {
  fork: "fork.knife", bus: "bus", shoppingbag: "bag", idea: "lightbulb", music: "music.note", heart: "heart",
  balloon: "balloon", car: "car", train: "tram", travel: "paperplane", gift: "gift", drink: "cup.and.saucer",
};
// on：放在什麼顏色的卡片上（分類顏色名稱），跟貼紙底色一樣時用白底的那張
function addIcon(stack, key, size, on) {
  let p = ANIMALS[key] ? iconPath(key) : artPath(key);
  if (!ANIMALS[key] && stickerClash(key, on) && local.fileExists(artPath(key + "-w"))) p = artPath(key + "-w");
  if (local.fileExists(p)) {
    const im = stack.addImage(Image.fromFile(p));
    im.imageSize = new Size(size, size);
    if (ANIMALS[key]) im.cornerRadius = size / 2;
    return;
  }
  const sym = SFSymbol.named(SF[key] || "star");
  sym.applyFont(Font.semiboldSystemFont(size * 0.55));
  const im = stack.addImage(sym.image);
  im.imageSize = new Size(size * 0.7, size * 0.7);
  im.tintColor = col(K.ink);
}
const money = n => (Number(n) < 0 ? "−$" : "$") + Math.abs(Number(n)).toLocaleString("en-US", { maximumFractionDigits: 2 }); // 負的是回饋、退款

// 依螢幕寬度推算小工具的大小（單位：點），跟筆記同一張表
function widgetSizes() {
  const s = Device.screenSize();
  const w = Math.min(s.width, s.height), h = Math.max(s.width, s.height);
  const t = w >= 428 ? [170, 364, 382] : w >= 414 ? (h >= 896 ? [169, 360, 379] : [159, 348, 357])
    : w >= 390 ? [158, 338, 354] : w >= 375 ? (h >= 812 ? [155, 329, 345] : [148, 321, 324]) : [141, 292, 311];
  return { small: [t[0], t[0]], medium: [t[1], t[0]], large: [t[1], t[2]] };
}
const WEEK = "日一二三四五六";
const LOGO = 45; // 左上角「彥」（原本 30，放大 1.5 倍）
const CHIP_H = 34, CHIP_GAP = 5, DAY_H = 18; // 每筆記錄（放大 1.2 倍）的高度、間距；日期小計那一行的高度

// 標題列：「彥」+ 帳本圖示 + 帳本名稱（大尺寸右邊再放「＋記一筆」）
function addHeader(parent, book, withPill, withName = true) {
  const head = parent.addStack();
  head.centerAlignContent();
  head.spacing = 6;
  for (const im of logoImages()) { const li = head.addImage(im); li.imageSize = new Size(LOGO, LOGO); }
  addIcon(head, book.icon, 26);
  if (withName) {
    const name = head.addText(book.name);
    name.font = Font.heavyRoundedSystemFont(15); name.textColor = col(K.ink); name.lineLimit = 1; name.minimumScaleFactor = 0.7;
  }
  if (withPill) { head.addSpacer(); addPill(head, book); }
}
function addPill(parent, book, plusOnly = false) {
  const pill = parent.addStack();
  pill.backgroundColor = col(K.tomato);
  pill.cornerRadius = 12;
  pill.url = runURL({ add: book.id });
  // 大尺寸只放一個「＋」（紅色底），小、中尺寸寫「＋ 記一筆」
  // 「＋」比帳本名稱（16）小一點
  if (plusOnly) pill.cornerRadius = 9;
  pill.setPadding(plusOnly ? 1 : 5, plusOnly ? 8 : 11, plusOnly ? 1 : 5, plusOnly ? 8 : 11);
  const pt = pill.addText(plusOnly ? "＋" : "＋ 記一筆");
  pt.font = Font.heavyRoundedSystemFont(plusOnly ? 12 : 13); pt.textColor = col(K.white);
}
// 記錄卡片的顏色：先用分類的顏色，跟前面 4 筆有重複時改用附近還沒用過的顏色（同一個分類連著記也不會整排同色）
const SPREAD = ["yellow", "blue", "pink", "green", "purple", "orange", "rose", "teal"];
function spreadColors(list, catColor) {
  const out = [];
  list.forEach((e, i) => {
    const near = out.slice(Math.max(0, i - 4));
    let c = catColor(e) || "yellow";
    if (near.includes(c)) c = SPREAD.find(x => !near.includes(x)) || c;
    out.push(c);
  });
  return out;
}
// 一筆記錄：分類圖示、備註（沒有就寫分類）、金額；color：卡片顏色（spreadColors 排好的）
function addChip(parent, e, cats, width, inset = 0, color) {
  const c = cats.find(x => x.id === e.cat) || { name: "未分類", color: "yellow", icon: "star" };
  // inset：左右各縮進一點（大尺寸用），兩邊一樣寬
  let holder = parent;
  if (inset) { holder = parent.addStack(); holder.addSpacer(inset); }
  const chip = holder.addStack();
  chip.size = new Size(width, CHIP_H);
  const cc = color || c.color || "yellow";
  chip.backgroundColor = col(CAT_BG[cc] || CAT_BG.yellow);
  chip.cornerRadius = 13;
  chip.setPadding(0, 6, 0, 10);
  chip.centerAlignContent();
  chip.spacing = 6;
  addIcon(chip, c.icon, 24, cc);
  const t = chip.addText(e.note || c.name);
  t.font = Font.heavyRoundedSystemFont(13.8); t.textColor = col(K.ink); t.lineLimit = 1;
  chip.addSpacer();
  const a = chip.addText((e.amt < 0 ? "−" : "") + Math.abs(Number(e.amt)).toLocaleString("en-US", { maximumFractionDigits: 2 }));
  a.font = Font.heavyRoundedSystemFont(14.4); a.textColor = col(e.amt < 0 ? "#17705F" : K.ink); // 回饋、退款用綠色
  if (inset) holder.addSpacer(inset);
}

function buildWidget(family) {
  const w = new ListWidget();
  w.backgroundColor = col(K.cream);
  const bgImg = cornerBg(family) || notesArt("bg-" + family + "-plain") || notesArt("bg-" + family);
  if (bgImg) w.backgroundImage = bgImg;
  w.setPadding(12, 14, 12, 14);
  w.refreshAfterDate = new Date(Date.now() + 15 * 60000);
  const [W, H] = widgetSizes()[family] || widgetSizes().medium;

  const data = loadData();
  // 哪一本：Parameter 填了帳本名稱就用那本，不然用最近記帳的那本
  const param = (args.widgetParameter || "").trim();
  const books = data ? data.books : [];
  const book = (param && books.find(b => b.name === param)) || books.find(b => b.id === (data || {}).lastBook) || books[0];
  if (!book) {
    w.url = runURL({});
    const t = w.addText("還沒有帳本，點一下開始記帳");
    t.font = Font.boldRoundedSystemFont(13); t.textColor = col(K.ink);
    return w;
  }
  const cats = data.cats || [];
  const now = new Date();
  const entries = [...book.entries].sort((a, b) => b.ts - a.ts);
  const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  const total = list => list.reduce((s, e) => s + Number(e.amt || 0), 0);
  const todaySum = total(entries.filter(e => dayKey(e.ts) === dayKey(now)));
  w.url = runURL({ book: book.id });

  // 今天花了多少、全部多少
  const addSums = (parent, big) => {
    const l = parent.addText("今天");
    l.font = Font.boldRoundedSystemFont(11); l.textColor = col(K.body);
    const v = parent.addText(money(todaySum));
    v.font = Font.heavyRoundedSystemFont(big); v.textColor = col(K.ink); v.minimumScaleFactor = 0.6; v.lineLimit = 1;
    const all = parent.addText(`全部 ${money(total(entries))}`);
    all.font = Font.semiboldRoundedSystemFont(11); all.textColor = col(K.body); all.lineLimit = 1;
  };

  if (family === "small") {
    // 小尺寸只能整個小工具一個連結：點了就記一筆
    w.url = runURL({ add: book.id });
    addHeader(w, book, false);
    w.addSpacer(4);
    addSums(w, 24);
    w.addSpacer();
    addPill(w, book);
    return w;
  }

  if (family === "medium") {
    // 左邊：標題、今天、全部、＋記一筆；右邊：最近 3 筆
    const row = w.addStack();
    const left = row.addStack();
    left.layoutVertically();
    left.size = new Size(128, H - 24);
    addHeader(left, book, false, false); // 左欄比較窄：名稱放下一行
    const nm = left.addText(book.name);
    nm.font = Font.heavyRoundedSystemFont(13); nm.textColor = col(K.ink); nm.lineLimit = 1;
    left.addSpacer(2);
    addSums(left, 22);
    left.addSpacer();
    addPill(left, book);
    row.addSpacer(10);
    const right = row.addStack();
    right.layoutVertically();
    right.spacing = CHIP_GAP;
    right.addSpacer();
    const rw = W - 28 - 128 - 10;
    if (!entries.length) { const t = right.addText("還沒有記錄"); t.font = Font.boldRoundedSystemFont(12); t.textColor = col(K.body); }
    const shown = entries.slice(0, 3), colors = spreadColors(shown, e => (cats.find(x => x.id === e.cat) || {}).color);
    shown.forEach((e, i) => addChip(right, e, cats, rw, 0, colors[i]));
    right.addSpacer();
    return w;
  }

  // 大尺寸：標題（左「彥」、中間帳本圖示和名稱）、今天、＋、全部，下面依日期列出，每天一行小計；放得下幾筆就放幾筆
  // 左右兩邊用一樣寬的欄位，中間的帳本圖示和名稱才會在正中間（右邊空著，讓右上角的色塊或照片露出來）
  const SIDE = 96;
  const head = w.addStack();
  head.centerAlignContent();
  const hl = head.addStack();
  hl.size = new Size(SIDE, LOGO);
  hl.centerAlignContent();
  for (const im of logoImages()) { const li = hl.addImage(im); li.imageSize = new Size(LOGO, LOGO); }
  hl.addSpacer();
  head.addSpacer();
  const mid = head.addStack();
  mid.centerAlignContent();
  mid.spacing = 6;
  addIcon(mid, book.icon, 28);
  const bn = mid.addText(book.name);
  bn.font = Font.heavyRoundedSystemFont(16); bn.textColor = col(K.ink); bn.lineLimit = 1; bn.minimumScaleFactor = 0.7;
  head.addSpacer();
  const hr = head.addStack();
  hr.size = new Size(SIDE, LOGO);
  w.addSpacer(6);
  // 今天、全部、「＋」都靠左排，右邊空著，不會被右上角的照片蓋到
  const sums = w.addStack();
  sums.centerAlignContent();
  sums.spacing = 8;
  // 今天和全部的金額都是 14 點；「＋」和全部往右挪一點
  const tl = sums.addText("今天"); tl.font = Font.boldRoundedSystemFont(12); tl.textColor = col(K.body);
  const tv = sums.addText(money(todaySum)); tv.font = Font.heavyRoundedSystemFont(14); tv.textColor = col(K.ink);
  sums.addSpacer(14);
  addPill(sums, book, true); // 「＋」放在全部金額前面
  const al = sums.addText("全部"); al.font = Font.boldRoundedSystemFont(12); al.textColor = col(K.body);
  const av = sums.addText(money(total(entries))); av.font = Font.heavyRoundedSystemFont(14); av.textColor = col(K.ink);
  sums.addSpacer();
  w.addSpacer(8);
  const inner = W - 28, INSET = 8, chipW = inner - INSET * 2; // 記錄卡片左右各縮 8
  let room = H - 24 - LOGO - 6 - 20 - 8;
  if (!entries.length) { const t = w.addText("還沒有記錄，點「＋」開始記一筆"); t.font = Font.boldRoundedSystemFont(13); t.textColor = col(K.body); }
  let day = null;
  const colors = spreadColors(entries.slice(0, 12), e => (cats.find(x => x.id === e.cat) || {}).color);
  for (const [i, e] of entries.entries()) {
    const k = dayKey(e.ts);
    const needDay = k !== day;
    if (room < (needDay ? DAY_H + 4 : 0) + CHIP_H) break;
    if (needDay) {
      day = k;
      const d = new Date(e.ts);
      const diff = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
      const label = (diff === 0 ? "今天 " : diff === 1 ? "昨天 " : "") + `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）`;
      const dr = w.addStack();
      dr.size = new Size(inner, DAY_H);
      dr.setPadding(0, INSET, 0, INSET); // 日期小計跟卡片對齊
      dr.centerAlignContent();
      const dl = dr.addText(label); dl.font = Font.heavyRoundedSystemFont(12); dl.textColor = col(K.ink);
      dr.addSpacer();
      const ds = dr.addText(money(total(entries.filter(x => dayKey(x.ts) === k)))); ds.font = Font.heavyRoundedSystemFont(12); ds.textColor = col(K.body);
      w.addSpacer(4);
      room -= DAY_H + 4;
    }
    addChip(w, e, cats, chipW, INSET, colors[i]);
    w.addSpacer(CHIP_GAP);
    room -= CHIP_H + CHIP_GAP;
  }
  w.addSpacer();
  return w;
}

// ---- 進入點
if (config.runsInWidget) {
  Script.setWidget(buildWidget(config.widgetFamily || "small"));
} else {
  await openApp(args.queryParameters || {});
}
Script.complete();
