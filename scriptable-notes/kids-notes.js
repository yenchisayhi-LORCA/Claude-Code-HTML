// 筆記・童趣風備忘錄（Scriptable）
// 在 App 內執行：打開筆記畫面（兩欄卡片預覽、勾選清單、分類、照片）
// 放在主畫面當小工具：顯示最近的筆記，點一下打開那則筆記
// 筆記、分類、照片都存在 iCloud 雲碟的 Scriptable/kids-notes/（沒開 iCloud 時存在本機），同一個 Apple 帳號的裝置共用
const K = {
  cream: "#FFFCEF", white: "#FFFFFF", ink: "#262261", body: "#5A5788", muted: "#8B88B2",
  tealText: "#3C7D74", tealCheck: "#17705F", pinRed: "#D93A2F",
  yellow100: "#FFF0AF", blue100: "#CFDDF8", orange100: "#FFE2BA", pink100: "#FBD3D0", green100: "#D5F5D0", teal100: "#C9F0E9",
  purple100: "#E3DAFA", rose100: "#FFD8E8",
};
const CAT_BG = { yellow: K.yellow100, orange: K.orange100, green: K.green100, blue: K.blue100, pink: K.pink100, teal: K.teal100, purple: K.purple100, rose: K.rose100 };
const CHIP_BG = [K.yellow100, K.blue100, K.orange100, K.pink100, K.green100, K.teal100, K.purple100, K.rose100];
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

// iCloud 還沒下載到這台裝置的檔案，資料夾裡只有「.notes.json.icloud」這種佔位檔，fileExists 會說不存在
function cloudPlaceholder(path) {
  const name = path.split("/").pop();
  return store.joinPath(path.slice(0, path.length - name.length), "." + name + ".icloud");
}
// 每次都叫 iCloud 拿最新版：另一台裝置改過時，這台已經下載過的舊檔不會自己更新（沒網路時就用手上這份）
async function fetchFromCloud(path) {
  try {
    if (!store.fileExists(path) && !store.fileExists(cloudPlaceholder(path))) return false;
    // 最多等 3 秒：iCloud 卡住時不要讓存檔一直等，先用手上這份
    try { await Promise.race([store.downloadFileFromiCloud(path), new Promise(r => Timer.schedule(3000, false, r))]); } catch (e) {}
    return store.fileExists(path);
  } catch (e) { return false; }
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
      id: "n-welcome", icon: "bee", cat: "k5", title: "歡迎使用筆記", photos: [], updated: now,
      lines: [
        { type: "t", text: "按下面紅色的「寫筆記」新增一則。" },
        { type: "c", text: "寫筆記時按工具列左邊的鍵，這一行就變成勾選項目", done: true },
        { type: "c", text: "按工具列右邊的鍵，可以從相簿加照片", done: false },
        { type: "c", text: "點左上角的圖示，換成日常記帳的小動物", done: false },
        { type: "c", text: "篩選列最後的「編輯分類」可以新增、改名、換顏色", done: false },
        { type: "c", text: "要刪除筆記：點卡片打開，按右上角的垃圾桶", done: false },
      ],
    }],
  };
}

// 只有真的從來沒存過筆記才用說明筆記；iCloud 還沒同步好時丟錯誤，免得說明筆記蓋掉真正的筆記
async function loadData() {
  if (!await fetchFromCloud(DATA_PATH)) {
    if (await fetchFromCloud(BACKUP_PATH)) {
      try { return JSON.parse(store.readString(BACKUP_PATH)); } catch (e) {}
    }
    if (store.fileExists(cloudPlaceholder(DATA_PATH)) || store.fileExists(cloudPlaceholder(BACKUP_PATH))) throw new Error("筆記還在從 iCloud 下載，等一下再試");
    return starterData();
  }
  try {
    const d = JSON.parse(store.readString(DATA_PATH));
    return { cats: d.cats || [], catsModified: d.catsModified || 0, notes: d.notes || [], deleted: d.deleted || {}, settings: d.settings || {} };
  } catch (e) {
    // 檔案壞掉時改讀備份，不要把原本的蓋掉
    if (store.fileExists(BACKUP_PATH)) {
      await ensureLocal(BACKUP_PATH);
      try { return JSON.parse(store.readString(BACKUP_PATH)); } catch (e2) {}
    }
    throw new Error("筆記檔讀不到：" + e);
  }
}

// 兩台裝置都可能改到同一份筆記檔：存檔前先拿 iCloud 上最新的版本，一則一則比，留下比較晚改的那個
// modified：這則筆記最後改動的時間（打勾、釘選也算）；deleted：刪掉的筆記 id 和時間，免得另一台的舊資料又把它加回來
const stamp = n => n.modified || n.updated || 0;
// view：筆記畫面上一次的內容（只跟它比，才分得出是這台改的，還是別台後來改的）
function markChanges(view, next) {
  const now = Date.now(), plain = n => JSON.stringify({ ...n, modified: undefined });
  const old = new Map((view.notes || []).map(n => [n.id, plain(n)]));
  for (const n of next.notes) if (old.get(n.id) !== plain(n)) n.modified = now;
  const ids = new Set(next.notes.map(n => n.id));
  next.deleted = {};
  for (const id of old.keys()) if (!ids.has(id)) next.deleted[id] = now;
  // 分類沒改就不要蓋掉別台改過的分類
  next.catsModified = JSON.stringify(view.cats) !== JSON.stringify(next.cats) ? now : 0;
  return next;
}
function mergeData(mine, disk) {
  if (!disk) return mine;
  const deleted = { ...(disk.deleted || {}) };
  for (const [id, t] of Object.entries(mine.deleted || {})) deleted[id] = Math.max(t, deleted[id] || 0);
  const byId = new Map();
  for (const n of disk.notes || []) byId.set(n.id, n);
  for (const n of mine.notes) { const o = byId.get(n.id); if (!o || stamp(n) >= stamp(o)) byId.set(n.id, n); }
  // 刪除紀錄留 60 天就夠了
  for (const id in deleted) if (Date.now() - deleted[id] > 60 * 86400000) delete deleted[id];
  const mineCats = (mine.catsModified || 0) >= (disk.catsModified || 0);
  return {
    cats: mineCats ? mine.cats : disk.cats || [], catsModified: Math.max(mine.catsModified || 0, disk.catsModified || 0),
    notes: [...byId.values()].filter(n => !(deleted[n.id] >= stamp(n))), deleted,
    settings: { ...(disk.settings || {}), ...(mine.settings || {}) },
  };
}

// 存檔：合併 iCloud 上最新的內容後寫回去，回傳合併後的資料
async function saveData(d) {
  mkdir(DIR);
  let disk = null;
  if (await fetchFromCloud(DATA_PATH)) { try { disk = JSON.parse(store.readString(DATA_PATH)); } catch (e) {} }
  d = mergeData(d, disk);
  // 每天留一份備份（notes-backup.json），萬一存壞了還有前一天的
  if (store.fileExists(DATA_PATH)) {
    const old = store.fileExists(BACKUP_PATH) ? store.modificationDate(BACKUP_PATH) : null;
    if (!old || Date.now() - old.getTime() > 86400000) store.writeString(BACKUP_PATH, store.readString(DATA_PATH));
  }
  store.writeString(DATA_PATH, JSON.stringify({ version: 2, cats: d.cats, catsModified: d.catsModified || 0, notes: d.notes, deleted: d.deleted || {}, settings: d.settings || {} }));
  return d;
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

// ---- 小工具的圖：左上角「彥」圖示（跟童趣風月曆同一個畫法）和彩色色塊底圖
// 第一次在 App 內執行時用 WebView 畫好，存在這台裝置（每台裝置的小工具大小不同）
// 圖示的字跟童趣風月曆共用設定（月曆選單的「圖示文字」），沒設定過就是「彥」
const local = FileManager.local();
const ART_DIR = local.joinPath(local.documentsDirectory(), "kids-notes-art");
const ART_VERSION = 11; // 底圖或圖示畫法改過就加 1，讓已存的圖重畫（2：加了圖示貼紙；3：加叉子、飲料杯；4：飲料改奶茶色；5：左上角可放 1～3 個字；6：中間改綠色加粉紅小花；7：綠色配紫花、藍色配粉紅花；8：紫花移到左下；9：左下小花改橘色；10：第一個字右下也有藍枝；11：多畫一張沒有菱形的底圖給行事曆小工具）
const artPath = name => local.joinPath(ART_DIR, name + ".png");
const ART_META = local.joinPath(ART_DIR, "meta.json");
const DEFAULT_LOGO = "彥";

// 依螢幕寬度推算小工具的大小（單位：點）
function widgetSizes() {
  const s = Device.screenSize();
  const w = Math.min(s.width, s.height), h = Math.max(s.width, s.height);
  const t = w >= 428 ? [170, 364, 382] : w >= 414 ? (h >= 896 ? [169, 360, 379] : [159, 348, 357])
    : w >= 390 ? [158, 338, 354] : w >= 375 ? (h >= 812 ? [155, 329, 345] : [148, 321, 324]) : [141, 292, 311];
  return { small: [t[0], t[0]], medium: [t[1], t[0]], large: [t[1], t[2]] };
}

// 左上角圖示的字：筆記自己的設定（1～3 個字，在筆記畫面點左上角修改，存在 notes.json，兩台裝置共用）；
// 還沒設定過時，沿用童趣風月曆「圖示文字」的字
const logoChars = text => [...String(text || "")].filter(c => c.trim()).slice(0, 3);
async function logoText(settings) {
  if (settings && logoChars(settings.logoText).length) return logoChars(settings.logoText).join("");
  const p = store.joinPath(store.documentsDirectory(), "calendar-widget-birthdays", "settings.json");
  try {
    if (!store.fileExists(p)) return DEFAULT_LOGO;
    await ensureLocal(p);
    return logoChars(JSON.parse(store.readString(p)).logoChar).join("") || DEFAULT_LOGO;
  } catch (e) { return DEFAULT_LOGO; }
}

function artMeta() {
  try { return JSON.parse(local.readString(ART_META)); } catch (e) { return null; }
}

// 舊版 iOS 的 WebView 沒有 canvas 的 roundRect，先補上
const CANVAS_COMPAT_JS = `
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.min(Array.isArray(r) ? r[0] : r || 0, Math.abs(w) / 2, Math.abs(h) / 2);
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r);
      this.closePath();
    };
  }
`;

// 不規則色塊：(cx, cy) 為中心、寬 w 高 h，r 是 8 個 border-radius 百分比，旋轉 deg 度
const BLOB_JS = `
  function blob(g, cx, cy, w, h, r, deg, fill) {
    g.save(); g.translate(cx, cy); g.rotate(deg * Math.PI / 180); g.translate(-w / 2, -h / 2);
    const [a, b, c, d, e, f, gg, hh] = r.map(v => v / 100);
    g.beginPath(); g.moveTo(a * w, 0); g.lineTo(w - b * w, 0);
    g.ellipse(w - b * w, f * h, b * w, f * h, 0, -Math.PI / 2, 0); g.lineTo(w, h - gg * h);
    g.ellipse(w - c * w, h - gg * h, c * w, gg * h, 0, 0, Math.PI / 2); g.lineTo(d * w, h);
    g.ellipse(d * w, h - hh * h, d * w, hh * h, 0, Math.PI / 2, Math.PI); g.lineTo(0, e * h);
    g.ellipse(a * w, e * h, a * w, e * h, 0, Math.PI, Math.PI * 1.5);
    g.closePath(); g.fillStyle = fill; g.fill(); g.restore();
  }
  const R1 = [52, 48, 61, 39, 58, 43, 57, 42], R2 = [60, 40, 44, 56, 46, 55, 45, 54],
        R3 = [45, 55, 52, 48, 62, 40, 60, 38], R4 = [55, 45, 48, 52, 44, 58, 42, 56];
`;

// 用 Scriptable 的 Request 下載 Google Fonts 字型檔（只抓要用到的字），回傳 base64
async function fetchFont(family, weights, chars) {
  const w = weights ? ":wght@" + weights.join(";") : "";
  const req = new Request(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}${w}&text=${encodeURIComponent(chars)}`);
  req.headers = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" };
  const css = await req.loadString();
  const faces = [];
  for (const block of css.match(/@font-face\s*{[^}]*}/g) || []) {
    const weight = (block.match(/font-weight:\s*(\d+)/) || [])[1] || "400";
    const src = (block.match(/url\(([^)]+)\)/) || [])[1];
    if (!src) continue;
    const data = await new Request(src).load();
    faces.push({ family, weight, b64: data.toBase64String() });
  }
  if (!faces.length) throw new Error(`下載不到字型「${family}」`);
  return faces;
}
const LOAD_FONTS_JS = faces => `
  for (const f of ${JSON.stringify(faces)}) {
    const face = new FontFace(f.family, Uint8Array.from(atob(f.b64), c => c.charCodeAt(0)), { weight: f.weight });
    await face.load(); document.fonts.add(face);
  }`;

// 圖還沒畫、字改過、或畫法改過時重畫；成功回傳 null，失敗回傳原因
async function ensureArt(ch) {
  const sizes = widgetSizes();
  const meta = artMeta();
  if (meta && meta.version === ART_VERSION && meta.logoChar === ch && JSON.stringify(meta.sizes) === JSON.stringify(sizes)) return null;
  try {
    const faces = await fetchFont("Huninn", null, ch);
    const stickerSvgs = {};
    for (const k of ICONS) if (!ANIMALS[k]) stickerSvgs[k] = stickerSVG(k, ICON_SVGS);
    const wv = new WebView();
    await wv.loadHTML("<html><body></body></html>");
    const res = await wv.evaluateJavaScript(`${CANVAS_COMPAT_JS}
      (async () => {
        try {
          await 0; // 先讓下面的 png、canvas 等定義跑完
          ${LOAD_FONTS_JS(faces)}
          const sizes = ${JSON.stringify(sizes)}, chars = ${JSON.stringify(logoChars(ch))}, out = {};
          chars.forEach((c, i) => { out["logo-" + i] = drawLogo(c, i, chars.length); });
          // 圖示貼紙：把 SVG 畫成 96×96 的 PNG，小工具用
          for (const [k, svg] of Object.entries(${JSON.stringify(stickerSvgs)})) {
            const im = new Image();
            im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
            await im.decode();
            const [cv, g] = canvas(32, 32, 3);
            g.drawImage(im, 0, 0, 32, 32);
            out["icon-" + k] = png(cv);
          }
          // 底圖畫兩種：筆記用的（右上有手繪菱形），和行事曆小工具用的沒有菱形版本（-plain）
          for (const f in sizes) {
            out["bg-" + f] = drawBackground(sizes[f][0], sizes[f][1], f, true);
            out["bg-" + f + "-plain"] = drawBackground(sizes[f][0], sizes[f][1], f, false);
          }
          completion(out);
        } catch (e) { completion({ error: String(e) }); }
      })();

      ${BLOB_JS}
      const png = cv => cv.toDataURL("image/png").split(",")[1];
      function canvas(w, h, s) {
        const cv = document.createElement("canvas"), g = cv.getContext("2d");
        cv.width = Math.round(w * s); cv.height = Math.round(h * s); g.scale(s, s);
        return [cv, g];
      }

      // 左上角圖示（256×256 設計稿）：不規則色塊外框、紅花、黃色不規則圓、黃枝 + 藍枝，中間是設定的字
      // 有好幾個字時每個字一個圖示：外框依序深藍、綠（左下角橘色小花）、藍（右上角粉紅小花），形狀角度各不同；紅花和黃枝放第一個、樹枝放最後一個
      function drawLogo(ch, i = 0, n = 1) {
      const [cv, g] = canvas(256, 256, 3);
      const OUTER = ["#232058", "#4FA85E", "#4A6FC4"][i % 3];
      const SHAPE = [[46, 54, 40, 60, 52, 44, 58, 42], [56, 44, 52, 48, 44, 58, 42, 56], [42, 58, 56, 44, 60, 40, 50, 50]][i % 3];
      const INNER = [[44, 56, 62, 38, 46, 54, 46, 54], [58, 42, 46, 54, 52, 48, 60, 40], [50, 50, 40, 60, 56, 44, 44, 56]][i % 3];
      blob(g, 128, 129, 246, 240, SHAPE, [-4, 5, -2][i % 3], OUTER);
      blob(g, 128, 128, 176, 168, INNER, [0, -3, 4][i % 3], "#F7D44C");
      const twig = (color, width, paths) => {
        g.strokeStyle = color; g.lineWidth = width; g.lineCap = "round";
        for (const d of paths) g.stroke(new Path2D(d));
      };
      // 右下樹枝：第一個字一定有（跟月曆的「彥」一模一樣），最後一個字也有；藍框上改用黃枝
      if (i === 0 || i === n - 1) twig(OUTER === "#4A6FC4" ? "#F2CF4A" : "#4A6FC4", 7, ["M178 228 C 190 210, 202 194, 218 180", "M190 212 C 186 200, 186 190, 190 180", "M202 198 C 210 196, 218 192, 226 186"]);
      if (i === 0) twig("#F2CF4A", 6.5, ["M60 236 C 61 222, 61 208, 60 194", "M61 218 C 54 216, 51 210, 51 202", "M60 206 C 66 204, 69 198, 69 190"]);
      // 小花：(x, y) 中心、s 縮放、deg 旋轉、color 花瓣顏色
      const flower = (x, y, s, deg, color) => {
        g.save(); g.translate(x, y); g.scale(s, s); g.rotate(deg * Math.PI / 180); g.fillStyle = color;
        for (let k = 0; k < 8; k++) { g.save(); g.rotate(k * Math.PI / 4); g.beginPath(); g.ellipse(0, -23, 8.5, 20, 0, 0, 7); g.fill(); g.restore(); }
        g.fillStyle = "#FFFCEA"; g.beginPath(); g.arc(0, 0, 11.5, 0, 7); g.fill(); g.restore();
      };
      if (i === 0) flower(50, 48, 1, -12, "#E0412F");      // 第一個：左上角紅花
      if (i === 1) flower(54, 204, 0.72, 10, "#FF9500");  // 綠色那個：左下角橘色小花
      if (i === 2) flower(204, 50, 0.72, -8, "#F28DB2");  // 藍色那個：右上角粉紅小花
      // 字：Huninn 90px，同色 2px 描邊稍微加粗；以字的實際外框置中（比較寬的字會縮小放進黃圓）
      g.font = '90px "Huninn"'; g.textAlign = "center"; g.textBaseline = "alphabetic";
      let m = g.measureText(ch);
      const fit = Math.min(1, 120 / (m.actualBoundingBoxLeft + m.actualBoundingBoxRight || 90));
      g.font = (90 * fit) + 'px "Huninn"'; m = g.measureText(ch);
      const base = 128 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
      g.strokeStyle = g.fillStyle = "#262261"; g.lineWidth = 2; g.lineJoin = "round";
      g.strokeText(ch, 128, base); g.fillText(ch, 128, base);
      return png(cv);
    }

      // 底圖：米白紙，四周放童趣風的彩色色塊（黃、粉、青、綠、橘、藍）和幾顆小圓點
      function drawBackground(W, H, family, sparkle) {
        const [cv, g] = canvas(W, H, 3), u = Math.min(W, H) / 170;
        g.fillStyle = "#FFFCEF"; g.fillRect(0, 0, W, H);
        blob(g, W - 4 * u, 2 * u, 92 * u, 80 * u, R1, -8, "#FFD426");
        if (sparkle) {
          g.save(); g.translate(W - 34 * u, 8 * u); g.scale(20 * u / 48, 20 * u / 48);
          g.strokeStyle = "#262261"; g.lineWidth = 3.4; g.lineCap = g.lineJoin = "round";
          g.stroke(new Path2D("M24 8c1 6 3.5 12 8 16-4.5 4-7 10-8 16-1-6-3.5-12-8-16 4.5-4 7-10 8-16Z")); g.restore();
        }
        blob(g, -6 * u, H + 4 * u, 96 * u, 74 * u, R2, 6, "#FBD3D0");
        blob(g, W + 6 * u, H + 6 * u, 104 * u, 78 * u, R3, -5, "#C9F0E9");
        if (family !== "small") {
          blob(g, -10 * u, H * 0.42, 34 * u, 46 * u, R4, 8, "#D5F5D0");
          blob(g, W + 8 * u, H * 0.5, 30 * u, 42 * u, R2, -6, "#FFE2BA");
          blob(g, W * 0.52, H + 10 * u, 70 * u, 34 * u, R1, 3, "#CFDDF8");
        }
        const dot = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r * u, 0, 7); g.fill(); };
        dot(W * 0.62, 9 * u, 3, "#FF9EC4");
        dot(W * 0.7, 18 * u, 2, "#4FD2C2");
        dot(W - 70 * u, 24 * u, 2.2, "#FF9500");
        return png(cv);
      }
      0;`, true);
    if (!res || res.error) return res ? res.error : "WebView 沒有回應";
    if (!local.fileExists(ART_DIR)) local.createDirectory(ART_DIR, true);
    for (const name in res) local.write(artPath(name), Data.fromBase64String(res[name]));
    // 字變少了：把多出來的舊圖示刪掉
    for (let i = logoChars(ch).length; i < 3; i++) if (local.fileExists(artPath("logo-" + i))) local.remove(artPath("logo-" + i));
    local.writeString(ART_META, JSON.stringify({ version: ART_VERSION, logoChar: ch, sizes }));
    return null;
  } catch (e) { return String(e); }
}
const artImage = name => local.fileExists(artPath(name)) ? Image.fromFile(artPath(name)) : null;
// 左上角的圖示（每個字一張）
function logoImages() {
  const meta = artMeta(), n = meta ? logoChars(meta.logoChar).length : 0, out = [];
  for (let i = 0; i < n; i++) { const im = artImage("logo-" + i); if (im) out.push(im); }
  return out;
}
const logoDataURLs = () => logoImages().map(im => "data:image/png;base64," + Data.fromPNG(im).toBase64String());

// ---- 筆記畫面
// 線條圖示（跟日常記帳同一套）和貼紙樣式，由 build.py 塞進來
const ICONS = ["lion","pig","giraffe","bear","monkey","bee","owl","fox","sheep","penguin","koala","frog","rabbit","star","heart","diamond","music","clothes","pencil","pets","sun","moon","cloud","partlycloudy","cloudynight","overcast","rain","thunderstorm","lightning","snow","rainbow","gift","balloon","fork","drink","idea","shoppingbag","travel","train","bus","car","bicycle","camera","location"];
const ICON_SVGS = {
    star: '<path d="M12 3l2.4 5.5 6 .6-4.5 4 1.3 5.9L12 16l-5.2 3 1.3-5.9-4.5-4 6-.6Z"/>',
    heart: '<path d="M12 20s-7-4.4-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5c-2.5 4.6-9.5 9-9.5 9Z"/>',
    diamond: '<path d="M12 4L15 12L12 20L9 12Z"/>',
    music: '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
    pencil: '<path d="M4 20l1-4L16 5l3 3L8 19l-4 1Z"/><path d="M14 7l3 3"/>',
    pets: '<circle cx="12" cy="15" r="3.4"/><circle cx="6.5" cy="10" r="1.6"/><circle cx="10" cy="7" r="1.6"/><circle cx="14" cy="7" r="1.6"/><circle cx="17.5" cy="10" r="1.6"/>',
    clothes: '<path d="M8 4 4 7l2 3 2-1.3V20h8V8.7L18 10l2-3-4-3-2 1.5h-4Z"/>',
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
    idea: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5a2.6 2.6 0 0 1 1.1-2.2A6 6 0 0 0 12 3Z"/>',
    shoppingbag: '<path d="M6 8h12l-1 12H7Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    travel: '<path d="M21 4 3 11l6 2 2 6 3-4 5 3Z"/>',
    train: '<rect x="6" y="4" width="12" height="12" rx="4"/><line x1="6" y1="11" x2="18" y2="11"/><circle cx="9" cy="15.5" r=".8" fill="currentColor" stroke="none"/><circle cx="15" cy="15.5" r=".8" fill="currentColor" stroke="none"/><path d="M8 19l-2 2M16 19l2 2"/>',
    bus: '<rect x="3" y="6" width="18" height="10" rx="2"/><line x1="3" y1="11" x2="21" y2="11"/><circle cx="7.5" cy="18.5" r="1.4"/><circle cx="16.5" cy="18.5" r="1.4"/>',
    car: '<path d="M4 16V12l2-4h12l2 4v4"/><path d="M4 16h16"/><circle cx="7.5" cy="16.5" r="1.6"/><circle cx="16.5" cy="16.5" r="1.6"/>',
    bicycle: '<circle cx="6" cy="17" r="3.2"/><circle cx="18" cy="17" r="3.2"/><path d="M6 17l4-9h4l-3 6h7l-3-5"/>',
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
};
// 新增的圖示（24×24，跟其他線條圖示同一個格子）
// 氣球：球、綁口、線、反光；叉子：叉頭、中間的齒、叉柄；飲料杯：杯身、杯蓋、吸管、珍珠
const EXTRA_ICON_SVGS = {
  balloon: '<path d="M12 2.8c3.9 0 6.6 2.9 6.6 6.6s-3.2 6.3-6.6 7.3c-3.4-1-6.6-3.6-6.6-7.3S8.1 2.8 12 2.8Z"/><path d="M10.8 18.4 12 16.7l1.2 1.7Z"/><path d="M12 18.4c-1.6 1.4 1.6 2.4 0 4.2"/><path d="M8.6 8.4c.3-1.5 1.3-2.5 2.6-2.8"/>',
  fork: '<path d="M8.5 2.8v5.4a3.5 3.5 0 0 0 7 0V2.8"/><path d="M12 2.8v5.4"/><path d="M10.8 11.6h2.4l-.3 8.9a.9.9 0 0 1-1.8 0Z"/>',
  drink: '<path d="M6.8 9.4h10.4l-1.3 10.9a1.6 1.6 0 0 1-1.6 1.4H9.7a1.6 1.6 0 0 1-1.6-1.4Z"/><path d="M5.8 9.4h12.4V8a1.8 1.8 0 0 0-1.8-1.8H7.6A1.8 1.8 0 0 0 5.8 8Z"/><path d="M12.8 6.2 14.6 2.4h2.6"/><circle cx="10" cy="18.2" r=".9" fill="currentColor"/><circle cx="12.3" cy="19.2" r=".9" fill="currentColor"/><circle cx="14.4" cy="17.8" r=".9" fill="currentColor"/>',
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
function stickerSVG(key, svgs) {
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
    + `<path d="${blobPathD(22, 22, STICKER_BLOBS[h % 4])}" transform="translate(1 1) rotate(${deg} 11 11)" fill="${STICKER_CHIP[spec.chip]}"/>`
    + `<g transform="translate(4.4 4.4) scale(.633)" stroke="${STICKER_INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</g>`
    + `</svg>`;
}
Object.assign(ICON_SVGS, EXTRA_ICON_SVGS);

const js = v => JSON.stringify(v).replace(/</g, "\\u003c");

async function openApp(openNoteId, filter) {
  let data;
  try { data = await loadData(); } catch (e) {
    const a = new Alert(); a.title = "讀不到筆記"; a.message = String(e); a.addAction("好"); await a.present();
    return;
  }
  if (!store.fileExists(DATA_PATH)) data = await saveData(data);
  const iconFailed = await ensureAnimalIcons();
  const artFailed = await ensureArt(await logoText(data.settings));
  const thumbs = {};
  for (const n of data.notes) for (const id of n.photos || []) {
    if (!(id in thumbs)) thumbs[id] = await photoDataURL(id, true) || "";
  }
  const boot = {
    cats: data.cats, notes: data.notes, thumbs, iconImages: await animalDataURLs(), openNote: openNoteId || null, filter: filter || null,
    logos: logoDataURLs(), logoText: await logoText(data.settings),
    warn: iconFailed ? "小動物圖示下載不到，先用線條圖示；連上網路後再打開一次就會補上。"
      : artFailed ? "左上角圖示畫不出來，連上網路後再打開一次就會補上。" : "",
  };
  const html = pageHTML().replace("/*BOOT*/null", () => js(boot));

  let view = JSON.parse(JSON.stringify({ cats: data.cats, notes: data.notes })); // 筆記畫面目前的內容
  const fromPage = (cats, notes) => {
    const next = markChanges(view, { cats, notes, settings: data.settings });
    view = JSON.parse(JSON.stringify({ cats, notes: next.notes }));
    return next;
  };
  const wv = new WebView();
  let queue = Promise.resolve();
  const run = async cmds => {
    for (const c of cmds) {
      if (c.type === "save") data = await saveData(fromPage(c.cats, c.notes));
      else if (c.type === "logo") {
        // 改左上角的字：存起來，重畫圖示，再把新圖示交給畫面
        data.settings = { ...(data.settings || {}), logoText: logoChars(c.text).join("") };
        data = await saveData(data);
        const err = await ensureArt(data.settings.logoText);
        await wv.evaluateJavaScript(`window.__logoUpdated(${js({ logos: logoDataURLs(), error: err })}); 0;`);
      }
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
      // 存檔出錯時在畫面上顯示原因，不要默默失敗
      queue = queue.then(drain).catch(e => wv.evaluateJavaScript(`toast(${js("存檔失敗：" + e)}); 0;`).catch(() => {}));
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
    if (raw) { const f = JSON.parse(raw); data = await saveData(fromPage(f.cats, f.notes)); }
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
  balloon: "balloon", fork: "fork.knife", drink: "cup.and.saucer",
};
const hash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };

function addIcon(stack, n, size, onColor) {
  // 線條圖示：用 App 內畫好的貼紙圖（跟 App 畫面一樣有塗色和底色）
  const sticker = !ANIMALS[n.icon] && artImage("icon-" + n.icon);
  if (sticker) {
    const im = stack.addImage(sticker);
    im.imageSize = new Size(size + 2, size + 2);
    return;
  }
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
  // 卡片本身有顏色時，圖示底改白色才看得出來
  chip.backgroundColor = col(onColor ? K.white : CHIP_BG[hash(n.id) % CHIP_BG.length]);
  chip.centerAlignContent();
  const sym = SFSymbol.named(SF[n.icon] || "star");
  if (!sym) return;
  sym.applyFont(Font.semiboldSystemFont(size * 0.5));
  const im = chip.addImage(sym.image);
  im.tintColor = col(K.ink);
  im.imageSize = new Size(size * 0.56, size * 0.56);
}

// 點小工具時執行這個腳本的網址，例如 scriptable:///run?scriptName=My%20note&note=n123
// （腳本名稱有空白時，直接在 URLScheme.forRunningScript() 後面接 ? 會失效，只會打開 Scriptable）
function runURL(params) {
  const q = { scriptName: Script.name(), ...params };
  return "scriptable:///run?" + Object.keys(q).map(k => k + "=" + encodeURIComponent(q[k])).join("&");
}

// 卡片原本的底色：清單全部打勾是淡青色，有分類用分類的顏色，沒分類依筆記輪流配色
function cardColor(n, cats) {
  const checks = n.lines.filter(l => l.type === "c");
  if (checks.length && checks.every(l => l.done)) return K.teal100;
  const cat = cats.find(c => c.id === n.cat);
  return cat ? CAT_BG[cat.color] || K.yellow100 : CHIP_BG[hash(n.id) % CHIP_BG.length];
}

// 同一個小工具裡的卡片都用不同底色：跟前面重複時，改用還沒用過的顏色（淡青留給「全部打勾」）
function distinctColors(list, cats) {
  const used = new Set();
  return list.map(n => {
    let c = cardColor(n, cats);
    if (used.has(c)) c = CHIP_BG.find(x => !used.has(x) && x !== K.teal100) || c;
    used.add(c);
    return c;
  });
}

function addCard(parent, n, cats, maxLines, compact, width, bgColor, height) {
  // 卡片用分類的顏色（沒分類就依筆記輪流配色）；清單全部打勾時變淡青色
  const bg = bgColor || cardColor(n, cats);
  const card = parent.addStack();
  card.layoutVertically();
  // 寬高都寫死：左右邊距一樣，每張卡片一樣高，日期固定在底部不會被切到
  if (width) card.size = new Size(width, height || 0);
  card.backgroundColor = col(bg);
  card.cornerRadius = 16;
  card.setPadding(9, 10, 8, 10);
  card.spacing = 4;
  card.url = runURL({ note: n.id });

  const head = card.addStack();
  head.centerAlignContent();
  head.spacing = 6;
  addIcon(head, n, compact ? 18 : 20, true);
  const t = head.addText(n.title || "未命名筆記");
  t.font = Font.heavyRoundedSystemFont(compact ? 12 : 13);
  t.textColor = col(K.ink);
  t.lineLimit = 1;
  head.addSpacer();
  if (n.pinned) {
    const pin = SFSymbol.named("pin.fill");
    pin.applyFont(Font.boldSystemFont(10));
    const pi = head.addImage(pin.image);
    pi.imageSize = new Size(11, 11);
    pi.tintColor = col(K.pinRed);
  }

  // 主畫面的卡片不顯示分類標籤（卡片底色已經看得出來）

  const photos = (n.photos || []).length;
  // 照片那一行也佔一行的位置
  for (const l of n.lines.filter(l => l.text.trim()).slice(0, Math.max(0, maxLines - (photos ? 1 : 0)))) {
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
  card.addSpacer(); // 內容靠上；主畫面的卡片不顯示修改日期和清單進度
}

async function buildWidget(family) {
  const w = new ListWidget();
  w.backgroundColor = col(K.cream);
  const bgImg = artImage("bg-" + family);
  if (bgImg) w.backgroundImage = bgImg;
  w.setPadding(10, 12, 12, 12);
  w.refreshAfterDate = new Date(Date.now() + 15 * 60000);
  let data;
  try { data = await loadData(); } catch (e) {
    // iCloud 還沒同步好：先顯示提示，1 分鐘後再試，不要顯示說明筆記
    w.refreshAfterDate = new Date(Date.now() + 60000);
    const t = w.addText("筆記還在從 iCloud 同步，等一下會自動更新");
    t.font = Font.boldRoundedSystemFont(12);
    t.textColor = col(K.body);
    w.addSpacer();
    return w;
  }
  // 小工具不顯示第一次使用的說明筆記（還沒存過筆記時就顯示「點一下開始寫」）
  if (!store.fileExists(DATA_PATH)) data.notes = data.notes.filter(n => n.id !== "n-welcome");
  // 釘選的筆記排最前面，其他依最後修改時間
  let notes = [...data.notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated - a.updated);

  // 小工具的 Parameter（長按 →「編輯小工具」）：填分類名稱只顯示那個分類，填「未完成」只顯示還沒打勾完的清單
  const param = (args.widgetParameter || "").trim();
  let title = "", filterKey = null, missing = false; // 顯示全部時不放標題，只有「彥」圖示
  if (param === "未完成") {
    notes = notes.filter(n => n.lines.some(l => l.type === "c" && !l.done));
    title = "未完成"; filterKey = "未完成";
  } else if (param) {
    const cat = data.cats.find(c => c.name.toLowerCase() === param.toLowerCase());
    if (cat) { notes = notes.filter(n => n.cat === cat.id); title = cat.name; filterKey = "cat:" + cat.id; }
    else { notes = []; title = param; missing = true; }
  }
  // 點卡片以外的地方：打開筆記，並篩選成這個小工具的分類
  w.url = runURL(filterKey ? { filter: filterKey } : {});

  // 標題列：左上角「彥」圖示 + 筆記（或分類名稱）
  const head = w.addStack();
  head.centerAlignContent();
  head.spacing = 2; // 圖示之間靠近一點，像一組
  const logos = logoImages(), logo = logos.length > 0;
  // 大尺寸 50、中和小尺寸 41；有好幾個字時一字一個圖示並排
  const LOGO = family === "large" ? 50 : 41;
  for (const im of logos) {
    const li = head.addImage(im);
    li.imageSize = new Size(LOGO, LOGO);
  }
  if (title) { // 有設定分類時才顯示分類名稱
    const h = head.addText(title);
    h.lineLimit = 1;
    h.font = Font.heavyRoundedSystemFont(family === "small" ? 15 : 18);
    h.textColor = col(K.ink);
  }
  head.addSpacer();
  // 這台裝置還沒在 App 內執行過（圖示、底圖、貼紙都是在 App 內畫好存在這台裝置的）：提醒一下
  if (!logo) {
    const hint = head.addText("到 Scriptable 按 ▶︎ 執行一次");
    hint.font = Font.boldRoundedSystemFont(10);
    hint.textColor = col(K.body);
    hint.lineLimit = 1;
  }
  const HEAD_GAP = family === "small" ? 6 : 8;
  w.addSpacer(HEAD_GAP);

  // 卡片高度：小工具高度扣掉上下邊距（10+12）、標題列、標題下的間距；大尺寸再分成兩排
  // 每張卡片能放幾行：扣掉卡片內距、標題等固定高度約 43，每行約 17
  const GAP = 8, [WW, WH] = widgetSizes()[family];
  const area = WH - 22 - Math.max(LOGO, 24) - HEAD_GAP;
  const cardH = Math.floor(family === "large" ? (area - GAP) / 2 : area);
  const maxLines = Math.max(1, Math.floor((cardH - 43) / 17));

  if (!notes.length) {
    const e = w.addText(missing ? `找不到「${param}」這個分類。長按小工具 →「編輯小工具」，把 Parameter 改成分類名稱，或清空顯示全部。`
      : filterKey ? "這裡還沒有筆記" : "還沒有筆記，點一下開始寫");
    e.font = Font.boldRoundedSystemFont(12);
    e.textColor = col(K.body);
    w.addSpacer();
    return w;
  }
  // 小動物圖示存在 iCloud：另一台裝置可能還沒下載到本機，先下載，不然會顯示成替代圖示
  for (const n of notes.slice(0, family === "large" ? 4 : family === "medium" ? 2 : 1)) {
    if (!ANIMALS[n.icon]) continue;
    try { const p = iconPath(n.icon); if (store.fileExists(p)) await ensureLocal(p); } catch (e) {}
  }

  if (family === "small") {
    // 小尺寸只能整個小工具一個連結
    w.url = runURL({ note: notes[0].id });
    addCard(w, notes[0], data.cats, maxLines, true, WW - 24, null, cardH);
    w.addSpacer(); // 內容靠上
    return w;
  }
  // 卡片寬度：小工具寬度扣掉左右各 12 的邊距，兩張之間隔 8；只有一則筆記時佔滿整排
  const inner = WW - 24;
  const colors = distinctColors(notes.slice(0, family === "large" ? 4 : 2), data.cats);
  const rows = family === "large" ? 2 : 1;
  const grid = w.addStack();
  grid.layoutVertically();
  grid.spacing = GAP;
  for (let r = 0; r < rows; r++) {
    const pair = notes.slice(r * 2, r * 2 + 2);
    if (!pair.length) break;
    const row = grid.addStack();
    row.spacing = GAP;
    const cw = notes.length === 1 ? inner : (inner - GAP) / 2;
    pair.forEach((n, i) => addCard(row, n, data.cats, maxLines, false, cw, colors[r * 2 + i], cardH));
    if (pair.length === 1 && notes.length > 1) row.addSpacer(); // 落單的卡片靠左，保持半寬
  }
  w.addSpacer(); // 筆記少的時候內容也靠上，不會整組掉到中間
  return w;
}

// 筆記畫面的 HTML（由 build.py 從 page.html 產生，不要直接改這裡）
function pageHTML() {
  return "<!doctype html>\n<html lang=\"zh-Hant\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n<title>童趣風備忘錄</title>\n<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Gluten:wght@600;700;800&family=Noto+Sans+TC:wght@500;700;900&display=swap\">\n<style>\n/* 版面：手機寬的一欄，兩欄瀑布流卡片放在米白紙底上，下方紅色「寫筆記」；編輯畫面是底部面板，工具列有勾選清單鍵 */\n:root {\n  --sun-yellow: #FFD426; --block-blue: #3F6FD1; --tomato-red: #EE3E33; --tomato-deep: #D93A2F;\n  --lake-teal: #4FD2C2; --bubble-pink: #FF9EC4; --cream-paper: #FFFCEF; --white: #FFFFFF; --ink-navy: #262261;\n  --ios-orange: #FF9500; --phone-green: #6BD861; --orange-100: #FFE2BA; --green-100: #D5F5D0;\n  --yellow-100: #FFF0AF; --blue-100: #CFDDF8; --pink-100: #FBD3D0; --teal-100: #C9F0E9;\n  --grape: #8E6FD8; --purple-100: #E3DAFA; --rose: #F2649E; --rose-100: #FFD8E8;\n  --text-body: #5A5788; --surface-disabled: #F0EEE4; --teal-text: #3C7D74; --teal-check: #17705F;\n  --font-display: Gluten, \"Noto Sans TC\", sans-serif;\n  --font-sans: \"Noto Sans TC\", -apple-system, \"PingFang TC\", system-ui, sans-serif;\n  --radius-pill: 999px; --radius-panel: 40px; --radius-card: 28px; --radius-input: 18px; --radius-icon-btn: 10px;\n  --shadow-frame: 0 18px 40px rgba(38, 34, 97, 0.12);\n  color-scheme: light;\n}\n* { box-sizing: border-box; }\n[hidden] { display: none !important; }\nhtml, body { height: 100%; }\nbody { background: var(--cream-paper); color: var(--ink-navy); font-family: var(--font-sans); font-weight: 500; }\nsvg.ic { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; flex: none; }\nbutton { -webkit-tap-highlight-color: transparent; }\n\n.app { max-width: 480px; margin: 0 auto; padding-inline: 16px; padding-block: 18px 120px; display: flex; flex-direction: column; gap: 16px; }\n\n.head { display: flex; align-items: center; gap: 12px; }\n.logo { width: 52px; height: 52px; background: var(--sun-yellow); border-radius: 52% 48% 61% 39% / 58% 43% 57% 42%; transform: rotate(-4deg); display: grid; place-items: center; flex: none; }\n.logo svg.ic { width: 28px; height: 28px; }\n.titles { min-width: 0; flex: 1; }\n.eyebrow { font-family: var(--font-display); font-weight: 800; font-size: 12px; letter-spacing: 1px; color: var(--text-body); text-transform: uppercase; }\nh1 { margin: 0; font-size: 26px; font-weight: 900; line-height: 1.25; }\n.icon-btn { width: 40px; height: 40px; border: 0; border-radius: var(--radius-icon-btn); background: var(--white); color: var(--ink-navy); display: grid; place-items: center; cursor: pointer; flex: none; }\n.icon-btn:hover { background: var(--surface-disabled); }\n:focus-visible { outline: 3px solid var(--sun-yellow); outline-offset: 2px; }\n\n.search { display: flex; align-items: center; gap: 8px; background: var(--white); border-radius: var(--radius-pill); padding: 10px 16px; }\n.search input { border: 0; outline: 0; background: transparent; font: inherit; font-size: 16px; color: var(--ink-navy); flex: 1; min-width: 0; }\n.search input::placeholder { color: var(--text-body); }\n\n.chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }\n.chip { border: 0; border-radius: var(--radius-pill); padding: 8px 16px; font: inherit; font-weight: 900; font-size: 14px; background: var(--white); color: var(--text-body); cursor: pointer; white-space: nowrap; }\n.chip[aria-pressed=\"true\"] { background: var(--ink-navy); color: var(--white); }\n.chip .n { font-family: var(--font-display); font-weight: 800; margin-left: 4px; }\n\n/* note icon (same set as 日常記帳) */\n.nicon { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; flex: none; overflow: hidden; color: var(--ink-navy); }\n.nicon img { width: 100%; height: 100%; object-fit: cover; display: block; }\n.nicon svg { width: 58%; height: 58%; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }\n\n/* masonry */\n.grid { columns: 2; column-gap: 12px; }\n.card { break-inside: avoid; margin-bottom: 12px; background: var(--white); border-radius: var(--radius-card); padding: 14px 14px 14px; display: flex; flex-direction: column; gap: 8px; cursor: pointer; transition: transform .15s; border: 0; width: 100%; text-align: left; font: inherit; color: inherit; }\n.card:hover { transform: translateY(-2px); }\n.card:active { transform: translateY(1px); }\n.card.done-all { background: var(--teal-100); }\n.c-head { display: flex; align-items: center; gap: 8px; min-width: 0; }\n.card .nicon { width: 30px; height: 30px; }\n.sheet .c-head > .nicon { width: 48px; height: 48px; }\n.c-title { font-size: 16px; font-weight: 900; line-height: 1.35; overflow-wrap: anywhere; min-width: 0; }\n.c-text { font-size: 14px; line-height: 1.6; color: var(--text-body); overflow-wrap: anywhere; }\n.lines { display: flex; flex-direction: column; gap: 6px; }\n.chk { display: flex; gap: 8px; align-items: flex-start; font-size: 14px; line-height: 1.45; font-weight: 700; overflow-wrap: anywhere; min-width: 0; }\n.box { width: 20px; height: 20px; border-radius: 50%; border: 2.5px solid var(--ink-navy); flex: none; margin-top: 1px; display: grid; place-items: center; background: var(--white); padding: 0; }\n.box svg.ic { width: 15px; height: 15px; stroke-width: 5; color: var(--white); }\n.chk.done { color: var(--teal-text); text-decoration: line-through; text-decoration-thickness: 2px; }\n.chk.done .box { border-color: var(--teal-check); background: var(--teal-check); }\n.more { font-size: 13px; color: var(--text-body); font-weight: 700; }\n.thumbs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }\n.thumbs.three { grid-template-columns: repeat(3, 1fr); }\n.thumb { aspect-ratio: 1; max-width: 100%; border-radius: 14px; display: grid; place-items: center; position: relative; overflow: hidden; color: var(--ink-navy); }\n.thumb svg.ic { width: 46%; height: 46%; }\n.thumb .plus { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(38,34,97,.72); color: var(--white); font-family: var(--font-display); font-weight: 800; font-size: 20px; }\n.meta { display: flex; align-items: center; justify-content: space-between; gap: 6px; }\n.date { font-family: var(--font-display); font-weight: 700; font-size: 12px; color: var(--text-body); font-variant-numeric: tabular-nums; }\n.prog { font-family: var(--font-display); font-weight: 800; font-size: 13px; color: var(--ink-navy); background: var(--surface-disabled); border-radius: var(--radius-pill); padding: 1px 8px; }\n.card.done-all .prog { background: var(--white); color: var(--teal-check); }\n.empty { text-align: center; color: var(--text-body); font-weight: 700; padding: 40px 0; }\n\n.fab { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(22px + env(safe-area-inset-bottom, 0px)); border: 0; border-radius: var(--radius-pill); background: var(--tomato-deep); color: var(--white); font: inherit; font-weight: 900; font-size: 17px; padding: 14px 28px; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: transform .15s; }\n.fab:hover { transform: translateX(-50%) translateY(-2px); }\n\n/* sheet */\n.scrim { position: fixed; inset: 0; background: rgba(38,34,97,.28); display: flex; align-items: flex-end; justify-content: center; z-index: 10; }\n.sheet { background: var(--cream-paper); width: 100%; max-width: 480px; max-height: 92%; overflow-y: auto; border-radius: var(--radius-panel) var(--radius-panel) 0 0; box-shadow: var(--shadow-frame); padding: 22px 20px 0; display: flex; flex-direction: column; gap: 14px; }\n.sheet > :last-child { margin-bottom: calc(20px + env(safe-area-inset-bottom, 0px)); }\n.sheet-top { display: flex; align-items: center; gap: 10px; }\n.sheet-top .sp { flex: 1; }\n.sheet h2 { margin: 0; font-size: 22px; font-weight: 900; line-height: 1.35; overflow-wrap: anywhere; min-width: 0; }\n.sheet .c-text { font-size: 15px; line-height: 1.7; }\n.sheet .chk { font-size: 16px; }\n.sheet .chk .box { width: 24px; height: 24px; cursor: pointer; }\n.sheet .chk .box svg.ic { width: 17px; height: 17px; }\n.sheet .thumbs { grid-template-columns: repeat(3, 1fr); }\n\n.btn-save { width: 48px; height: 48px; border: 0; border-radius: 50%; background: var(--sun-yellow); color: var(--ink-navy); display: grid; place-items: center; cursor: pointer; flex: none; }\n.btn-save svg.ic { width: 28px; height: 28px; stroke-width: 4.5; }\n\n/* editor */\n.ed-title { border: 0; background: transparent; font: inherit; font-size: 22px; font-weight: 900; color: var(--ink-navy); padding: 0; min-width: 0; flex: 1; outline: 0; }\n.ed-title::placeholder { color: var(--text-body); opacity: .6; }\n.pick-btn { border: 0; background: transparent; padding: 0; cursor: pointer; border-radius: 50%; position: relative; }\n.pick-btn .nicon { width: 48px; height: 48px; }\n.pick-btn .edit-dot { position: absolute; right: -2px; bottom: -2px; width: 20px; height: 20px; border-radius: 50%; background: var(--ink-navy); color: var(--white); display: grid; place-items: center; }\n.pick-btn .edit-dot svg.ic { width: 12px; height: 12px; stroke-width: 4; }\n.icon-panel { background: var(--white); border-radius: 24px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }\n.icon-panel .lbl { font-size: 13px; font-weight: 700; color: var(--text-body); }\n.icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(46px, 1fr)); gap: 8px; }\n.icon-opt { aspect-ratio: 1; max-width: 100%; border: 0; border-radius: 16px; background: var(--cream-paper); display: grid; place-items: center; cursor: pointer; padding: 3px; color: var(--ink-navy); }\n.icon-opt .nicon { width: 100%; height: 100%; background: transparent !important; }\n.icon-opt.img .nicon { background: none; }\n.icon-opt[aria-pressed=\"true\"] { background: var(--sun-yellow); transform: rotate(-3deg); }\n\n.ed-lines { display: flex; flex-direction: column; gap: 4px; min-height: 180px; padding-bottom: 8px; }\n.ed-line { display: flex; gap: 10px; align-items: flex-start; }\n.ed-line .box { width: 24px; height: 24px; margin-top: 5px; cursor: pointer; }\n.ed-line .box svg.ic { width: 17px; height: 17px; }\n.ed-line textarea { flex: 1; min-width: 0; border: 0; outline: 0; resize: none; background: transparent; font: inherit; font-size: 17px; line-height: 1.6; color: var(--ink-navy); padding: 2px 0; overflow: hidden; height: auto; }\n.ed-line.done textarea { color: var(--teal-text); text-decoration: line-through; }\n.ed-line textarea::placeholder { color: var(--text-body); opacity: .6; }\n\n/* 編輯畫面：上面的按鈕列和下面的工具列固定，中間的內容自己捲動（鍵盤打開時也一樣） */\n.sheet.editor { overflow: hidden; gap: 10px; }\n.sheet.editor .ed-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; display: flex; flex-direction: column; gap: 14px; margin-inline: -20px; padding: 2px 20px 16px; }\n.sheet.editor > .toolbar { position: static; flex: none; margin-bottom: 0; }\n.toolbar { position: sticky; bottom: 0; margin-inline: -20px; padding: 10px 20px calc(12px + env(safe-area-inset-bottom, 0px)); background: var(--cream-paper); display: flex; justify-content: center; }\n.toolbar-inner { display: flex; gap: 6px; align-items: center; background: var(--white); border-radius: var(--radius-pill); padding: 6px 10px; box-shadow: 0 4px 14px rgba(38,34,97,.08); }\n.tool { border: 0; background: transparent; color: var(--ink-navy); border-radius: var(--radius-pill); height: 44px; min-width: 52px; padding: 0 12px; display: flex; align-items: center; gap: 6px; cursor: pointer; font: inherit; font-weight: 900; font-size: 14px; }\n.tool:hover { background: var(--surface-disabled); }\n.tool.on { background: var(--teal-100); color: var(--teal-check); }\n.tool svg.ic { width: 28px; height: 28px; stroke-width: 3.4; }\n.tool-sep { width: 2px; height: 26px; background: var(--surface-disabled); border-radius: 2px; }\n.ed-photos .thumb { cursor: default; }\n\n\n@media (prefers-reduced-motion: reduce) { .card, .fab { transition: none; } }\n/* categories */\n.tag { align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; border-radius: var(--radius-pill); padding: 3px 10px; font-size: 12px; font-weight: 900; letter-spacing: 1px; color: var(--ink-navy); border: 0; font-family: inherit; }\n.t-yellow { background: var(--yellow-100); } .t-blue { background: var(--blue-100); } .t-pink { background: var(--pink-100); } .t-teal { background: var(--teal-100); } .t-orange { background: var(--orange-100); } .t-green { background: var(--green-100); } .t-purple { background: var(--purple-100); } .t-rose { background: var(--rose-100); }\n.card.done-all .tag { background: var(--white); }\n.cat-box { display: flex; flex-direction: column; gap: 10px; }\n.lbl-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }\n.lbl { font-size: 13px; font-weight: 700; color: var(--text-body); }\n.link-btn { border: 0; background: transparent; font: inherit; font-size: 14px; font-weight: 900; color: var(--block-blue); cursor: pointer; padding: 4px 6px; border-radius: 8px; }\n.cat-row { display: flex; flex-wrap: wrap; gap: 8px; }\n.cat-row .tag { font-size: 15px; padding: 8px 16px; cursor: pointer; border: 2.5px solid transparent; letter-spacing: .5px; }\n.cat-row .tag[aria-pressed=\"true\"] { border-color: var(--ink-navy); }\n.cat-row .tag.add { background: transparent; border: 2.5px dashed var(--text-body); color: var(--text-body); }\n.cat-edit { display: inline-flex; align-items: center; gap: 4px; border-radius: var(--radius-pill); padding: 4px 6px 4px 6px; }\n.cat-edit input { border: 0; background: var(--white); border-radius: var(--radius-pill); font: inherit; font-size: 15px; font-weight: 900; color: var(--ink-navy); padding: 5px 10px; width: 6.5em; min-width: 0; }\n.mini { width: 30px; height: 30px; border: 0; border-radius: 50%; background: var(--white); color: var(--ink-navy); display: grid; place-items: center; cursor: pointer; padding: 0; flex: none; font: inherit; }\n.mini svg.ic { width: 16px; height: 16px; stroke-width: 4; }\n.mini.swatch { border: 2.5px solid var(--ink-navy); }\n.cat-row.editing { flex-direction: column; align-items: flex-start; }\n.cat-item { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; max-width: 100%; }\n.palette { display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 2px; }\n.palette .dot { width: 34px; height: 34px; border-radius: 50%; border: 3px solid transparent; display: grid; place-items: center; cursor: pointer; padding: 0; }\n.palette .dot[aria-pressed=\"true\"] { border-color: var(--ink-navy); }\n.palette .dot svg.ic { width: 18px; height: 18px; stroke-width: 5; }\n.add-box { display: flex; flex-direction: column; gap: 8px; }\n.new-dot { width: 20px; height: 20px; border-radius: 50%; flex: none; }\n.mini.danger { width: auto; padding: 0 10px; border-radius: var(--radius-pill); background: var(--tomato-deep); color: var(--white); font-size: 13px; font-weight: 900; }\n.add-row { display: flex; gap: 8px; align-items: center; }\n.add-row input { flex: 1; min-width: 0; border: 0; border-radius: var(--radius-input); background: var(--white); padding: 10px 14px; font: inherit; font-size: 16px; color: var(--ink-navy); }\n.btn-sm { border: 0; border-radius: var(--radius-pill); padding: 10px 18px; font: inherit; font-weight: 900; font-size: 15px; background: var(--block-blue); color: var(--white); cursor: pointer; flex: none; }\n.chip.manage { background: transparent; border: 2.5px dashed var(--text-body); padding: 6px 14px; }\n\n/* photos */\n.thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }\n.thumb[data-src] { cursor: zoom-in; }\n.thumb .rm { position: absolute; top: 5px; right: 5px; width: 26px; height: 26px; border-radius: 50%; border: 0; background: rgba(38,34,97,.8); color: var(--white); display: grid; place-items: center; cursor: pointer; padding: 0; }\n.thumb .rm svg.ic { width: 14px; height: 14px; stroke-width: 4.5; }\n.ed-photos .thumbs { grid-template-columns: repeat(3, 1fr); }\n.lightbox { position: fixed; inset: 0; z-index: 20; background: rgba(38,34,97,.92); display: grid; place-items: center; padding: 24px 16px; cursor: zoom-out; }\n.lightbox img { max-width: 100%; max-height: 100%; border-radius: 20px; }\n.busy { font-size: 13px; font-weight: 700; color: var(--text-body); }\n\n/* Scriptable 版：避開瀏海、提示訊息 */\n/* Scriptable 在畫面最上面疊了自己的「Close」和分享鍵，內容和面板都往下讓出這一條 */\n:root { --top-bar: max(58px, calc(env(safe-area-inset-top, 0px) + 48px)); }\n.app { padding-top: var(--top-bar); }\n.scrim { padding-top: var(--top-bar); }\n.sheet { max-height: 100%; }\n.lightbox { padding-top: var(--top-bar); }\n.toast { position: fixed; left: 50%; transform: translateX(-50%); top: var(--top-bar); z-index: 30; background: var(--ink-navy); color: var(--white); border-radius: var(--radius-pill); padding: 10px 18px; font-weight: 900; font-size: 14px; max-width: calc(100% - 32px); }\n.logo { border: 0; padding: 0; cursor: pointer; color: var(--ink-navy); }\n.logo.img { background: none; border-radius: 0; transform: none; width: auto; height: 56px; display: flex; gap: 2px; }\n.logo.img img { width: 56px; height: 56px; display: block; }\n.hint { font-size: 13px; color: var(--text-body); font-weight: 700; margin: 0; line-height: 1.6; }\n.logo-input { border: 0; border-radius: var(--radius-input); background: var(--white); padding: 12px 14px; font: inherit; font-size: 22px; font-weight: 900; color: var(--ink-navy); letter-spacing: 6px; width: 100%; }\n.logo-row { display: flex; gap: 10px; justify-content: flex-end; }\n.nicon.sticker { border-radius: 0; overflow: visible; }\n.nicon.sticker svg { width: 100%; height: 100%; fill: none; stroke: none; }\n.icon-btn.pin-btn[aria-pressed=\"true\"] { background: var(--sun-yellow); }\n.pin-badge { margin-left: auto; color: var(--tomato-deep); flex: none; display: grid; place-items: center; }\n.pin-badge svg.ic { width: 18px; height: 18px; stroke-width: 3.6; fill: var(--tomato-deep); }\n</style>\n\n</head>\n<body>\n<svg width=\"0\" height=\"0\" style=\"position:absolute\" aria-hidden=\"true\">\n  <symbol id=\"ic-search\" viewBox=\"0 0 48 48\"><circle cx=\"21\" cy=\"21\" r=\"12\"/><path d=\"M30 31l9 9\"/></symbol>\n  <symbol id=\"ic-plus\" viewBox=\"0 0 48 48\"><path d=\"M24 11v26M11 24h26\"/></symbol>\n  <symbol id=\"ic-check\" viewBox=\"0 0 48 48\"><path d=\"M11 25l9 9 17-19\"/></symbol>\n  <symbol id=\"ic-close\" viewBox=\"0 0 48 48\"><path d=\"M14 14l20 20M34 14L14 34\"/></symbol>\n  <symbol id=\"ic-back\" viewBox=\"0 0 48 48\"><path d=\"M29 11L16 24l13 13\"/></symbol>\n  <symbol id=\"ic-pencil\" viewBox=\"0 0 48 48\"><path d=\"M30 10l8 8-20 20-10 2 2-10z M26 14l8 8\"/></symbol>\n  <symbol id=\"ic-note\" viewBox=\"0 0 48 48\"><path d=\"M13 8h17l8 8v23a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z\"/><path d=\"M17 22h14M17 29h10\"/></symbol>\n  <symbol id=\"ic-checklist\" viewBox=\"0 0 48 48\"><circle cx=\"11\" cy=\"14\" r=\"5\"/><path d=\"M8.5 14l2 2 3.5-4\"/><circle cx=\"11\" cy=\"33\" r=\"5\"/><path d=\"M22 14h18M22 33h18\"/></symbol>\n  <symbol id=\"ic-bottle\" viewBox=\"0 0 48 48\"><path d=\"M19 7h10v6H19z\"/><path d=\"M17 13h14c2 0 3 1 3 3v23c0 2-1 3-3 3H17c-2 0-3-1-3-3V16c0-2 1-3 3-3z\"/><path d=\"M14 23h20v10H14\"/></symbol>\n  <symbol id=\"ic-tube\" viewBox=\"0 0 48 48\"><path d=\"M16 9h16l-2 26H18z\"/><path d=\"M20 35h8v6h-8z\"/><path d=\"M19 17h10\"/></symbol>\n  <symbol id=\"ic-box\" viewBox=\"0 0 48 48\"><path d=\"M8 16l16-8 16 8v17L24 41 8 33z\"/><path d=\"M8 16l16 8 16-8M24 24v17\"/></symbol>\n  <symbol id=\"ic-photo\" viewBox=\"0 0 48 48\"><rect x=\"7\" y=\"10\" width=\"34\" height=\"28\" rx=\"5\"/><circle cx=\"17\" cy=\"19\" r=\"3\"/><path d=\"M8 34l11-10 8 7 5-4 9 8\"/></symbol>\n  <symbol id=\"ic-star\" viewBox=\"0 0 48 48\"><path d=\"M24 6l5.3 11.2 12.2 1.6-9 8.4 2.3 12.1L24 33.4l-10.8 5.9 2.3-12.1-9-8.4 12.2-1.6z\"/></symbol>\n  <symbol id=\"ic-pin\" viewBox=\"0 0 48 48\"><path d=\"M17 7h14l-2.5 13 7.5 8H12l7.5-8Z\"/><path d=\"M24 28v14\"/></symbol>\n  <symbol id=\"ic-trash\" viewBox=\"0 0 48 48\"><path d=\"M9 13h30M19 13V9h10v4M13 13l2 26h18l2-26M21 21v12M27 21v12\"/></symbol>\n</svg>\n\n<main class=\"app\">\n  <header class=\"head\">\n    <button class=\"logo\" id=\"logo\" aria-label=\"改左上角的字\"><svg class=\"ic\"><use href=\"#ic-note\"/></svg></button>\n    <div class=\"titles\"></div><!-- 左上角只放「彥」圖示，不放標題文字 -->\n    <button class=\"icon-btn\" id=\"searchToggle\" aria-label=\"搜尋\"><svg class=\"ic\"><use href=\"#ic-search\"/></svg></button>\n  </header>\n\n  <div class=\"search\" id=\"searchBar\" hidden>\n    <svg class=\"ic\"><use href=\"#ic-search\"/></svg>\n    <input id=\"q\" type=\"search\" placeholder=\"找筆記，例如：益生菌\" autocomplete=\"off\">\n  </div>\n\n  <nav class=\"chips\" id=\"chips\" aria-label=\"篩選\"></nav>\n\n  <section class=\"grid\" id=\"grid\" aria-live=\"polite\"></section>\n</main>\n\n<button class=\"fab\" id=\"fab\"><svg class=\"ic\"><use href=\"#ic-plus\"/></svg>寫筆記</button>\n\n<div class=\"scrim\" id=\"scrim\" hidden></div>\n<div class=\"lightbox\" id=\"lightbox\" hidden></div>\n<div class=\"toast\" id=\"toast\" role=\"status\" hidden></div>\n\n<script>\nconst ICONS = [\"lion\",\"pig\",\"giraffe\",\"bear\",\"monkey\",\"bee\",\"owl\",\"fox\",\"sheep\",\"penguin\",\"koala\",\"frog\",\"rabbit\",\"star\",\"heart\",\"diamond\",\"music\",\"clothes\",\"pencil\",\"pets\",\"sun\",\"moon\",\"cloud\",\"partlycloudy\",\"cloudynight\",\"overcast\",\"rain\",\"thunderstorm\",\"lightning\",\"snow\",\"rainbow\",\"gift\",\"balloon\",\"fork\",\"drink\",\"idea\",\"shoppingbag\",\"travel\",\"train\",\"bus\",\"car\",\"bicycle\",\"camera\",\"location\"];\nconst ICON_SVGS = {\n    star: '<path d=\"M12 3l2.4 5.5 6 .6-4.5 4 1.3 5.9L12 16l-5.2 3 1.3-5.9-4.5-4 6-.6Z\"/>',\n    heart: '<path d=\"M12 20s-7-4.4-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5c-2.5 4.6-9.5 9-9.5 9Z\"/>',\n    diamond: '<path d=\"M12 4L15 12L12 20L9 12Z\"/>',\n    music: '<path d=\"M9 18V5l10-2v13\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/><circle cx=\"16\" cy=\"16\" r=\"3\"/>',\n    pencil: '<path d=\"M4 20l1-4L16 5l3 3L8 19l-4 1Z\"/><path d=\"M14 7l3 3\"/>',\n    pets: '<circle cx=\"12\" cy=\"15\" r=\"3.4\"/><circle cx=\"6.5\" cy=\"10\" r=\"1.6\"/><circle cx=\"10\" cy=\"7\" r=\"1.6\"/><circle cx=\"14\" cy=\"7\" r=\"1.6\"/><circle cx=\"17.5\" cy=\"10\" r=\"1.6\"/>',\n    clothes: '<path d=\"M8 4 4 7l2 3 2-1.3V20h8V8.7L18 10l2-3-4-3-2 1.5h-4Z\"/>',\n    sun: '<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1\"/>',\n    moon: '<path d=\"M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z\"/>',\n    cloud: '<path d=\"M7 18h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.1 10.1 4 4 0 0 0 7 18Z\"/>',\n    partlycloudy: '<circle cx=\"8\" cy=\"8\" r=\"3\"/><path d=\"M8 3v1.2M8 12.8V14M3 8h1.2M12.8 8H14M4.5 4.5l.9.9M11.5 4.5l-.9.9\"/><path d=\"M10 20h7a3.5 3.5 0 0 0 .4-6.98A4.5 4.5 0 0 0 9.2 12.4 3.2 3.2 0 0 0 10 20Z\"/>',\n    cloudynight: '<path d=\"M15 8.2A4 4 0 1 1 10.9 4a3.2 3.2 0 0 0 4.1 4.2Z\"/><path d=\"M9 20h7a3.5 3.5 0 0 0 .4-6.98A4.5 4.5 0 0 0 8.2 12.4 3.2 3.2 0 0 0 9 20Z\"/>',\n    overcast: '<path d=\"M7 14h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.1 6.1 4 4 0 0 0 7 14Z\"/><line x1=\"5\" y1=\"18\" x2=\"19\" y2=\"18\"/>',\n    rain: '<path d=\"M7 13h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.1 5.1 4 4 0 0 0 7 13Z\"/><path d=\"M8 17l-1 3M12 17l-1 3M16 17l-1 3\"/>',\n    thunderstorm: '<path d=\"M7 12h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.1 4.1 4 4 0 0 0 7 12Z\"/><path d=\"M13 13l-3 5h3l-2 4\"/>',\n    lightning: '<path d=\"M13 2 4 14h6l-1 8 9-12h-6Z\"/>',\n    snow: '<path d=\"M7 11h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.1 3.1 4 4 0 0 0 7 11Z\"/><circle cx=\"8\" cy=\"18\" r=\".6\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12\" cy=\"19\" r=\".6\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"16\" cy=\"18\" r=\".6\" fill=\"currentColor\" stroke=\"none\"/>',\n    rainbow: '<path d=\"M3 18a9 9 0 0 1 18 0\"/><path d=\"M6.5 18a5.5 5.5 0 0 1 11 0\"/>',\n    gift: '<rect x=\"4\" y=\"10\" width=\"16\" height=\"10\" rx=\"1.5\"/><line x1=\"4\" y1=\"14\" x2=\"20\" y2=\"14\"/><line x1=\"12\" y1=\"10\" x2=\"12\" y2=\"20\"/><path d=\"M12 10c-2-4-6-3-6-1s3 1 6 1Zm0 0c2-4 6-3 6-1s-3 1-6 1Z\"/>',\n    idea: '<path d=\"M9 18h6M10 21h4\"/><path d=\"M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5a2.6 2.6 0 0 1 1.1-2.2A6 6 0 0 0 12 3Z\"/>',\n    shoppingbag: '<path d=\"M6 8h12l-1 12H7Z\"/><path d=\"M9 8V6a3 3 0 0 1 6 0v2\"/>',\n    travel: '<path d=\"M21 4 3 11l6 2 2 6 3-4 5 3Z\"/>',\n    train: '<rect x=\"6\" y=\"4\" width=\"12\" height=\"12\" rx=\"4\"/><line x1=\"6\" y1=\"11\" x2=\"18\" y2=\"11\"/><circle cx=\"9\" cy=\"15.5\" r=\".8\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"15\" cy=\"15.5\" r=\".8\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M8 19l-2 2M16 19l2 2\"/>',\n    bus: '<rect x=\"3\" y=\"6\" width=\"18\" height=\"10\" rx=\"2\"/><line x1=\"3\" y1=\"11\" x2=\"21\" y2=\"11\"/><circle cx=\"7.5\" cy=\"18.5\" r=\"1.4\"/><circle cx=\"16.5\" cy=\"18.5\" r=\"1.4\"/>',\n    car: '<path d=\"M4 16V12l2-4h12l2 4v4\"/><path d=\"M4 16h16\"/><circle cx=\"7.5\" cy=\"16.5\" r=\"1.6\"/><circle cx=\"16.5\" cy=\"16.5\" r=\"1.6\"/>',\n    bicycle: '<circle cx=\"6\" cy=\"17\" r=\"3.2\"/><circle cx=\"18\" cy=\"17\" r=\"3.2\"/><path d=\"M6 17l4-9h4l-3 6h7l-3-5\"/>',\n    camera: '<rect x=\"3\" y=\"7\" width=\"18\" height=\"13\" rx=\"2\"/><path d=\"M8 7l1.5-3h5L16 7\"/><circle cx=\"12\" cy=\"13.5\" r=\"4\"/>',\n    location: '<path d=\"M12 21s7-7.2 7-12a7 7 0 0 0-14 0c0 4.8 7 12 7 12Z\"/><circle cx=\"12\" cy=\"9\" r=\"2.3\"/>',\n    pig: '<path d=\"M7.5 8.5 9 6 10.5 8.3M13.5 8.3 15 6 16.5 8.5\"/><circle cx=\"12\" cy=\"13.5\" r=\"6.5\"/><ellipse cx=\"12\" cy=\"15.3\" rx=\"2.3\" ry=\"1.6\"/><circle cx=\"11.1\" cy=\"15.3\" r=\".35\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12.9\" cy=\"15.3\" r=\".35\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"9.6\" cy=\"12\" r=\".5\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"14.4\" cy=\"12\" r=\".5\" fill=\"currentColor\" stroke=\"none\"/>',\n    giraffe: '<line x1=\"9.5\" y1=\"7.8\" x2=\"9\" y2=\"5\"/><circle cx=\"9\" cy=\"4.5\" r=\".7\" fill=\"currentColor\" stroke=\"none\"/><line x1=\"14.5\" y1=\"7.8\" x2=\"15\" y2=\"5\"/><circle cx=\"15\" cy=\"4.5\" r=\".7\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12\" cy=\"13.5\" r=\"6.5\"/><ellipse cx=\"12\" cy=\"16.8\" rx=\"2\" ry=\"1.3\"/><circle cx=\"9.4\" cy=\"12\" r=\".5\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"14.6\" cy=\"12\" r=\".5\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"8\" cy=\"14.5\" r=\".9\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"16\" cy=\"15\" r=\".9\" fill=\"currentColor\" stroke=\"none\"/>',\n    bear: '<circle cx=\"7.3\" cy=\"8.2\" r=\"2.3\"/><circle cx=\"16.7\" cy=\"8.2\" r=\"2.3\"/><circle cx=\"12\" cy=\"13.8\" r=\"6.5\"/><ellipse cx=\"12\" cy=\"16\" rx=\"2.2\" ry=\"1.5\"/><circle cx=\"9.5\" cy=\"12\" r=\".5\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"14.5\" cy=\"12\" r=\".5\" fill=\"currentColor\" stroke=\"none\"/>',\n    monkey: '<circle cx=\"6.3\" cy=\"12.5\" r=\"2.6\"/><circle cx=\"17.7\" cy=\"12.5\" r=\"2.6\"/><circle cx=\"12\" cy=\"13\" r=\"6.5\"/><ellipse cx=\"12\" cy=\"14.7\" rx=\"3.6\" ry=\"3.1\"/><circle cx=\"10\" cy=\"12.8\" r=\".5\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"14\" cy=\"12.8\" r=\".5\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M10.3 16.5q1.7 1.1 3.4 0\"/>',\n    lion: '<line x1=\"17.5\" y1=\"13\" x2=\"19.7\" y2=\"13\"/><line x1=\"15.9\" y1=\"9.1\" x2=\"17.4\" y2=\"7.6\"/><line x1=\"12\" y1=\"7.5\" x2=\"12\" y2=\"5.3\"/><line x1=\"8.1\" y1=\"9.1\" x2=\"6.6\" y2=\"7.6\"/><line x1=\"6.5\" y1=\"13\" x2=\"4.3\" y2=\"13\"/><line x1=\"8.1\" y1=\"16.9\" x2=\"6.6\" y2=\"18.4\"/><line x1=\"12\" y1=\"18.5\" x2=\"12\" y2=\"20.7\"/><line x1=\"15.9\" y1=\"16.9\" x2=\"17.4\" y2=\"18.4\"/><circle cx=\"12\" cy=\"13\" r=\"5.5\"/><ellipse cx=\"12\" cy=\"15.2\" rx=\"2\" ry=\"1.4\"/><circle cx=\"9.9\" cy=\"11.7\" r=\".5\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"14.1\" cy=\"11.7\" r=\".5\" fill=\"currentColor\" stroke=\"none\"/>'\n  };\n// 筆記圖示的貼紙樣式：線條圖示（跟日常記帳同一套）加上塗色和不規則底色，畫法跟童趣風月曆的生日貼紙一樣。\n// App 畫面和主畫面小工具共用這一份；build.py 會把它塞進 page.html 和 kids-notes.js。\n// fill：第幾個圖形要塗什麼顏色（依 ICON_SVGS 裡元素的順序，從 0 開始）；stroke：改線條顏色；chip：底色\nconst STICKER_INK = \"#262261\";\nconst STICKER_CHIP = {\n  yellow: \"#FFF0AF\", orange: \"#FFE2BA\", green: \"#D5F5D0\", blue: \"#CFDDF8\",\n  pink: \"#FBD3D0\", teal: \"#C9F0E9\", purple: \"#E3DAFA\", rose: \"#FFD8E8\",\n};\nconst STICKER_COLORS = {\n  yellow: \"#FFD426\", red: \"#EE3E33\", orange: \"#FF9500\", green: \"#6BD861\", sky: \"#8CC4EE\", blue: \"#3F6FD1\",\n  teal: \"#4FD2C2\", pink: \"#FF9EC4\", lilac: \"#B9A3F0\", white: \"#FFFFFF\", mist: \"#E4E2F2\", balloon: \"#7DCB6E\", milkTea: \"#D9B48F\",\n};\nconst STICKERS = {\n  star: { chip: \"yellow\", fill: { 0: STICKER_COLORS.yellow } },\n  heart: { chip: \"pink\", fill: { 0: STICKER_COLORS.red } },\n  diamond: { chip: \"blue\", fill: { 0: STICKER_COLORS.sky } },\n  music: { chip: \"purple\", fill: { 1: STICKER_COLORS.lilac, 2: STICKER_COLORS.lilac } },\n  pencil: { chip: \"orange\", fill: { 0: STICKER_COLORS.yellow } },\n  pets: { chip: \"rose\", fill: { 0: STICKER_COLORS.pink, 1: STICKER_COLORS.pink, 2: STICKER_COLORS.pink, 3: STICKER_COLORS.pink, 4: STICKER_COLORS.pink } },\n  clothes: { chip: \"green\", fill: { 0: STICKER_COLORS.green } },\n  sun: { chip: \"orange\", fill: { 0: STICKER_COLORS.yellow } },\n  moon: { chip: \"purple\", fill: { 0: STICKER_COLORS.yellow } },\n  cloud: { chip: \"blue\", fill: { 0: STICKER_COLORS.white } },\n  partlycloudy: { chip: \"blue\", fill: { 0: STICKER_COLORS.yellow, 2: STICKER_COLORS.white } },\n  cloudynight: { chip: \"purple\", fill: { 0: STICKER_COLORS.yellow, 1: STICKER_COLORS.white } },\n  overcast: { chip: \"blue\", fill: { 0: STICKER_COLORS.mist } },\n  rain: { chip: \"blue\", fill: { 0: STICKER_COLORS.white }, stroke: { 1: STICKER_COLORS.blue } },\n  thunderstorm: { chip: \"purple\", fill: { 0: STICKER_COLORS.mist }, stroke: { 1: STICKER_COLORS.orange } },\n  lightning: { chip: \"yellow\", fill: { 0: STICKER_COLORS.yellow } },\n  snow: { chip: \"teal\", fill: { 0: STICKER_COLORS.white } },\n  rainbow: { chip: \"yellow\", stroke: { 0: STICKER_COLORS.red, 1: STICKER_COLORS.blue } },\n  gift: { chip: \"blue\", fill: { 0: STICKER_COLORS.sky, 3: STICKER_COLORS.red } },\n  balloon: { chip: \"teal\", fill: { 0: STICKER_COLORS.balloon, 1: STICKER_COLORS.balloon } },\n  fork: { chip: \"orange\", fill: { 0: STICKER_COLORS.white, 2: STICKER_COLORS.white } },\n  drink: { chip: \"teal\", fill: { 0: STICKER_COLORS.milkTea, 1: STICKER_COLORS.white } },\n  idea: { chip: \"yellow\", fill: { 1: STICKER_COLORS.yellow } },\n  shoppingbag: { chip: \"orange\", fill: { 0: STICKER_COLORS.orange } },\n  travel: { chip: \"teal\", fill: { 0: STICKER_COLORS.sky } },\n  train: { chip: \"yellow\", fill: { 0: STICKER_COLORS.red, 2: STICKER_COLORS.yellow, 3: STICKER_COLORS.yellow } },\n  bus: { chip: \"teal\", fill: { 0: STICKER_COLORS.green, 2: STICKER_COLORS.white, 3: STICKER_COLORS.white } },\n  car: { chip: \"blue\", fill: { 0: STICKER_COLORS.yellow, 2: STICKER_COLORS.white, 3: STICKER_COLORS.white } },\n  bicycle: { chip: \"green\", fill: { 0: STICKER_COLORS.white, 1: STICKER_COLORS.white } },\n  camera: { chip: \"purple\", fill: { 0: STICKER_COLORS.lilac, 2: STICKER_COLORS.white } },\n  location: { chip: \"rose\", fill: { 0: STICKER_COLORS.red, 1: STICKER_COLORS.white } },\n};\n// 新增的圖示（24×24，跟其他線條圖示同一個格子）\n// 氣球：球、綁口、線、反光；叉子：叉頭、中間的齒、叉柄；飲料杯：杯身、杯蓋、吸管、珍珠\nconst EXTRA_ICON_SVGS = {\n  balloon: '<path d=\"M12 2.8c3.9 0 6.6 2.9 6.6 6.6s-3.2 6.3-6.6 7.3c-3.4-1-6.6-3.6-6.6-7.3S8.1 2.8 12 2.8Z\"/><path d=\"M10.8 18.4 12 16.7l1.2 1.7Z\"/><path d=\"M12 18.4c-1.6 1.4 1.6 2.4 0 4.2\"/><path d=\"M8.6 8.4c.3-1.5 1.3-2.5 2.6-2.8\"/>',\n  fork: '<path d=\"M8.5 2.8v5.4a3.5 3.5 0 0 0 7 0V2.8\"/><path d=\"M12 2.8v5.4\"/><path d=\"M10.8 11.6h2.4l-.3 8.9a.9.9 0 0 1-1.8 0Z\"/>',\n  drink: '<path d=\"M6.8 9.4h10.4l-1.3 10.9a1.6 1.6 0 0 1-1.6 1.4H9.7a1.6 1.6 0 0 1-1.6-1.4Z\"/><path d=\"M5.8 9.4h12.4V8a1.8 1.8 0 0 0-1.8-1.8H7.6A1.8 1.8 0 0 0 5.8 8Z\"/><path d=\"M12.8 6.2 14.6 2.4h2.6\"/><circle cx=\"10\" cy=\"18.2\" r=\".9\" fill=\"currentColor\"/><circle cx=\"12.3\" cy=\"19.2\" r=\".9\" fill=\"currentColor\"/><circle cx=\"14.4\" cy=\"17.8\" r=\".9\" fill=\"currentColor\"/>',\n};\n\n// 不規則色塊的 8 個圓角百分比（同童趣風月曆的 R1–R4），依圖示名稱挑一組、旋轉 ±4 度\nconst STICKER_BLOBS = [[52, 48, 61, 39, 58, 43, 57, 42], [60, 40, 44, 56, 46, 55, 45, 54], [45, 55, 52, 48, 62, 40, 60, 38], [55, 45, 48, 52, 44, 58, 42, 56]];\nfunction stickerHash(s) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }\n\n// 不規則色塊的 SVG 路徑（寬 w、高 h，左上角在 0,0）\nfunction blobPathD(w, h, r) {\n  const [a, b, c, d, e, f, g, k] = r.map((v) => v / 100);\n  return `M${a * w} 0H${w - b * w}A${b * w} ${f * h} 0 0 1 ${w} ${f * h}V${h - g * h}A${c * w} ${g * h} 0 0 1 ${w - c * w} ${h}`\n    + `H${d * w}A${d * w} ${k * h} 0 0 1 0 ${h - k * h}V${e * h}A${a * w} ${e * h} 0 0 1 ${a * w} 0Z`;\n}\n\n// 一個圖示的完整貼紙 SVG（viewBox 24×24）：底下不規則色塊，上面是塗好色的線條圖示\nfunction stickerSVG(key, svgs) {\n  const spec = STICKERS[key] || { chip: \"yellow\", fill: {} };\n  const inner = svgs[key] || svgs.star;\n  let i = 0;\n  const body = inner.replace(/<(\\w+)([^>]*?)\\/>/g, (m, tag, attrs) => {\n    const idx = i++;\n    if (/fill=\"currentColor\"/.test(attrs)) return `<${tag}${attrs.replace('fill=\"currentColor\"', `fill=\"${STICKER_INK}\"`)}/>`;\n    const fill = spec.fill && spec.fill[idx] ? spec.fill[idx] : \"none\";\n    const stroke = spec.stroke && spec.stroke[idx] ? ` stroke=\"${spec.stroke[idx]}\" stroke-width=\"2.8\"` : \"\";\n    return `<${tag}${attrs} fill=\"${fill}\"${stroke}/>`;\n  });\n  const h = stickerHash(key), deg = (h % 9) - 4;\n  // 寫明寬高，畫成 PNG 時才不會被當成 300×150 而變形\n  return `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"96\" height=\"96\" viewBox=\"0 0 24 24\">`\n    + `<path d=\"${blobPathD(22, 22, STICKER_BLOBS[h % 4])}\" transform=\"translate(1 1) rotate(${deg} 11 11)\" fill=\"${STICKER_CHIP[spec.chip]}\"/>`\n    + `<g transform=\"translate(4.4 4.4) scale(.633)\" stroke=\"${STICKER_INK}\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">${body}</g>`\n    + `</svg>`;\n}\nObject.assign(ICON_SVGS, EXTRA_ICON_SVGS);\nconst BOOT = /*BOOT*/null;\n</script>\n<script>\n// Scriptable 打開這一頁時，BOOT 會帶入 iCloud 裡的分類、筆記、照片縮圖和小動物圖示\nconst boot = BOOT || { cats: [], notes: [], thumbs: {}, iconImages: {} };\nconst ICON_IMAGES = boot.iconImages || {};\nconst THUMBS = boot.thumbs || {};\n\nconst CHIP_BG = [\"var(--yellow-100)\", \"var(--blue-100)\", \"var(--orange-100)\", \"var(--pink-100)\", \"var(--green-100)\", \"var(--teal-100)\", \"var(--purple-100)\", \"var(--rose-100)\"];\nconst CAT_COLORS = [\"yellow\", \"orange\", \"green\", \"blue\", \"pink\", \"teal\", \"purple\", \"rose\"];\nconst COLOR_NAMES = { yellow: \"黃\", orange: \"橘\", green: \"綠\", blue: \"藍\", pink: \"粉\", teal: \"青\", purple: \"紫\", rose: \"桃紅\" };\nconst CAT_STRONG = { yellow: \"sun-yellow\", orange: \"ios-orange\", green: \"phone-green\", blue: \"block-blue\", pink: \"bubble-pink\", teal: \"lake-teal\", purple: \"grape\", rose: \"rose\" };\n\n// 筆記內容是一行一行：c = 勾選項目，t = 文字\nconst C = (s, d) => ({ type: \"c\", text: s, done: !!d });\nconst T = (s) => ({ type: \"t\", text: s });\n\nlet cats = boot.cats;\nlet notes = boot.notes;\n\nlet filter = \"全部\";\nlet query = \"\";\nconst $ = (s) => document.querySelector(s);\nconst esc = (s) => String(s).replace(/[&<>\"]/g, (c) => ({ \"&\": \"&amp;\", \"<\": \"&lt;\", \">\": \"&gt;\", '\"': \"&quot;\" }[c]));\nconst icon = (id) => `<svg class=\"ic\"><use href=\"#ic-${id}\"/></svg>`;\nconst hash = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };\nconst catOf = (id) => cats.find((c) => c.id === id);\nconst uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);\n\n/* ---------- 跟 Scriptable 溝通：要做的事放進 outbox，再用 kidsnotes:// 網址叫 Scriptable 來拿 ---------- */\nlet outbox = [];\nlet pingTimer = null, saveTimer = null;\nfunction ping() {\n  location.href = \"kidsnotes://ping?\" + Date.now();\n  clearTimeout(pingTimer);\n  // 萬一這次沒被收到，過一下再叫一次，直到 outbox 清空\n  pingTimer = setTimeout(() => { if (outbox.length) ping(); }, 1500);\n}\nfunction send(cmd) { outbox.push(cmd); ping(); }\nwindow.__takeOutbox = () => {\n  const out = outbox; outbox = [];\n  return JSON.stringify(out);\n};\n// 有改動就在 0.3 秒後存一次（連續打勾只存最後一次）\nfunction changed() {\n  clearTimeout(saveTimer);\n  saveTimer = setTimeout(() => {\n    outbox = outbox.filter((c) => c.type !== \"save\");\n    send({ type: \"save\", cats, notes });\n  }, 300);\n}\n// 關掉畫面前 Scriptable 會直接呼叫這個，確保最後的改動有存到\nwindow.__finalState = () => { commitEditor(); return JSON.stringify({ cats, notes }); };\n\n// 編輯中的筆記：不管是按完成、按返回、點面板外面，還是直接按 Scriptable 的 Close，都會先存起來（跟 iPhone 備忘錄一樣）\nlet editorCommit = null;\nfunction commitEditor() { const c = editorCommit; editorCommit = null; if (c) c(); }\n\nfunction toast(msg) {\n  const t = $(\"#toast\"); t.textContent = msg; t.hidden = false;\n  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 2200);\n}\n\nfunction fmtDate(ms) {\n  const d = new Date(ms), p = (x) => String(x).padStart(2, \"0\");\n  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;\n}\n\n// 小動物用圖片；其他圖示是塗好色、有不規則底色的貼紙（stickers.js）\nfunction noteIcon(key) {\n  if (ICON_IMAGES[key]) return `<span class=\"nicon\"><img src=\"${ICON_IMAGES[key]}\" alt=\"\"></span>`;\n  return `<span class=\"nicon sticker\">${stickerSVG(ICON_SVGS[key] ? key : \"star\", ICON_SVGS)}</span>`;\n}\n\nfunction photoInner(id) {\n  return THUMBS[id] ? `<img src=\"${THUMBS[id]}\" alt=\"\">` : icon(\"photo\");\n}\n\nfunction thumbsHTML(photos, max, opts = {}) {\n  if (!photos || !photos.length) return \"\";\n  const shown = photos.slice(0, max);\n  const extra = photos.length - max;\n  return `<div class=\"${max > 4 ? \"thumbs three\" : \"thumbs\"}\">` + shown.map((id, i) => {\n    const plus = extra > 0 && i === shown.length - 1 ? `<span class=\"plus\">+${extra + 1}</span>` : \"\";\n    const rm = opts.removable ? `<button class=\"rm\" data-rm=\"${i}\" aria-label=\"移除照片\">${icon(\"close\")}</button>` : \"\";\n    const zoom = opts.zoom ? ` data-src=\"${esc(id)}\"` : \"\";\n    return `<div class=\"thumb\"${zoom} style=\"background:${CHIP_BG[i % CHIP_BG.length]}\">${photoInner(id)}${plus}${rm}</div>`;\n  }).join(\"\") + `</div>`;\n}\n\nfunction linesHTML(lines, max) {\n  const shown = max ? lines.slice(0, max) : lines;\n  let h = `<div class=\"lines\">` + shown.map((l, i) => l.type === \"c\"\n    ? `<div class=\"chk ${l.done ? \"done\" : \"\"}\" data-i=\"${i}\"><span class=\"box\">${l.done ? icon(\"check\") : \"\"}</span><span>${esc(l.text)}</span></div>`\n    : `<div class=\"c-text\">${esc(l.text)}</div>`).join(\"\") + `</div>`;\n  if (max && lines.length > max) h += `<div class=\"more\">還有 ${lines.length - max} 行</div>`;\n  return h;\n}\n\nfunction tagHTML(id) {\n  const c = catOf(id);\n  return c ? `<span class=\"tag t-${c.color}\">${esc(c.name)}</span>` : \"\";\n}\n\nconst checks = (n) => n.lines.filter((l) => l.type === \"c\");\n\nfunction matches(n, f = filter) {\n  if (f === \"未完成\" && !checks(n).some((l) => !l.done)) return false;\n  if (f === \"有照片\" && !(n.photos && n.photos.length)) return false;\n  if (f.startsWith(\"cat:\") && n.cat !== f.slice(4)) return false;\n  if (!query) return true;\n  const hay = [n.title, catOf(n.cat)?.name || \"\", ...n.lines.map((l) => l.text)].join(\" \").toLowerCase();\n  return hay.includes(query.toLowerCase());\n}\n\nfunction renderChips() {\n  if (filter.startsWith(\"cat:\") && !catOf(filter.slice(4))) filter = \"全部\";\n  const list = [[\"全部\", \"全部\"], [\"未完成\", \"未完成\"], [\"有照片\", \"有照片\"], ...cats.map((c) => [\"cat:\" + c.id, c.name])];\n  $(\"#chips\").innerHTML = list.map(([key, label]) =>\n    `<button class=\"chip\" aria-pressed=\"${key === filter}\" data-c=\"${esc(key)}\">${esc(label)}<span class=\"n\">${notes.filter((n) => matches(n, key)).length}</span></button>`).join(\"\")\n    + `<button class=\"chip manage\" data-manage=\"1\">編輯分類</button>`;\n}\n\nfunction renderGrid() {\n  // 釘選的筆記排最前面，其他依最後修改時間\n  notes.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated - a.updated);\n  const list = notes.filter((n) => matches(n));\n  if (!notes.length) { $(\"#grid\").innerHTML = `<p class=\"empty\">還沒有筆記，按下面的「寫筆記」開始</p>`; return; }\n  if (!list.length) { $(\"#grid\").innerHTML = `<p class=\"empty\">找不到符合的筆記</p>`; return; }\n  $(\"#grid\").innerHTML = list.map((n) => {\n    const cs = checks(n), done = cs.filter((l) => l.done).length;\n    const allDone = cs.length && done === cs.length;\n    return `<button class=\"card ${allDone ? \"done-all\" : \"\"}\" data-id=\"${esc(n.id)}\">\n      <span class=\"c-head\">${noteIcon(n.icon, n.id)}<span class=\"c-title\">${esc(n.title)}</span>${n.pinned ? `<span class=\"pin-badge\" aria-label=\"已釘選\">${icon(\"pin\")}</span>` : \"\"}</span>\n      ${tagHTML(n.cat)}\n      ${linesHTML(n.lines, 5)}\n      ${thumbsHTML(n.photos, n.photos && n.photos.length > 4 ? 6 : 4)}\n      <span class=\"meta\"><span class=\"date\">${fmtDate(n.updated)}</span>${cs.length ? `<span class=\"prog\">${done}/${cs.length}</span>` : \"\"}</span>\n    </button>`;\n  }).join(\"\");\n}\n\nfunction render() { renderChips(); renderGrid(); }\n\nfunction openSheet(html, onMount, cls) {\n  commitEditor();\n  const s = $(\"#scrim\");\n  s.innerHTML = `<div class=\"sheet ${cls || \"\"}\" role=\"dialog\" aria-modal=\"true\">${html}</div>`;\n  s.hidden = false;\n  onMount && onMount(s.firstElementChild);\n}\nlet onPhotoPicked = null; // 編輯器打開時，Scriptable 選好的照片交給它\nfunction closeSheet() { commitEditor(); $(\"#scrim\").hidden = true; $(\"#scrim\").innerHTML = \"\"; onPhotoPicked = null; }\n\n/* ---------- 照片放大：先顯示縮圖，Scriptable 送來原圖再換掉 ---------- */\nlet fullWanted = null;\nfunction showPhoto(id) {\n  const lb = $(\"#lightbox\");\n  lb.innerHTML = THUMBS[id] ? `<img src=\"${THUMBS[id]}\" alt=\"照片\">` : \"\";\n  lb.hidden = false;\n  fullWanted = id;\n  send({ type: \"full\", id });\n}\nwindow.__showFull = (id, src) => {\n  if (fullWanted !== id || $(\"#lightbox\").hidden) return;\n  $(\"#lightbox\").innerHTML = `<img src=\"${src}\" alt=\"照片\">`;\n};\n$(\"#lightbox\").addEventListener(\"click\", () => { $(\"#lightbox\").hidden = true; $(\"#lightbox\").innerHTML = \"\"; fullWanted = null; });\n\nwindow.__photoAdded = (res) => {\n  if (res && res.error) { toast(res.error); }\n  if (res && res.id) THUMBS[res.id] = res.thumb;\n  if (onPhotoPicked) onPhotoPicked(res && res.id ? res.id : null);\n};\n\n/* ---------- 分類：選擇、新增、改名、換顏色、刪除 ---------- */\n// 還沒被用過（或用最少次）的顏色，新分類預設用它，儘量不重複\nfunction freshColor() {\n  const used = {};\n  cats.forEach((c) => { used[c.color] = (used[c.color] || 0) + 1; });\n  return CAT_COLORS.reduce((best, c) => ((used[c] || 0) < (used[best] || 0) ? c : best), CAT_COLORS[0]);\n}\n\n// 一排 8 個色點，點一下選顏色；目前的顏色有外框和勾\nfunction paletteHTML(current, attr) {\n  return `<div class=\"palette\" role=\"group\" aria-label=\"選顏色\">${CAT_COLORS.map((c) => {\n    const taken = cats.filter((x) => x.color === c).length;\n    return `<button class=\"dot\" ${attr}=\"${c}\" aria-pressed=\"${c === current}\" aria-label=\"${COLOR_NAMES[c]}${taken ? `（已有 ${taken} 個分類）` : \"\"}\"\n      style=\"background:var(--${CAT_STRONG[c]});color:var(--${[\"blue\", \"purple\", \"rose\"].includes(c) ? \"white\" : \"ink-navy\"})\">${c === current ? icon(\"check\") : \"\"}</button>`;\n  }).join(\"\")}</div>`;\n}\n\nfunction catEditor(host, opts) {\n  // opts.selected: 目前選的分類 id（null = 不分類）；opts.onSelect 有給才可以選\n  let editing = !!opts.startEditing;\n  let adding = false;\n  let armed = null;   // 按過一次刪除、等第二次確認的分類 id\n  let picking = null; // 正在選顏色的分類 id\n  let newName = \"\", newColor = freshColor();\n\n  function paint(focusAdd) {\n    let chips;\n    if (!editing) {\n      chips = (opts.onSelect ? [`<button class=\"tag\" style=\"background:var(--surface-disabled)\" data-sel=\"\" aria-pressed=\"${!opts.selected}\">不分類</button>`] : [])\n        .concat(cats.map((c) => `<button class=\"tag t-${c.color}\" data-sel=\"${esc(c.id)}\" aria-pressed=\"${opts.onSelect ? c.id === opts.selected : false}\">${esc(c.name)}</button>`))\n        .concat(adding ? [] : [`<button class=\"tag add\" data-add=\"1\">＋ 新增分類</button>`]).join(\"\");\n    } else {\n      chips = cats.map((c) => `\n        <div class=\"cat-item\">\n          <span class=\"cat-edit t-${c.color}\">\n            <input value=\"${esc(c.name)}\" data-name=\"${esc(c.id)}\" aria-label=\"分類名稱\" maxlength=\"10\">\n            <button class=\"mini swatch\" style=\"background:var(--${CAT_STRONG[c.color]})\" data-pick=\"${esc(c.id)}\" aria-label=\"選顏色\" aria-expanded=\"${picking === c.id}\"></button>\n            ${armed === c.id\n              ? `<button class=\"mini danger\" data-del=\"${esc(c.id)}\">確定刪除</button>`\n              : `<button class=\"mini\" data-del=\"${esc(c.id)}\" aria-label=\"刪除 ${esc(c.name)}\">${icon(\"close\")}</button>`}\n          </span>\n          ${picking === c.id ? paletteHTML(c.color, \"data-setcolor\") : \"\"}\n        </div>`).join(\"\") || `<span class=\"lbl\">還沒有分類</span>`;\n    }\n    host.innerHTML = `\n      <div class=\"lbl-row\"><span class=\"lbl\">分類</span>\n        <button class=\"link-btn\" data-toggle=\"1\">${editing ? \"完成\" : \"編輯\"}</button></div>\n      <div class=\"cat-row ${editing ? \"editing\" : \"\"}\">${chips}</div>\n      ${adding || (editing && opts.alwaysAdd) ? `<div class=\"add-box\">\n        <div class=\"add-row\">\n          <span class=\"new-dot\" style=\"background:var(--${CAT_STRONG[newColor]})\"></span>\n          <input id=\"cat-new\" placeholder=\"新分類名稱，例如：日本\" maxlength=\"10\" value=\"${esc(newName)}\">\n          <button class=\"btn-sm\" data-addok=\"1\">加入</button></div>\n        ${paletteHTML(newColor, \"data-newcolor\")}</div>` : \"\"}\n      ${editing ? `<span class=\"lbl\">點名字旁邊的色塊選顏色，按 × 刪除；刪掉的分類，裡面的筆記會變成不分類。</span>` : \"\"}`;\n    if (focusAdd) host.querySelector(\"#cat-new\")?.focus();\n  }\n\n  function addCat() {\n    const inp = host.querySelector(\"#cat-new\");\n    const name = inp && inp.value.trim();\n    if (!name) { inp && inp.focus(); return; }\n    const c = { id: uid(\"k\"), name, color: newColor };\n    cats.push(c);\n    adding = false; newName = \"\"; newColor = freshColor();\n    if (opts.onSelect && !editing) { opts.selected = c.id; opts.onSelect(c.id); }\n    changed(); render(); paint(editing && opts.alwaysAdd);\n  }\n\n  host.addEventListener(\"click\", (e) => {\n    const t = e.target.closest(\"button\"); if (!t) return;\n    if (t.dataset.toggle) { editing = !editing; adding = false; armed = null; picking = null; paint(); return; }\n    if (t.dataset.add) { adding = true; newColor = freshColor(); paint(true); return; }\n    if (t.dataset.addok) { addCat(); return; }\n    if (t.dataset.newcolor) { newColor = t.dataset.newcolor; paint(); host.querySelector(\"#cat-new\")?.focus(); return; }\n    if (t.dataset.sel !== undefined && opts.onSelect) { opts.selected = t.dataset.sel || null; opts.onSelect(opts.selected); paint(); return; }\n    if (t.dataset.pick) { picking = picking === t.dataset.pick ? null : t.dataset.pick; armed = null; paint(); return; }\n    if (t.dataset.setcolor) { catOf(picking).color = t.dataset.setcolor; picking = null; changed(); render(); paint(); return; }\n    if (t.dataset.del) {\n      const id = t.dataset.del;\n      if (armed !== id) { armed = id; picking = null; paint(); return; }\n      cats = cats.filter((c) => c.id !== id);\n      notes.forEach((n) => { if (n.cat === id) n.cat = null; });\n      if (opts.selected === id) { opts.selected = null; opts.onSelect && opts.onSelect(null); }\n      armed = null; changed(); render(); paint();\n    }\n  });\n  host.addEventListener(\"input\", (e) => {\n    if (e.target.id === \"cat-new\") { newName = e.target.value; return; }\n    const id = e.target.dataset.name; if (!id) return;\n    const v = e.target.value.trim(); if (v) { catOf(id).name = v; changed(); render(); }\n  });\n  host.addEventListener(\"keydown\", (e) => {\n    if (e.isComposing || e.keyCode === 229) return;\n    if (e.key === \"Enter\" && e.target.id === \"cat-new\") { e.preventDefault(); addCat(); }\n  });\n  paint();\n}\n\nfunction openCatManager() {\n  openSheet(`\n    <div class=\"sheet-top\"><h2>編輯分類</h2><span class=\"sp\"></span>\n      <button class=\"icon-btn\" data-act=\"close\" aria-label=\"關閉\">${icon(\"close\")}</button></div>\n    <div class=\"cat-box\" id=\"cat-box\"></div>`, (el) => {\n    catEditor(el.querySelector(\"#cat-box\"), { selected: null, startEditing: true, alwaysAdd: true });\n    el.addEventListener(\"click\", (e) => { if (e.target.closest('[data-act=\"close\"]')) closeSheet(); });\n  });\n}\n\nfunction openNote(id, armedDelete) {\n  const n = notes.find((x) => x.id === id);\n  if (!n) { closeSheet(); return; }\n  openSheet(`\n    <div class=\"sheet-top\">\n      <button class=\"icon-btn\" data-act=\"close\" aria-label=\"返回\">${icon(\"back\")}</button>\n      <span class=\"sp\"></span>\n      ${armedDelete\n        ? `<button class=\"mini danger\" data-act=\"del\" style=\"height:40px;padding:0 16px\">確定刪除這則筆記</button>`\n        : `<button class=\"icon-btn\" data-act=\"del\" aria-label=\"刪除\">${icon(\"trash\")}</button>`}\n      <button class=\"icon-btn pin-btn\" data-act=\"pin\" aria-pressed=\"${!!n.pinned}\" aria-label=\"釘選\">${icon(\"pin\")}</button>\n      <button class=\"icon-btn\" data-act=\"edit\" aria-label=\"編輯\">${icon(\"pencil\")}</button>\n    </div>\n    <div class=\"c-head\">${noteIcon(n.icon, n.id)}<h2>${esc(n.title)}</h2></div>\n    ${tagHTML(n.cat)}\n    ${linesHTML(n.lines)}\n    ${thumbsHTML(n.photos, 99, { zoom: true })}\n    <div class=\"date\">${fmtDate(n.updated)}</div>`, (el) => {\n    el.addEventListener(\"click\", (e) => {\n      const ph = e.target.closest(\"[data-src]\");\n      if (ph) { showPhoto(ph.dataset.src); return; }\n      const row = e.target.closest(\".chk[data-i]\");\n      if (row) { const l = n.lines[+row.dataset.i]; l.done = !l.done; changed(); render(); openNote(id); return; }\n      const act = e.target.closest(\"[data-act]\")?.dataset.act;\n      if (act === \"close\") closeSheet();\n      if (act === \"edit\") openEditor(n);\n      if (act === \"pin\") { n.pinned = !n.pinned; changed(); render(); openNote(id); toast(n.pinned ? \"已釘選，會一直排在最前面\" : \"取消釘選\"); return; }\n      if (act === \"del\") {\n        if (!armedDelete) { openNote(id, true); return; }\n        notes = notes.filter((x) => x.id !== id);\n        changed(); closeSheet(); render(); toast(\"已刪除\");\n      }\n    });\n  });\n}\n\n/* ---------- 編輯器：一行一列，勾選清單鍵切換目前這一行 ---------- */\nfunction openEditor(n) {\n  const draft = {\n    icon: n ? n.icon : \"star\",\n    cat: n ? n.cat : (filter.startsWith(\"cat:\") ? filter.slice(4) : null),\n    title: n ? n.title : \"\",\n    // 沒有內容的筆記（只有標題）也要留一行空白可以寫\n    lines: n && n.lines.length ? n.lines.map((l) => ({ ...l })) : [T(\"\")],\n    photos: n && n.photos ? [...n.photos] : [],\n    pinned: !!(n && n.pinned),\n  };\n  let focusIdx = 0, caret = 0;\n\n  openSheet(`\n    <div class=\"sheet-top\">\n      <button class=\"icon-btn\" data-act=\"close\" aria-label=\"取消\">${icon(\"back\")}</button>\n      <span class=\"sp\"></span>\n      ${n ? `<button class=\"icon-btn\" data-act=\"delnote\" aria-label=\"刪除\">${icon(\"trash\")}</button>` : \"\"}\n      <button class=\"icon-btn pin-btn\" data-act=\"pin\" aria-pressed=\"${draft.pinned}\" aria-label=\"釘選\">${icon(\"pin\")}</button>\n      <button class=\"btn-save\" data-act=\"save\" aria-label=\"完成\">${icon(\"check\")}</button>\n    </div>\n    <div class=\"ed-body\" id=\"ed-body\">\n    <div class=\"c-head\">\n      <button class=\"pick-btn\" data-act=\"pick\" aria-label=\"換圖示\" aria-expanded=\"false\"><span id=\"ed-icon\"></span><span class=\"edit-dot\">${icon(\"pencil\")}</span></button>\n      <input class=\"ed-title\" id=\"ed-title\" placeholder=\"標題\" value=\"${esc(draft.title)}\">\n    </div>\n    <div class=\"icon-panel\" id=\"icon-panel\" hidden>\n      <span class=\"lbl\">選個圖示</span>\n      <div class=\"icon-grid\">${ICONS.map((k) =>\n        `<button class=\"icon-opt\" data-icon=\"${k}\" aria-pressed=\"${k === draft.icon}\" aria-label=\"${k}\">${noteIcon(k)}</button>`).join(\"\")}</div>\n    </div>\n    <div class=\"cat-box\" id=\"ed-cats\"></div>\n    <div class=\"ed-lines\" id=\"ed-lines\"></div>\n    <div class=\"ed-photos\" id=\"ed-photos\"></div>\n    </div>\n    <div class=\"toolbar\"><div class=\"toolbar-inner\">\n      <button class=\"tool\" data-tool=\"check\" aria-label=\"勾選清單\">${icon(\"checklist\")}</button>\n      <span class=\"tool-sep\"></span>\n      <button class=\"tool\" data-tool=\"photo\" aria-label=\"加照片\">${icon(\"photo\")}</button>\n    </div></div>`, (el) => {\n    const linesEl = el.querySelector(\"#ed-lines\");\n    const checkTool = el.querySelector('[data-tool=\"check\"]');\n    const paintIcon = () => { el.querySelector(\"#ed-icon\").innerHTML = noteIcon(draft.icon, n ? n.id : \"new\"); };\n\n    catEditor(el.querySelector(\"#ed-cats\"), { selected: draft.cat, onSelect: (id) => { draft.cat = id; } });\n\n    const autosize = (ta) => { ta.style.height = \"auto\"; ta.style.height = ta.scrollHeight + \"px\"; };\n    const syncTool = () => checkTool.classList.toggle(\"on\", draft.lines[focusIdx]?.type === \"c\");\n\n    function paintLines(focusAt) {\n      linesEl.innerHTML = draft.lines.map((l, i) => `\n        <div class=\"ed-line ${l.type === \"c\" && l.done ? \"done\" : \"\"}\" data-i=\"${i}\">\n          ${l.type === \"c\" ? `<button class=\"box\" data-box=\"${i}\" aria-label=\"打勾\">${l.done ? icon(\"check\") : \"\"}</button>` : \"\"}\n          <textarea rows=\"1\" data-i=\"${i}\" placeholder=\"${draft.lines.length === 1 && !l.text ? \"寫點什麼…\" : \"\"}\">${esc(l.text)}</textarea>\n        </div>`).join(\"\");\n      linesEl.querySelectorAll(\"textarea\").forEach(autosize);\n      if (focusAt) {\n        const ta = linesEl.querySelector(`textarea[data-i=\"${focusAt[0]}\"]`);\n        if (ta) { ta.focus(); ta.setSelectionRange(focusAt[1], focusAt[1]); keepInView(ta); }\n      }\n      syncTool();\n    }\n\n    function paintPhotos(msg) {\n      el.querySelector(\"#ed-photos\").innerHTML = (msg ? `<p class=\"busy\">${msg}</p>` : \"\") + thumbsHTML(draft.photos, 99, { removable: true });\n    }\n\n    linesEl.addEventListener(\"focusin\", (e) => { if (e.target.dataset.i) { focusIdx = +e.target.dataset.i; syncTool(); } });\n    linesEl.addEventListener(\"input\", (e) => {\n      const ta = e.target; draft.lines[+ta.dataset.i].text = ta.value; autosize(ta);\n    });\n    linesEl.addEventListener(\"keydown\", (e) => {\n      const ta = e.target; if (ta.tagName !== \"TEXTAREA\") return;\n      if (e.isComposing || e.keyCode === 229) return; // 注音選字中，不處理\n      const i = +ta.dataset.i, line = draft.lines[i];\n      if (e.key === \"Enter\") {\n        e.preventDefault();\n        // 空的勾選項目按換行 → 變回一般文字（跟 iPhone 備忘錄一樣）\n        if (line.type === \"c\" && !ta.value) { line.type = \"t\"; paintLines([i, 0]); return; }\n        const pos = ta.selectionStart;\n        const rest = ta.value.slice(pos);\n        line.text = ta.value.slice(0, pos);\n        draft.lines.splice(i + 1, 0, line.type === \"c\" ? C(rest) : T(rest));\n        paintLines([i + 1, 0]);\n      } else if (e.key === \"Backspace\" && ta.selectionStart === 0 && ta.selectionEnd === 0) {\n        if (line.type === \"c\") { e.preventDefault(); line.type = \"t\"; line.done = false; paintLines([i, 0]); }\n        else if (i > 0) {\n          e.preventDefault();\n          const prev = draft.lines[i - 1], at = prev.text.length;\n          prev.text += line.text; draft.lines.splice(i, 1);\n          paintLines([i - 1, at]);\n        }\n      }\n    });\n    linesEl.addEventListener(\"click\", (e) => {\n      // 點到文字下面的空白處：跳到最後一行，最後一行有字就再開一行\n      if (e.target === linesEl) {\n        const last = draft.lines.length - 1;\n        if (draft.lines[last].text) { draft.lines.push(draft.lines[last].type === \"c\" ? C(\"\") : T(\"\")); paintLines([last + 1, 0]); }\n        else paintLines([last, 0]);\n        return;\n      }\n      const b = e.target.closest(\"[data-box]\");\n      if (b) { const l = draft.lines[+b.dataset.box]; l.done = !l.done; paintLines(); }\n    });\n\n    // 工具列按下時不要讓文字框失去焦點，鍵盤才不會收起來\n    el.querySelector(\".toolbar\").addEventListener(\"pointerdown\", (e) => {\n      if (e.target.closest('[data-tool=\"check\"]')) {\n        const ta = linesEl.querySelector(`textarea[data-i=\"${focusIdx}\"]`);\n        if (ta) caret = ta.selectionStart;\n        e.preventDefault();\n      }\n    });\n    el.querySelector(\".toolbar\").addEventListener(\"click\", (e) => {\n      const t = e.target.closest(\"[data-tool]\")?.dataset.tool;\n      if (t === \"check\") {\n        const l = draft.lines[focusIdx] || draft.lines[draft.lines.length - 1];\n        l.type = l.type === \"c\" ? \"t\" : \"c\"; l.done = false;\n        paintLines([focusIdx, caret]);\n      }\n      if (t === \"photo\") {\n        document.activeElement && document.activeElement.blur();\n        paintPhotos(\"正在打開相簿…\");\n        send({ type: \"photo\" });\n      }\n    });\n    onPhotoPicked = (id) => { if (id) draft.photos.push(id); paintPhotos(); };\n\n    el.querySelector(\"#ed-photos\").addEventListener(\"click\", (e) => {\n      const rm = e.target.closest(\"[data-rm]\");\n      if (rm) { draft.photos.splice(+rm.dataset.rm, 1); paintPhotos(); }\n    });\n\n    el.addEventListener(\"click\", (e) => {\n      const opt = e.target.closest(\"[data-icon]\");\n      if (opt) {\n        draft.icon = opt.dataset.icon; paintIcon();\n        el.querySelectorAll(\"[data-icon]\").forEach((b) => b.setAttribute(\"aria-pressed\", b.dataset.icon === draft.icon));\n        return;\n      }\n      const act = e.target.closest(\"[data-act]\")?.dataset.act;\n      if (act === \"pick\") {\n        const p = el.querySelector(\"#icon-panel\"); p.hidden = !p.hidden;\n        e.target.closest(\"[data-act]\").setAttribute(\"aria-expanded\", String(!p.hidden));\n      }\n      if (act === \"close\") { n ? openNote(n.id) : closeSheet(); } // 兩種都會先存檔\n      if (act === \"pin\") {\n        draft.pinned = !draft.pinned;\n        e.target.closest(\"[data-act]\").setAttribute(\"aria-pressed\", String(draft.pinned));\n        toast(draft.pinned ? \"已釘選，會一直排在最前面\" : \"取消釘選\");\n      }\n      if (act === \"delnote\") {\n        const b = e.target.closest(\"[data-act]\");\n        // 第一次按：垃圾桶變成紅色的「確定刪除」，再按一次才刪（跟閱讀畫面一樣）\n        if (!b.classList.contains(\"danger\")) { b.className = \"mini danger\"; b.style.cssText = \"height:40px;padding:0 16px\"; b.textContent = \"確定刪除\"; return; }\n        editorCommit = null; // 要刪掉的筆記不用再存\n        notes = notes.filter((x) => x.id !== n.id);\n        changed(); closeSheet(); render(); toast(\"已刪除\");\n        return;\n      }\n      if (act === \"save\") closeSheet(); // closeSheet 會存檔\n    });\n\n    // 存檔：內容跟打開時一樣就不動（不改修改時間）；新筆記什麼都沒寫就不建立\n    const pick = (o) => JSON.stringify([o.icon, o.cat || null, o.title, o.lines.filter((l) => l.text.trim()), o.photos || [], !!o.pinned]);\n    const before = n ? pick(n) : null;\n    editorCommit = () => {\n      const lines = draft.lines.filter((l) => l.text.trim());\n      const title = el.querySelector(\"#ed-title\").value.trim();\n      if (!title && !lines.length && !draft.photos.length) return;\n      const data = { icon: draft.icon, cat: draft.cat, title: title || \"未命名筆記\", lines, photos: draft.photos, pinned: draft.pinned };\n      if (n && pick(data) === before) return;\n      if (n) Object.assign(n, data, { updated: Date.now() }); else notes.unshift({ id: uid(\"n\"), ...data, updated: Date.now() });\n      changed(); render();\n    };\n\n    paintIcon(); paintPhotos();\n    paintLines(n ? null : [0, 0]);\n    if (!n) el.querySelector(\"#ed-title\").focus();\n  }, \"editor\");\n}\n\n$(\"#grid\").addEventListener(\"click\", (e) => { const c = e.target.closest(\".card\"); if (c) openNote(c.dataset.id); });\n$(\"#chips\").addEventListener(\"click\", (e) => {\n  if (e.target.closest(\"[data-manage]\")) { openCatManager(); return; }\n  const c = e.target.closest(\".chip\"); if (c) { filter = c.dataset.c; render(); }\n});\n$(\"#fab\").addEventListener(\"click\", () => openEditor(null));\n$(\"#scrim\").addEventListener(\"click\", (e) => { if (e.target.id === \"scrim\") closeSheet(); });\n/* ---------- 鍵盤打開時：面板縮到鍵盤上方，正在打字的那一行捲到看得到的地方 ---------- */\n// iPhone 的鍵盤會蓋住畫面下半部，但網頁本身不會變矮；用 visualViewport 算出鍵盤上方還看得到的範圍\nfunction fitToKeyboard() {\n  const vv = window.visualViewport, s = $(\"#scrim\");\n  if (!vv) return;\n  const open = window.innerHeight - vv.height > 80;\n  s.style.top = open ? vv.offsetTop + \"px\" : \"\";\n  s.style.height = open ? vv.height + \"px\" : \"\";\n  s.style.bottom = open ? \"auto\" : \"\";\n  const ta = document.activeElement;\n  if (open && ta && ta.tagName === \"TEXTAREA\") keepInView(ta);\n}\nfunction keepInView(el) {\n  setTimeout(() => {\n    const box = el.closest(\".ed-body\") || el.closest(\".sheet\");\n    if (!box) return;\n    const r = el.getBoundingClientRect(), br = box.getBoundingClientRect();\n    if (r.bottom > br.bottom - 12) box.scrollTop += r.bottom - (br.bottom - 12);\n    else if (r.top < br.top + 12) box.scrollTop -= br.top + 12 - r.top;\n  }, 60);\n}\nif (window.visualViewport) {\n  visualViewport.addEventListener(\"resize\", fitToKeyboard);\n  visualViewport.addEventListener(\"scroll\", fitToKeyboard);\n}\ndocument.addEventListener(\"focusin\", (e) => { if (e.target.tagName === \"TEXTAREA\") setTimeout(() => keepInView(e.target), 300); });\ndocument.addEventListener(\"input\", (e) => { if (e.target.tagName === \"TEXTAREA\") keepInView(e.target); });\n\n$(\"#searchToggle\").addEventListener(\"click\", () => { const b = $(\"#searchBar\"); b.hidden = !b.hidden; if (!b.hidden) $(\"#q\").focus(); else { query = \"\"; $(\"#q\").value = \"\"; render(); } });\n$(\"#q\").addEventListener(\"input\", (e) => { query = e.target.value.trim(); render(); });\n// 從分類小工具點進來時，先篩選成那個分類\nif (boot.filter) filter = boot.filter;\n// 左上角：每個字一個「彥」風格的圖示（1～3 個字），點一下可以改\nlet logoText = boot.logoText || \"彥\";\nfunction paintLogo(urls) {\n  const lg = $(\"#logo\");\n  if (!urls || !urls.length) return;\n  lg.classList.add(\"img\");\n  lg.innerHTML = urls.map((u) => `<img src=\"${u}\" alt=\"\">`).join(\"\");\n}\npaintLogo(boot.logos);\nconst pickChars = (t) => [...String(t || \"\")].filter((c) => c.trim());\nfunction openLogoEditor() {\n  openSheet(`\n    <div class=\"sheet-top\"><h2>左上角的字</h2><span class=\"sp\"></span>\n      <button class=\"icon-btn\" data-act=\"close\" aria-label=\"關閉\">${icon(\"close\")}</button></div>\n    <p class=\"hint\">可以放 1～3 個字，每個字會做成一個圖示，主畫面小工具也一樣。</p>\n    <input class=\"logo-input\" id=\"logo-text\" value=\"${esc(logoText)}\" placeholder=\"例如：林小琪\" autocomplete=\"off\">\n    <p class=\"hint\" id=\"logo-msg\"></p>\n    <div class=\"logo-row\"><button class=\"btn btn-primary\" data-act=\"ok\">儲存</button></div>`, (el) => {\n    const inp = el.querySelector(\"#logo-text\"), msg = el.querySelector(\"#logo-msg\");\n    inp.focus();\n    el.addEventListener(\"click\", (e) => {\n      const act = e.target.closest(\"[data-act]\")?.dataset.act;\n      if (act === \"close\") closeSheet();\n      if (act === \"ok\") {\n        const chars = pickChars(inp.value);\n        if (!chars.length) { msg.textContent = \"請輸入至少 1 個字。\"; return; }\n        if (chars.length > 3) { msg.textContent = \"最多 3 個字。\"; return; }\n        logoText = chars.join(\"\");\n        send({ type: \"logo\", text: logoText });\n        closeSheet(); toast(\"正在畫新的圖示…\");\n      }\n    });\n  });\n}\nwindow.__logoUpdated = (res) => {\n  if (res && res.error) { toast(\"圖示畫不出來，請確認網路後再試一次\"); return; }\n  paintLogo(res.logos); toast(\"已更新，主畫面小工具稍後會跟著換\");\n};\n$(\"#logo\").addEventListener(\"click\", openLogoEditor);\nrender();\n// 從主畫面小工具點卡片進來：直接打開那則筆記的編輯畫面\nif (boot.openNote) { const n = notes.find((x) => x.id === boot.openNote); if (n) openEditor(n); }\nif (boot.warn) toast(boot.warn);\n</script>\n</body>\n</html>\n";
}

// ---- 進入點
if (config.runsInWidget) {
  Script.setWidget(await buildWidget(config.widgetFamily || "medium"));
} else {
  const q = args.queryParameters || {};
  await openApp(q.note, q.filter);
}
Script.complete();
