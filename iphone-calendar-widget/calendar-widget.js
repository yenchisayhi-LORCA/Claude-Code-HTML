// 月曆小工具（Scriptable 大尺寸）— 配色沿用旅遊記帳系統，數字字型 Caacupe One
const C = {
  bg: "#3B4CB8", surface: "#FFFDF7", text: "#2B3159", muted: "#8A93B5",
  primary: "#3B4CB8", teal: "#4CBFB5", tealDark: "#2E8C84", tealTint: "#EDF9F4",
  danger: "#E8574B", dangerDark: "#B93E34", warn: "#F5B324", warnDark: "#D9971A",
};
const col = (hex, a = 1) => new Color(hex, a);

// 依螢幕寬度推算大尺寸小工具的大小（單位：點）
function widgetSize() {
  const s = Device.screenSize();
  const w = Math.min(s.width, s.height), h = Math.max(s.width, s.height);
  if (w >= 428) return [364, 382];
  if (w >= 414) return h >= 896 ? [360, 379] : [348, 357];
  if (w >= 390) return [338, 354];
  if (w >= 375) return h >= 812 ? [329, 345] : [321, 324];
  return [292, 311];
}

// 農曆日期，例如「八月十八」；系統不支援時回傳空字串
function lunarText(d) {
  try {
    const parts = new Intl.DateTimeFormat("zh-TW-u-ca-chinese", { month: "long", day: "numeric" }).formatToParts(d);
    const month = parts.find(p => p.type === "month").value;
    const n = parseInt(parts.find(p => p.type === "day").value, 10);
    const num = "一二三四五六七八九十";
    let day;
    if (n === 10) day = "初十";
    else if (n === 20) day = "二十";
    else if (n === 30) day = "三十";
    else if (n < 10) day = "初" + num[n - 1];
    else if (n < 20) day = "十" + num[n - 11];
    else day = "廿" + num[n - 21];
    return month + day;
  } catch (e) {
    return "";
  }
}

// ---- Caacupe One 數字字型
// Scriptable 無法直接安裝網路字型，所以第一次在 App 內執行時，用 WebView 從
// Google Fonts 載入字型、把 0–9 各色數字畫成小圖存起來；小工具之後直接讀這些圖。
// 字型沒有中文，中文維持系統圓體。
const FONT = "Caacupe One";
const GLYPH_VERSION = 1;
const GLYPH_COLORS = { text: C.text, muted: C.muted, white: "#FFFFFF", primary: C.primary };
const fm = FileManager.local();
const glyphDir = fm.joinPath(fm.documentsDirectory(), "calendar-widget-glyphs");
const metaPath = fm.joinPath(glyphDir, "meta.json");

async function buildGlyphs() {
  const wv = new WebView();
  await wv.loadHTML(`<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${FONT.replace(/ /g, "+")}&display=block"></head><body></body></html>`);
  const res = await wv.evaluateJavaScript(`
    (async () => {
      try {
        const F = '100px "${FONT}"';
        await document.fonts.load(F, "0123456789");
        if (!document.fonts.check(F, "0123456789")) return completion(null);
        const cv = document.createElement("canvas"), g = cv.getContext("2d");
        g.font = F;
        const widths = {}, images = {}, colors = ${JSON.stringify(GLYPH_COLORS)};
        for (const ch of "0123456789") widths[ch] = g.measureText(ch).width;
        for (const name in colors) for (const ch of "0123456789") {
          cv.width = Math.ceil(widths[ch]) + 20; cv.height = 140;
          g.font = F; g.fillStyle = colors[name];
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText(ch, cv.width / 2, 70);
          images[name + ch] = cv.toDataURL("image/png").split(",")[1];
        }
        completion({ widths, images });
      } catch (e) { completion(null); }
    })();`, true);
  if (!res) return false;
  if (!fm.fileExists(glyphDir)) fm.createDirectory(glyphDir, true);
  for (const key in res.images) fm.write(fm.joinPath(glyphDir, key + ".png"), Data.fromBase64String(res.images[key]));
  fm.writeString(metaPath, JSON.stringify({ version: GLYPH_VERSION, colors: GLYPH_COLORS, widths: res.widths }));
  return true;
}

// 讀取字型小圖；沒有的話（且不是在小工具裡）先建一次。失敗就回傳 null，改用系統字型
async function loadGlyphs() {
  const ok = () => {
    if (!fm.fileExists(metaPath)) return null;
    const meta = JSON.parse(fm.readString(metaPath));
    if (meta.version !== GLYPH_VERSION || JSON.stringify(meta.colors) !== JSON.stringify(GLYPH_COLORS)) return null;
    return meta;
  };
  let meta = ok();
  if (!meta && !config.runsInWidget) {
    try { if (await buildGlyphs()) meta = ok(); } catch (e) {}
  }
  if (!meta) return null;
  const images = {};
  for (const name in GLYPH_COLORS) for (const ch of "0123456789") {
    images[name + ch] = Image.fromFile(fm.joinPath(glyphDir, name + ch + ".png"));
  }
  return { widths: meta.widths, images };
}
const glyphs = await loadGlyphs();

const [W, H] = widgetSize();
const ctx = new DrawContext();
ctx.size = new Size(W, H);
ctx.opaque = false;
ctx.respectScreenScale = true;

function ellipse(hex, a, x, y, w, h) {
  ctx.setFillColor(col(hex, a));
  ctx.fillEllipse(new Rect(x, y, w, h));
}
function roundRect(hex, a, x, y, w, h, r) {
  const p = new Path();
  p.addRoundedRect(new Rect(x, y, w, h), r, r);
  ctx.addPath(p);
  ctx.setFillColor(col(hex, a));
  ctx.fillPath();
}
// 以 (cx, cy) 為中心畫一行文字
function text(str, cx, cy, size, hex, font, align = "center", boxW = 80) {
  ctx.setFont(font(size));
  ctx.setTextColor(col(hex));
  const x = align === "left" ? cx : align === "right" ? cx - boxW : cx - boxW / 2;
  if (align === "left") ctx.setTextAlignedLeft();
  else if (align === "right") ctx.setTextAlignedRight();
  else ctx.setTextAlignedCenter();
  ctx.drawTextInRect(str, new Rect(x, cy - size * 0.62, boxW, size * 1.4));
}
const heavy = s => Font.heavyRoundedSystemFont(s);
const bold = s => Font.boldRoundedSystemFont(s);

// 用 Caacupe One 畫數字（colorName 為 GLYPH_COLORS 的鍵）；沒有字型時用系統圓體
function numWidth(str, size) {
  if (!glyphs) return str.length * size * 0.6;
  return [...str].reduce((w, ch) => w + glyphs.widths[ch] * size / 100, 0);
}
function num(str, x, cy, size, colorName, align = "center") {
  if (!glyphs) {
    const w = numWidth(str, size) + 20;
    const cx = align === "left" ? x + w / 2 - 10 : x;
    return text(str, cx, cy, size, GLYPH_COLORS[colorName], heavy, "center", w);
  }
  const k = size / 100;
  let pen = align === "left" ? x : x - numWidth(str, size) / 2;
  for (const ch of str) {
    const adv = glyphs.widths[ch] * k, imgW = (Math.ceil(glyphs.widths[ch]) + 20) * k;
    ctx.drawImageInRect(glyphs.images[colorName + ch], new Rect(pen + adv / 2 - imgW / 2, cy - 70 * k, imgW, 140 * k));
    pen += adv;
  }
}

// ---- 背景：藍底 + 彩色色塊
ctx.setFillColor(col(C.bg));
ctx.fillRect(new Rect(0, 0, W, H));
ellipse(C.teal, 1, W * 0.18, -H * 0.3, W * 0.62, H * 0.45);
ellipse(C.teal, 0.55, W * 0.8, H * 0.22, W * 0.4, H * 0.7);
ellipse(C.danger, 1, -W * 0.22, H * 0.8, W * 0.7, H * 0.42);
ellipse(C.warn, 1, W * 0.6, H * 0.82, W * 0.6, H * 0.45);

// ---- 米白卡片（底下一層深色做厚實陰影）
const m = 11, cardX = m, cardY = m, cardW = W - m * 2, cardH = H - m * 2 - 5;
roundRect("#182050", 0.18, cardX, cardY + 6, cardW, cardH, 22);
roundRect(C.surface, 1, cardX, cardY, cardW, cardH, 22);

const now = new Date();
const year = now.getFullYear(), month = now.getMonth(), today = now.getDate();
const pad = 14, inX = cardX + pad, inW = cardW - pad * 2;

// ---- 標題列：「彥」圖示 + 月份 + 年份 + 農曆
// 圖示：黃底圓角方塊、紅花、米白圓塊裡的「彥」、兩株小芽
function drawLogo(x, y, s) {
  const P = (px, py) => new Point(x + px * s, y + py * s);
  roundRect("#F7D35A", 1, x, y, s, s, s * 0.24);

  // 紅花：8 片花瓣 + 白色花心
  const fx = 0.19, fy = 0.17;
  const petals = new Path();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + 0.2, at = (r, da) => P(fx + r * Math.cos(a + da), fy + r * Math.sin(a + da));
    petals.move(at(0.03, -0.9));
    petals.addQuadCurve(at(0.2, 0), at(0.19, -0.5));
    petals.addQuadCurve(at(0.03, 0.9), at(0.19, 0.5));
    petals.closeSubpath();
  }
  ctx.addPath(petals);
  ctx.setFillColor(col("#E0452E"));
  ctx.fillPath();
  ellipse("#E0452E", 1, x + (fx - 0.07) * s, y + (fy - 0.07) * s, 0.14 * s, 0.14 * s);
  ellipse("#FFFDF7", 1, x + (fx - 0.045) * s, y + (fy - 0.045) * s, 0.09 * s, 0.09 * s);

  // 米白圓塊（略不規則）
  const bx = 0.53, by = 0.5, r = [0.37, 0.35, 0.36, 0.33], kk = 0.5523;
  const blob = new Path();
  blob.move(P(bx + r[0], by));
  blob.addCurve(P(bx, by + r[1]), P(bx + r[0], by + r[1] * kk), P(bx + r[2] * kk, by + r[1]));
  blob.addCurve(P(bx - r[2], by), P(bx - r[2] * kk, by + r[1]), P(bx - r[2], by + r[1] * kk));
  blob.addCurve(P(bx, by - r[3]), P(bx - r[2], by - r[3] * kk), P(bx - r[2] * kk, by - r[3]));
  blob.addCurve(P(bx + r[0], by), P(bx + r[0] * kk, by - r[3]), P(bx + r[0], by - r[3] * kk));
  blob.closeSubpath();
  ctx.addPath(blob);
  ctx.setFillColor(col("#FDFBEF"));
  ctx.fillPath();

  text("彥", x + bx * s, y + by * s, s * 0.46, "#2A2F7C", heavy, "center", s);

  // 小芽
  const sprout = (hex, lines) => {
    const p = new Path();
    lines.forEach(([a, b, c, d]) => { p.move(P(a, b)); p.addLine(P(c, d)); });
    ctx.addPath(p);
    ctx.setStrokeColor(col(hex));
    ctx.setLineWidth(s * 0.05);
    ctx.strokePath();
  };
  sprout("#5B78D0", [[0.2, 0.96, 0.21, 0.73], [0.205, 0.85, 0.15, 0.77], [0.21, 0.81, 0.27, 0.75]]);
  sprout("#2A2F7C", [[0.74, 0.88, 0.9, 0.68], [0.8, 0.81, 0.77, 0.64], [0.8, 0.81, 0.94, 0.8]]);
}

const logoS = 40, headY = cardY + pad + logoS / 2;
drawLogo(inX, headY - logoS / 2, logoS);

const titleX = inX + logoS + 10, monthNum = String(month + 1);
num(monthNum, titleX, headY, 26, "primary", "left");
const monthNumW = numWidth(monthNum, 26);
text("月", titleX + monthNumW + 1, headY, 22, C.primary, heavy, "left", 30);
num(String(year), titleX + monthNumW + 1 + 22 + 8, headY + 3, 15, "muted", "left");

const lunar = lunarText(now);
if (lunar) {
  const pillW = lunar.length * 14 + 22, pillH = 26;
  roundRect(C.tealTint, 1, inX + inW - pillW, headY - pillH / 2, pillW, pillH, 13);
  text(lunar, inX + inW - pillW / 2, headY, 14, C.tealDark, bold, "center", pillW);
}

// ---- 星期列（從星期日開始）
const colW = inW / 7;
const weekY = headY + 34;
["日", "一", "二", "三", "四", "五", "六"].forEach((d, i) => {
  const c = i === 0 ? C.danger : i === 6 ? C.tealDark : C.muted;
  text(d, inX + colW * i + colW / 2, weekY, 13, c, bold, "center", colW);
});

// ---- 日期格
const firstDow = new Date(year, month, 1).getDay();
const days = new Date(year, month + 1, 0).getDate();
const rows = Math.ceil((firstDow + days) / 7);
const gridTop = weekY + 14, gridBottom = cardY + cardH - pad + 2;
const rowH = (gridBottom - gridTop) / rows;
const dot = Math.min(colW, rowH) * 0.82;

for (let d = 1; d <= days; d++) {
  const idx = firstDow + d - 1, c = idx % 7, r = Math.floor(idx / 7);
  const cx = inX + colW * c + colW / 2, cy = gridTop + rowH * r + rowH / 2;
  if (d === today) {
    ellipse(C.dangerDark, 1, cx - dot / 2, cy - dot / 2 + 3, dot, dot);
    ellipse(C.danger, 1, cx - dot / 2, cy - dot / 2, dot, dot);
    num(String(d), cx, cy, 20, "white");
  } else {
    const weekend = c === 0 || c === 6;
    num(String(d), cx, cy, 20, weekend ? "muted" : "text");
  }
}

// ---- 輸出小工具
const widget = new ListWidget();
widget.setPadding(0, 0, 0, 0);
widget.backgroundImage = ctx.getImage();
widget.url = "calshow://"; // 點一下打開內建行事曆
const midnight = new Date(year, month, today + 1, 0, 0, 5);
widget.refreshAfterDate = midnight;

if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentLarge();
Script.complete();
