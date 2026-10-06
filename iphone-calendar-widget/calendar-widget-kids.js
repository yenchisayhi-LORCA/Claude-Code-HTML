// 月曆小工具・童趣風（Scriptable 大尺寸）— 配色、字型、圖示照設計系統「童趣風」
// 數字用 Gluten、中文用 Zen Maru Gothic（跟大圓臉版一樣）；米白紙底、角落色塊、今天是黃色不規則色塊
// 壽星和旅程跟「大圓臉版」共用同一份資料（iCloud 的 calendar-widget-birthdays 資料夾），在哪一版新增都會一起顯示
const K = {
  cream: "#FFFCEF", ink: "#262261", body: "#5A5788", muted: "#8B88B2",
  yellow: "#FFD426", blue: "#3F6FD1", red: "#EE3E33", redText: "#B8261E", teal: "#4FD2C2", pink: "#FF9EC4",
  yellow100: "#FFF0AF", blue100: "#CFDDF8", pink100: "#FBD3D0", teal100: "#C9F0E9",
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
const [W, H] = widgetSize();
const SC = W / 1540;

// ---- 字型與圖片
// Scriptable 無法直接安裝網路字型，所以第一次在 App 內執行時，用 WebView 從 Google Fonts 載入
// Gluten、Zen Maru Gothic，把會用到的字依顏色畫成小圖存起來；「彥」圖示、底圖、小圖示也一起畫好。
// 小工具之後直接讀這些圖；還沒存好時改用系統圓體和簡化版圖案。
const NUM_FONT = "Gluten", CJK_FONT = "Zen Maru Gothic";
const fontOf = ch => ch.codePointAt(0) > 255 ? CJK_FONT : NUM_FONT;
const GLYPH_VERSION = 2;
const DIGITS = "0123456789";
// [粗細, 顏色, 要畫的字]；英數字用 Gluten、中文用 Zen Maru Gothic
const GLYPH_SPECS = [
  [700, K.ink, DIGITS],
  [700, K.body, DIGITS],
  [800, K.ink, DIGITS + "."],
  [700, K.redText, "日"],
  [700, K.muted, "一二三四五"],
  [700, K.blue, "六"],
];
const glyphKey = (w, hex, ch) => `${w}_${hex.slice(1)}_${ch.codePointAt(0)}`;
const fm = FileManager.local();
const glyphDir = fm.joinPath(fm.documentsDirectory(), "calendar-widget-kids");
const ART_VERSION = 2; // 底圖或小圖示改過就加 1，讓已存的圖重畫
const metaPath = fm.joinPath(glyphDir, "meta.json");
const artPath = name => fm.joinPath(glyphDir, name + ".png");
// 生日貼紙（依壽星順序輪流）、交通工具、今天的色塊、空位的三隻小怪獸
const STICKERS = ["star", "heart", "gift", "balloon"];
const TRANSPORT = { plane: "飛機", train: "火車", car: "汽車" };
const ART_NAMES = ["logo", "bg", "today", "monsters", ...STICKERS.map(s => "sticker-" + s), ...Object.keys(TRANSPORT)];

// 交通工具圖示（跟大圓臉版一樣；在 WebView 的 canvas 裡畫，g 已縮放成 1×1 的方格）
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

// 不規則色塊：(cx, cy) 為中心、寬 w 高 h，r 是 8 個 border-radius 百分比
// （左上、右上、右下、左下的水平半徑 / 同順序的垂直半徑），旋轉 deg 度
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
// 把一段文字要用的 Gluten（英數字）和 Zen Maru Gothic（中文、符號）都抓下來
async function fetchTextFonts(text, numWeights, cjkWeights) {
  const latin = [...new Set(text)].filter(ch => fontOf(ch) === NUM_FONT).join("");
  const cjk = [...new Set(text)].filter(ch => fontOf(ch) === CJK_FONT).join("");
  return [
    ...(latin.trim() ? await fetchFont(NUM_FONT, numWeights, latin) : []),
    ...(cjk ? await fetchFont(CJK_FONT, cjkWeights, cjk) : []),
  ];
}
const LOAD_FONTS_JS = faces => `
  for (const f of ${JSON.stringify(faces)}) {
    const face = new FontFace(f.family, Uint8Array.from(atob(f.b64), c => c.charCodeAt(0)), { weight: f.weight });
    await face.load(); document.fonts.add(face);
  }`;

// 成功回傳 null；失敗回傳原因
async function buildArt() {
  const allChars = [...new Set(GLYPH_SPECS.map(g => g[2]).join(""))].join("");
  const faces = [...await fetchTextFonts(allChars, [700, 800], [700]), ...await fetchFont("Huninn", null, "彥")];
  const wv = new WebView();
  await wv.loadHTML("<html><body></body></html>");
  const res = await wv.evaluateJavaScript(`
    (async () => {
      try {
        ${LOAD_FONTS_JS(faces)}
        const specs = ${JSON.stringify(GLYPH_SPECS)}, widths = {}, images = {};
        const fontOf = ch => ch.codePointAt(0) > 255 ? "${CJK_FONT}" : "${NUM_FONT}";
        const cv = document.createElement("canvas"), g = cv.getContext("2d");
        for (const [w, hex, chars] of specs) for (const ch of chars) {
          const key = w + "_" + hex.slice(1) + "_" + ch.codePointAt(0), font = w + ' 100px "' + fontOf(ch) + '"';
          g.font = font;
          widths[key] = g.measureText(ch).width;
          cv.width = Math.ceil(widths[key]) + 20; cv.height = 140;
          g.font = font; g.fillStyle = hex;
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText(ch, cv.width / 2, 72);
          images[key] = cv.toDataURL("image/png").split(",")[1];
        }
        const art = {
          logo: drawLogo(), bg: drawBackground(${W}, ${H}), today: drawToday(), monsters: drawMonsters(),
          ${STICKERS.map(s => `"sticker-${s}": drawSticker("${s}")`).join(", ")},
          plane: transportPNG("plane"), train: transportPNG("train"), car: transportPNG("car"),
        };
        completion({ widths, images, art });
      } catch (e) { completion({ error: String(e) }); }
    })();

    ${BLOB_JS}
    ${TRANSPORT_JS}
    const png = cv => cv.toDataURL("image/png").split(",")[1];
    function canvas(w, h, s) {
      const cv = document.createElement("canvas"), g = cv.getContext("2d");
      cv.width = Math.round(w * s); cv.height = Math.round(h * s); g.scale(s, s);
      return [cv, g];
    }

    // 「彥」深色版（256×256 設計稿）：深藍不規則色塊、紅花、黃色不規則圓、黃枝 + 藍枝
    function drawLogo() {
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
      // 彥：Huninn 90px，同色 2px 描邊稍微加粗；以字的實際外框置中
      g.font = '90px "Huninn"'; g.textAlign = "center"; g.textBaseline = "alphabetic";
      const m = g.measureText("彥"), base = 128 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
      g.strokeStyle = g.fillStyle = "${K.ink}"; g.lineWidth = 2; g.lineJoin = "round";
      g.strokeText("彥", 128, base); g.fillText("彥", 128, base);
      return png(cv);
    }

    // 底圖：米白紙 + 右上黃色色塊（手繪閃亮）+ 左下淡粉、右下淡青色塊
    function drawBackground(W, H) {
      const [cv, g] = canvas(W, H, 3);
      g.fillStyle = "${K.cream}"; g.fillRect(0, 0, W, H);
      blob(g, W - 6, 4, 118, 104, R1, -8, "${K.yellow}");
      g.save(); g.translate(W - 44, 12); g.scale(26 / 48, 26 / 48);
      g.strokeStyle = "${K.ink}"; g.lineWidth = 3.4; g.lineCap = g.lineJoin = "round";
      g.stroke(new Path2D("M24 8c1 6 3.5 12 8 16-4.5 4-7 10-8 16-1-6-3.5-12-8-16 4.5-4 7-10 8-16Z")); g.restore();
      blob(g, -4, H + 6, 110, 84, R2, 6, "${K.pink100}");
      blob(g, W + 6, H + 8, 120, 90, R3, -5, "${K.teal100}");
      return png(cv);
    }

    // 今天：黃色不規則色塊（寬高比 1.04 : 1）
    function drawToday() {
      const [cv, g] = canvas(52, 50, 3);
      blob(g, 26, 25, 47, 45, R1, -4, "${K.yellow}");
      return png(cv);
    }

    // 空位裝飾：三隻色塊小怪獸（112×56）
    function drawMonsters() {
      const [cv, g] = canvas(112, 56, 3);
      const monster = (x, y, s, color) => {
        g.save(); g.translate(x, y); g.scale(s / 60, s / 60);
        const f = color === "${K.blue}" ? "#FFFFFF" : "${K.ink}";
        g.fillStyle = color; g.fill(new Path2D("M30 3c16 0 28 14 28 31 0 14-12 23-28 23S2 48 2 34C2 17 14 3 30 3Z"));
        g.fillStyle = f; for (const ex of [21, 39]) { g.beginPath(); g.arc(ex, 30, 3, 0, 7); g.fill(); }
        g.strokeStyle = f; g.lineWidth = 3; g.lineCap = "round"; g.stroke(new Path2D("M22 39c4 5 13 5 17-1"));
        g.restore();
      };
      monster(1, 17, 34, "${K.pink}");
      monster(37, 4, 40, "${K.yellow}");
      monster(81, 21, 30, "${K.blue}");
      return png(cv);
    }

    // 生日貼紙（26×26，色塊 22）：手繪線稿圖示 + 填色，底下墊淡色不規則色塊
    function drawSticker(name) {
      const ICON = {
        star: ["M24 6c1.6 1 3.4 6.6 5.2 11.6 5.4.4 11 .8 12 1.6.9.9-3.6 4.6-7.6 8.4 1.2 5.2 2.7 10.8 2.1 11.6-.7.8-5.8-2.1-11.7-5.3-5.6 3-10.8 6.1-11.6 5.3-.8-.8.7-6.3 2-11.6-4-3.8-8.5-7.5-7.6-8.4.9-.8 6.5-1.2 12-1.6C20.5 12.6 22.4 7 24 6Z"],
        heart: ["M24 40C9 29.6 7.5 22.4 8.2 17.6 9 12.2 13.5 9.6 17.6 10.4c3.6.7 5.6 3.6 6.4 6.6.8-3 3-5.9 6.6-6.6 4.1-.8 8.6 1.8 9.4 7.2.7 4.8-1 12-16 22Z"],
        gift: ["M10.5 22.5c9-1 18-1 27 0V39c-9 1-18 1-27 0Z", "M8.5 15.5c10.5-1 20.5-1 31 0v7c-10.5 1-20.5 1-31 0Z", "M24 15.5V39", "M24 15.5c-3.5-1-6-2.5-6-5s3.5-3 6 5Zm0 0c3.5-1 6-2.5 6-5s-3.5-3-6 5Z"],
        balloon: ["M24 5.5c7.5 0 12.5 5.5 12.5 12.5S30.5 30.5 24 32.5C17.5 30.5 11.5 25 11.5 18S16.5 5.5 24 5.5Z", "M21.8 35.5 24 32.5l2.2 3Z", "-M24 35.5c-3 2.5 3 4.5 0 8", "-M17.5 16c.6-2.8 2.4-4.6 4.8-5.3"],
      };
      const FILL = { star: "${K.yellow}", heart: "${K.red}", gift: "#8CC4EE", balloon: "#7DCB6E" };
      const CHIP = { star: ["${K.yellow100}", R1, -4], heart: ["${K.pink100}", R2, 3], gift: ["${K.blue100}", R3, -3], balloon: ["${K.teal100}", R4, 4] };
      const [cv, g] = canvas(26, 26, 4);
      const [bg, r, deg] = CHIP[name];
      blob(g, 13, 13, 22, 22, r, deg, bg);
      g.save(); g.translate(5, 5); g.scale(16 / 48, 16 / 48);
      g.strokeStyle = "${K.ink}"; g.lineWidth = 4.4; g.lineCap = g.lineJoin = "round";
      for (let d of ICON[name]) {
        const noFill = d[0] === "-"; if (noFill) d = d.slice(1);
        const p = new Path2D(d);
        if (!noFill) { g.fillStyle = FILL[name]; g.fill(p); }
        g.stroke(p);
      }
      g.restore();
      return png(cv);
    }

    // 最後一行要是一般的值：iPhone 的 WebView 不接受 Promise 當回傳值，會直接報錯
    0;`, true);
  if (!res || res.error) return res ? res.error : "WebView 沒有回應";
  if (!fm.fileExists(glyphDir)) fm.createDirectory(glyphDir, true);
  for (const name in res.art) fm.write(artPath(name), Data.fromBase64String(res.art[name]));
  for (const key in res.images) fm.write(fm.joinPath(glyphDir, key + ".png"), Data.fromBase64String(res.images[key]));
  fm.writeString(metaPath, JSON.stringify({ version: GLYPH_VERSION, artVersion: ART_VERSION, specs: GLYPH_SPECS, size: [W, H], widths: res.widths }));
  return null;
}

// 讀取字型小圖和圖片；沒有的話（且不是在小工具裡）先建一次。失敗就回傳 null，改用系統字型
async function loadGlyphs() {
  const ok = () => {
    if (!fm.fileExists(metaPath)) return null;
    const meta = JSON.parse(fm.readString(metaPath));
    if (meta.version !== GLYPH_VERSION || JSON.stringify(meta.specs) !== JSON.stringify(GLYPH_SPECS)) return null;
    if (meta.artVersion !== ART_VERSION || JSON.stringify(meta.size) !== JSON.stringify([W, H])) return null;
    return meta;
  };
  let meta = ok();
  if (!meta && !config.runsInWidget) {
    let err;
    try { err = await buildArt(); } catch (e) { err = String(e); }
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
  const images = {}, art = {};
  for (const key in meta.widths) images[key] = Image.fromFile(fm.joinPath(glyphDir, key + ".png"));
  for (const name of ART_NAMES) art[name] = Image.fromFile(artPath(name));
  return { widths: meta.widths, images, art };
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
    if (!(st.photoPos in PHOTO_POS)) st.photoPos = def.photoPos;
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

// ---- 旅程：地點、出發日、回程日、交通工具
// 標籤文字會先畫成透明底的圖存起來（kids-trip-<id>.png），膠囊底色由小工具依旅程順序決定；
// 大圓臉版的粉藍標籤（trip-<id>.png）也一起更新，兩版顯示一致
const tripsPath = store.joinPath(bdayDir, "trips.json");
const kidsLabelPath = id => store.joinPath(bdayDir, "kids-trip-" + id + ".png");
const bigfaceLabelPath = id => store.joinPath(bdayDir, "trip-" + id + ".png");
const TRIP_COLORS = [K.blue100, K.teal100, K.pink100]; // 這個月的第 1、2、3 趟（第 4 趟起重複）
// 標籤圖的版本：字型改過就換數字，讓已畫好的標籤重畫
const kidsKey = t => "zen|" + tripText(t);
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

// 童趣風標籤文字（高 26pt、3 倍解析度、透明底）：數字 Gluten、中文 Zen Maru Gothic；成功回傳寬度（pt），失敗回傳 0
async function renderKidsLabel(t) {
  try {
    const text = tripText(t);
    const faces = await fetchTextFonts(text, [700], [700]);
    const wv = new WebView();
    await wv.loadHTML("<html><body></body></html>");
    const res = await wv.evaluateJavaScript(`
      (async () => {
        try {
          ${LOAD_FONTS_JS(faces)}
          const text = ${JSON.stringify(text)}, S = 3, H = 26, F = '700 13px "${NUM_FONT}", "${CJK_FONT}"';
          const m = document.createElement("canvas").getContext("2d"); m.font = F;
          const W = Math.ceil(m.measureText(text).width) + 22;
          const cv = document.createElement("canvas"), g = cv.getContext("2d");
          cv.width = W * S; cv.height = H * S; g.scale(S, S);
          g.font = F; g.fillStyle = "${K.ink}"; g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText(text, W / 2, H / 2 + 1);
          completion({ w: W, png: cv.toDataURL("image/png").split(",")[1] });
        } catch (e) { completion(null); }
      })();
      0;`, true);
    if (!res) return 0;
    if (!store.fileExists(bdayDir)) store.createDirectory(bdayDir, true);
    store.write(kidsLabelPath(t.id), Data.fromBase64String(res.png));
    return res.w;
  } catch (e) { return 0; }
}

// 大圓臉版的粉藍標籤（Zen Maru Gothic + 交通工具），跟大圓臉版畫法相同
async function renderBigfaceLabel(t) {
  try {
    const text = tripText(t);
    const faces = await fetchFont("Zen Maru Gothic", [700], text);
    const wv = new WebView();
    await wv.loadHTML("<html><body></body></html>");
    const res = await wv.evaluateJavaScript(`
      (async () => {
        try {
          ${LOAD_FONTS_JS(faces)}
          const text = ${JSON.stringify(text)}, S = 3, H = 26, F = '700 13px "Zen Maru Gothic"';
          const m = document.createElement("canvas").getContext("2d"); m.font = F;
          const W = Math.ceil(m.measureText(text).width) + 36;
          const cv = document.createElement("canvas"), g = cv.getContext("2d");
          cv.width = W * S; cv.height = H * S; g.scale(S, S);
          g.fillStyle = "#E2F3FA"; g.beginPath(); g.roundRect(0, 0, W, H, H / 2); g.fill();
          g.fillStyle = "#FFFFFF"; g.beginPath(); g.arc(15, H / 2, 10, 0, Math.PI * 2); g.fill();
          g.save(); g.translate(6, H / 2 - 9); g.scale(18, 18); drawTransport(g, ${JSON.stringify(t.mode)}); g.restore();
          g.font = F; g.fillStyle = "#3B8DB5"; g.textAlign = "left"; g.textBaseline = "middle";
          g.fillText(text, 29, H / 2 + 1);
          completion({ w: W, png: cv.toDataURL("image/png").split(",")[1] });
        } catch (e) { completion(null); }
      })();
      ${TRANSPORT_JS}
      0;`, true);
    if (!res) return 0;
    if (!store.fileExists(bdayDir)) store.createDirectory(bdayDir, true);
    store.write(bigfaceLabelPath(t.id), Data.fromBase64String(res.png));
    return res.w;
  } catch (e) { return 0; }
}

// 在大圓臉版新增或修改的旅程，這裡還沒有童趣風標籤：在 App 內執行時補畫
async function syncKidsLabels() {
  const list = await loadTrips();
  let changed = false;
  for (const t of list) {
    if (t.kidsText === kidsKey(t) && t.kidsW && store.fileExists(kidsLabelPath(t.id))) continue;
    const w = await renderKidsLabel(t);
    if (w) { t.kidsW = w; t.kidsText = kidsKey(t); changed = true; }
  }
  if (changed) saveTrips(list);
}

async function addTrip(old) {
  const info = await askTrip(old);
  if (!info) return;
  const list = await loadTrips();
  const t = old ? Object.assign(list.find(x => x.id === old.id), info) : { id: Date.now().toString(36), ...info };
  t.kidsW = await renderKidsLabel(t);
  t.kidsText = t.kidsW ? kidsKey(t) : "";
  t.labelW = await renderBigfaceLabel(t);
  if (!old) list.push(t);
  saveTrips(list);
  if (!t.kidsW) await notice("已儲存", "標籤字型下載失敗，先用系統字型顯示；網路正常時再執行一次就會補畫。");
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
    for (const p of [kidsLabelPath(t.id), bigfaceLabelPath(t.id)]) if (store.fileExists(p)) store.remove(p);
  }
}

// 在 App 內執行時的選單；選「預覽小工具」回傳 true
async function mainMenu() {
  while (true) {
    const list = await loadBirthdays(), trips = await loadTrips();
    const a = new Alert();
    a.title = "童趣風月曆";
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
if (!config.runsInWidget) await syncKidsLabels();
const showPreview = config.runsInWidget ? false : await mainMenu();

// ---- 畫小工具
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
const art = name => glyphs && glyphs.art[name];

// 用 Gluten / Zen Maru Gothic 畫字；有任何字沒畫到小圖時，整串改用系統圓體
const hasGlyphs = (str, w, hex) => glyphs && [...str].every(ch => glyphKey(w, hex, ch) in glyphs.widths);
function strWidth(str, size, w, hex) {
  if (!hasGlyphs(str, w, hex)) return [...str].reduce((t, ch) => t + size * (ch.charCodeAt(0) > 255 ? 1 : 0.6), 0);
  return [...str].reduce((t, ch) => t + glyphs.widths[glyphKey(w, hex, ch)] * size / 100, 0);
}
function str(s, x, cy, size, hex, w = 700, align = "center") {
  const width = strWidth(s, size, w, hex);
  if (!hasGlyphs(s, w, hex)) {
    const cx = align === "left" ? x + width / 2 : align === "right" ? x - width / 2 : x;
    return text(s, cx, cy, size, hex, w >= 800 ? heavy : bold, "center", width + 20);
  }
  const k = size / 100;
  let pen = align === "left" ? x : align === "right" ? x - width : x - width / 2;
  for (const ch of s) {
    const key = glyphKey(w, hex, ch), adv = glyphs.widths[key] * k, imgW = (Math.ceil(glyphs.widths[key]) + 20) * k;
    ctx.drawImageInRect(glyphs.images[key], new Rect(pen + adv / 2 - imgW / 2, cy - 70 * k, imgW, 140 * k));
    pen += adv;
  }
}

// ---- 背景：米白紙 + 角落色塊；還沒存好時畫簡化版
if (art("bg")) {
  ctx.drawImageInRect(art("bg"), new Rect(0, 0, W, H));
} else {
  ctx.setFillColor(col(K.cream));
  ctx.fillRect(new Rect(0, 0, W, H));
  ellipse(K.yellow, 1, W - 65, -48, 118, 104);
  ellipse(K.pink100, 1, -59, H - 36, 110, 84);
  ellipse(K.teal100, 1, W - 54, H - 37, 120, 90);
}

const now = new Date();
const year = now.getFullYear(), month = now.getMonth(), today = now.getDate();
const pad = 16, inX = pad, inW = W - pad * 2;
const footerH = 305 * SC;

// ---- 標題列：左邊「彥」圖示（深色版），右邊年月
const logoS = 40 * 1.2, headY = 34; // 彥放大 1.2 倍，中心位置不變
if (art("logo")) ctx.drawImageInRect(art("logo"), new Rect(inX, headY - logoS / 2, logoS, logoS));
else {
  roundRect("#232058", 1, inX, headY - logoS / 2, logoS, logoS, logoS * 0.17);
  ellipse("#F7D44C", 1, inX + logoS * 0.16, headY - logoS * 0.33, logoS * 0.68, logoS * 0.66);
  text("彥", inX + logoS / 2, headY, logoS * 0.4, K.ink, heavy, "center", logoS);
}

// 右上角：年.月，例如 2026.09（避開右上角的黃色色塊）
const title = `${year}.${String(month + 1).padStart(2, "0")}`, titleRight = W - 245 * SC - 6, titleSize = 26 * 0.8 * 0.85;
str(title, titleRight, headY, titleSize, K.ink, 800, "right");

// ---- 本月壽星：照片放在最下面（左下或右下），外框依生日先後輪流用粉紅、湖水青、太陽黃、深藍
const days = new Date(year, month + 1, 0).getDate();
const birthdays = (await loadBirthdays())
  .filter(p => p.month === month + 1)
  .map(p => ({ ...p, day: Math.min(p.day, days) })) // 2/29 在平年顯示在 2/28
  .sort((a, b) => a.day - b.day);
const RINGS = [K.pink, K.teal, K.yellow, K.blue];
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
for (let i = 0; i < spots.length; i++) {
  const { cx, cy, D } = spots[i], r = D / 2 - 3.5;
  ellipse(RINGS[i % RINGS.length], 1, cx - D / 2, cy - D / 2, D, D);
  const path = avatarPath(birthdays[i].id);
  if (store.fileExists(path)) {
    await ensureLocal(path);
    ctx.drawImageInRect(Image.fromFile(path), new Rect(cx - r, cy - r, r * 2, r * 2));
  }
}

// ---- 本月旅程：年月左邊顯示一趟（進行中或接下來的優先），其他的放下方；
// 每趟依日期先後輪流用淡藍、淡青、淡粉，標籤和色帶同色
const monthStart = new Date(year, month, 1), monthEnd = new Date(year, month, days);
const todayD = new Date(year, month, today);
const trips = (await loadTrips())
  .filter(t => toDate(t.start) <= monthEnd && toDate(t.end) >= monthStart)
  .sort((a, b) => a.start.localeCompare(b.start));
const tripColor = t => TRIP_COLORS[trips.indexOf(t) % TRIP_COLORS.length];
const shownTrip = trips.find(t => toDate(t.end) >= todayD) || trips[trips.length - 1];

// 畫一個旅程標籤：x 是靠照片（或年月）那一側的邊，alignRight 表示往左長；寬度超過 maxW 就縮小
async function drawTripLabel(t, x, cy, maxW, alignRight) {
  const path = kidsLabelPath(t.id), label = tripText(t);
  const ready = t.kidsW && t.kidsText === kidsKey(t) && store.fileExists(path);
  const w0 = ready ? t.kidsW : label.length * 11 + 16;
  const k = Math.min(1, maxW / w0), w = w0 * k, h = 26 * k, lx = alignRight ? x - w : x;
  roundRect(tripColor(t), 1, lx, cy - h / 2, w, h, h / 2);
  if (ready) {
    await ensureLocal(path);
    ctx.drawImageInRect(Image.fromFile(path), new Rect(lx, cy - h / 2, w, h));
  } else {
    text(label, lx + w / 2, cy, 12 * k, K.ink, bold, "center", w);
  }
}

if (shownTrip) {
  const left = inX + logoS + 8, right = titleRight - strWidth(title, titleSize, 800, K.ink) - 8;
  await drawTripLabel(shownTrip, right, headY, right - left, true);
}

// 其他旅程：放在最下面一排、壽星照片旁邊的空位（最多 2 個，上下疊）；空位太窄就不放
const photosRight = st.photoPos === "bottomRight";
const edgeL = spots.length && !photosRight ? Math.max(...spots.map(p => p.cx + p.D / 2)) + 8 : 12;
const edgeR = spots.length && photosRight ? Math.min(...spots.map(p => p.cx - p.D / 2)) - 8 : W - 12;
const otherTrips = trips.filter(t => t !== shownTrip).slice(0, 2);
const mid = H - 12 - PHOTO / 2;
let bottomLabels = 0;
if (otherTrips.length && edgeR - edgeL >= 70) {
  const ys = otherTrips.length === 1 ? [mid] : [mid - 15, mid + 15];
  for (let i = 0; i < otherTrips.length; i++) {
    await drawTripLabel(otherTrips[i], photosRight ? edgeR : edgeL, ys[i], edgeR - edgeL, photosRight);
  }
  bottomLabels = otherTrips.length;
}

// 空位裝飾：三隻色塊小怪獸，放在下方沒有照片、也沒有旅程標籤的地方（留一點給角落色塊）
if (art("monsters") && !bottomLabels) {
  const x0 = photosRight ? 12 : edgeL, x1 = photosRight ? edgeR : W - 12;
  const room = x1 - x0 - 14, k = Math.min(1.3, room / 120);
  if (room >= 50) {
    const x = photosRight ? x1 - 14 - Math.max(6, (room - 120 * k) / 2) - 112 * k : x0 + Math.max(6, (room - 120 * k) / 2);
    ctx.drawImageInRect(art("monsters"), new Rect(x, mid - 28 * k, 112 * k, 56 * k));
  }
}

// ---- 星期列（從星期日開始）
const colW = inW / 7;
const weekY = headY + 36;
["日", "一", "二", "三", "四", "五", "六"].forEach((d, i) => {
  const c = i === 0 ? K.redText : i === 6 ? K.blue : K.muted;
  str(d, inX + colW * i + colW / 2, weekY, 13, c);
});

// ---- 日期格
const firstDow = new Date(year, month, 1).getDay();
const rows = Math.ceil((firstDow + days) / 7);
const gridTop = weekY + 12, gridBottom = H - footerH - 2;
const rowH = (gridBottom - gridTop) / rows;
const dot = Math.min(colW, rowH) * 0.86;
const cellOf = d => {
  const idx = firstDow + d - 1, c = idx % 7, r = Math.floor(idx / 7);
  return { c, r, cx: inX + colW * c + colW / 2, cy: gridTop + rowH * r + rowH / 2 };
};

// 旅程色帶：畫在數字底下，跨週時每一排分開畫
for (const t of trips) {
  const from = toDate(t.start) < monthStart ? 1 : toDate(t.start).getDate();
  const to = toDate(t.end) > monthEnd ? days : toDate(t.end).getDate();
  let d = from;
  while (d <= to) {
    const a = cellOf(d);
    let e = d;
    while (e < to && cellOf(e + 1).r === a.r) e++;
    const b = cellOf(e), bh = Math.min(30, rowH - 6);
    roundRect(tripColor(t), 1, a.cx - colW / 2 + 3, a.cy - bh / 2, b.cx - a.cx + colW - 6, bh, bh / 2);
    d = e + 1;
  }
}
// 出發日的交通工具
const tripStarts = {};
for (const t of trips) {
  const s = toDate(t.start);
  if (s.getFullYear() === year && s.getMonth() === month) tripStarts[s.getDate()] = t.mode;
}

const STICKER_FALLBACK = [K.yellow, K.red, "#8CC4EE", "#7DCB6E"];
const DAY_SIZE = 20 * 0.85; // 日期數字大小
for (let d = 1; d <= days; d++) {
  const { c, cx, cy } = cellOf(d);
  if (d === today) {
    if (art("today")) ctx.drawImageInRect(art("today"), new Rect(cx - dot * 0.54, cy - dot * 0.52, dot * 1.08, dot * 1.04));
    else ellipse(K.yellow, 1, cx - dot * 0.52, cy - dot / 2, dot * 1.04, dot);
    str(String(d), cx, cy, DAY_SIZE, K.ink, 800);
  } else {
    const weekend = c === 0 || c === 6;
    str(String(d), cx, cy, DAY_SIZE, weekend ? K.body : K.ink);
  }
  // 數字右上角的小圖示：出發日放交通工具；生日放貼紙（同一天時貼紙往左挪）
  const x0 = cx + strWidth(String(d), DAY_SIZE, 700, K.ink) / 2 - 3;
  const mode = tripStarts[d];
  if (mode) {
    if (art(mode)) ctx.drawImageInRect(art(mode), new Rect(x0, cy - 23, 20, 20));
    else ellipse("#5AA9E6", 1, x0 + 3, cy - 18, 13, 10);
  }
  const b = birthdays.findIndex(p => p.day === d);
  if (b >= 0) {
    const k = b % STICKERS.length, x = (mode ? x0 - 19 : x0) - 4, y = cy - 27;
    if (art("sticker-" + STICKERS[k])) ctx.drawImageInRect(art("sticker-" + STICKERS[k]), new Rect(x, y, 26, 26));
    else ellipse(STICKER_FALLBACK[k], 1, x + 7, y + 7, 12, 12);
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
