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
  teal: "#4FD2C2", pink: "#FF9EC4", lilac: "#B9A3F0", white: "#FFFFFF", mist: "#E4E2F2", balloon: "#7DCB6E", milkTea: "#D9B48F",
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
  drink: { chip: "teal", fill: { 0: STICKER_COLORS.milkTea, 1: STICKER_COLORS.white } },
  idea: { chip: "yellow", fill: { 1: STICKER_COLORS.yellow } },
  shoppingbag: { chip: "orange", fill: { 0: STICKER_COLORS.orange } },
  travel: { chip: "teal", fill: { 0: STICKER_COLORS.sky } },
  train: { chip: "yellow", fill: { 0: STICKER_COLORS.red, 2: STICKER_COLORS.yellow, 3: STICKER_COLORS.yellow } },
  bus: { chip: "teal", fill: { 0: STICKER_COLORS.green, 2: STICKER_COLORS.white, 3: STICKER_COLORS.white } },
  car: { chip: "blue", fill: { 0: STICKER_COLORS.yellow, 2: STICKER_COLORS.white, 3: STICKER_COLORS.white } },
  bicycle: { chip: "green", fill: { 0: STICKER_COLORS.white, 1: STICKER_COLORS.white } },
  camera: { chip: "purple", fill: { 0: STICKER_COLORS.lilac, 2: STICKER_COLORS.white } },
  location: { chip: "rose", fill: { 0: STICKER_COLORS.red, 1: STICKER_COLORS.white } },
  apple: { chip: "pink", fill: { 0: "#EE3E33", 2: "#6BD861" } },
  strawberry: { chip: "rose", fill: { 0: "#EE3E33", 1: "#6BD861" } },
  grape: { chip: "purple", fill: { 0: "#9B6BE8", 1: "#9B6BE8", 2: "#9B6BE8", 3: "#9B6BE8", 4: "#9B6BE8", 5: "#9B6BE8", 7: "#6BD861" } },
  watermelon: { chip: "green", fill: { 0: "#3FA34D", 1: "#FF5A6E" } },
  orange: { chip: "orange", fill: { 0: "#FF9500", 1: "#6BD861" } },
  cherry: { chip: "rose", fill: { 0: "#D9322B", 1: "#D9322B", 4: "#6BD861" } },
  rainboot: { chip: "teal", fill: { 0: "#FFD426", 1: "#3F6FD1" } },
  flipflop: { chip: "yellow", fill: { 0: "#4FD2C2" }, stroke: { 1: "#EE3E33" } },
  steamtrain: { chip: "blue", fill: { 0: "#EE3E33", 1: "#EE3E33", 2: "#FFD426", 3: "#FFD426", 4: "#FFD426" } },
  metro: { chip: "teal", fill: { 0: "#FFFFFF", 1: "#8CC4EE" }, stroke: { 2: "#4FD2C2" } },
  plane: { chip: "blue", fill: { 0: "#FFFFFF" } },
  planeside: { chip: "teal", fill: { 0: "#FFFFFF", 1: "#EE3E33", 2: "#8CC4EE" } },
  carside: { chip: "yellow", fill: { 0: "#EE3E33", 1: "#FFFFFF", 2: "#FFFFFF", 3: "#FFFFFF", 4: "#FFFFFF" } },
  forkknife: { chip: "orange", fill: { 0: "#FFD426", 2: "#FFD426", 3: "#8CC4EE", 4: "#8CC4EE" } },
  burger: { chip: "orange", fill: { 0: "#FFC93C", 2: "#8B5A3C", 3: "#FFC93C" }, stroke: { 1: "#3FA34D" } },
  pizza: { chip: "rose", fill: { 0: "#FFD426", 1: "#FF9500", 2: "#EE3E33", 3: "#EE3E33" } },
  cake: { chip: "pink", fill: { 0: "#FFFFFF", 1: "#FF9EC4", 2: "#EE3E33" } },
};
// 新增的圖示（24×24，跟其他線條圖示同一個格子）
// 氣球：球、綁口、線、反光；叉子：叉頭、中間的齒、叉柄；飲料杯：杯身、杯蓋、吸管、珍珠
// 水果：蘋果、草莓、葡萄、西瓜、柳橙、櫻桃（果實塗色，葉子塗綠）；雨靴：靴身、鞋底、靴口；夾腳拖：鞋底、夾帶
// 交通：小火車、捷運、飛機（俯視、側面）、小汽車（側面）
// 餐飲：刀叉、漢堡、披薩、蛋糕
const EXTRA_ICON_SVGS = {
  balloon: '<path d="M12 2.8c3.9 0 6.6 2.9 6.6 6.6s-3.2 6.3-6.6 7.3c-3.4-1-6.6-3.6-6.6-7.3S8.1 2.8 12 2.8Z"/><path d="M10.8 18.4 12 16.7l1.2 1.7Z"/><path d="M12 18.4c-1.6 1.4 1.6 2.4 0 4.2"/><path d="M8.6 8.4c.3-1.5 1.3-2.5 2.6-2.8"/>',
  fork: '<path d="M8.5 2.8v5.4a3.5 3.5 0 0 0 7 0V2.8"/><path d="M12 2.8v5.4"/><path d="M10.8 11.6h2.4l-.3 8.9a.9.9 0 0 1-1.8 0Z"/>',
  drink: '<path d="M6.8 9.4h10.4l-1.3 10.9a1.6 1.6 0 0 1-1.6 1.4H9.7a1.6 1.6 0 0 1-1.6-1.4Z"/><path d="M5.8 9.4h12.4V8a1.8 1.8 0 0 0-1.8-1.8H7.6A1.8 1.8 0 0 0 5.8 8Z"/><path d="M12.8 6.2 14.6 2.4h2.6"/><circle cx="10" cy="18.2" r=".9" fill="currentColor"/><circle cx="12.3" cy="19.2" r=".9" fill="currentColor"/><circle cx="14.4" cy="17.8" r=".9" fill="currentColor"/>',
  apple: '<path d="M12 7.6c-1.6-1.1-4.6-1.3-6.2.6-2 2.3-1.3 6.7.6 9.6 1.4 2.1 3 3 4.2 2.4.9-.4 1.9-.4 2.8 0 1.2.6 2.8-.3 4.2-2.4 1.9-2.9 2.6-7.3.6-9.6-1.6-1.9-4.6-1.7-6.2-.6Z"/><path d="M12 7.6c0-1.8.6-3.2 1.8-4.2"/><path d="M13.4 5c1.2-1.5 3.2-1.8 4.6-1.1-.6 1.6-2.4 2.4-4.6 1.1Z"/>',
  strawberry: '<path d="M12 20.6c-3.2-1.6-6.6-5.6-6.6-9.2 0-2 1.6-3.3 3.6-3.3 1.2 0 2.2.4 3 .9.8-.5 1.8-.9 3-.9 2 0 3.6 1.3 3.6 3.3 0 3.6-3.4 7.6-6.6 9.2Z"/><path d="M8.4 8.4 7.4 5.6l3 1L12 4.2l1.6 2.4 3-1-1 2.8Z"/><circle cx="9.8" cy="12" r=".7" fill="currentColor"/><circle cx="14.2" cy="12" r=".7" fill="currentColor"/><circle cx="12" cy="15.2" r=".7" fill="currentColor"/>',
  grape: '<circle cx="7.6" cy="9.4" r="2.8"/><circle cx="12" cy="9.4" r="2.8"/><circle cx="16.4" cy="9.4" r="2.8"/><circle cx="9.8" cy="14" r="2.8"/><circle cx="14.2" cy="14" r="2.8"/><circle cx="12" cy="18.6" r="2.8"/><path d="M12 6.6V3.4"/><path d="M12 4.8c1.4-1.6 3.6-1.9 5-1-1 1.6-3 2.1-5 1Z"/>',
  watermelon: '<path d="M2.4 8.4h19.2a9.6 9.6 0 0 1-19.2 0Z"/><path d="M4.6 8.4h14.8a7.4 7.4 0 0 1-14.8 0Z"/><circle cx="9.4" cy="11" r=".8" fill="currentColor"/><circle cx="12" cy="13" r=".8" fill="currentColor"/><circle cx="14.6" cy="11" r=".8" fill="currentColor"/>',
  orange: '<circle cx="12" cy="13.6" r="7"/><path d="M12 6.6c.3-1.9 1.9-3 3.8-2.7-.3 1.9-1.9 3-3.8 2.7Z"/><path d="M8.4 11.4c.4-1.2 1.3-2.1 2.4-2.5"/>',
  cherry: '<circle cx="8" cy="16.4" r="3"/><circle cx="16" cy="15.4" r="3"/><path d="M8 13.4c.8-4 2.4-7 5.2-9"/><path d="M16 12.4c-.6-3.6-1.4-6.2-2.8-8"/><path d="M13.2 4.4c1.4-1.3 3.6-1.1 4.8.2-1.4 1.1-3.4 1-4.8-.2Z"/>',
  rainboot: '<path d="M6 3.4h6.2v9.8l4.2 1.4c2.4.8 4 2 4 3.4H6Z"/><path d="M5.6 18h15v1.2c0 .8-.6 1.4-1.4 1.4H7c-.8 0-1.4-.6-1.4-1.4Z"/><path d="M5.2 3.4h7.8"/>',
  flipflop: '<path d="M12 2.6c3 0 4.6 2.6 4.6 6 0 2.2-.6 3.6-.6 5.4 0 2.2 1.2 3.6 1.2 5.4 0 1.8-2 2.8-5.2 2.8s-5.2-1-5.2-2.8c0-1.8 1.2-3.2 1.2-5.4 0-1.8-.6-3.2-.6-5.4 0-3.4 1.6-6 4.6-6Z"/><path d="M12 6.4 8.2 11.8M12 6.4l3.8 5.4"/>',
  steamtrain: '<path d="M3 6.6h6.4v9.6H3Z"/><path d="M9.4 10h9c1 0 1.8.8 1.8 1.8v4.4H9.4Z"/><path d="M14.4 10V5.6h3v4.4"/><circle cx="6.6" cy="17.4" r="2.4"/><circle cx="15.4" cy="17.4" r="2.4"/>',
  metro: '<rect x="5" y="3.4" width="14" height="14.6" rx="3.6"/><path d="M7.4 6.2h9.2v5H7.4Z"/><path d="M5 13.6h14"/><circle cx="8.4" cy="15.8" r=".9" fill="currentColor"/><circle cx="15.6" cy="15.8" r=".9" fill="currentColor"/><path d="M8 18l-2 2.6M16 18l2 2.6"/>',
  plane: '<path d="M12 2.6c.9 0 1.5.9 1.5 2.2v4.6l7 4.2v2l-7-2v4l2.2 1.8v1.6L12 20.2l-3.7.8v-1.6l2.2-1.8v-4l-7 2v-2l7-4.2V4.8c0-1.3.6-2.2 1.5-2.2Z"/>',
  planeside: '<path d="M2.6 12.8c0-1.2 1-2.2 2.2-2.2h12.4c2.4 0 4.4 1.4 4.4 3s-2 3-4.4 3H6.6c-2.2 0-4-1.6-4-3.8Z"/><path d="M4.4 10.6 3 4.8h3l3.6 5.8"/><path d="M9.6 14.6 7.2 20.4h3.2l4.6-5.8"/>',
  carside: '<path d="M2.8 15.8v-2.6c0-1 .6-1.8 1.6-2.1l2.6-.7 2.2-3c.4-.5 1-.8 1.6-.8h4.6c.6 0 1.2.3 1.6.8l2.4 3 1.4.3c.9.2 1.6 1 1.6 2v3.1Z"/><path d="M10.6 8.4h1.8v2.6H8.8Z"/><path d="M14.4 8.4h.8c.3 0 .6.1.8.4l1.6 2.2h-3.2Z"/><circle cx="7.4" cy="16.2" r="2.1"/><circle cx="16.6" cy="16.2" r="2.1"/>',
  forkknife: '<path d="M3.8 2.8v5.4c0 1.8 1.4 3.2 3.4 3.2s3.4-1.4 3.4-3.2V2.8"/><path d="M7.2 2.8v4.6"/><path d="M5.9 12.2h2.6v7.6a1.3 1.3 0 0 1-2.6 0Z"/><path d="M18.6 2.8c-2.8 1.4-4.4 4.6-4.4 8.6h4.4Z"/><path d="M15.9 12.2h2.6v7.6a1.3 1.3 0 0 1-2.6 0Z"/>',
  burger: '<path d="M4 10.4c0-3.6 3.6-6 8-6s8 2.4 8 6Z"/><path d="M3.6 12.4c1.4-1 2.8 1 4.2 0s2.8 1 4.2 0 2.8 1 4.2 0 2.8 1 4.2 0"/><path d="M4 13.8h16v2.6H4Z"/><path d="M4.4 17.6h15.2c0 1.6-1.4 2.8-3.2 2.8H7.6c-1.8 0-3.2-1.2-3.2-2.8Z"/>',
  pizza: '<path d="M12 21 3.6 6.4c2.6-1.6 5.4-2.4 8.4-2.4s5.8.8 8.4 2.4Z"/><path d="M3.6 6.4c2.6-1.6 5.4-2.4 8.4-2.4s5.8.8 8.4 2.4l-1.6 2.8c-2.2-1.2-4.4-1.8-6.8-1.8s-4.6.6-6.8 1.8Z"/><circle cx="10.4" cy="11.6" r="1.3"/><circle cx="13" cy="15.4" r="1.2"/>',
  cake: '<path d="M3.6 10.6h16.8v9.4H3.6Z"/><path d="M3.6 10.6 13.4 6h7v4.6Z"/><circle cx="16.6" cy="4.2" r="2.2"/>',
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
// 貼紙底色跟它放上去的卡片同色時看不出來：on 是卡片的顏色（名稱如 "orange"，或色碼），同色就回傳 true
function stickerClash(key, on) {
  if (!on) return false;
  const chip = (STICKERS[key] || { chip: "yellow" }).chip;
  return on === chip || String(on).toLowerCase() === STICKER_CHIP[chip].toLowerCase();
}
// on：放在什麼顏色的卡片上（可省略）；跟貼紙底色一樣時底色改白色
function stickerSVG(key, svgs, on) {
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
    + `<path d="${blobPathD(22, 22, STICKER_BLOBS[h % 4])}" transform="translate(1 1) rotate(${deg} 11 11)" fill="${stickerClash(key, on) ? "#FFFFFF" : STICKER_CHIP[spec.chip]}"/>`
    + `<g transform="translate(4.4 4.4) scale(.633)" stroke="${STICKER_INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</g>`
    + `</svg>`;
}
