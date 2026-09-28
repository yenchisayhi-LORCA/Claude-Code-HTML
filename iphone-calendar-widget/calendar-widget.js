// 月曆小工具（Scriptable 大尺寸）— 配色沿用旅遊記帳系統，字型 Zen Maru Gothic
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

// ---- Zen Maru Gothic 字型
// Scriptable 無法直接安裝網路字型，所以第一次在 App 內執行時，用 WebView 從
// Google Fonts 載入字型、把會用到的字依顏色畫成小圖存起來；小工具之後直接讀這些圖。
// 沒畫到的字（例如圖示裡的「彥」，字型裡沒有）改用系統圓體。
const FONT = "Zen Maru Gothic";
const GLYPH_VERSION = 2;
const DIGITS = "0123456789";
const LUNAR_CHARS = "正一二三四五六七八九十冬臘閏月初廿";
// [粗細, 顏色, 要畫的字]
const GLYPH_SPECS = [
  [700, C.text, DIGITS],
  [700, C.muted, DIGITS + "一二三四五"],
  [900, "#FFFFFF", DIGITS],
  [900, C.primary, DIGITS + "月"],
  [700, C.danger, "日"],
  [700, C.tealDark, "六" + LUNAR_CHARS],
];
const glyphKey = (w, hex, ch) => `${w}_${hex.slice(1)}_${ch.codePointAt(0)}`;
const fm = FileManager.local();
const glyphDir = fm.joinPath(fm.documentsDirectory(), "calendar-widget-glyphs");
const metaPath = fm.joinPath(glyphDir, "meta.json");

async function buildGlyphs() {
  const allChars = [...new Set(GLYPH_SPECS.map(g => g[2]).join(""))].join("");
  const css = `https://fonts.googleapis.com/css2?family=${FONT.replace(/ /g, "+")}:wght@700;900&text=${encodeURIComponent(allChars)}&display=block`;
  const wv = new WebView();
  await wv.loadHTML(`<html><head><link rel="stylesheet" href="${css}"></head><body></body></html>`);
  const res = await wv.evaluateJavaScript(`
    (async () => {
      try {
        const specs = ${JSON.stringify(GLYPH_SPECS)}, widths = {}, images = {};
        for (const w of [700, 900]) {
          // 字型沒下載成功時 load 會回傳空陣列，這時不要存檔，免得存到備用字型
          const faces = await document.fonts.load(w + ' 100px "${FONT}"', ${JSON.stringify(allChars)});
          if (!faces.length) return completion(null);
        }
        const cv = document.createElement("canvas"), g = cv.getContext("2d");
        for (const [w, hex, chars] of specs) for (const ch of chars) {
          const key = w + "_" + hex.slice(1) + "_" + ch.codePointAt(0);
          g.font = w + ' 100px "${FONT}"';
          widths[key] = g.measureText(ch).width;
          cv.width = Math.ceil(widths[key]) + 20; cv.height = 140;
          g.font = w + ' 100px "${FONT}"'; g.fillStyle = hex;
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText(ch, cv.width / 2, 70);
          images[key] = cv.toDataURL("image/png").split(",")[1];
        }
        completion({ widths, images });
      } catch (e) { completion(null); }
    })();`, true);
  if (!res) return false;
  if (!fm.fileExists(glyphDir)) fm.createDirectory(glyphDir, true);
  for (const key in res.images) fm.write(fm.joinPath(glyphDir, key + ".png"), Data.fromBase64String(res.images[key]));
  fm.writeString(metaPath, JSON.stringify({ version: GLYPH_VERSION, specs: GLYPH_SPECS, widths: res.widths }));
  return true;
}

// 讀取字型小圖；沒有的話（且不是在小工具裡）先建一次。失敗就回傳 null，改用系統字型
async function loadGlyphs() {
  const ok = () => {
    if (!fm.fileExists(metaPath)) return null;
    const meta = JSON.parse(fm.readString(metaPath));
    if (meta.version !== GLYPH_VERSION || JSON.stringify(meta.specs) !== JSON.stringify(GLYPH_SPECS)) return null;
    return meta;
  };
  let meta = ok();
  if (!meta && !config.runsInWidget) {
    try { if (await buildGlyphs()) meta = ok(); } catch (e) {}
  }
  if (!meta) return null;
  const images = {};
  for (const key in meta.widths) images[key] = Image.fromFile(fm.joinPath(glyphDir, key + ".png"));
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

// 用 Zen Maru Gothic 畫字；有任何字沒畫到小圖時，整串改用系統圓體
const hasGlyphs = (str, w, hex) => glyphs && [...str].every(ch => glyphKey(w, hex, ch) in glyphs.widths);
function strWidth(str, size, w, hex) {
  if (!hasGlyphs(str, w, hex)) return [...str].reduce((t, ch) => t + size * (ch.charCodeAt(0) > 255 ? 1 : 0.6), 0);
  return [...str].reduce((t, ch) => t + glyphs.widths[glyphKey(w, hex, ch)] * size / 100, 0);
}
function str(s, x, cy, size, hex, w = 700, align = "center") {
  const width = strWidth(s, size, w, hex);
  if (!hasGlyphs(s, w, hex)) {
    const cx = align === "left" ? x + width / 2 : x;
    return text(s, cx, cy, size, hex, w >= 900 ? heavy : bold, "center", width + 20);
  }
  const k = size / 100;
  let pen = align === "left" ? x : x - width / 2;
  for (const ch of s) {
    const key = glyphKey(w, hex, ch), adv = glyphs.widths[key] * k, imgW = (Math.ceil(glyphs.widths[key]) + 20) * k;
    ctx.drawImageInRect(glyphs.images[key], new Rect(pen + adv / 2 - imgW / 2, cy - 70 * k, imgW, 140 * k));
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

const titleX = inX + logoS + 10, title = `${month + 1}月`;
str(title, titleX, headY, 24, C.primary, 900, "left");
str(String(year), titleX + strWidth(title, 24, 900, C.primary) + 8, headY + 2, 14, C.muted, 700, "left");

const lunar = lunarText(now);
if (lunar) {
  const pillW = strWidth(lunar, 14, 700, C.tealDark) + 22, pillH = 26;
  roundRect(C.tealTint, 1, inX + inW - pillW, headY - pillH / 2, pillW, pillH, 13);
  str(lunar, inX + inW - pillW / 2, headY, 14, C.tealDark);
}

// ---- 星期列（從星期日開始）
const colW = inW / 7;
const weekY = headY + 34;
["日", "一", "二", "三", "四", "五", "六"].forEach((d, i) => {
  const c = i === 0 ? C.danger : i === 6 ? C.tealDark : C.muted;
  str(d, inX + colW * i + colW / 2, weekY, 13, c);
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
    str(String(d), cx, cy, 19, "#FFFFFF", 900);
  } else {
    const weekend = c === 0 || c === 6;
    str(String(d), cx, cy, 19, weekend ? C.muted : C.text);
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
