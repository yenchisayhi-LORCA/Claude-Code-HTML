// 月曆小工具・大圓臉版（Scriptable 大尺寸）— 底圖取自照片排版「大圓臉」樣板，字型 Zen Maru Gothic
// 可在 App 內設定壽星：當月壽星的照片放在最下面（左下或右下），生日那天的日期旁有氣球或拉炮
// 也可設定旅程：年月左邊顯示「9.21～23 花蓮」，旅程日期加粉藍色帶，出發日旁放交通工具
const C = {
  bg: "#FFFBEF", text: "#2B3159", muted: "#8A93B5",
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
// Google Fonts 載入字型、把會用到的字依顏色畫成小圖存起來，「彥」圖示和底圖也一起畫好
// 存起來；小工具之後直接讀這些圖。還沒存好時改用系統圓體、簡化版圖示和簡化版底圖。
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
const glyphDir = fm.joinPath(fm.documentsDirectory(), "calendar-widget-bigface");
const BG_VERSION = 6; // 底圖或小圖示改過就加 1，讓已存的圖重畫
const metaPath = fm.joinPath(glyphDir, "meta.json");
const logoPath = fm.joinPath(glyphDir, "logo.png");
const bgPath = fm.joinPath(glyphDir, "bg.png");
const leafPath = fm.joinPath(glyphDir, "leaf.png");
// 小圖示：前 3 個是生日用（依壽星順序輪流），後 3 個是旅程的交通工具
const ICON_NAMES = ["balloon-red", "popper", "balloon-blue", "plane", "train", "car"];
const TRANSPORT = { plane: "飛機", train: "火車", car: "汽車" };

// 交通工具圖示（在 WebView 的 canvas 裡畫，g 已縮放成 1×1 的方格）
const TRANSPORT_JS = `
  function drawTransport(g, kind) {
    if (kind === "plane") {
      g.save(); g.translate(0.5, 0.52); g.rotate(-0.35);
      g.fillStyle = "#FFC93C"; g.beginPath(); g.moveTo(-0.05, -0.02); g.lineTo(-0.2, -0.36); g.lineTo(-0.06, -0.36); g.lineTo(0.14, -0.02); g.fill();
      g.fillStyle = "#5AA9E6"; g.beginPath(); g.roundRect(-0.44, -0.13, 0.86, 0.26, 0.13); g.fill();
      g.beginPath(); g.moveTo(-0.44, -0.1); g.lineTo(-0.47, -0.34); g.lineTo(-0.3, -0.1); g.fill();
      g.fillStyle = "#E8574B"; g.beginPath(); g.moveTo(-0.45, -0.12); g.lineTo(-0.47, -0.34); g.lineTo(-0.36, -0.12); g.fill();
      g.fillStyle = "#FFFFFF"; for (const x of [-0.2, -0.07, 0.06]) { g.beginPath(); g.arc(x, -0.02, 0.035, 0, 7); g.fill(); }
      g.fillStyle = "#FFC93C"; g.beginPath(); g.moveTo(-0.02, 0.06); g.lineTo(-0.14, 0.34); g.lineTo(-0.01, 0.34); g.lineTo(0.13, 0.06); g.fill();
      g.fillStyle = "#2B3159"; g.beginPath(); g.arc(0.3, -0.02, 0.025, 0, 7); g.fill();
      g.fillStyle = "rgba(240, 88, 138, 0.55)"; g.beginPath(); g.ellipse(0.33, 0.05, 0.04, 0.025, 0, 0, 7); g.fill();
      g.restore();
    } else if (kind === "train") {
      g.fillStyle = "#8A93B5"; g.fillRect(0.3, 0.86, 0.08, 0.1); g.fillRect(0.62, 0.86, 0.08, 0.1);
      g.fillStyle = "#E8574B"; g.beginPath(); g.roundRect(0.16, 0.12, 0.68, 0.76, 0.2); g.fill();
      g.fillStyle = "#BFE3F5"; g.beginPath(); g.roundRect(0.25, 0.22, 0.5, 0.3, 0.1); g.fill();
      g.fillStyle = "#FFFBEF"; g.fillRect(0.16, 0.58, 0.68, 0.06);
      g.fillStyle = "#FFC93C"; for (const x of [0.3, 0.7]) { g.beginPath(); g.arc(x, 0.75, 0.06, 0, 7); g.fill(); }
      g.fillStyle = "#2B3159"; for (const x of [0.41, 0.59]) { g.beginPath(); g.arc(x, 0.36, 0.03, 0, 7); g.fill(); }
      g.strokeStyle = "#2B3159"; g.lineWidth = 0.03; g.lineCap = "round"; g.beginPath(); g.arc(0.5, 0.4, 0.05, 0.3, Math.PI - 0.3); g.stroke();
      g.fillStyle = "#5AA9E6"; g.beginPath(); g.roundRect(0.42, 0.04, 0.16, 0.1, 0.04); g.fill();
    } else {
      g.fillStyle = "#FFC93C"; g.beginPath(); g.roundRect(0.06, 0.46, 0.88, 0.3, 0.12); g.fill();
      g.beginPath(); g.roundRect(0.22, 0.24, 0.52, 0.34, 0.16); g.fill();
      g.fillStyle = "#BFE3F5"; g.beginPath(); g.roundRect(0.28, 0.3, 0.18, 0.18, 0.05); g.fill(); g.beginPath(); g.roundRect(0.5, 0.3, 0.18, 0.18, 0.05); g.fill();
      g.fillStyle = "#2B3159"; for (const x of [0.28, 0.72]) { g.beginPath(); g.arc(x, 0.78, 0.12, 0, 7); g.fill(); }
      g.fillStyle = "#D9D9E3"; for (const x of [0.28, 0.72]) { g.beginPath(); g.arc(x, 0.78, 0.05, 0, 7); g.fill(); }
      g.fillStyle = "#E8574B"; g.beginPath(); g.ellipse(0.92, 0.56, 0.03, 0.05, 0, 0, 7); g.fill();
      g.fillStyle = "#2B3159"; g.beginPath(); g.arc(0.83, 0.52, 0.025, 0, 7); g.fill();
      g.fillStyle = "rgba(240, 88, 138, 0.55)"; g.beginPath(); g.ellipse(0.85, 0.6, 0.035, 0.02, 0, 0, 7); g.fill();
    }
  }
  function transportPNG(kind) {
    const cv = document.createElement("canvas"), g = cv.getContext("2d");
    cv.width = cv.height = 96;
    g.scale(96, 96);
    drawTransport(g, kind);
    return cv.toDataURL("image/png").split(",")[1];
  }
`;
const iconPath = name => fm.joinPath(glyphDir, name + ".png");

// 照片排版工具的內建樣板（1200×1802）：t9「大圓臉」當底圖
const TEMPLATE_BASES = [
  "https://raw.githubusercontent.com/yenchisayhi-LORCA/Claude-Code-HTML/main/photo-print-layout/builtin-templates/",
  "https://yenchisayhi-lorca.github.io/Claude-Code-HTML/photo-print-layout/builtin-templates/",
];
async function fetchTemplate(file) {
  for (const base of TEMPLATE_BASES) {
    const url = base + file;
    try {
      const req = new Request(url);
      const data = await req.load();
      if (req.response.statusCode === 200) return data.toBase64String();
    } catch (e) {}
  }
  throw new Error(`下載不到樣板圖 ${file}`);
}

const [W, H] = widgetSize();
// 裝飾縮放比例（樣板像素 → 小工具的點）
const SC = W / 1540;

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
  const template = await fetchTemplate("t9.png");
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
        const [bg, leaf] = await drawBackground(${W}, ${H}, ${SC});
        const icons = [drawBalloon("#E8574B"), drawPopper(), drawBalloon("#5AA9E6"), transportPNG("plane"), transportPNG("train"), transportPNG("car")];
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
        completion({ widths, images, logo, bg, leaf, icons });
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

    ${TRANSPORT_JS}

    // 生日小圖示（96×96）：氣球
    function drawBalloon(color) {
      const cv = document.createElement("canvas"), g = cv.getContext("2d");
      cv.width = cv.height = 96;
      g.scale(96, 96);
      g.strokeStyle = "#8A93B5"; g.lineWidth = 0.035;
      g.beginPath(); g.moveTo(0.5, 0.7); g.bezierCurveTo(0.4, 0.8, 0.6, 0.88, 0.48, 0.98); g.stroke();
      g.fillStyle = color;
      g.beginPath(); g.ellipse(0.5, 0.38, 0.28, 0.33, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(0.44, 0.74); g.lineTo(0.56, 0.74); g.lineTo(0.5, 0.68); g.fill();
      g.fillStyle = "rgba(255, 255, 255, 0.7)";
      g.beginPath(); g.ellipse(0.4, 0.26, 0.06, 0.1, 0.5, 0, Math.PI * 2); g.fill();
      return cv.toDataURL("image/png").split(",")[1];
    }

    // 生日小圖示（96×96）：拉炮（黃紅條紋圓錐 + 紙屑 + 彩帶）
    function drawPopper() {
      const cv = document.createElement("canvas"), g = cv.getContext("2d");
      cv.width = cv.height = 96;
      g.scale(96, 96);
      g.save();
      g.beginPath(); g.moveTo(0.1, 0.92); g.lineTo(0.3, 0.4); g.lineTo(0.62, 0.72); g.closePath(); g.clip();
      g.fillStyle = "#FFC93C"; g.fillRect(0, 0, 1, 1);
      g.strokeStyle = "#E8574B"; g.lineWidth = 0.08;
      for (const t of [0.25, 0.45, 0.65]) { g.beginPath(); g.moveTo(t - 0.3, t + 0.3); g.lineTo(t + 0.3, t + 0.32); g.stroke(); }
      g.restore();
      const confetti = [["#E8574B", 0.62, 0.18, 1], ["#4FC4A8", 0.84, 0.34, 0], ["#5AA9E6", 0.5, 0.1, 0], ["#F0588A", 0.9, 0.58, 1], ["#3B4CB8", 0.74, 0.06, 1]];
      for (const [c, x, y, round] of confetti) {
        g.fillStyle = c; g.beginPath();
        if (round) g.arc(x, y, 0.06, 0, Math.PI * 2); else g.roundRect(x - 0.05, y - 0.03, 0.1, 0.06, 0.02);
        g.fill();
      }
      g.strokeStyle = "#F0588A"; g.lineWidth = 0.055; g.lineCap = "round";
      g.beginPath(); g.moveTo(0.48, 0.44); g.bezierCurveTo(0.56, 0.3, 0.66, 0.42, 0.72, 0.28); g.stroke();
      return cv.toDataURL("image/png").split(",")[1];
    }

    // 小工具底圖：把「大圓臉」樣板四個角的裝飾搬到小工具四角，並拿掉中間兩個照片圓；
    // 葉子另外存成一張圖，小工具再依壽星照片的位置決定放哪
    async function loadImg(b64) {
      const img = document.createElement("img");
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      return img;
    }
    async function drawBackground(W, H, sc) {
      const img = await loadImg("${template}");

      // 1. 清掉照片圓（灰色 #EFEFE2）：依位置換回底下原本的顏色（藍圓、黃圓或米白底），
      //    連同反鋸齒邊緣一起處理
      const src = document.createElement("canvas"), s = src.getContext("2d");
      src.width = img.width; src.height = img.height;
      s.drawImage(img, 0, 0);
      const d = s.getImageData(0, 0, src.width, src.height), p = d.data;
      const G = [239, 239, 226], CREAM = [255, 251, 239];
      const under = (x, y) =>
        Math.hypot(x - 104.6, y - 104) < 255 ? [59, 76, 184] :
        Math.hypot(x - 1094.5, y - 1724.1) < 195 ? [255, 201, 60] : CREAM;
      for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
        const i = (y * src.width + x) * 4, U = under(x, y);
        const v = [U[0] - G[0], U[1] - G[1], U[2] - G[2]], q = [p[i] - G[0], p[i + 1] - G[1], p[i + 2] - G[2]];
        const t = (q[0] * v[0] + q[1] * v[1] + q[2] * v[2]) / (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        if (t < -0.05 || t > 1.05) continue;
        const r = Math.hypot(q[0] - t * v[0], q[1] - t * v[1], q[2] - t * v[2]);
        if (r < 8) { p[i] = U[0]; p[i + 1] = U[1]; p[i + 2] = U[2]; }
      }
      s.putImageData(d, 0, 0);

      // 2. 米白底 + 四角裝飾 + 葉子（[來源 x, y, 寬, 高], 放置位置）
      const S = 3, cv = document.createElement("canvas"), g = cv.getContext("2d");
      cv.width = W * S; cv.height = H * S;
      g.scale(S, S);
      g.fillStyle = "rgb(255, 251, 239)"; g.fillRect(0, 0, W, H);
      const put = ([sx, sy, sw, sh], x, y) => g.drawImage(src, sx, sy, sw, sh, x, y, sw * sc, sh * sc);
      put([0, 0, 362, 362], -14, -14);                               // 左上：藍圓（往外推，避開星期列）
      put([955, 0, 245, 245], W - 245 * sc, 0);                      // 右上：綠圓 + 黃花
      g.fillStyle = "rgb(255, 122, 92)";                              // 左下：紅圓
      g.beginPath(); g.arc(89.6 * sc, H - (1800 - 1738.9) * sc, 209 * sc, 0, Math.PI * 2); g.fill();
      put([890, 1515, 310, 285], W - 310 * sc, H - 285 * sc);        // 右下：黃圓

      // 3. 葉子（130×145，3 倍解析度）
      const lf = document.createElement("canvas"), lg = lf.getContext("2d");
      lf.width = Math.round(130 * sc * S); lf.height = Math.round(145 * sc * S);
      lg.drawImage(src, 40, 645, 130, 145, 0, 0, lf.width, lf.height);
      return [cv.toDataURL("image/png").split(",")[1], lf.toDataURL("image/png").split(",")[1]];
    }

    // 最後一行要是一般的值：iPhone 的 WebView 不接受 Promise 當回傳值，會直接報錯
    0;`, true);
  if (!res || res.error) return res ? res.error : "WebView 沒有回應";
  if (!fm.fileExists(glyphDir)) fm.createDirectory(glyphDir, true);
  fm.write(logoPath, Data.fromBase64String(res.logo));
  fm.write(bgPath, Data.fromBase64String(res.bg));
  fm.write(leafPath, Data.fromBase64String(res.leaf));
  res.icons.forEach((b64, i) => fm.write(iconPath(ICON_NAMES[i]), Data.fromBase64String(b64)));
  for (const key in res.images) fm.write(fm.joinPath(glyphDir, key + ".png"), Data.fromBase64String(res.images[key]));
  fm.writeString(metaPath, JSON.stringify({ version: GLYPH_VERSION, bgVersion: BG_VERSION, specs: GLYPH_SPECS, size: [W, H], widths: res.widths }));
  return null;
}

// 讀取字型小圖；沒有的話（且不是在小工具裡）先建一次。失敗就回傳 null，改用系統字型
async function loadGlyphs() {
  const ok = () => {
    if (!fm.fileExists(metaPath)) return null;
    const meta = JSON.parse(fm.readString(metaPath));
    if (meta.version !== GLYPH_VERSION || JSON.stringify(meta.specs) !== JSON.stringify(GLYPH_SPECS)) return null;
    if (meta.bgVersion !== BG_VERSION || JSON.stringify(meta.size) !== JSON.stringify([W, H])) return null;
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
  return {
    widths: meta.widths, images,
    logo: Image.fromFile(logoPath), bg: Image.fromFile(bgPath), leaf: Image.fromFile(leafPath), icons: ICON_NAMES.map(n => Image.fromFile(iconPath(n))),
  };
}
const glyphs = await loadGlyphs();

// ---- 壽星資料：名字、生日、圓形大頭照，存在 iCloud Drive 的 Scriptable 資料夾（沒開 iCloud 就存本機）
const store = (() => {
  try { const f = FileManager.iCloud(); f.documentsDirectory(); return f; } catch (e) { return FileManager.local(); }
})();
const bdayDir = store.joinPath(store.documentsDirectory(), "calendar-widget-birthdays");
const bdayPath = store.joinPath(bdayDir, "birthdays.json");
const avatarPath = id => store.joinPath(bdayDir, id + ".png");
const settingsPath = store.joinPath(bdayDir, "settings.json");

// 壽星照片位置：都在最下面一排
const PHOTO_POS = {
  bottomLeft: "左下（從左邊往右排）",
  bottomRight: "右下（從右邊往左排）",
};
async function loadSettings() {
  const def = { photoPos: "bottomLeft" };
  if (!store.fileExists(settingsPath)) return def;
  await ensureLocal(settingsPath);
  try {
    const st = { ...def, ...JSON.parse(store.readString(settingsPath)) };
    if (!(st.photoPos in PHOTO_POS)) st.photoPos = def.photoPos; // 舊版的「上方」等設定改用左下
    return st;
  } catch (e) { return def; }
}
function saveSettings(st) {
  if (!store.fileExists(bdayDir)) store.createDirectory(bdayDir, true);
  store.writeString(settingsPath, JSON.stringify(st));
}
async function choosePhotoPos() {
  const st = await loadSettings(), keys = Object.keys(PHOTO_POS);
  const a = new Alert();
  a.title = "壽星照片位置";
  a.message = `目前：${PHOTO_POS[st.photoPos]}`;
  keys.forEach(k => a.addAction(PHOTO_POS[k]));
  a.addCancelAction("返回");
  const i = await a.presentSheet();
  if (i >= 0) { st.photoPos = keys[i]; saveSettings(st); }
}

async function ensureLocal(path) {
  if (store.isFileStoredIniCloud(path) && !store.isFileDownloaded(path)) await store.downloadFileFromiCloud(path);
}
async function loadBirthdays() {
  if (!store.fileExists(bdayPath)) return [];
  await ensureLocal(bdayPath);
  try { return JSON.parse(store.readString(bdayPath)); } catch (e) { return []; }
}
function saveBirthdays(list) {
  if (!store.fileExists(bdayDir)) store.createDirectory(bdayDir, true);
  list.sort((a, b) => a.month - b.month || a.day - b.day);
  store.writeString(bdayPath, JSON.stringify(list));
}

async function notice(title, message) {
  const a = new Alert();
  a.title = title; a.message = message;
  a.addAction("好");
  await a.present();
}

// 輸入名字和生日；取消回傳 null
async function askInfo(p = {}) {
  const a = new Alert();
  a.title = p.id ? "修改壽星" : "新增壽星";
  a.message = "輸入名字和生日（月、日）";
  a.addTextField("名字", p.name || "");
  a.addTextField("月（1–12）", p.month ? String(p.month) : "").setNumberPadKeyboard();
  a.addTextField("日（1–31）", p.day ? String(p.day) : "").setNumberPadKeyboard();
  a.addAction(p.id ? "儲存" : "下一步：選照片");
  a.addCancelAction("取消");
  if (await a.present() === -1) return null;
  const name = a.textFieldValue(0).trim();
  const month = parseInt(a.textFieldValue(1), 10), day = parseInt(a.textFieldValue(2), 10);
  // 用閏年（2024）檢查日期，2/29 也可以輸入
  if (!name || !(month >= 1 && month <= 12) || !(day >= 1 && day <= new Date(2024, month, 0).getDate())) {
    await notice("資料不正確", "請輸入名字，以及正確的月和日。");
    return askInfo({ ...p, name, month, day });
  }
  return { name, month, day };
}

// 從相簿選照片，裁成圓形存起來；成功回傳 true
async function pickPhoto(id) {
  let img;
  try { img = await Photos.fromLibrary(); } catch (e) { return false; }
  // 先縮小到最長邊 600 像素，再交給 WebView 裁成 240×240 的圓形 PNG（四角透明）
  const k = Math.min(1, 600 / Math.max(img.size.width, img.size.height));
  const dc = new DrawContext();
  dc.size = new Size(Math.round(img.size.width * k), Math.round(img.size.height * k));
  dc.respectScreenScale = false;
  dc.drawImageInRect(img, new Rect(0, 0, dc.size.width, dc.size.height));
  const jpeg = Data.fromJPEG(dc.getImage()).toBase64String();
  const wv = new WebView();
  await wv.loadHTML("<html><body></body></html>");
  const png = await wv.evaluateJavaScript(`
    (async () => {
      try {
        const im = document.createElement("img");
        im.src = "data:image/jpeg;base64,${jpeg}";
        await im.decode();
        const N = 240, s = Math.min(im.width, im.height), cv = document.createElement("canvas"), g = cv.getContext("2d");
        cv.width = cv.height = N;
        g.beginPath(); g.arc(N / 2, N / 2, N / 2, 0, Math.PI * 2); g.clip();
        g.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, N, N);
        completion(cv.toDataURL("image/png").split(",")[1]);
      } catch (e) { completion(null); }
    })();
    0;`, true);
  if (!png) { await notice("照片處理失敗", "請換一張照片再試一次。"); return false; }
  if (!store.fileExists(bdayDir)) store.createDirectory(bdayDir, true);
  store.write(avatarPath(id), Data.fromBase64String(png));
  return true;
}

async function addBirthday() {
  const info = await askInfo();
  if (!info) return;
  const id = Date.now().toString(36);
  if (!await pickPhoto(id)) return;
  const list = await loadBirthdays();
  list.push({ id, ...info });
  saveBirthdays(list);
  await notice("已新增", `${info.name}（${info.month}/${info.day}）`);
}

async function manageBirthdays() {
  const list = await loadBirthdays();
  const a = new Alert();
  a.title = "管理壽星";
  list.forEach(p => a.addAction(`${p.name}（${p.month}/${p.day}）`));
  a.addCancelAction("返回");
  const i = await a.presentSheet();
  if (i < 0) return;
  const p = list[i];
  const b = new Alert();
  b.title = `${p.name}（${p.month}/${p.day}）`;
  b.addAction("修改名字或生日");
  b.addAction("換照片");
  b.addDestructiveAction("刪除");
  b.addCancelAction("返回");
  const j = await b.presentSheet();
  if (j === 0) {
    const info = await askInfo(p);
    if (info) { Object.assign(p, info); saveBirthdays(list); }
  } else if (j === 1) {
    await pickPhoto(p.id);
  } else if (j === 2) {
    const c = new Alert();
    c.title = `確定刪除「${p.name}」？`;
    c.addDestructiveAction("刪除");
    c.addCancelAction("取消");
    if (await c.present() === 0) {
      list.splice(i, 1);
      saveBirthdays(list);
      if (store.fileExists(avatarPath(p.id))) store.remove(avatarPath(p.id));
    }
  }
}

// ---- 旅程：地點、出發日、回程日、交通工具；年月左邊的膠囊標籤會先畫成圖存起來
const tripsPath = store.joinPath(bdayDir, "trips.json");
const tripLabelPath = id => store.joinPath(bdayDir, "trip-" + id + ".png");
const TRIP_BG = "#E2F3FA", TRIP_FG = "#3B8DB5", TRIP_BAND = ["#82C8E8", 0.28]; // 粉藍
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const toDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

async function loadTrips() {
  if (!store.fileExists(tripsPath)) return [];
  await ensureLocal(tripsPath);
  try { return JSON.parse(store.readString(tripsPath)); } catch (e) { return []; }
}
function saveTrips(list) {
  if (!store.fileExists(bdayDir)) store.createDirectory(bdayDir, true);
  list.sort((a, b) => a.start.localeCompare(b.start));
  store.writeString(tripsPath, JSON.stringify(list));
}
// 膠囊上的文字：同月「9.21～23 花蓮」、跨月「9.30～10.2 花蓮」、當天來回「9.21 花蓮」
function tripText(t) {
  const a = toDate(t.start), b = toDate(t.end);
  const from = `${a.getMonth() + 1}.${a.getDate()}`;
  const to = ymd(a) === ymd(b) ? "" : a.getMonth() === b.getMonth() ? `～${b.getDate()}` : `～${b.getMonth() + 1}.${b.getDate()}`;
  return `${from}${to} ${t.place}`;
}
// 管理清單用的名稱；不是今年的旅程會加上年份，例如「阿里山（2027 10.1～3，火車）」
const tripName = t => {
  const y = toDate(t.start).getFullYear(), yy = y === new Date().getFullYear() ? "" : `${y} `;
  return `${t.place}（${yy}${tripText(t).split(" ")[0]}，${TRANSPORT[t.mode]}）`;
};

// 解析「9/21」（用 year 當年份），也接受「2027/9/21」直接寫年份。
// 有 after（出發日）時，日期早於出發日就算成隔年（例如 12/30～1/2 跨年）
function parseDay(str, year, after) {
  const m = (str || "").trim().match(/^(?:(\d{4})[\/.\-])?(\d{1,2})[\/.\-](\d{1,2})$/);
  if (!m) return null;
  const mo = +m[2], d = +m[3], y = m[1] ? +m[1] : year;
  let dt = new Date(y, mo - 1, d);
  if (dt.getMonth() !== mo - 1) return null;
  if (!m[1] && after && dt < after) dt = new Date(y + 1, mo - 1, d);
  return dt;
}

async function askTrip(t = {}) {
  const a = new Alert();
  a.title = t.id ? "修改旅程" : "新增旅程";
  a.message = "年份預設今年，可以改成明年以後；日期請輸入「月/日」，例如 9/21";
  const md = s => { if (!s) return ""; const d = toDate(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
  const y0 = t.year || (t.start ? toDate(t.start).getFullYear() : new Date().getFullYear());
  a.addTextField("地點（例如 花蓮）", t.place || "");
  a.addTextField("年份（例如 2027）", String(y0)).setNumberPadKeyboard();
  a.addTextField("出發日（例如 9/21）", t.startText ?? md(t.start));
  a.addTextField("回程日（例如 9/23）", t.endText ?? md(t.end));
  a.addAction("下一步：選交通工具");
  a.addCancelAction("取消");
  if (await a.present() === -1) return null;
  const place = a.textFieldValue(0).trim(), year = parseInt(a.textFieldValue(1), 10);
  const startText = a.textFieldValue(2), endText = a.textFieldValue(3);
  const okYear = year >= 2000 && year <= 2100;
  const start = okYear && parseDay(startText, year);
  const end = start && parseDay(endText, year, start);
  if (!place || !start || !end || end - start > 60 * 86400000) {
    await notice("資料不正確", "請輸入地點、年份（例如 2027），以及正確的出發日和回程日（例如 9/21、9/23）。");
    return askTrip({ ...t, place, year: okYear ? year : undefined, startText, endText });
  }
  const b = new Alert();
  b.title = "交通工具";
  const kinds = Object.keys(TRANSPORT);
  kinds.forEach(k => b.addAction(TRANSPORT[k]));
  b.addCancelAction("取消");
  const k = await b.presentSheet();
  if (k < 0) return null;
  return { place, start: ymd(start), end: ymd(end), mode: kinds[k] };
}

// 用 Zen Maru Gothic 把膠囊標籤畫成圖（高 26pt、3 倍解析度）；成功回傳寬度（pt），失敗回傳 0
async function renderTripLabel(t) {
  try {
    const text = tripText(t);
    const faces = await fetchFont(FONT, [700], text);
    const wv = new WebView();
    await wv.loadHTML("<html><body></body></html>");
    const res = await wv.evaluateJavaScript(`
      (async () => {
        try {
          for (const f of ${JSON.stringify(faces)}) {
            const face = new FontFace(f.family, Uint8Array.from(atob(f.b64), c => c.charCodeAt(0)), { weight: f.weight });
            await face.load(); document.fonts.add(face);
          }
          const text = ${JSON.stringify(text)}, S = 3, H = 26, F = '700 13px "${FONT}"';
          const m = document.createElement("canvas").getContext("2d"); m.font = F;
          const W = Math.ceil(m.measureText(text).width) + 36;
          const cv = document.createElement("canvas"), g = cv.getContext("2d");
          cv.width = W * S; cv.height = H * S; g.scale(S, S);
          g.fillStyle = "${TRIP_BG}"; g.beginPath(); g.roundRect(0, 0, W, H, H / 2); g.fill();
          g.fillStyle = "#FFFFFF"; g.beginPath(); g.arc(15, H / 2, 10, 0, Math.PI * 2); g.fill();
          g.save(); g.translate(6, H / 2 - 9); g.scale(18, 18); drawTransport(g, ${JSON.stringify(t.mode)}); g.restore();
          g.font = F; g.fillStyle = "${TRIP_FG}"; g.textAlign = "left"; g.textBaseline = "middle";
          g.fillText(text, 29, H / 2 + 1);
          completion({ w: W, png: cv.toDataURL("image/png").split(",")[1] });
        } catch (e) { completion(null); }
      })();
      ${TRANSPORT_JS}
      0;`, true);
    if (!res) return 0;
    if (!store.fileExists(bdayDir)) store.createDirectory(bdayDir, true);
    store.write(tripLabelPath(t.id), Data.fromBase64String(res.png));
    return res.w;
  } catch (e) { return 0; }
}

async function addTrip(old) {
  const info = await askTrip(old);
  if (!info) return;
  const list = await loadTrips();
  const t = old ? Object.assign(list.find(x => x.id === old.id), info) : { id: Date.now().toString(36), ...info };
  t.labelW = await renderTripLabel(t);
  if (!old) list.push(t);
  saveTrips(list);
  if (!t.labelW) await notice("已儲存", "標籤字型下載失敗，先用系統字型顯示；網路正常時再到「管理旅程」修改一次即可。");
  else await notice(old ? "已更新" : "已新增", tripName(t));
}

async function manageTrips() {
  const list = await loadTrips();
  const a = new Alert();
  a.title = "管理旅程";
  list.forEach(t => a.addAction(tripName(t)));
  a.addCancelAction("返回");
  const i = await a.presentSheet();
  if (i < 0) return;
  const t = list[i];
  const b = new Alert();
  b.title = tripName(t);
  b.addAction("修改");
  b.addDestructiveAction("刪除");
  b.addCancelAction("返回");
  const j = await b.presentSheet();
  if (j === 0) await addTrip(t);
  else if (j === 1) {
    list.splice(i, 1);
    saveTrips(list);
    if (store.fileExists(tripLabelPath(t.id))) store.remove(tripLabelPath(t.id));
  }
}

// 在 App 內執行時的選單；選「預覽小工具」回傳 true
async function mainMenu() {
  while (true) {
    const list = await loadBirthdays(), trips = await loadTrips();
    const a = new Alert();
    a.title = "月曆小工具";
    a.message = `壽星 ${list.length} 位・旅程 ${trips.length} 趟`;
    const acts = [["預覽小工具", null], ["新增壽星", addBirthday]];
    if (list.length) acts.push(["管理壽星", manageBirthdays]);
    acts.push(["照片位置", choosePhotoPos], ["新增旅程", () => addTrip()]);
    if (trips.length) acts.push(["管理旅程", manageTrips]);
    acts.forEach(([t]) => a.addAction(t));
    a.addCancelAction("結束");
    const i = await a.presentSheet();
    if (i < 0) return false;
    if (i === 0) return true;
    await acts[i][1]();
  }
}
const showPreview = config.runsInWidget ? false : await mainMenu();

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

// ---- 背景：「大圓臉」底圖；還沒存好時畫簡化版（只有四角色塊）
if (glyphs) {
  ctx.drawImageInRect(glyphs.bg, new Rect(0, 0, W, H));
} else {
  ctx.setFillColor(col(C.bg));
  ctx.fillRect(new Rect(0, 0, W, H));
  const circle = (hex, cx, cy, r) => ellipse(hex, 1, cx - r, cy - r, r * 2, r * 2);
  circle("#3B4CB8", 104.6 * SC - 14, 104 * SC - 14, 254 * SC);
  circle("#4FC4A8", W - (1200 - 1154.8) * SC, 73.7 * SC, 165 * SC);
  circle("#FF7A5C", 89.6 * SC, H - (1800 - 1738.9) * SC, 209 * SC);
  circle("#FFC93C", W - (1200 - 1094.5) * SC, H - (1800 - 1724.1) * SC, 194.5 * SC);
}

const now = new Date();
const year = now.getFullYear(), month = now.getMonth(), today = now.getDate();
// 內容直接放在米白底上：上方避開右上角裝飾，下方留給左下、右下的色塊和壽星照片
const pad = 16, inX = pad, inW = W - pad * 2;
const footerH = 305 * SC;

// ---- 標題列：左邊「彥」圖示，右邊年月
// 圖示沒存好時，先畫簡化版（黃底 + 奶油色圓 + 彥）
function drawLogo(x, y, s) {
  if (glyphs) return ctx.drawImageInRect(glyphs.logo, new Rect(x, y, s, s));
  roundRect("#FFD429", 1, x, y, s, s, s * 0.22);
  ellipse("#FFFCEA", 1, x + s * 0.16, y + s * 0.18, s * 0.68, s * 0.65);
  text("彥", x + s / 2, y + s / 2, s * 0.4, "#2A2A6B", heavy, "center", s);
}

const logoS = 40, headY = 14 + logoS / 2;
drawLogo(inX, headY - logoS / 2, logoS);

// 右上角：年.月，例如 2026.09
const title = `${year}.${String(month + 1).padStart(2, "0")}`, titleRight = W - 245 * SC - 6;
str(title, titleRight, headY, 24, C.primary, 900, "right");

// ---- 本月壽星：照片放在最下面（左下或右下），依生日先後用紫、綠、橘外框（第 4 位起重複）
const days = new Date(year, month + 1, 0).getDate();
const birthdays = (await loadBirthdays())
  .filter(p => p.month === month + 1)
  .map(p => ({ ...p, day: Math.min(p.day, days) })) // 2/29 在平年顯示在 2/28
  .sort((a, b) => a.day - b.day);
const RINGS = [["#9A8ADA", "#7564BC"], ["#98CF40", "#72A52A"], ["#EF8E34", "#C96F1E"]];
const PHOTO = 53, GAP = 7;

// 算出每張照片的位置：排在最下面一排，靠左或靠右；太多張就縮小（不會擋到日期）
function layoutPhotos(n, pos) {
  const left = 12, right = W - 12, cy = H - 12 - PHOTO / 2;
  const D = Math.min(PHOTO, (right - left - GAP * (n - 1)) / n), out = [];
  for (let i = 0; i < n; i++) {
    const cx = pos === "bottomRight" ? right - D / 2 - (n - 1 - i) * (D + GAP) : left + D / 2 + i * (D + GAP);
    out.push({ cx, cy, D });
  }
  return out;
}
const st = await loadSettings();
const spots = layoutPhotos(birthdays.length, st.photoPos);
spots.forEach(({ cx, cy, D }, i) => {
  const [ring, dark] = RINGS[i % RINGS.length], r = D / 2 - 3;
  ellipse(dark, 1, cx - D / 2, cy - D / 2 + 2, D, D);
  ellipse(ring, 1, cx - D / 2, cy - D / 2, D, D);
  spots[i].r = r;
});
for (let i = 0; i < spots.length; i++) {
  const path = avatarPath(birthdays[i].id), { cx, cy, r } = spots[i];
  if (store.fileExists(path)) {
    await ensureLocal(path);
    ctx.drawImageInRect(Image.fromFile(path), new Rect(cx - r, cy - r, r * 2, r * 2));
  }
}

// 葉子：放在下方沒有照片的地方；放不下就不放
if (glyphs) {
  const lw = 130 * SC, lh = 145 * SC, ly = H - lh - 4;
  const bottom = spots;
  const minX = bottom.length ? Math.min(...bottom.map(p => p.cx - p.D / 2)) : W;
  const maxX = bottom.length ? Math.max(...bottom.map(p => p.cx + p.D / 2)) : 0;
  const yellowLeft = W - 310 * SC, coralRight = 300 * SC;
  let lx = null;
  if (!bottom.length) lx = W * 0.5;
  else if (maxX + 10 + lw < yellowLeft) lx = Math.max(maxX + 10, W * 0.5);
  else if (minX - 10 - lw > coralRight) lx = Math.min(minX - 10 - lw, W * 0.5);
  if (lx !== null) ctx.drawImageInRect(glyphs.leaf, new Rect(lx, ly, lw, lh));
}

// ---- 本月旅程：年月左邊顯示一趟（進行中或接下來的優先），色帶和交通工具每趟都標
const monthStart = new Date(year, month, 1), monthEnd = new Date(year, month, days);
const todayD = new Date(year, month, today);
const trips = (await loadTrips()).filter(t => toDate(t.start) <= monthEnd && toDate(t.end) >= monthStart);
const shownTrip = trips.find(t => toDate(t.end) >= todayD) || trips[trips.length - 1];
if (shownTrip) {
  const left = inX + logoS + 8, right = titleRight - strWidth(title, 24, 900, C.primary) - 8;
  const path = tripLabelPath(shownTrip.id);
  if (shownTrip.labelW && store.fileExists(path)) {
    await ensureLocal(path);
    const k = Math.min(1, (right - left) / shownTrip.labelW), w = shownTrip.labelW * k, h = 26 * k;
    ctx.drawImageInRect(Image.fromFile(path), new Rect(right - w, headY - h / 2, w, h));
  } else {
    // 標籤圖還沒畫好：用系統字型畫簡單的膠囊
    const label = tripText(shownTrip), w = Math.min(right - left, label.length * 11 + 16);
    roundRect(TRIP_BG, 1, right - w, headY - 13, w, 26, 13);
    text(label, right - w / 2, headY, 12, TRIP_FG, bold, "center", w);
  }
}

// ---- 星期列（從星期日開始）
const colW = inW / 7;
const weekY = headY + 36;
["日", "一", "二", "三", "四", "五", "六"].forEach((d, i) => {
  const c = i === 0 ? C.danger : i === 6 ? C.tealDark : C.muted;
  str(d, inX + colW * i + colW / 2, weekY, 13, c);
});

// ---- 日期格
const firstDow = new Date(year, month, 1).getDay();
const rows = Math.ceil((firstDow + days) / 7);
const gridTop = weekY + 12, gridBottom = H - footerH - 2;
const rowH = (gridBottom - gridTop) / rows;
const dot = Math.min(colW, rowH) * 0.84;
const cellOf = d => {
  const idx = firstDow + d - 1, c = idx % 7, r = Math.floor(idx / 7);
  return { c, r, cx: inX + colW * c + colW / 2, cy: gridTop + rowH * r + rowH / 2 };
};

// 旅程色帶：畫在數字底下，跨週時每一排分開畫
for (const t of trips) {
  const from = Math.max(1, toDate(t.start) < monthStart ? 1 : toDate(t.start).getDate());
  const to = toDate(t.end) > monthEnd ? days : toDate(t.end).getDate();
  let d = from;
  while (d <= to) {
    const a = cellOf(d);
    let e = d;
    while (e < to && cellOf(e + 1).r === a.r) e++;
    const b = cellOf(e), bh = Math.min(30, rowH - 6);
    roundRect(TRIP_BAND[0], TRIP_BAND[1], a.cx - colW / 2 + 3, a.cy - bh / 2, b.cx - a.cx + colW - 6, bh, bh / 2);
    d = e + 1;
  }
}
// 出發日的交通工具
const tripStarts = {};
for (const t of trips) {
  const s = toDate(t.start);
  if (s.getFullYear() === year && s.getMonth() === month) tripStarts[s.getDate()] = t.mode;
}

for (let d = 1; d <= days; d++) {
  const { c, cx, cy } = cellOf(d);
  if (d === today) {
    ellipse(C.dangerDark, 1, cx - dot / 2, cy - dot / 2 + 3, dot, dot);
    ellipse(C.danger, 1, cx - dot / 2, cy - dot / 2, dot, dot);
    str(String(d), cx, cy, 19, "#FFFFFF", 900);
  } else {
    const weekend = c === 0 || c === 6;
    str(String(d), cx, cy, 19, weekend ? C.muted : C.text);
  }
  // 數字右上角的小圖示：出發日放交通工具；生日放氣球或拉炮（同一天時氣球往左挪）
  const x0 = cx + strWidth(String(d), 19, 700, C.text) / 2 - 3;
  const mode = tripStarts[d];
  if (mode) {
    const k = ICON_NAMES.indexOf(mode);
    if (glyphs) ctx.drawImageInRect(glyphs.icons[k], new Rect(x0, cy - 25, 20, 20));
    else ellipse("#5AA9E6", 1, x0 + 3, cy - 20, 13, 10);
  }
  const b = birthdays.findIndex(p => p.day === d);
  if (b >= 0) {
    const x = mode ? x0 - 17 : x0, y = cy - 24, k = b % 3;
    if (glyphs) ctx.drawImageInRect(glyphs.icons[k], new Rect(x, y, 18, 18));
    else ellipse(["#E8574B", "#FFC93C", "#5AA9E6"][k], 1, x + 4, y + 1, 10, 12);
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
else if (showPreview) await widget.presentLarge();
Script.complete();
