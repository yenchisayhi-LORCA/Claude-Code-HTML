// 靈感筆記・童趣風備忘錄（Scriptable）
// 在 App 內執行：打開筆記畫面（兩欄卡片預覽、勾選清單、分類、照片）
// 放在主畫面當小工具：顯示最近的筆記，點一下打開那則筆記
// 筆記、分類、照片都存在 iCloud 雲碟的 Scriptable/kids-notes/（沒開 iCloud 時存在本機），同一個 Apple 帳號的裝置共用
const K = {
  cream: "#FFFCEF", white: "#FFFFFF", ink: "#262261", body: "#5A5788", muted: "#8B88B2",
  tealText: "#3C7D74", tealCheck: "#17705F",
  yellow100: "#FFF0AF", blue100: "#CFDDF8", orange100: "#FFE2BA", pink100: "#FBD3D0", green100: "#D5F5D0", teal100: "#C9F0E9",
};
const CAT_BG = { yellow: K.yellow100, orange: K.orange100, green: K.green100, blue: K.blue100, pink: K.pink100, teal: K.teal100 };
const CHIP_BG = [K.yellow100, K.blue100, K.orange100, K.pink100, K.green100, K.teal100];
const col = (hex, a = 1) => new Color(hex, a);

// ---- 存檔位置
const store = (() => {
  try { const f = FileManager.iCloud(); f.documentsDirectory(); return f; } catch (e) { return FileManager.local(); }
})();
const DIR = store.joinPath(store.documentsDirectory(), "kids-notes");
const DATA_PATH = store.joinPath(DIR, "notes.json");
const BACKUP_PATH = store.joinPath(DIR, "notes-backup.json");
const PHOTO_DIR = store.joinPath(DIR, "photos");
const ICON_DIR = store.joinPath(DIR, "icons");
const photoPath = (id, small) => store.joinPath(PHOTO_DIR, id + (small ? "-s" : "") + ".jpg");
const iconPath = key => store.joinPath(ICON_DIR, key + ".png");
const mkdir = p => { if (!store.fileExists(p)) store.createDirectory(p, true); };

async function ensureLocal(path) {
  if (store.isFileStoredIniCloud(path) && !store.isFileDownloaded(path)) await store.downloadFileFromiCloud(path);
}

// 第一次使用時的分類和一則說明筆記
function starterData() {
  const now = Date.now();
  return {
    cats: [
      { id: "k1", name: "網購", color: "orange" },
      { id: "k2", name: "旅行", color: "blue" },
      { id: "k3", name: "保養", color: "teal" },
      { id: "k4", name: "採買", color: "green" },
      { id: "k5", name: "靈感", color: "yellow" },
    ],
    notes: [{
      id: "n-welcome", icon: "bee", cat: "k5", title: "歡迎使用靈感筆記", photos: [], updated: now,
      lines: [
        { type: "t", text: "按下面紅色的「寫筆記」新增一則。" },
        { type: "c", text: "寫筆記時按工具列左邊的鍵，這一行就變成勾選項目", done: true },
        { type: "c", text: "按工具列右邊的鍵，可以從相簿加照片", done: false },
        { type: "c", text: "點左上角的圖示，換成日常記帳的小動物", done: false },
        { type: "c", text: "篩選列最後的「編輯分類」可以新增、改名、換顏色", done: false },
      ],
    }],
  };
}

async function loadData() {
  if (!store.fileExists(DATA_PATH)) return starterData();
  await ensureLocal(DATA_PATH);
  try {
    const d = JSON.parse(store.readString(DATA_PATH));
    return { cats: d.cats || [], notes: d.notes || [] };
  } catch (e) {
    // 檔案壞掉時改讀備份，不要把原本的蓋掉
    if (store.fileExists(BACKUP_PATH)) {
      await ensureLocal(BACKUP_PATH);
      try { return JSON.parse(store.readString(BACKUP_PATH)); } catch (e2) {}
    }
    throw new Error("筆記檔讀不到：" + e);
  }
}

function saveData(d) {
  mkdir(DIR);
  // 每天留一份備份（notes-backup.json），萬一存壞了還有前一天的
  if (store.fileExists(DATA_PATH)) {
    const old = store.fileExists(BACKUP_PATH) ? store.modificationDate(BACKUP_PATH) : null;
    if (!old || Date.now() - old.getTime() > 86400000) store.writeString(BACKUP_PATH, store.readString(DATA_PATH));
  }
  store.writeString(DATA_PATH, JSON.stringify({ version: 1, cats: d.cats, notes: d.notes }));
}

// ---- 圖片縮放：長邊縮到 max 像素
function resize(img, max) {
  const k = Math.min(1, max / Math.max(img.size.width, img.size.height));
  const dc = new DrawContext();
  dc.size = new Size(Math.round(img.size.width * k), Math.round(img.size.height * k));
  dc.respectScreenScale = false;
  dc.opaque = true;
  dc.drawImageInRect(img, new Rect(0, 0, dc.size.width, dc.size.height));
  return dc.getImage();
}

// 加照片：存一張長邊 1000 的大圖、一張 320 的縮圖；回傳給畫面用的 { id, thumb }
async function pickPhoto() {
  const a = new Alert();
  a.title = "加照片";
  a.addAction("從相簿選");
  a.addAction("拍照");
  a.addCancelAction("取消");
  const i = await a.presentSheet();
  if (i < 0) return null;
  let img;
  try { img = i === 0 ? await Photos.fromLibrary() : await Photos.fromCamera(); } catch (e) { return null; }
  try {
    mkdir(PHOTO_DIR);
    const id = "p" + Date.now().toString(36);
    store.write(photoPath(id), Data.fromJPEG(resize(img, 1000)));
    const small = Data.fromJPEG(resize(img, 320));
    store.write(photoPath(id, true), small);
    return { id, thumb: "data:image/jpeg;base64," + small.toBase64String() };
  } catch (e) {
    return { error: "照片存不起來：" + e };
  }
}

async function photoDataURL(id, small) {
  const p = photoPath(id, small);
  if (!store.fileExists(p)) return null;
  await ensureLocal(p);
  return "data:image/jpeg;base64," + store.read(p).toBase64String();
}

// 沒有任何筆記在用、而且放超過 7 天的照片才刪（別台裝置剛加的照片可能還沒同步到筆記檔，先不動）
function cleanupPhotos(d) {
  if (!store.fileExists(PHOTO_DIR)) return;
  const used = new Set(d.notes.flatMap(n => n.photos || []));
  for (const f of store.listContents(PHOTO_DIR)) {
    const id = f.replace(/(-s)?\.jpg$/, "");
    if (used.has(id)) continue;
    const p = store.joinPath(PHOTO_DIR, f);
    const made = store.creationDate(p);
    if (made && Date.now() - made.getTime() > 7 * 86400000) store.remove(p);
  }
}

// ---- 日常記帳的小動物圖示：第一次在 App 內執行時從 GitHub 下載，存成 PNG（SVG 先在 WebView 轉成 PNG）
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
// 回傳下載失敗的數量
async function ensureAnimalIcons() {
  const missing = Object.keys(ANIMALS).filter(k => !store.fileExists(iconPath(k)));
  if (!missing.length) return 0;
  mkdir(ICON_DIR);
  const svgs = {};
  let failed = 0;
  for (const k of missing) {
    const data = await download(ANIMALS[k]);
    if (!data) { failed++; continue; }
    if (ANIMALS[k].endsWith(".png")) store.write(iconPath(k), data);
    else svgs[k] = data.toBase64String();
  }
  if (Object.keys(svgs).length) {
    try {
      const wv = new WebView();
      await wv.loadHTML("<html><body></body></html>");
      const res = await wv.evaluateJavaScript(`
        (async () => {
          const out = {};
          for (const [k, b64] of Object.entries(${JSON.stringify(svgs)})) {
            try {
              const im = new Image();
              im.src = "data:image/svg+xml;base64," + b64;
              await im.decode();
              const cv = document.createElement("canvas"); cv.width = cv.height = 160;
              cv.getContext("2d").drawImage(im, 0, 0, 160, 160);
              out[k] = cv.toDataURL("image/png").split(",")[1];
            } catch (e) {}
          }
          completion(out);
        })();
        0;`, true);
      for (const k of Object.keys(svgs)) {
        if (res && res[k]) store.write(iconPath(k), Data.fromBase64String(res[k]));
        else failed++;
      }
    } catch (e) { failed += Object.keys(svgs).length; }
  }
  return failed;
}
async function animalDataURLs() {
  const out = {};
  for (const k of Object.keys(ANIMALS)) {
    const p = iconPath(k);
    if (!store.fileExists(p)) continue;
    await ensureLocal(p);
    out[k] = "data:image/png;base64," + store.read(p).toBase64String();
  }
  return out;
}

// ---- 筆記畫面（HTML 在最下面的 PAGE_HTML）
const js = v => JSON.stringify(v).replace(/</g, "\\u003c");

async function openApp(openNoteId) {
  let data;
  try { data = await loadData(); } catch (e) {
    const a = new Alert(); a.title = "讀不到筆記"; a.message = String(e); a.addAction("好"); await a.present();
    return;
  }
  if (!store.fileExists(DATA_PATH)) saveData(data);
  const iconFailed = await ensureAnimalIcons();
  const thumbs = {};
  for (const n of data.notes) for (const id of n.photos || []) {
    if (!(id in thumbs)) thumbs[id] = await photoDataURL(id, true) || "";
  }
  const boot = {
    cats: data.cats, notes: data.notes, thumbs, iconImages: await animalDataURLs(), openNote: openNoteId || null,
    warn: iconFailed ? "小動物圖示下載不到，先用線條圖示；連上網路後再打開一次就會補上。" : "",
  };
  const html = pageHTML().replace("/*BOOT*/null", () => js(boot));

  const wv = new WebView();
  let queue = Promise.resolve();
  const run = async cmds => {
    for (const c of cmds) {
      if (c.type === "save") { data = { cats: c.cats, notes: c.notes }; saveData(data); }
      else if (c.type === "photo") {
        const r = await pickPhoto();
        await wv.evaluateJavaScript(`window.__photoAdded(${js(r)}); 0;`);
      } else if (c.type === "full") {
        const src = await photoDataURL(c.id, false);
        if (src) await wv.evaluateJavaScript(`window.__showFull(${js(c.id)}, ${js(src)}); 0;`);
      }
    }
  };
  // 畫面用 kidsnotes:// 網址叫我們：把它要做的事拿回來處理（存檔、選照片、看原圖）
  const drain = async () => {
    const raw = await wv.evaluateJavaScript("window.__takeOutbox ? window.__takeOutbox() : '[]'");
    await run(JSON.parse(raw || "[]"));
  };
  wv.shouldAllowRequest = req => {
    if ((req.url || "").startsWith("kidsnotes://")) {
      queue = queue.then(drain).catch(e => console.error(e));
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
    if (raw) { data = JSON.parse(raw); saveData(data); }
  } catch (e) { console.error(e); }
  try { cleanupPhotos(data); } catch (e) {}
}

// ---- 主畫面小工具
// 線條圖示在小工具裡用相近的 SF Symbols
const SF = {
  star: "star", heart: "heart", diamond: "diamond", music: "music.note", pencil: "pencil", pets: "pawprint",
  clothes: "tshirt", sun: "sun.max", moon: "moon", cloud: "cloud", partlycloudy: "cloud.sun", cloudynight: "cloud.moon",
  overcast: "smoke", rain: "cloud.rain", thunderstorm: "cloud.bolt", lightning: "bolt", snow: "snowflake",
  rainbow: "rainbow", gift: "gift", idea: "lightbulb", shoppingbag: "bag", travel: "paperplane", train: "tram",
  bus: "bus", car: "car", bicycle: "bicycle", camera: "camera", location: "mappin",
};
const hash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };

function addIcon(stack, n, size) {
  const p = iconPath(n.icon);
  if (ANIMALS[n.icon] && store.fileExists(p) && store.isFileDownloaded(p)) {
    const im = stack.addImage(Image.fromFile(p));
    im.imageSize = new Size(size, size);
    im.cornerRadius = size / 2;
    return;
  }
  const chip = stack.addStack();
  chip.size = new Size(size, size);
  chip.cornerRadius = size / 2;
  chip.backgroundColor = col(CHIP_BG[hash(n.id) % CHIP_BG.length]);
  chip.centerAlignContent();
  const sym = SFSymbol.named(SF[n.icon] || "star");
  if (!sym) return;
  sym.applyFont(Font.semiboldSystemFont(size * 0.5));
  const im = chip.addImage(sym.image);
  im.tintColor = col(K.ink);
  im.imageSize = new Size(size * 0.56, size * 0.56);
}

function addCard(parent, n, cats, maxLines, compact) {
  const checks = n.lines.filter(l => l.type === "c");
  const allDone = checks.length && checks.every(l => l.done);
  const card = parent.addStack();
  card.layoutVertically();
  card.backgroundColor = col(allDone ? K.teal100 : K.white);
  card.cornerRadius = 16;
  card.setPadding(9, 10, 8, 10);
  card.spacing = 4;
  card.url = URLScheme.forRunningScript() + "?note=" + encodeURIComponent(n.id);

  const head = card.addStack();
  head.centerAlignContent();
  head.spacing = 6;
  addIcon(head, n, compact ? 18 : 20);
  const t = head.addText(n.title || "未命名筆記");
  t.font = Font.heavyRoundedSystemFont(compact ? 12 : 13);
  t.textColor = col(K.ink);
  t.lineLimit = 1;
  head.addSpacer();

  const cat = cats.find(c => c.id === n.cat);
  if (cat && !compact) {
    const tag = card.addStack();
    tag.backgroundColor = col(allDone ? K.white : CAT_BG[cat.color] || K.yellow100);
    tag.cornerRadius = 7;
    tag.setPadding(1, 6, 1, 6);
    const tt = tag.addText(cat.name);
    tt.font = Font.heavyRoundedSystemFont(9);
    tt.textColor = col(K.ink);
  }

  for (const l of n.lines.filter(l => l.text.trim()).slice(0, maxLines)) {
    const row = card.addStack();
    row.spacing = 4;
    row.centerAlignContent();
    if (l.type === "c") {
      const sym = SFSymbol.named(l.done ? "checkmark.circle.fill" : "circle");
      sym.applyFont(Font.boldSystemFont(10));
      const im = row.addImage(sym.image);
      im.imageSize = new Size(11, 11);
      im.tintColor = col(l.done ? K.tealCheck : K.ink);
    }
    const tx = row.addText(l.text);
    tx.font = l.type === "c" ? Font.boldRoundedSystemFont(11) : Font.mediumRoundedSystemFont(11);
    tx.textColor = col(l.type === "c" && l.done ? K.tealText : l.type === "c" ? K.ink : K.body);
    tx.lineLimit = 1;
  }
  const photos = (n.photos || []).length;
  if (photos) {
    const row = card.addStack();
    row.spacing = 4;
    row.centerAlignContent();
    const sym = SFSymbol.named("photo");
    sym.applyFont(Font.semiboldSystemFont(10));
    const im = row.addImage(sym.image);
    im.imageSize = new Size(12, 10);
    im.tintColor = col(K.body);
    const ph = row.addText(`${photos} 張照片`);
    ph.font = Font.mediumRoundedSystemFont(10);
    ph.textColor = col(K.body);
  }
  card.addSpacer();
  const foot = card.addStack();
  const d = new Date(n.updated), p = x => String(x).padStart(2, "0");
  const dt = foot.addText(`${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`);
  dt.font = Font.semiboldRoundedSystemFont(9);
  dt.textColor = col(K.body);
  foot.addSpacer();
  if (checks.length) {
    const pr = foot.addText(`${checks.filter(l => l.done).length}/${checks.length}`);
    pr.font = Font.heavyRoundedSystemFont(9);
    pr.textColor = col(allDone ? K.tealCheck : K.ink);
  }
}

async function buildWidget(family) {
  const w = new ListWidget();
  w.backgroundColor = col(K.cream);
  w.setPadding(12, 12, 12, 12);
  w.refreshAfterDate = new Date(Date.now() + 15 * 60000);
  let data;
  try { data = await loadData(); } catch (e) { data = { cats: [], notes: [] }; }
  const notes = [...data.notes].sort((a, b) => b.updated - a.updated);

  const head = w.addStack();
  head.centerAlignContent();
  const h = head.addText("靈感筆記");
  h.font = Font.heavyRoundedSystemFont(family === "small" ? 14 : 16);
  h.textColor = col(K.ink);
  head.addSpacer();
  const cnt = head.addText(`${notes.length} 則`);
  cnt.font = Font.boldRoundedSystemFont(11);
  cnt.textColor = col(K.body);
  w.addSpacer(8);

  if (!notes.length) {
    const e = w.addText("還沒有筆記，點一下開始寫");
    e.font = Font.boldRoundedSystemFont(12);
    e.textColor = col(K.body);
    w.addSpacer();
    return w;
  }
  if (family === "small") {
    // 小尺寸只能整個小工具一個連結
    w.url = URLScheme.forRunningScript() + "?note=" + encodeURIComponent(notes[0].id);
    addCard(w, notes[0], data.cats, 3, true);
    return w;
  }
  const rows = family === "large" ? 2 : 1;
  const grid = w.addStack();
  grid.layoutVertically();
  grid.spacing = 8;
  for (let r = 0; r < rows; r++) {
    const row = grid.addStack();
    row.spacing = 8;
    for (let c = 0; c < 2; c++) {
      const n = notes[r * 2 + c];
      if (n) addCard(row, n, data.cats, family === "large" ? 5 : 3, false);
      else row.addSpacer();
    }
  }
  return w;
}

// 筆記畫面的 HTML（由 build.py 從 page.html 產生，不要直接改這裡）
function pageHTML() {
  return /*PAGE_HTML*/"";
}

// ---- 進入點
if (config.runsInWidget) {
  Script.setWidget(await buildWidget(config.widgetFamily || "medium"));
} else {
  await openApp(args.queryParameters && args.queryParameters.note);
}
Script.complete();
