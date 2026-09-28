// 月曆小工具（Scriptable 大尺寸）— 配色沿用旅遊記帳系統，字型 Zen Maru Gothic
const C = {
  bg: "#3B4CB8", surface: "#FFFDF7", text: "#2B3159", muted: "#8A93B5",
  primary: "#3B4CB8", teal: "#4CBFB5", tealDark: "#2E8C84",
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

// ---- Zen Maru Gothic 字型
// Scriptable 無法直接安裝網路字型，所以第一次在 App 內執行時，用 WebView 從
// Google Fonts 載入字型、把會用到的字依顏色畫成小圖存起來，「彥」圖示也一起畫好存成
// 一張圖；小工具之後直接讀這些圖。還沒存好時改用系統圓體和簡化版圖示。
const FONT = "Zen Maru Gothic";
const GLYPH_VERSION = 4;
const DIGITS = "0123456789";
// [粗細, 顏色, 要畫的字]
const GLYPH_SPECS = [
  [700, C.text, DIGITS],
  [700, C.muted, DIGITS + "一二三四五"],
  [900, "#FFFFFF", DIGITS],
  [900, C.primary, DIGITS + "."],
  [700, C.danger, "日"],
  [700, C.tealDark, "六"],
];
const glyphKey = (w, hex, ch) => `${w}_${hex.slice(1)}_${ch.codePointAt(0)}`;
const fm = FileManager.local();
const glyphDir = fm.joinPath(fm.documentsDirectory(), "calendar-widget-glyphs");
const metaPath = fm.joinPath(glyphDir, "meta.json");
const logoPath = fm.joinPath(glyphDir, "logo.png");

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

// 成功回傳 null；失敗回傳原因
async function buildGlyphs() {
  const allChars = [...new Set(GLYPH_SPECS.map(g => g[2]).join(""))].join("");
  const faces = [...await fetchFont(FONT, [700, 900], allChars), ...await fetchFont("Huninn", null, "彥")];
  const wv = new WebView();
  await wv.loadHTML("<html><body></body></html>");
  const res = await wv.evaluateJavaScript(`
    (async () => {
      try {
        const specs = ${JSON.stringify(GLYPH_SPECS)}, widths = {}, images = {};
        for (const f of ${JSON.stringify(faces)}) {
          const bytes = Uint8Array.from(atob(f.b64), c => c.charCodeAt(0));
          const face = new FontFace(f.family, bytes, { weight: f.weight });
          await face.load();
          document.fonts.add(face);
        }
        const logo = drawLogo();
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
        completion({ widths, images, logo });
      } catch (e) { completion({ error: String(e) }); }
    })();

    // 「彥」圖示（Claude Design 黃底版，256×256 設計稿，以 3 倍解析度輸出）
    function drawLogo() {
      const S = 3, cv = document.createElement("canvas"), g = cv.getContext("2d");
      cv.width = cv.height = 256 * S;
      g.scale(S, S);
      g.beginPath(); g.roundRect(0, 0, 256, 256, 56); g.clip();
      g.fillStyle = "#FFD429"; g.fillRect(0, 0, 256, 256);

      // 紅花（奶油花心）
      g.save(); g.translate(46, 44); g.rotate(-12 * Math.PI / 180);
      g.fillStyle = "#E63329";
      for (let i = 0; i < 8; i++) {
        g.save(); g.rotate(i * Math.PI / 4);
        g.beginPath(); g.ellipse(0, -23, 8, 20, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      g.fillStyle = "#FFFCEA"; g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.fill();
      g.restore();

      // 葉枝：[顏色, 線寬, 位移, 旋轉角度, 路徑]
      const twig = (color, width, tx, ty, deg, paths) => {
        g.save(); g.translate(tx, ty); g.rotate(deg * Math.PI / 180);
        g.strokeStyle = color; g.lineWidth = width; g.lineCap = "round";
        for (const d of paths) g.stroke(new Path2D(d));
        g.restore();
      };
      twig("#2A2A6B", 5.5, 200, 182, 18, [
        "M0 52 C 4 30, 10 12, 20 -6", "M3 38 C -6 32, -12 23, -14 14", "M8 26 C 0 19, -4 10, -5 1",
        "M6 34 C 15 27, 20 19, 23 10", "M11 21 C 20 15, 25 7, 27 -2"]);
      twig("#4A6FC4", 5, 46, 200, -8, [
        "M0 42 C 1 26, 3 12, 6 0", "M2 30 C -6 26, -10 19, -11 12", "M4 17 C 12 13, 16 6, 16 -1"]);

      // 奶油色不規則圓：172×166，border-radius 44% 56% 62% 38% / 46% 54% 46% 54%
      const bw = 172, bh = 166, bx = (256 - bw) / 2, by = (256 - bh) / 2;
      const tl = [0.44 * bw, 0.46 * bh], tr = [0.56 * bw, 0.54 * bh], br = [0.62 * bw, 0.46 * bh], bl = [0.38 * bw, 0.54 * bh];
      g.fillStyle = "#FFFCEA"; g.beginPath();
      g.ellipse(bx + bw - tr[0], by + tr[1], tr[0], tr[1], 0, -Math.PI / 2, 0);
      g.ellipse(bx + bw - br[0], by + bh - br[1], br[0], br[1], 0, 0, Math.PI / 2);
      g.ellipse(bx + bl[0], by + bh - bl[1], bl[0], bl[1], 0, Math.PI / 2, Math.PI);
      g.ellipse(bx + tl[0], by + tl[1], tl[0], tl[1], 0, Math.PI, Math.PI * 1.5);
      g.fill();

      // 彥：Huninn 96px，同色 4px 描邊加粗；以字的實際外框置中，對齊設計稿位置（中心 y ≈ 126.5）
      g.font = '96px "Huninn"'; g.textAlign = "center"; g.textBaseline = "alphabetic";
      const m = g.measureText("彥");
      const baseline = 126.5 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
      g.strokeStyle = g.fillStyle = "#2A2A6B"; g.lineWidth = 4; g.lineJoin = "round";
      g.strokeText("彥", 128, baseline); g.fillText("彥", 128, baseline);
      return cv.toDataURL("image/png").split(",")[1];
    }

    // 最後一行要是一般的值：iPhone 的 WebView 不接受 Promise 當回傳值，會直接報錯
    0;`, true);
  if (!res || res.error) return res ? res.error : "WebView 沒有回應";
  if (!fm.fileExists(glyphDir)) fm.createDirectory(glyphDir, true);
  fm.write(logoPath, Data.fromBase64String(res.logo));
  for (const key in res.images) fm.write(fm.joinPath(glyphDir, key + ".png"), Data.fromBase64String(res.images[key]));
  fm.writeString(metaPath, JSON.stringify({ version: GLYPH_VERSION, specs: GLYPH_SPECS, widths: res.widths }));
  return null;
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
    let err;
    try { err = await buildGlyphs(); } catch (e) { err = String(e); }
    meta = ok();
    if (!meta) {
      const alert = new Alert();
      alert.title = "字型下載失敗";
      alert.message = `先用系統字型顯示。確認網路後再執行一次。\n\n原因：${err}`;
      alert.addAction("好");
      await alert.present();
    }
  }
  if (!meta) return null;
  const images = {};
  for (const key in meta.widths) images[key] = Image.fromFile(fm.joinPath(glyphDir, key + ".png"));
  return { widths: meta.widths, images, logo: Image.fromFile(logoPath) };
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
    const cx = align === "left" ? x + width / 2 : align === "right" ? x - width / 2 : x;
    return text(s, cx, cy, size, hex, w >= 900 ? heavy : bold, "center", width + 20);
  }
  const k = size / 100;
  let pen = align === "left" ? x : align === "right" ? x - width : x - width / 2;
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

// ---- 標題列：左邊「彥」圖示，右邊年月
// 圖示沒存好時，先畫簡化版（黃底 + 奶油色圓 + 彥）
function drawLogo(x, y, s) {
  if (glyphs) return ctx.drawImageInRect(glyphs.logo, new Rect(x, y, s, s));
  roundRect("#FFD429", 1, x, y, s, s, s * 0.22);
  ellipse("#FFFCEA", 1, x + s * 0.16, y + s * 0.18, s * 0.68, s * 0.65);
  text("彥", x + s / 2, y + s / 2, s * 0.4, "#2A2A6B", heavy, "center", s);
}

const logoS = 40, headY = cardY + pad + logoS / 2;
drawLogo(inX, headY - logoS / 2, logoS);

// 右上角：年.月，例如 2026.09
str(`${year}.${String(month + 1).padStart(2, "0")}`, inX + inW, headY, 24, C.primary, 900, "right");

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
