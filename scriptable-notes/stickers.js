// 筆記圖示的貼紙樣式：線條圖示（跟日常記帳同一套）加上塗色和不規則底色，畫法跟童趣風月曆的生日貼紙一樣。
// App 畫面和主畫面小工具共用這一份；build.py 會把它塞進 page.html 和 kids-notes.js。
// fill：第幾個圖形要塗什麼顏色（依 ICON_SVGS 裡元素的順序，從 0 開始）；stroke：改線條顏色；chip：底色
const STICKER_INK = "#262261";
const STICKER_CHIP = {
  yellow: "#FFF0AF", orange: "#FFE2BA", green: "#D5F5D0", blue: "#CFDDF8",
  pink: "#FBD3D0", teal: "#C9F0E9", purple: "#E3DAFA", rose: "#FFD8E8",
};
const STICKER_COLORS = {
  yellow: "#FFD426", red: "#EE3E33", orange: "#FF9500", green: "#6BD861", sky: "#8CC4EE", blue: "#3F6FD1",
  teal: "#4FD2C2", pink: "#FF9EC4", lilac: "#B9A3F0", white: "#FFFFFF", mist: "#E4E2F2", balloon: "#7DCB6E",
};
const STICKERS = {
  star: { chip: "yellow", fill: { 0: STICKER_COLORS.yellow } },
  heart: { chip: "pink", fill: { 0: STICKER_COLORS.red } },
  diamond: { chip: "blue", fill: { 0: STICKER_COLORS.sky } },
  music: { chip: "purple", fill: { 1: STICKER_COLORS.lilac, 2: STICKER_COLORS.lilac } },
  pencil: { chip: "orange", fill: { 0: STICKER_COLORS.yellow } },
  pets: { chip: "rose", fill: { 0: STICKER_COLORS.pink, 1: STICKER_COLORS.pink, 2: STICKER_COLORS.pink, 3: STICKER_COLORS.pink, 4: STICKER_COLORS.pink } },
  clothes: { chip: "green", fill: { 0: STICKER_COLORS.green } },
  sun: { chip: "orange", fill: { 0: STICKER_COLORS.yellow } },
  moon: { chip: "purple", fill: { 0: STICKER_COLORS.yellow } },
  cloud: { chip: "blue", fill: { 0: STICKER_COLORS.white } },
  partlycloudy: { chip: "blue", fill: { 0: STICKER_COLORS.yellow, 2: STICKER_COLORS.white } },
  cloudynight: { chip: "purple", fill: { 0: STICKER_COLORS.yellow, 1: STICKER_COLORS.white } },
  overcast: { chip: "blue", fill: { 0: STICKER_COLORS.mist } },
  rain: { chip: "blue", fill: { 0: STICKER_COLORS.white }, stroke: { 1: STICKER_COLORS.blue } },
  thunderstorm: { chip: "purple", fill: { 0: STICKER_COLORS.mist }, stroke: { 1: STICKER_COLORS.orange } },
  lightning: { chip: "yellow", fill: { 0: STICKER_COLORS.yellow } },
  snow: { chip: "teal", fill: { 0: STICKER_COLORS.white } },
  rainbow: { chip: "yellow", stroke: { 0: STICKER_COLORS.red, 1: STICKER_COLORS.blue } },
  gift: { chip: "blue", fill: { 0: STICKER_COLORS.sky, 3: STICKER_COLORS.red } },
  balloon: { chip: "teal", fill: { 0: STICKER_COLORS.balloon, 1: STICKER_COLORS.balloon } },
  fork: { chip: "orange", fill: { 0: STICKER_COLORS.white, 2: STICKER_COLORS.white } },
  drink: { chip: "teal", fill: { 0: STICKER_COLORS.pink, 1: STICKER_COLORS.white } },
  idea: { chip: "yellow", fill: { 1: STICKER_COLORS.yellow } },
  shoppingbag: { chip: "orange", fill: { 0: STICKER_COLORS.orange } },
  travel: { chip: "teal", fill: { 0: STICKER_COLORS.sky } },
  train: { chip: "yellow", fill: { 0: STICKER_COLORS.red, 2: STICKER_COLORS.yellow, 3: STICKER_COLORS.yellow } },
  bus: { chip: "teal", fill: { 0: STICKER_COLORS.green, 2: STICKER_COLORS.white, 3: STICKER_COLORS.white } },
  car: { chip: "blue", fill: { 0: STICKER_COLORS.yellow, 2: STICKER_COLORS.white, 3: STICKER_COLORS.white } },
  bicycle: { chip: "green", fill: { 0: STICKER_COLORS.white, 1: STICKER_COLORS.white } },
  camera: { chip: "purple", fill: { 0: STICKER_COLORS.lilac, 2: STICKER_COLORS.white } },
  location: { chip: "rose", fill: { 0: STICKER_COLORS.red, 1: STICKER_COLORS.white } },
};
// 新增的圖示（24×24，跟其他線條圖示同一個格子）
// 氣球：球、綁口、線、反光；叉子：叉頭、中間的齒、叉柄；飲料杯：杯身、杯蓋、吸管、珍珠
const EXTRA_ICON_SVGS = {
  balloon: '<path d="M12 2.8c3.9 0 6.6 2.9 6.6 6.6s-3.2 6.3-6.6 7.3c-3.4-1-6.6-3.6-6.6-7.3S8.1 2.8 12 2.8Z"/><path d="M10.8 18.4 12 16.7l1.2 1.7Z"/><path d="M12 18.4c-1.6 1.4 1.6 2.4 0 4.2"/><path d="M8.6 8.4c.3-1.5 1.3-2.5 2.6-2.8"/>',
  fork: '<path d="M8.5 2.8v5.4a3.5 3.5 0 0 0 7 0V2.8"/><path d="M12 2.8v5.4"/><path d="M10.8 11.6h2.4l-.3 8.9a.9.9 0 0 1-1.8 0Z"/>',
  drink: '<path d="M6.8 9.4h10.4l-1.3 10.9a1.6 1.6 0 0 1-1.6 1.4H9.7a1.6 1.6 0 0 1-1.6-1.4Z"/><path d="M5.8 9.4h12.4V8a1.8 1.8 0 0 0-1.8-1.8H7.6A1.8 1.8 0 0 0 5.8 8Z"/><path d="M12.8 6.2 14.6 2.4h2.6"/><circle cx="10" cy="18.2" r=".9" fill="currentColor"/><circle cx="12.3" cy="19.2" r=".9" fill="currentColor"/><circle cx="14.4" cy="17.8" r=".9" fill="currentColor"/>',
};

// 不規則色塊的 8 個圓角百分比（同童趣風月曆的 R1–R4），依圖示名稱挑一組、旋轉 ±4 度
const STICKER_BLOBS = [[52, 48, 61, 39, 58, 43, 57, 42], [60, 40, 44, 56, 46, 55, 45, 54], [45, 55, 52, 48, 62, 40, 60, 38], [55, 45, 48, 52, 44, 58, 42, 56]];
function stickerHash(s) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }

// 不規則色塊的 SVG 路徑（寬 w、高 h，左上角在 0,0）
function blobPathD(w, h, r) {
  const [a, b, c, d, e, f, g, k] = r.map((v) => v / 100);
  return `M${a * w} 0H${w - b * w}A${b * w} ${f * h} 0 0 1 ${w} ${f * h}V${h - g * h}A${c * w} ${g * h} 0 0 1 ${w - c * w} ${h}`
    + `H${d * w}A${d * w} ${k * h} 0 0 1 0 ${h - k * h}V${e * h}A${a * w} ${e * h} 0 0 1 ${a * w} 0Z`;
}

// 一個圖示的完整貼紙 SVG（viewBox 24×24）：底下不規則色塊，上面是塗好色的線條圖示
function stickerSVG(key, svgs) {
  const spec = STICKERS[key] || { chip: "yellow", fill: {} };
  const inner = svgs[key] || svgs.star;
  let i = 0;
  const body = inner.replace(/<(\w+)([^>]*?)\/>/g, (m, tag, attrs) => {
    const idx = i++;
    if (/fill="currentColor"/.test(attrs)) return `<${tag}${attrs.replace('fill="currentColor"', `fill="${STICKER_INK}"`)}/>`;
    const fill = spec.fill && spec.fill[idx] ? spec.fill[idx] : "none";
    const stroke = spec.stroke && spec.stroke[idx] ? ` stroke="${spec.stroke[idx]}" stroke-width="2.8"` : "";
    return `<${tag}${attrs} fill="${fill}"${stroke}/>`;
  });
  const h = stickerHash(key), deg = (h % 9) - 4;
  // 寫明寬高，畫成 PNG 時才不會被當成 300×150 而變形
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24">`
    + `<path d="${blobPathD(22, 22, STICKER_BLOBS[h % 4])}" transform="translate(1 1) rotate(${deg} 11 11)" fill="${STICKER_CHIP[spec.chip]}"/>`
    + `<g transform="translate(4.4 4.4) scale(.633)" stroke="${STICKER_INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</g>`
    + `</svg>`;
}
