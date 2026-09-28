// 月曆小工具（Scriptable 大尺寸）— 配色沿用旅遊記帳系統
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

// ---- 標題列：黃色行李箱圖示（今天日期）+ 月份 + 年份 + 農曆
const headY = cardY + pad + 18;
const logoX = inX, logoW = 36, logoH = 30;
const handle = new Path();
handle.addRoundedRect(new Rect(logoX + logoW / 2 - 8, headY - logoH / 2 - 7, 16, 12), 5, 5);
ctx.addPath(handle);
ctx.setStrokeColor(col(C.dangerDark));
ctx.setLineWidth(3);
ctx.strokePath();
roundRect(C.warnDark, 1, logoX, headY - logoH / 2 + 4, logoW, logoH, 10);
roundRect(C.warn, 1, logoX, headY - logoH / 2, logoW, logoH, 10);
text(String(today), logoX + logoW / 2, headY, 17, "#FFFFFF", heavy, "center", logoW);

text(`${month + 1}月`, logoX + logoW + 10, headY, 24, C.primary, heavy, "left", 70);
const monthW = month + 1 >= 10 ? 58 : 44;
text(String(year), logoX + logoW + 12 + monthW, headY + 3, 14, C.muted, bold, "left", 50);

const lunar = lunarText(now);
if (lunar) {
  const pillW = lunar.length * 14 + 22, pillH = 26;
  roundRect(C.tealTint, 1, inX + inW - pillW, headY - pillH / 2, pillW, pillH, 13);
  text(lunar, inX + inW - pillW / 2, headY, 14, C.tealDark, bold, "center", pillW);
}

// ---- 星期列（從星期日開始）
const colW = inW / 7;
const weekY = headY + 36;
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
    text(String(d), cx, cy, 18, "#FFFFFF", heavy, "center", colW);
  } else {
    const weekend = c === 0 || c === 6;
    text(String(d), cx, cy, 18, weekend ? C.muted : C.text, bold, "center", colW);
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
