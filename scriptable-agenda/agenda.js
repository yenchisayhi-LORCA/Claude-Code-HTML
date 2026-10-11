// 待辦事項・童趣風行事曆小工具（Scriptable）
// 讀 iPhone 內建「行事曆」的活動和「提醒事項」，依日期排成彩色卡片；放得下多少就顯示多少
// 左上角的字圖示和彩色底圖沿用「筆記」腳本在這台裝置畫好的圖（kids-notes-art），兩個小工具看起來是同一套
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
const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
const col = (hex, a = 1) => new Color(hex, a);
const hash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
const p2 = n => String(n).padStart(2, "0");
const hm = d => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
const day0 = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const key = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// ---- 農曆（用系統內建的農曆，例如「九月初二」「閏六月十五」）
const LUNAR_DAYS = ["", "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
  "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"];
function lunar(d) {
  try {
    const parts = new Intl.DateTimeFormat("zh-TW-u-ca-chinese", { month: "long", day: "numeric" }).formatToParts(d);
    const month = (parts.find(p => p.type === "month") || {}).value || "";
    const dayN = parseInt((parts.find(p => p.type === "day") || {}).value, 10);
    return month && LUNAR_DAYS[dayN] ? month + LUNAR_DAYS[dayN] : "";
  } catch (e) { return ""; }
}

// ---- 小工具大小（單位：點），跟筆記腳本同一張表
function widgetSizes() {
  const s = Device.screenSize();
  const w = Math.min(s.width, s.height), h = Math.max(s.width, s.height);
  const t = w >= 428 ? [170, 364, 382] : w >= 414 ? (h >= 896 ? [169, 360, 379] : [159, 348, 357])
    : w >= 390 ? [158, 338, 354] : w >= 375 ? (h >= 812 ? [155, 329, 345] : [148, 321, 324]) : [141, 292, 311];
  return { small: [t[0], t[0]], medium: [t[1], t[0]], large: [t[1], t[2]] };
}

// ---- 沿用筆記腳本畫好的圖：左上角的字圖示（logo-0～2）和彩色底圖（bg-large 等）
const local = FileManager.local();
const ART_DIR = local.joinPath(local.documentsDirectory(), "kids-notes-art");
const artPath = name => local.joinPath(ART_DIR, name + ".png");
const artImage = name => local.fileExists(artPath(name)) ? Image.fromFile(artPath(name)) : null;
function logoImages() {
  let n = 0;
  try { n = [...String(JSON.parse(local.readString(local.joinPath(ART_DIR, "meta.json"))).logoChar || "")].filter(c => c.trim()).slice(0, 3).length; } catch (e) {}
  const out = [];
  for (let i = 0; i < n; i++) { const im = artImage("logo-" + i); if (im) out.push(im); }
  return out;
}

// ---- 讀行事曆和提醒事項
// 回傳 { groups: [{ day, label, lunar, items }], undated: [...] }，items 依時間排好
async function loadAgenda(days = 30) {
  const now = new Date(), today = day0(now), end = addDays(today, days);
  const items = [];
  let events = [], reminders = [];
  try { events = await CalendarEvent.between(today, end); } catch (e) {}
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

// 卡片顏色：依行程隨機（同一個行程每次都同色），跟前一張同色就換下一個顏色
function makePicker() {
  let last = -1;
  return it => {
    let i = hash(it.id + it.title) % PALETTE.length;
    if (i === last) i = (i + 1) % PALETTE.length;
    last = i;
    return PALETTE[i];
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
  t.font = Font.heavyRoundedSystemFont(opts.small ? 12 : 13);
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

function addDayHeader(parent, g) {
  const row = parent.addStack();
  row.centerAlignContent();
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

// 左上角：字圖示 + 今天日期（深藍）+ 農曆
function addTopHeader(w, size, compact) {
  const now = new Date();
  const head = w.addStack();
  head.centerAlignContent();
  head.spacing = 2;
  for (const im of logoImages()) { const li = head.addImage(im); li.imageSize = new Size(size, size); }
  head.addSpacer(6);
  const box = head.addStack();
  box.layoutVertically();
  const d = box.addText(compact ? `${now.getMonth() + 1}/${now.getDate()} 週${WEEK[now.getDay()]}` : `${now.getMonth() + 1}月${now.getDate()}日 星期${WEEK[now.getDay()]}`);
  d.font = Font.heavyRoundedSystemFont(compact ? 13 : 16);
  d.textColor = col(K.ink); // 日期和星期都用深藍色（不用行事曆的紅色）
  d.lineLimit = 1;
  const l = lunar(now);
  if (l) {
    const lt = box.addText(l);
    lt.font = Font.semiboldRoundedSystemFont(compact ? 10 : 11);
    lt.textColor = col(K.body);
  }
  head.addSpacer();
}

const CARD_H = 38, GAP = 5, DAY_H = 18;

async function buildWidget(family) {
  const [W, H] = widgetSizes()[family];
  const w = new ListWidget();
  w.backgroundColor = col(K.cream);
  const bg = artImage("bg-" + family);
  if (bg) w.backgroundImage = bg;
  w.setPadding(10, 12, 12, 12);
  w.url = "calshow://";
  const { groups, undated } = await loadAgenda();
  const inner = W - 24, pick = makePicker();

  if (family === "large") {
    const LOGO = 44;
    addTopHeader(w, LOGO, false);
    w.addSpacer(8);
    let room = H - 22 - LOGO - 8;
    const all = [...groups];
    if (undated.length) all.push({ label: "待辦", lunar: "", items: undated });
    for (const g of all) {
      const empty = g.label === "今天" && !g.items.length;
      const first = empty ? 30 : CARD_H;
      if (room < DAY_H + GAP + first) break; // 連一張卡片都放不下就不放這一天
      addDayHeader(w, g);
      w.addSpacer(GAP);
      room -= DAY_H + GAP;
      if (empty) {
        const box = w.addStack();
        box.size = new Size(inner, 30);
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
        addCard(w, it, pick(it), inner, CARD_H);
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
  // 下一次更新：30 分鐘後或明天 0 點，看哪個先到
  const midnight = addDays(day0(new Date()), 1);
  wd.refreshAfterDate = new Date(Math.min(Date.now() + 30 * 60000, midnight.getTime() + 5000));
  Script.setWidget(wd);
} else {
  const a = new Alert();
  a.title = "待辦事項";
  a.message = "預覽主畫面小工具。第一次執行時，請允許 Scriptable 取用行事曆和提醒事項。";
  a.addAction("預覽大尺寸");
  a.addAction("預覽中尺寸");
  a.addAction("預覽小尺寸");
  a.addCancelAction("結束");
  const i = await a.presentSheet();
  if (i === 0) await (await buildWidget("large")).presentLarge();
  if (i === 1) await (await buildWidget("medium")).presentMedium();
  if (i === 2) await (await buildWidget("small")).presentSmall();
}
Script.complete();
