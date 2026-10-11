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

// ---- 小工具的圖：左上角「彥」圖示（跟童趣風月曆同一個畫法）和彩色色塊底圖
// 第一次在 App 內執行時用 WebView 畫好，存在這台裝置（每台裝置的小工具大小不同）
// 圖示的字跟童趣風月曆共用設定（月曆選單的「圖示文字」），沒設定過就是「彥」
const local = FileManager.local();
const ART_DIR = local.joinPath(local.documentsDirectory(), "kids-notes-art");
const ART_VERSION = 4; // 底圖或圖示畫法改過就加 1，讓已存的圖重畫（2：加了圖示貼紙；3：加叉子、飲料杯；4：飲料改奶茶色）
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

async function logoChar() {
  const p = store.joinPath(store.documentsDirectory(), "calendar-widget-birthdays", "settings.json");
  try {
    if (!store.fileExists(p)) return DEFAULT_LOGO;
    await ensureLocal(p);
    return JSON.parse(store.readString(p)).logoChar || DEFAULT_LOGO;
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
async function ensureArt() {
  const ch = await logoChar(), sizes = widgetSizes();
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
          const sizes = ${JSON.stringify(sizes)}, out = { logo: drawLogo(${JSON.stringify(ch)}) };
          // 圖示貼紙：把 SVG 畫成 96×96 的 PNG，小工具用
          for (const [k, svg] of Object.entries(${JSON.stringify(stickerSvgs)})) {
            const im = new Image();
            im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
            await im.decode();
            const [cv, g] = canvas(32, 32, 3);
            g.drawImage(im, 0, 0, 32, 32);
            out["icon-" + k] = png(cv);
          }
          for (const f in sizes) out["bg-" + f] = drawBackground(sizes[f][0], sizes[f][1], f);
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

      // 左上角圖示（256×256 設計稿）：深藍不規則色塊、紅花、黃色不規則圓、黃枝 + 藍枝，中間是設定的字
    function drawLogo(ch) {
      const [cv, g] = canvas(256, 256, 3);
      blob(g, 128, 129, 246, 240, [46, 54, 40, 60, 52, 44, 58, 42], -4, "#232058");
      blob(g, 128, 128, 176, 168, [44, 56, 62, 38, 46, 54, 46, 54], 0, "#F7D44C");
      const twig = (color, width, paths) => {
        g.strokeStyle = color; g.lineWidth = width; g.lineCap = "round";
        for (const d of paths) g.stroke(new Path2D(d));
      };
      twig("#4A6FC4", 7, ["M178 228 C 190 210, 202 194, 218 180", "M190 212 C 186 200, 186 190, 190 180", "M202 198 C 210 196, 218 192, 226 186"]);
      twig("#F2CF4A", 6.5, ["M60 236 C 61 222, 61 208, 60 194", "M61 218 C 54 216, 51 210, 51 202", "M60 206 C 66 204, 69 198, 69 190"]);
      g.save(); g.translate(50, 48); g.rotate(-12 * Math.PI / 180); g.fillStyle = "#E0412F";
      for (let i = 0; i < 8; i++) { g.save(); g.rotate(i * Math.PI / 4); g.beginPath(); g.ellipse(0, -23, 8.5, 20, 0, 0, 7); g.fill(); g.restore(); }
      g.fillStyle = "#FFFCEA"; g.beginPath(); g.arc(0, 0, 11.5, 0, 7); g.fill(); g.restore();
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
      function drawBackground(W, H, family) {
        const [cv, g] = canvas(W, H, 3), u = Math.min(W, H) / 170;
        g.fillStyle = "#FFFCEF"; g.fillRect(0, 0, W, H);
        blob(g, W - 4 * u, 2 * u, 92 * u, 80 * u, R1, -8, "#FFD426");
        g.save(); g.translate(W - 34 * u, 8 * u); g.scale(20 * u / 48, 20 * u / 48);
        g.strokeStyle = "#262261"; g.lineWidth = 3.4; g.lineCap = g.lineJoin = "round";
        g.stroke(new Path2D("M24 8c1 6 3.5 12 8 16-4.5 4-7 10-8 16-1-6-3.5-12-8-16 4.5-4 7-10 8-16Z")); g.restore();
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
    local.writeString(ART_META, JSON.stringify({ version: ART_VERSION, logoChar: ch, sizes }));
    return null;
  } catch (e) { return String(e); }
}
const artImage = name => local.fileExists(artPath(name)) ? Image.fromFile(artPath(name)) : null;

// ---- 筆記畫面
// 線條圖示（跟日常記帳同一套）和貼紙樣式，由 build.py 塞進來
const ICONS = /*ICONS*/[];
const ICON_SVGS = /*ICON_SVGS*/{};
/*STICKERS*/
Object.assign(ICON_SVGS, EXTRA_ICON_SVGS);

const js = v => JSON.stringify(v).replace(/</g, "\\u003c");

async function openApp(openNoteId, filter) {
  let data;
  try { data = await loadData(); } catch (e) {
    const a = new Alert(); a.title = "讀不到筆記"; a.message = String(e); a.addAction("好"); await a.present();
    return;
  }
  if (!store.fileExists(DATA_PATH)) saveData(data);
  const iconFailed = await ensureAnimalIcons();
  const artFailed = await ensureArt();
  const logo = artImage("logo");
  const thumbs = {};
  for (const n of data.notes) for (const id of n.photos || []) {
    if (!(id in thumbs)) thumbs[id] = await photoDataURL(id, true) || "";
  }
  const boot = {
    cats: data.cats, notes: data.notes, thumbs, iconImages: await animalDataURLs(), openNote: openNoteId || null, filter: filter || null,
    logo: logo ? "data:image/png;base64," + Data.fromPNG(logo).toBase64String() : null,
    warn: iconFailed ? "小動物圖示下載不到，先用線條圖示；連上網路後再打開一次就會補上。"
      : artFailed ? "左上角圖示畫不出來，連上網路後再打開一次就會補上。" : "",
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
  try { data = await loadData(); } catch (e) { data = { cats: [], notes: [] }; }
  // 釘選的筆記排最前面，其他依最後修改時間
  let notes = [...data.notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated - a.updated);

  // 小工具的 Parameter（長按 →「編輯小工具」）：填分類名稱只顯示那個分類，填「未完成」只顯示還沒打勾完的清單
  const param = (args.widgetParameter || "").trim();
  let title = "筆記", filterKey = null, missing = false;
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
  head.spacing = 6;
  const logo = artImage("logo");
  // 大尺寸 50、中和小尺寸 41（拿掉卡片底部的日期和進度後，再放大 1.2 倍）
  const LOGO = family === "large" ? 50 : 41;
  if (logo) {
    const li = head.addImage(logo);
    li.imageSize = new Size(LOGO, LOGO);
  }
  const h = head.addText(title);
  h.lineLimit = 1;
  h.font = Font.heavyRoundedSystemFont(family === "small" ? 15 : 18);
  h.textColor = col(K.ink);
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
  const q = args.queryParameters || {};
  await openApp(q.note, q.filter);
}
Script.complete();
