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
const ICONS = /*ICONS*/[];
const ICON_SVGS = /*ICON_SVGS*/{};
/*STICKERS*/
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
const STICKER_ART = 1;
async function ensureStickerArt() {
  const meta = local.joinPath(ART_DIR, "meta.json");
  try { if (local.fileExists(meta) && JSON.parse(local.readString(meta)).version === STICKER_ART) return; } catch (e) {}
  const svgs = {};
  for (const k of ICONS) if (!ANIMALS[k]) svgs[k] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(stickerSVG(k, ICON_SVGS));
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
  return /*PAGE_HTML*/"";
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
function addIcon(stack, key, size) {
  const p = ANIMALS[key] ? iconPath(key) : artPath(key);
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
const money = n => "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

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
// 一筆記錄：分類圖示、備註（沒有就寫分類）、金額
function addChip(parent, e, cats, width, inset = 0) {
  const c = cats.find(x => x.id === e.cat) || { name: "未分類", color: "yellow", icon: "star" };
  // inset：左右各縮進一點（大尺寸用），兩邊一樣寬
  let holder = parent;
  if (inset) { holder = parent.addStack(); holder.addSpacer(inset); }
  const chip = holder.addStack();
  chip.size = new Size(width, CHIP_H);
  chip.backgroundColor = col(CAT_BG[c.color] || CAT_BG.yellow);
  chip.cornerRadius = 13;
  chip.setPadding(0, 6, 0, 10);
  chip.centerAlignContent();
  chip.spacing = 6;
  addIcon(chip, c.icon, 24);
  const t = chip.addText(e.note || c.name);
  t.font = Font.heavyRoundedSystemFont(13.8); t.textColor = col(K.ink); t.lineLimit = 1;
  chip.addSpacer();
  const a = chip.addText(Number(e.amt).toLocaleString("en-US", { maximumFractionDigits: 2 }));
  a.font = Font.heavyRoundedSystemFont(14.4); a.textColor = col(K.ink);
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
    for (const e of entries.slice(0, 3)) addChip(right, e, cats, rw);
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
  const tl = sums.addText("今天"); tl.font = Font.boldRoundedSystemFont(12); tl.textColor = col(K.body);
  const tv = sums.addText(money(todaySum)); tv.font = Font.heavyRoundedSystemFont(26); tv.textColor = col(K.ink);
  addPill(sums, book, true); // 「＋」放在全部金額前面
  const al = sums.addText(`全部 ${money(total(entries))}`); al.font = Font.boldRoundedSystemFont(12); al.textColor = col(K.body);
  sums.addSpacer();
  w.addSpacer(8);
  const inner = W - 28, INSET = 8, chipW = inner - INSET * 2; // 記錄卡片左右各縮 8
  let room = H - 24 - LOGO - 6 - 32 - 8;
  if (!entries.length) { const t = w.addText("還沒有記錄，點「＋」開始記一筆"); t.font = Font.boldRoundedSystemFont(13); t.textColor = col(K.body); }
  let day = null;
  for (const e of entries) {
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
    addChip(w, e, cats, chipW, INSET);
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
