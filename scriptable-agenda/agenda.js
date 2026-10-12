// 待辦事項・童趣風行事曆小工具（Scriptable）
// 讀 iPhone 內建「行事曆」的活動和「提醒事項」，依日期排成彩色卡片；放得下多少就顯示多少
// 左上角的字圖示沿用「童趣風月曆」畫好的「彥」（calendar-widget-kids），彩色底圖沿用「筆記」腳本畫好的圖（kids-notes-art）
// 點小工具打開行事曆；點提醒事項的卡片打開提醒事項
const K = {
  cream: "#FFFCEF", white: "#FFFFFF", ink: "#262261", body: "#5A5788", red: "#D93A2F", sun: "#FFD426",
};
// 卡片底色和小圓點：跟「筆記」分類同一組 8 色，依行程隨機挑，相鄰兩張不同色
const PALETTE = [
  { bg: "#FFF0AF", dot: "#E0A800" }, { bg: "#FFE2BA", dot: "#FF9500" }, { bg: "#D5F5D0", dot: "#3FA34D" },
  { bg: "#CFDDF8", dot: "#3F6FD1" }, { bg: "#FBD3D0", dot: "#E0412F" }, { bg: "#C9F0E9", dot: "#17A08F" },
  { bg: "#E3DAFA", dot: "#8E6FD8" }, { bg: "#FFD8E8", dot: "#F2649E" },
];
// 卡片不用粉紅、青色、桃紅：底圖左下是粉紅、右下是青色色塊，卡片壓在上面會混在一起
const CARD_PALETTE = PALETTE.filter(c => !["#FBD3D0", "#C9F0E9", "#FFD8E8"].includes(c.bg));
const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
const col = (hex, a = 1) => new Color(hex, a);
const hash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
const p2 = n => String(n).padStart(2, "0");
const hm = d => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
const day0 = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const key = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// ---- 農曆（例如「九月初二」「閏六月十五」）：小工具裡不能用系統的農曆格式，所以內建一張 1900–2100 的表
const LUNAR_DAYS = ["", "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
  "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"];
// 農曆 1900–2100：每年一個數字（從系統內建的農曆資料產生，跟 iPhone 行事曆顯示的一致），低 4 位是閏月月份，第 5～16 位是每月大小月，第 17 位是閏月大小
const LUNAR_INFO = [0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x18da3,0x095b0,0x14977,0x04970,0x0a4b0,0x1b0b6,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,0x06566,0x0d4a0,0x0ea50,0x16a95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,0x06ca0,0x0b550,0x15355,0x04db0,0x025b0,0x18573,0x052b0,0x0a9a8,0x0e950,0x06aa0,0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x1ad47,0x0ab60,0x09570,0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096e5,0x092e0,0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,0x0a950,0x0b4a0,0x0bca4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x05270,0x0a930,0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4f0,0x05260,0x0ea65,0x0d520,0x0daa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,0x092e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,0x092d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,0x0d520];
const leapMonth = y => LUNAR_INFO[y - 1900] & 0xf;
const leapDays = y => leapMonth(y) ? ((LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29) : 0;
const monthDays = (y, m) => (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29;
function yearDays(y) { let s = 348; for (let i = 0x8000; i > 0x8; i >>= 1) s += (LUNAR_INFO[y - 1900] & i) ? 1 : 0; return s + leapDays(y); }
const LUNAR_MONTHS = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "臘"];
// 國曆日期 → 「九月初二」「閏六月十五」
function lunar(d) {
  let offset = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1900, 0, 31)) / 86400000);
  if (offset < 0) return "";
  let y = 1900;
  for (; y < 2101 && offset >= yearDays(y); y++) offset -= yearDays(y);
  if (y > 2100) return "";
  const leap = leapMonth(y);
  let m = 1, isLeap = false;
  while (m <= 12) {
    const len = isLeap ? leapDays(y) : monthDays(y, m);
    if (offset < len) break;
    offset -= len;
    if (leap && m === leap && !isLeap) isLeap = true; else { isLeap = false; m++; }
  }
  return (isLeap ? "閏" : "") + LUNAR_MONTHS[m - 1] + "月" + LUNAR_DAYS[offset + 1];
}

// ---- 小工具大小（單位：點），跟筆記腳本同一張表
function widgetSizes() {
  const s = Device.screenSize();
  const w = Math.min(s.width, s.height), h = Math.max(s.width, s.height);
  const t = w >= 428 ? [170, 364, 382] : w >= 414 ? (h >= 896 ? [169, 360, 379] : [159, 348, 357])
    : w >= 390 ? [158, 338, 354] : w >= 375 ? (h >= 812 ? [155, 329, 345] : [148, 321, 324]) : [141, 292, 311];
  return { small: [t[0], t[0]], medium: [t[1], t[0]], large: [t[1], t[2]] };
}

// ---- 沿用筆記腳本畫好的圖：彩色底圖（bg-large 等）；左上角的字圖示用月曆的，沒有時退回筆記的 logo-0
const local = FileManager.local();
const ART_DIR = local.joinPath(local.documentsDirectory(), "kids-notes-art");
const artPath = name => local.joinPath(ART_DIR, name + ".png");
const artImage = name => local.fileExists(artPath(name)) ? Image.fromFile(artPath(name)) : null;
// 左上圖示跟童趣風月曆的「彥」一樣（月曆腳本畫好存在 calendar-widget-kids/logo.png）；沒跑過月曆才退回筆記的字圖示
function logoImages() {
  const calLogo = local.joinPath(local.joinPath(local.documentsDirectory(), "calendar-widget-kids"), "logo.png");
  if (local.fileExists(calLogo)) return [Image.fromFile(calLogo)];
  let n = 0;
  try { n = [...String(JSON.parse(local.readString(local.joinPath(ART_DIR, "meta.json"))).logoChar || "")].filter(c => c.trim()).slice(0, 3).length; } catch (e) {}
  const out = [];
  for (let i = 0; i < n; i++) { const im = artImage("logo-" + i); if (im) out.push(im); }
  return out;
}

// ---- 右上角的照片：黃色色塊可以換成一張照片（外框跟色塊同一個形狀）
// 照片和設定存在 iCloud 的 kids-agenda/（兩台裝置共用）；疊好照片的底圖畫在每台裝置自己的 kids-agenda-art/
// 小工具裡不能畫圖，所以換照片後，另一台要在 Scriptable 裡執行一次這個腳本，小工具才會換
const cloud = (() => { try { const f = FileManager.iCloud(); f.documentsDirectory(); return f; } catch (e) { return local; } })();
const AG_DIR = cloud.joinPath(cloud.documentsDirectory(), "kids-agenda");
const CORNER_PATH = cloud.joinPath(AG_DIR, "corner.jpg");
const SETTINGS_PATH = cloud.joinPath(AG_DIR, "settings.json");
const AG_ART = local.joinPath(local.documentsDirectory(), "kids-agenda-art");
const agArt = name => local.joinPath(AG_ART, name + ".png");
const AG_META = local.joinPath(AG_ART, "meta.json");
const readJSON = (fm, p) => { try { return JSON.parse(fm.readString(p)); } catch (e) { return null; } };
async function download(p) {
  try { if (cloud.fileExists(p)) await Promise.race([cloud.downloadFileFromiCloud(p), new Promise(r => Timer.schedule(3000, false, r))]); } catch (e) {}
}
async function cornerVersion() {
  await download(SETTINGS_PATH);
  return (readJSON(cloud, SETTINGS_PATH) || {}).cornerPhoto || 0;
}
// 底圖的版本：照片版本 + 筆記畫的底圖（-plain）的修改時間，任何一個變了就要重畫
const baseStamp = () => ["small", "medium", "large"].map(f => { try { return local.modificationDate(artPath("bg-" + f + "-plain")).getTime(); } catch (e) { return 0; } }).join(",");
function cornerBg(family, corner) {
  const meta = readJSON(local, AG_META);
  if (!corner || !meta || meta.corner !== corner || meta.base !== baseStamp() || !local.fileExists(agArt("bg-" + family))) return null;
  return Image.fromFile(agArt("bg-" + family));
}
// 在 App 內執行時：照片換過、或筆記的底圖重畫過，就重畫疊好照片的底圖
async function ensureCornerArt() {
  const corner = await cornerVersion();
  const meta = readJSON(local, AG_META);
  if (!corner || (meta && meta.corner === corner && meta.base === baseStamp())) return;
  await download(CORNER_PATH);
  if (!cloud.fileExists(CORNER_PATH)) return;
  const bases = {};
  for (const f of ["small", "medium", "large"]) if (local.fileExists(artPath("bg-" + f + "-plain"))) bases[f] = local.read(artPath("bg-" + f + "-plain")).toBase64String();
  if (!Object.keys(bases).length) return;
  const wv = new WebView();
  await wv.loadHTML("<html><body></body></html>");
  const res = await wv.evaluateJavaScript(`
    (async () => {
      try {
        const load = b64 => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = "data:image/png;base64," + b64; });
        const photo = await load(${JSON.stringify(cloud.read(CORNER_PATH).toBase64String())});
        const out = {};
        for (const [f, b64] of Object.entries(${JSON.stringify(bases)})) {
          const base = await load(b64), S = 3, W = base.width / S, H = base.height / S, u = Math.min(W, H) / 170;
          const cv = document.createElement("canvas"); cv.width = base.width; cv.height = base.height;
          const g = cv.getContext("2d"); g.drawImage(base, 0, 0);
          // 跟筆記的底圖同一個黃色色塊：中心 (W-4u, 2u)、92u×80u、轉 -8 度
          const pc = document.createElement("canvas"); pc.width = cv.width; pc.height = cv.height;
          const pg = pc.getContext("2d"); pg.scale(S, S);
          const bx = W - 4 * u, by = 2 * u, bw = 92 * u, bh = 80 * u;
          blob(pg, bx, by, bw, bh, R1, -8, "#000");
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
    // 不規則色塊（跟筆記腳本的 BLOB_JS 一樣）
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
    0;`, true);
  if (!res || res.error) return;
  if (!local.fileExists(AG_ART)) local.createDirectory(AG_ART, true);
  for (const f in res) local.write(agArt("bg-" + f), Data.fromBase64String(res[f]));
  local.writeString(AG_META, JSON.stringify({ corner, base: baseStamp() }));
}
// 從相簿選照片，或拿掉改回黃色色塊
async function changeCorner() {
  const a = new Alert();
  a.title = "右上角的照片";
  a.addAction("從相簿選");
  a.addDestructiveAction("拿掉照片，改回黃色色塊");
  a.addCancelAction("取消");
  const i = await a.presentSheet();
  if (i < 0) return;
  if (!cloud.fileExists(AG_DIR)) cloud.createDirectory(AG_DIR, true);
  if (i === 0) {
    let img;
    try { img = await Photos.fromLibrary(); } catch (e) { return; }
    // 長邊縮到 900 像素
    const k = Math.min(1, 900 / Math.max(img.size.width, img.size.height));
    const dc = new DrawContext();
    dc.size = new Size(Math.round(img.size.width * k), Math.round(img.size.height * k));
    dc.respectScreenScale = false; dc.opaque = true;
    dc.drawImageInRect(img, new Rect(0, 0, dc.size.width, dc.size.height));
    cloud.write(CORNER_PATH, Data.fromJPEG(dc.getImage()));
  } else if (cloud.fileExists(CORNER_PATH)) cloud.remove(CORNER_PATH);
  cloud.writeString(SETTINGS_PATH, JSON.stringify({ ...(readJSON(cloud, SETTINGS_PATH) || {}), cornerPhoto: i === 0 ? Date.now() : 0 }));
  await ensureCornerArt();
}

// ---- 讀行事曆和提醒事項
// 回傳 { groups: [{ day, label, lunar, items }], undated: [...] }，items 依時間排好
async function loadAgenda(days = 30) {
  const now = new Date(), today = day0(now), end = addDays(today, days);
  const items = [];
  let events = [], reminders = [];
  try {
    // 只讀自己建立的行事曆（可以編輯的）和通訊錄生日；內建的節日、訂閱的行事曆不顯示
    const cals = (await Calendar.forEvents()).filter(c => c.allowsContentModifications || /生日|birthday/i.test(c.title));
    if (cals.length) events = await CalendarEvent.between(today, end, cals);
  } catch (e) {}
  try { reminders = await Reminder.allIncomplete(); } catch (e) {}
  for (const e of events) {
    if (e.endDate <= now && !e.isAllDay) continue; // 已經結束的不顯示
    const d = e.startDate < today ? today : day0(e.startDate);
    items.push({ kind: "event", id: e.identifier, title: e.title || "（沒有標題）", day: d,
      start: e.startDate, end: e.endDate, allDay: e.isAllDay, sort: e.isAllDay ? -1 : e.startDate.getTime() });
  }
  const undated = [];
  for (const r of reminders) {
    const item = { kind: "rem", id: r.identifier, title: r.title || "（沒有標題）" };
    if (!r.dueDate) { undated.push(item); continue; }
    const overdue = r.dueDate < today;
    const d = overdue ? today : day0(r.dueDate);
    if (d >= end) continue;
    items.push({ ...item, day: d, start: r.dueDate, hasTime: r.dueDateIncludesTime, overdue,
      sort: overdue ? -2 : r.dueDateIncludesTime ? r.dueDate.getTime() : -1 });
  }
  const map = new Map();
  map.set(key(today), []); // 今天一定要有（沒行程時顯示「好好休息」）
  for (const it of items) { const k = key(it.day); if (!map.has(k)) map.set(k, []); map.get(k).push(it); }
  const groups = [...map.keys()].sort().map(k => {
    const [y, m, dd] = k.split("-").map(Number), d = new Date(y, m - 1, dd);
    const diff = Math.round((d - today) / 86400000);
    const label = diff === 0 ? "今天" : diff === 1 ? "明天" : `${m}/${dd} 星期${WEEK[d.getDay()]}`;
    return { day: d, label, lunar: lunar(d), items: map.get(k).sort((a, b) => a.sort - b.sort) };
  });
  return { groups, undated };
}

// 卡片顏色：依行程隨機（同一個行程每次都同色），同一個小工具裡不重複，8 色用完才重來
function makePicker() {
  const used = new Set();
  return it => {
    if (used.size >= CARD_PALETTE.length) used.clear();
    let i = hash(it.id + it.title) % CARD_PALETTE.length;
    while (used.has(i)) i = (i + 1) % CARD_PALETTE.length;
    used.add(i);
    return CARD_PALETTE[i];
  };
}

// 卡片右邊或第二行的時間文字
function timeText(it, withDay) {
  const dayPart = withDay ? withDay + " " : "";
  if (it.kind === "rem") {
    if (it.overdue) return "已過期";
    return dayPart + (it.hasTime ? hm(it.start) : "");
  }
  return dayPart + (it.allDay ? "整天" : hm(it.start));
}

// ---- 畫一張卡片：提醒事項是空心圓圈，行事曆活動是彩色小圓點
function addCard(parent, it, color, width, height, opts = {}) {
  const card = parent.addStack();
  card.size = new Size(width, height);
  card.backgroundColor = col(color.bg);
  card.cornerRadius = 12;
  card.setPadding(0, 9, 0, 9);
  card.centerAlignContent();
  card.spacing = 7;
  if (it.kind === "rem") card.url = "x-apple-reminderkit://";

  if (it.kind === "rem") {
    const sym = SFSymbol.named("circle");
    sym.applyFont(Font.boldSystemFont(14));
    const im = card.addImage(sym.image);
    im.imageSize = new Size(15, 15);
    im.tintColor = col(it.overdue ? K.red : K.ink);
  } else {
    const ring = card.addStack();
    ring.size = new Size(13, 13);
    ring.cornerRadius = 6.5;
    ring.backgroundColor = col(K.white);
    ring.centerAlignContent();
    const dot = ring.addStack();
    dot.size = new Size(9, 9);
    dot.cornerRadius = 4.5;
    dot.backgroundColor = col(color.dot);
  }

  const text = card.addStack();
  text.layoutVertically();
  text.spacing = 1;
  const t = text.addText(it.title);
  // 大尺寸的卡片標題放大 1.2 倍（13 → 15.6）；時間不變
  t.font = Font.heavyRoundedSystemFont(opts.small ? 12 : opts.withDay ? 13 : 15.6);
  t.textColor = col(K.ink);
  t.lineLimit = 1;
  const sub = timeText(it, opts.withDay);
  // 提醒事項（和中、小尺寸）的時間放第二行；大尺寸的活動時間放右邊，上開始、下結束
  if (sub && (it.kind === "rem" || opts.withDay)) {
    const row = text.addStack();
    row.centerAlignContent();
    row.spacing = 3;
    if (it.kind === "rem" && !it.overdue && it.hasTime && !opts.withDay) {
      const c = SFSymbol.named("clock");
      c.applyFont(Font.semiboldSystemFont(10));
      const ci = row.addImage(c.image);
      ci.imageSize = new Size(10, 10);
      ci.tintColor = col(K.body);
    }
    const s = row.addText(sub);
    s.font = Font.semiboldRoundedSystemFont(10);
    s.textColor = col(it.overdue ? K.red : K.body);
    s.lineLimit = 1;
  }
  card.addSpacer();
  if (it.kind === "event" && !opts.withDay) {
    const r = card.addStack();
    r.layoutVertically();
    if (it.allDay) {
      const a = r.addText("整天");
      a.font = Font.heavyRoundedSystemFont(11);
      a.textColor = col(color.dot);
    } else {
      for (const d of [it.start, it.end]) {
        const a = r.addText(hm(d));
        a.font = Font.heavyRoundedSystemFont(11);
        a.textColor = col(color.dot);
        a.rightAlignText();
      }
    }
  }
}

function addDayHeader(parent, g, indent = 0) {
  const row = parent.addStack();
  row.centerAlignContent();
  if (indent) row.addSpacer(indent);
  row.spacing = 6;
  const pill = row.addStack();
  pill.backgroundColor = col(g.label === "今天" ? K.sun : K.white);
  pill.cornerRadius = 8;
  pill.setPadding(1, 8, 1, 8);
  const t = pill.addText(g.label);
  t.font = Font.heavyRoundedSystemFont(11);
  t.textColor = col(K.ink);
  if (g.lunar && g.label !== "今天") {
    const l = row.addText(g.lunar);
    l.font = Font.semiboldRoundedSystemFont(10);
    l.textColor = col(K.body);
  }
}

// 左上角：字圖示 + 今天日期（深藍）+ 農曆，日期跟圖示裡的字差不多對齊在同一條底線
function addTopHeader(w, size, compact) {
  const now = new Date();
  const head = w.addStack();
  head.bottomAlignContent();
  head.spacing = 2;
  for (const im of logoImages()) { const li = head.addImage(im); li.imageSize = new Size(size, size); }
  head.addSpacer(6);
  const box = head.addStack();
  box.bottomAlignContent();
  box.spacing = 5;
  box.setPadding(0, 0, Math.round(size * 0.2), 0); // 往上墊一點，對齊圖示裡字的底部
  const d = box.addText(compact ? `${now.getMonth() + 1}/${now.getDate()} 週${WEEK[now.getDay()]}` : `${now.getMonth() + 1}月${now.getDate()}日 星期${WEEK[now.getDay()]}`);
  d.font = Font.heavyRoundedSystemFont(compact ? 11 : 15.6); // 大尺寸 13 再放大 1.2 倍；農曆不變
  d.textColor = col(K.ink); // 日期和星期都用深藍色（不用行事曆的紅色）
  d.lineLimit = 1;
  const l = lunar(now);
  if (l && !compact) {
    const lt = box.addText(l);
    lt.font = Font.semiboldRoundedSystemFont(10);
    lt.textColor = col(K.body);
    lt.lineLimit = 1;
  }
  head.addSpacer();
}

const CARD_H = 38, GAP = 5, DAY_H = 18;

async function buildWidget(family) {
  const [W, H] = widgetSizes()[family];
  const w = new ListWidget();
  w.backgroundColor = col(K.cream);
  // 底圖：右上角換過照片就用疊好照片的版本，不然用筆記畫好的「沒有手繪菱形」版本（舊版筆記還沒畫的話，先用一般版本）
  const bg = cornerBg(family, await cornerVersion()) || artImage("bg-" + family + "-plain") || artImage("bg-" + family);
  if (bg) w.backgroundImage = bg;
  w.setPadding(10, 12, 12, 12);
  w.url = "calshow://";
  const { groups, undated } = await loadAgenda();
  const inner = W - 24, pick = makePicker();

  if (family === "large") {
    const LOGO = 48; // 「彥」44 放大 1.1 倍
    // 行程最多放 4 項左右：整組往下 10，第一張卡片就在右上角照片（色塊）下面
    // 卡片和日期左右各縮 12，露出底圖左邊的綠色、右邊的橘色色塊（色塊停在離卡片約 4 的地方）
    const INSET = 12, cardW = inner - INSET * 2;
    const leftRow = () => { const r = w.addStack(); r.layoutHorizontally(); r.addSpacer(INSET); return r; };
    addTopHeader(w, LOGO, false);
    w.addSpacer(18);
    let room = H - 22 - LOGO - 18;
    const all = [...groups];
    if (undated.length) all.push({ label: "待辦", lunar: "", items: undated });
    for (const g of all) {
      const empty = g.label === "今天" && !g.items.length;
      const first = empty ? 30 : CARD_H;
      if (room < DAY_H + GAP + first) break; // 連一張卡片都放不下就不放這一天
      addDayHeader(w, g, INSET);
      w.addSpacer(GAP);
      room -= DAY_H + GAP;
      if (empty) {
        const boxRow = leftRow();
        const box = boxRow.addStack();
        boxRow.addSpacer();
        box.size = new Size(cardW, 30);
        box.backgroundColor = col(K.white, 0.75);
        box.cornerRadius = 12;
        box.setPadding(0, 10, 0, 10);
        box.centerAlignContent();
        const s = box.addText("✦ 今天沒有其他行程，好好休息");
        s.font = Font.boldRoundedSystemFont(12);
        s.textColor = col(K.body);
        box.addSpacer();
        w.addSpacer(GAP + 2);
        room -= 30 + GAP + 2;
        continue;
      }
      for (const it of g.items) {
        if (room < CARD_H) break;
        const row = leftRow();
        addCard(row, it, pick(it), cardW, CARD_H);
        row.addSpacer();
        w.addSpacer(GAP);
        room -= CARD_H + GAP;
      }
      w.addSpacer(2);
      room -= 2;
    }
    w.addSpacer();
    return w;
  }

  // 中、小尺寸：不分日期，直接列出接下來最近的幾筆，時間前面加上「明天」「10/15 週四」
  const flat = [];
  for (const g of groups) for (const it of g.items) {
    const tag = g.label.replace("星期", "週");
    flat.push({ it, tag });
  }
  for (const it of undated) flat.push({ it, tag: "待辦" });

  if (family === "medium") {
    const row = w.addStack();
    const left = row.addStack();
    left.layoutVertically();
    left.size = new Size(92, H - 22);
    const logos = logoImages();
    const lg = left.addStack();
    lg.spacing = 1;
    for (const im of logos) { const li = lg.addImage(im); li.imageSize = new Size(29, 29); }
    left.addSpacer(6);
    const now = new Date();
    const d = left.addText(`${now.getMonth() + 1}/${now.getDate()} 週${WEEK[now.getDay()]}`);
    d.font = Font.heavyRoundedSystemFont(15);
    d.textColor = col(K.ink);
    const l = lunar(now);
    if (l) { const lt = left.addText(l); lt.font = Font.semiboldRoundedSystemFont(11); lt.textColor = col(K.body); }
    left.addSpacer();
    row.addSpacer(8);
    const list = row.addStack();
    list.layoutVertically();
    list.spacing = GAP;
    const listW = inner - 92 - 8;
    const n = Math.floor((H - 22 + GAP) / (CARD_H + GAP));
    if (!flat.length) {
      const s = list.addText("✦ 接下來沒有行程，好好休息");
      s.font = Font.boldRoundedSystemFont(12);
      s.textColor = col(K.body);
    }
    for (const { it, tag } of flat.slice(0, n)) addCard(list, it, pick(it), listW, CARD_H, { withDay: tag });
    list.addSpacer();
    return w;
  }

  // 小尺寸
  addTopHeader(w, 24, true);
  w.addSpacer(6);
  const n = Math.max(1, Math.floor((H - 22 - 30 - 6 + GAP) / (CARD_H + GAP)));
  if (!flat.length) {
    const s = w.addText("✦ 沒有行程");
    s.font = Font.boldRoundedSystemFont(12);
    s.textColor = col(K.body);
  }
  for (const { it, tag } of flat.slice(0, n)) {
    addCard(w, it, pick(it), inner, CARD_H, { withDay: tag, small: true });
    w.addSpacer(GAP);
  }
  w.addSpacer();
  return w;
}

// ---- 進入點：在 App 內執行時可以預覽三種尺寸（第一次會詢問行事曆和提醒事項的權限）
if (config.runsInWidget) {
  const wd = await buildWidget(config.widgetFamily || "large");
  // 下一次更新：15 分鐘後或明天 0 點，看哪個先到
  const midnight = addDays(day0(new Date()), 1);
  wd.refreshAfterDate = new Date(Math.min(Date.now() + 15 * 60000, midnight.getTime() + 5000));
  Script.setWidget(wd);
} else {
  await ensureCornerArt(); // 另一台換過照片：在這台也畫好
  for (;;) {
    const a = new Alert();
    a.title = "待辦事項";
    a.message = "預覽主畫面小工具。第一次執行時，請允許 Scriptable 取用行事曆和提醒事項。";
    a.addAction("預覽大尺寸");
    a.addAction("預覽中尺寸");
    a.addAction("預覽小尺寸");
    a.addAction("換右上角的照片");
    a.addCancelAction("結束");
    const i = await a.presentSheet();
    if (i === 0) await (await buildWidget("large")).presentLarge();
    if (i === 1) await (await buildWidget("medium")).presentMedium();
    if (i === 2) await (await buildWidget("small")).presentSmall();
    if (i === 3) { await changeCorner(); continue; } // 換好回到選單，可以馬上預覽
    break;
  }
}
Script.complete();
