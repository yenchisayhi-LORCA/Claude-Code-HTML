// 內建樣板：由設計稿（童趣拼貼底稿 6 款）量測每個照片框的位置/圓角/傾斜角度後轉成資料。
// 跟使用者自建樣板不同，這些不是存在 localStorage，而是隨頁面附帶的靜態圖檔＋固定資料，
// 每次載入都一樣、也不能在編輯器裡修改（框的圓角/旋轉是這幾款設計的重點，套用簡易的
// 矩形拖曳編輯器很容易把資料改壞，所以不開放編輯，只能直接套用或當範本複製成新樣板）。

const BASE = new URL('../builtin-templates/', import.meta.url).href;

export const BUILTIN_TEMPLATES = [
  {
    id: 'builtin-t1',
    name: '陽光問候',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t1.png`,
    slots: [
      { id: 'p1', x: 0.08, y: 0.35, w: 0.84, h: 0.5, rotationDeg: 0, blob: { tl: [0.1786, 0.16], tr: [0.125, 0.2133], br: [0.1964, 0.1333], bl: [0.1429, 0.2067] } },
    ],
    texts: [
      { id: 'title', x: 0.79625, y: 0.12682291666666667, w: 0.2675, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.06333, lineHeightRatio: 0.95, color: 'rgb(38, 34, 97)', align: 'right', rotationDeg: 0, default: "HELLO\nSUNNY" },
      { id: 'date', x: 0.84375, y: 0.20614583333333333, w: 0.1725, fontFamily: `Nunito, sans-serif`, fontWeight: '700', fontSizeFrac: 0.01833, lineHeightRatio: 1.2, color: 'rgb(63, 111, 181)', align: 'right', rotationDeg: 0, default: "2026 · 08 · 29" },
      { id: 'caption', x: 0.29, y: 0.9066666666666666, w: 0.42, fontFamily: `Nunito, "Noto Sans TC", sans-serif`, fontWeight: '700', fontSizeFrac: 0.02, lineHeightRatio: 1.2, color: 'rgb(38, 34, 97)', align: 'left', rotationDeg: 0, default: "今天的天氣很好，我們去公園。" },
    ],
  },
  {
    id: 'builtin-t2',
    name: '雙寶並排',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t2.png`,
    // 新版的獅子貼紙疊在 p2 照片上面（設計上就是要蓋在照片一角），所以另外需要一張
    // 前景裝飾圖層，照片畫完之後再疊上去，貼紙才不會被照片蓋住。
    foreground: `${BASE}t2-fg.png`,
    slots: [
      { id: 'p1', x: 0.08, y: 0.18, w: 0.84, h: 0.35, rotationDeg: 0, blob: { tl: [0.1667, 0.1905], tr: [0.1042, 0.2714], br: [0.1815, 0.1571], bl: [0.119, 0.2571] } },
      { id: 'p2', x: 0.08, y: 0.5566666666666666, w: 0.84, h: 0.35, rotationDeg: 0, blob: { tl: [0.1042, 0.2524], tr: [0.1756, 0.1714], br: [0.1131, 0.2762], bl: [0.1667, 0.1667] } },
    ],
    texts: [
      { id: 'title', x: 0.499990234375, y: 0.0625, w: 0.47611375, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.05167, lineHeightRatio: 1.2, color: 'rgb(253, 253, 239)', align: 'left', rotationDeg: 0, default: "BEST FRIENDS" },
      { id: 'name', x: 0.16125, y: 0.9545833333333333, w: 0.1625, fontFamily: `Nunito, "Noto Sans TC", sans-serif`, fontWeight: '700', fontSizeFrac: 0.02167, lineHeightRatio: 1.2, color: 'rgb(38, 34, 97)', align: 'left', rotationDeg: 0, default: "姐姐與弟弟" },
      { id: 'date', x: 0.33625, y: 0.9570833333333333, w: 0.1475, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.025, lineHeightRatio: 1.2, color: 'rgb(63, 111, 181)', align: 'left', rotationDeg: 0, default: "Aug 2026" },
    ],
  },
  {
    id: 'builtin-t3',
    name: '大小格拼貼',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t3.png`,
    slots: [
      { id: 'p1', x: 0.08, y: 0.21666666666666667, w: 0.84, h: 0.37333333333333335, rotationDeg: 0, blob: { tl: [0.1756, 0.1875], tr: [0.1131, 0.2679], br: [0.1875, 0.1607], bl: [0.125, 0.2545] } },
      { id: 'p2', x: 0.08, y: 0.6133333333333333, w: 0.4075, h: 0.27166666666666667, rotationDeg: 0, blob: { tl: [0.2577, 0.184], tr: [0.1718, 0.2699], br: [0.2822, 0.1595], bl: [0.184, 0.2577] } },
      { id: 'p3', x: 0.5125, y: 0.6133333333333333, w: 0.4075, h: 0.27166666666666667, rotationDeg: 0, blob: { tl: [0.1718, 0.2577], tr: [0.2699, 0.1779], br: [0.184, 0.2761], bl: [0.2761, 0.1718] } },
    ],
    texts: [
      { id: 'title', x: 0.3425, y: 0.08849609375, w: 0.525, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.06, lineHeightRatio: 0.95, color: 'rgb(38, 34, 97)', align: 'left', rotationDeg: 0, default: "NOVEMBER" },
      { id: 'subtitle', x: 0.3425, y: 0.13532552083333332, w: 0.525, fontFamily: `Nunito, sans-serif`, fontWeight: '700', fontSizeFrac: 0.02, lineHeightRatio: 1.2, color: 'rgb(63, 111, 181)', align: 'left', rotationDeg: 0, default: "2026 · 小小畫家" },
      { id: 'caption', x: 0.2725, y: 0.9558333333333333, w: 0.385, fontFamily: `Nunito, "Noto Sans TC", sans-serif`, fontWeight: '700', fontSizeFrac: 0.01833, lineHeightRatio: 1.2, color: 'rgb(38, 34, 97)', align: 'left', rotationDeg: 0, default: "畫室的下午，三張作品完成了。" },
    ],
  },
  {
    id: 'builtin-t4',
    name: '拍立得三連',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t4.png`,
    slots: [
      { id: 'p1', x: 0.08670356750488281, y: 0.18233286539713542, w: 0.405, h: 0.20833333333333334, radius: 0.016, rotationDeg: -2.5 },
      { id: 'p2', x: 0.5081681060791016, y: 0.45448410034179687, w: 0.405, h: 0.20833333333333334, radius: 0.016, rotationDeg: 2 },
      { id: 'p3', x: 0.0870168685913086, y: 0.7287302907307943, w: 0.405, h: 0.20833333333333334, radius: 0.016, rotationDeg: -1.5 },
    ],
    texts: [
      { id: 'title', x: 0.218125, y: 0.08, w: 0.29625, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.04333, lineHeightRatio: 1, color: 'rgb(253, 253, 239)', align: 'left', rotationDeg: 0, default: "MY LITTLE\nWEEKEND" },
      { id: 'caption1', x: 0.15718833923339845, y: 0.41045644124348957, w: 0.12, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.02, lineHeightRatio: 1.2, color: 'rgb(38, 34, 97)', align: 'left', rotationDeg: -2.5, default: "早餐時間" },
      { id: 'caption2', x: 0.564471435546875, y: 0.6753204345703125, w: 0.12, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.02, lineHeightRatio: 1.2, color: 'rgb(38, 34, 97)', align: 'left', rotationDeg: 2, default: "公園散步" },
      { id: 'caption3', x: 0.1542767333984375, y: 0.9552989705403646, w: 0.12, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.02, lineHeightRatio: 1.2, color: 'rgb(38, 34, 97)', align: 'left', rotationDeg: -1.5, default: "睡前故事" },
    ],
  },
  {
    id: 'builtin-t5',
    name: '對話框',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t5.png`,
    // 對話泡泡跟標題文字設計上蓋在滿版的 p1 照片上面，所以另外需要一張前景裝飾圖層
    // （四周透明，只有這兩塊裝飾），照片畫完之後再疊上去，裝飾才不會被照片蓋住。
    foreground: `${BASE}t5-fg.png`,
    slots: [
      { id: 'p1', x: 0, y: 0, w: 1, h: 0.6833333333333333, radius: 0, rotationDeg: 0 },
      { id: 'p2', x: 0.555, y: 0.625, w: 0.375, h: 0.25, rotationDeg: 0, blob: { tl: [0.2067, 0.1467], tr: [0.1333, 0.2133], br: [0.2267, 0.1267], bl: [0.1467, 0.2] } },
    ],
    texts: [
      { id: 'bubble', x: 0.2225, y: 0.12166666666666667, w: 0.165, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.03667, lineHeightRatio: 1, color: 'rgb(38, 34, 97)', align: 'center', rotationDeg: 0, default: "我三歲\n啦！" },
      { id: 'title', x: 0.2675, y: 0.6883333333333334, w: 0.375, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.05, lineHeightRatio: 0.95, color: 'rgb(38, 34, 97)', align: 'left', rotationDeg: 0, default: "HAPPY\nBIRTHDAY" },
      { id: 'caption', x: 0.2675, y: 0.7554166666666666, w: 0.375, fontFamily: `Nunito, "Noto Sans TC", sans-serif`, fontWeight: '700', fontSizeFrac: 0.01667, lineHeightRatio: 1.2, color: 'rgb(63, 111, 181)', align: 'left', rotationDeg: 0, default: "生日蛋糕與小禮物" },
    ],
  },
  {
    id: 'builtin-t6',
    name: '相簿頁',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t6.png`,
    slots: [
      { id: 'p1', x: 0.08, y: 0.075, w: 0.4075, h: 0.27166666666666667, radius: 0.5, rotationDeg: 0 },
      { id: 'p2', x: 0.08, y: 0.39166666666666666, w: 0.4075, h: 0.36666666666666664, rotationDeg: 0, blob: { tl: [0.2699, 0.15], tr: [0.1779, 0.2091], br: [0.2945, 0.1273], bl: [0.1902, 0.2] } },
      { id: 'p3', x: 0.5125, y: 0.39166666666666666, w: 0.4075, h: 0.36666666666666664, rotationDeg: 0, blob: { tl: [0.1779, 0.2045], tr: [0.2822, 0.1409], br: [0.184, 0.2136], bl: [0.2883, 0.1318] } },
    ],
    texts: [
      { id: 'title', x: 0.76, y: 0.1756640625, w: 0.33, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.05333, lineHeightRatio: 0.95, color: 'rgb(38, 34, 97)', align: 'right', rotationDeg: 0, default: "GROWING\nUP" },
      { id: 'meta', x: 0.793125, y: 0.24424479166666666, w: 0.26375, fontFamily: `Nunito, "Noto Sans TC", sans-serif`, fontWeight: '700', fontSizeFrac: 0.01667, lineHeightRatio: 1.2, color: 'rgb(63, 111, 181)', align: 'right', rotationDeg: 0, default: "三歲七個月 · 身高 98cm" },
      { id: 'noteTitle', x: 0.535, y: 0.8289127604166666, w: 0.84, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.02833, lineHeightRatio: 1.1, color: 'rgb(253, 253, 239)', align: 'left', rotationDeg: 0, default: "今天學會自己綁鞋帶" },
      { id: 'noteSubtitle', x: 0.535, y: 0.8594921875, w: 0.84, fontFamily: `Nunito, "Noto Sans TC", sans-serif`, fontWeight: '400', fontSizeFrac: 0.015, lineHeightRatio: 1.2, color: 'rgb(253, 253, 239)', align: 'left', rotationDeg: 0, default: "記錄一件小小的第一次。" },
    ],
  },
  {
    id: 'builtin-t7',
    name: '花園寫真',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t7.png`,
    slots: [
      // blob：四個角各自的橢圓圓角比例（水平/垂直），做出不規則有機造型的照片框，
      // 花草裝飾就位在框的四角缺口，照片畫上去之後才會有「探出邊框」的效果。
      { id: 'p1', x: 0.1125, y: 0.23333333333333334, w: 0.775, h: 0.5833333333333334, rotationDeg: 0, blob: { tl: [0.32, 0.68], tr: [0.68, 0.42], br: [0.62, 0.7], bl: [0.38, 0.3] } },
    ],
    texts: [
      { id: 'title', x: 0.5, y: 0.07833333333333334, w: 0.51625, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.05667, lineHeightRatio: 1, color: 'rgb(38, 34, 97)', align: 'center', rotationDeg: 0, default: "GARDEN DAYS" },
      { id: 'subtitle', x: 0.5, y: 0.125, w: 0.15, fontFamily: `Nunito, sans-serif`, fontWeight: '700', fontSizeFrac: 0.02, lineHeightRatio: 1.2, color: 'rgb(63, 111, 181)', align: 'center', rotationDeg: 0, default: "小小探索家" },
      { id: 'caption', x: 0.5, y: 0.9383333333333334, w: 1, fontFamily: `Nunito, "Noto Sans TC", sans-serif`, fontWeight: '700', fontSizeFrac: 0.02, lineHeightRatio: 1.2, color: 'rgb(38, 34, 97)', align: 'center', rotationDeg: 0, default: "陽台上的午後時光。" },
    ],
  },
  {
    id: 'builtin-t8',
    name: '兩個瞬間',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t8.png`,
    slots: [
      { id: 'p1', x: 0.0625, y: 0.14166666666666666, w: 0.875, h: 0.39166666666666666, rotationDeg: 0, blob: { tl: [0.1, 0.0638], tr: [0.0371, 0.1404], br: [0.0886, 0.0553], bl: [0.0429, 0.1319] } },
      { id: 'p2', x: 0.0625, y: 0.56, w: 0.875, h: 0.39166666666666666, rotationDeg: 0, blob: { tl: [0.0371, 0.1319], tr: [0.0971, 0.0596], br: [0.04, 0.1404], bl: [0.0914, 0.0553] } },
    ],
    texts: [
      { id: 'title', x: 0.5, y: 0.05, w: 0.37961, fontFamily: `"Baloo 2", cursive`, fontWeight: '800', fontSizeFrac: 0.03667, lineHeightRatio: 1.2, color: 'rgb(255, 243, 222)', align: 'left', rotationDeg: 0, default: "PLAY ALL DAY" },
    ],
  },
  {
    id: 'builtin-t9',
    name: '大圓臉',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t9.png`,
    slots: [
      { id: 'p1', x: 0.05, y: 0.1, w: 0.9, h: 0.6, rotationDeg: 0, radius: 0.5 },
      { id: 'p2', x: 0.5575, y: 0.6583333333333333, w: 0.375, h: 0.25, rotationDeg: 0, blob: { tl: [0.56, 0.46], tr: [0.44, 0.54], br: [0.48, 0.46], bl: [0.52, 0.54] } },
    ],
    texts: [
      { id: 'title', x: 0.228125, y: 0.051666666666666666, w: 0.32625, fontFamily: `"Baloo 2", cursive`, fontWeight: '800', fontSizeFrac: 0.04333, lineHeightRatio: 1, color: 'rgb(27, 42, 99)', align: 'left', rotationDeg: 0, default: "HELLO, ME!" },
      { id: 'meta', x: 0.2575, y: 0.7066666666666667, w: 0.375, fontFamily: `Nunito, "Noto Sans TC", sans-serif`, fontWeight: '700', fontSizeFrac: 0.02, lineHeightRatio: 1.2, color: 'rgb(27, 42, 99)', align: 'left', rotationDeg: 0, default: "三歲七個月" },
      { id: 'metaSub', x: 0.2575, y: 0.7366666666666667, w: 0.375, fontFamily: `Nunito, "Noto Sans TC", sans-serif`, fontWeight: '700', fontSizeFrac: 0.02, lineHeightRatio: 1.2, color: 'rgb(47, 169, 124)', align: 'left', rotationDeg: 0, default: "最愛的表情" },
    ],
  },
  {
    id: 'builtin-t10',
    name: '一天三景',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t10.png`,
    slots: [
      { id: 'p1', x: 0.055, y: 0.1, w: 0.89, h: 0.3333333333333333, rotationDeg: 0, blob: { tl: [0.0899, 0.065], tr: [0.0337, 0.155], br: [0.0843, 0.06], bl: [0.0365, 0.145] } },
      { id: 'p2', x: 0.055, y: 0.46, w: 0.5, h: 0.3333333333333333, rotationDeg: 0, blob: { tl: [0.52, 0.48], tr: [0.48, 0.52], br: [0.44, 0.48], bl: [0.56, 0.52] } },
      { id: 'p3', x: 0.595, y: 0.46, w: 0.35, h: 0.3333333333333333, rotationDeg: 0, blob: { tl: [0.0857, 0.14], tr: [0.2143, 0.06], br: [0.0929, 0.15], bl: [0.2071, 0.065] } },
    ],
    texts: [
      { id: 'title', x: 0.27125, y: 0.06416666666666666, w: 0.4125, fontFamily: `"Baloo 2", cursive`, fontWeight: '800', fontSizeFrac: 0.03833, lineHeightRatio: 1.2, color: 'rgb(27, 42, 99)', align: 'left', rotationDeg: 0, default: "ONE HAPPY DAY" },
      { id: 'caption', x: 0.54375, y: 0.9520833333333333, w: 0.2375, fontFamily: `Nunito, "Noto Sans TC", sans-serif`, fontWeight: '700', fontSizeFrac: 0.01667, lineHeightRatio: 1.2, color: 'rgb(27, 42, 99)', align: 'left', rotationDeg: 0, default: "早餐 · 公園 · 睡前故事" },
    ],
  },
  {
    id: 'builtin-t11',
    name: '滿版出血',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t11.png`,
    slots: [
      // p1 刻意超出畫布邊界（x 是負的、x+w > 1）做出「出血滿版」的效果，跟畫布尺寸無關，
      // 直接沿用同一套 canvas 繪圖就會自動裁到畫布邊緣，不需要額外處理。
      { id: 'p1', x: -0.025, y: -0.016666666666666666, w: 1.05, h: 0.7333333333333333, rotationDeg: 0, blob: { tl: [0, 0], tr: [0, 0], br: [0.6, 0.26], bl: [0.6, 0.26] } },
      { id: 'p2', x: 0.6225, y: 0.6583333333333333, w: 0.3125, h: 0.20833333333333334, rotationDeg: 0, radius: 0.5 },
    ],
    texts: [
      { id: 'title', x: 0.3075, y: 0.8183333333333334, w: 0.475, fontFamily: `"Baloo 2", cursive`, fontWeight: '800', fontSizeFrac: 0.05167, lineHeightRatio: 1, color: 'rgb(245, 197, 24)', align: 'left', rotationDeg: 0, default: "GROWING\nUP FAST" },
      { id: 'subtitle', x: 0.3075, y: 0.8879166666666667, w: 0.475, fontFamily: `Nunito, "Noto Sans TC", sans-serif`, fontWeight: '700', fontSizeFrac: 0.01667, lineHeightRatio: 1.2, color: 'rgb(255, 251, 239)', align: 'left', rotationDeg: 0, default: "2026 夏天 · 身高 98cm" },
    ],
  },
  {
    id: 'builtin-t12',
    name: '雙拱門',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t12.png`,
    slots: [
      { id: 'p1', x: 0.06, y: 0.13333333333333333, w: 0.425, h: 0.5166666666666667, rotationDeg: 0, blob: { tl: [0.5, 0.2742], tr: [0.5, 0.2742], br: [0.1176, 0.0645], bl: [0.1176, 0.0645] } },
      { id: 'p2', x: 0.515, y: 0.13333333333333333, w: 0.425, h: 0.5166666666666667, rotationDeg: 0, blob: { tl: [0.5, 0.2742], tr: [0.5, 0.2742], br: [0.1176, 0.0645], bl: [0.1176, 0.0645] } },
      // p3：橢圓（水平/垂直半徑各佔框寬高的一半但兩者不相等），必須用 blob 才能畫成真正的
      // 橢圓，用單一數值的 radius 會變成兩端是半圓、中間是直邊的「藥丸形」。
      { id: 'p3', x: 0.06, y: 0.6833333333333333, w: 0.88, h: 0.18333333333333332, rotationDeg: 0, blob: { tl: [0.5, 0.5], tr: [0.5, 0.5], br: [0.5, 0.5], bl: [0.5, 0.5] } },
    ],
    texts: [
      { id: 'title', x: 0.5, y: 0.04583333333333333, w: 0.55765625, fontFamily: `"Baloo 2", cursive`, fontWeight: '800', fontSizeFrac: 0.035, lineHeightRatio: 1.2, color: 'rgb(253, 235, 227)', align: 'left', rotationDeg: 0, default: "LITTLE ADVENTURES" },
    ],
  },
  {
    id: 'builtin-t13',
    name: '生日派對',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t13.png`,
    slots: [
      { id: 'p1', x: 0.125, y: 0.25, w: 0.75, h: 0.5333333333333333, rotationDeg: 0, blob: { tl: [0.5, 0.4688], tr: [0.5, 0.4688], br: [0.0667, 0.0625], bl: [0.0667, 0.0625] } },
      { id: 'p2', x: 0.08, y: 0.8, w: 0.2625, h: 0.175, radius: 0.5, rotationDeg: 0 },
    ],
    texts: [
      { id: 'labelTop', x: 0.5, y: 0.13458333333333333, w: 1, fontFamily: `"Baloo 2", cursive`, fontWeight: '800', fontSizeFrac: 0.04333, lineHeightRatio: 1.2, color: 'rgb(255, 246, 236)', align: 'center', rotationDeg: 0, default: "HAPPY" },
      { id: 'title', x: 0.5, y: 0.185, w: 1, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.08667, lineHeightRatio: 1, color: 'rgb(255, 201, 60)', align: 'center', rotationDeg: 0, default: "Birthday" },
      { id: 'caption', x: 0.445, y: 0.9604166666666667, w: 0.14, fontFamily: `Nunito, "Noto Sans TC", sans-serif`, fontWeight: '700', fontSizeFrac: 0.01667, lineHeightRatio: 1.2, color: 'rgb(255, 246, 236)', align: 'left', rotationDeg: 0, default: "小壽星 · 3 歲" },
    ],
  },
  {
    id: 'builtin-t14',
    name: '彩虹雲朵',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t14.png`,
    slots: [
      { id: 'p1', x: 0.075, y: 0.3, w: 0.85, h: 0.5666666666666667, radius: 0.5, rotationDeg: 0 },
    ],
    texts: [
      { id: 'title', x: 0.5, y: 0.30416666666666664, w: 1, fontFamily: `"Baloo 2", cursive`, fontWeight: '800', fontSizeFrac: 0.03667, lineHeightRatio: 1.2, color: 'rgb(255, 246, 236)', align: 'center', rotationDeg: 0, default: "今天也是好天氣" },
    ],
  },
  {
    id: 'builtin-t15',
    name: '小公主皇冠',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t15.png`,
    slots: [
      { id: 'p1', x: 0.055, y: 0.20833333333333334, w: 0.5875, h: 0.39166666666666666, rotationDeg: 0, blob: { tl: [0.58, 0.52], tr: [0.42, 0.56], br: [0.48, 0.44], bl: [0.52, 0.48] } },
      { id: 'p2', x: 0.62, y: 0.2916666666666667, w: 0.33, h: 0.33, rotationDeg: 0, blob: { tl: [0.5, 0.5], tr: [0.5, 0.5], br: [0.5, 0.5], bl: [0.5, 0.5] } },
      { id: 'p3', x: 0.075, y: 0.65, w: 0.85, h: 0.275, radius: 0.5, rotationDeg: 0 },
    ],
    texts: [
      { id: 'title', x: 0.5875, y: 0.12, w: 0.65, fontFamily: `"Baloo 2", cursive`, fontWeight: '800', fontSizeFrac: 0.055, lineHeightRatio: 1, color: 'rgb(240, 86, 140)', align: 'left', rotationDeg: 0, default: "MY LITTLE\nPRINCESS" },
      { id: 'subtitle', x: 0.5875, y: 0.1925, w: 0.65, fontFamily: `Nunito, "Noto Sans TC", sans-serif`, fontWeight: '700', fontSizeFrac: 0.01833, lineHeightRatio: 1.2, color: 'rgb(55, 55, 122)', align: 'left', rotationDeg: 0, default: "2026 · 三歲生日快樂" },
      { id: 'caption', x: 0.22, y: 0.9508333333333333, w: 0.275, fontFamily: `Nunito, "Noto Sans TC", sans-serif`, fontWeight: '700', fontSizeFrac: 0.01833, lineHeightRatio: 1.2, color: 'rgb(55, 55, 122)', align: 'left', rotationDeg: 0, default: "最喜歡的小裙子與皇冠" },
    ],
  },
  {
    id: 'builtin-t16',
    name: '派對拍立得',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t16.png`,
    slots: [
      { id: 'p1', x: 0.06641525268554688, y: 0.17738390604654947, w: 0.505, h: 0.25333333333333335, radius: 0, rotationDeg: -3 },
      { id: 'p2', x: 0.40344589233398437, y: 0.49609855651855467, w: 0.505, h: 0.25333333333333335, radius: 0, rotationDeg: 2.5 },
      { id: 'p3', x: 0.0425, y: 0.6833333333333333, w: 0.4, h: 0.26666666666666666, radius: 0.5, rotationDeg: 0 },
    ],
    texts: [
      { id: 'title', x: 0.5, y: 0.07541666666666667, w: 1, fontFamily: `"Baloo 2", cursive`, fontWeight: '800', fontSizeFrac: 0.04833, lineHeightRatio: 1.2, color: 'rgb(255, 246, 236)', align: 'center', rotationDeg: 0, default: "PARTY TIME!" },
      { id: 'caption1', x: 0.13172260284423828, y: 0.45453776041666666, w: 0.0975, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.02167, lineHeightRatio: 1.2, color: 'rgb(240, 86, 140)', align: 'left', rotationDeg: -3, default: "吹蠟燭" },
      { id: 'caption2', x: 0.44797966003417966, y: 0.7605989583333334, w: 0.0975, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.02167, lineHeightRatio: 1.2, color: 'rgb(89, 169, 239)', align: 'left', rotationDeg: 2.5, default: "拆禮物" },
      { id: 'caption3', x: 0.5575, y: 0.8, w: 0.125, fontFamily: `Nunito, "Noto Sans TC", sans-serif`, fontWeight: '700', fontSizeFrac: 0.01667, lineHeightRatio: 1.5, color: 'rgb(55, 55, 122)', align: 'right', rotationDeg: 0, default: "三張最愛的\n派對瞬間" },
    ],
  },
  {
    id: 'builtin-t17',
    name: '氣球動物園',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t17.png`,
    slots: [
      { id: 'p1', x: 0.055, y: 0.175, w: 0.45, h: 0.3416666666666667, rotationDeg: 0, blob: { tl: [0.5, 0.5], tr: [0.5, 0.5], br: [0.46, 0.46], bl: [0.46, 0.46] } },
      { id: 'p2', x: 0.545, y: 0.35833333333333334, w: 0.4125, h: 0.31333333333333335, rotationDeg: 0, blob: { tl: [0.5, 0.5], tr: [0.5, 0.5], br: [0.46, 0.46], bl: [0.46, 0.46] } },
      { id: 'p3', x: 0.075, y: 0.6366666666666667, w: 0.45, h: 0.3, radius: 0.5, rotationDeg: 0 },
    ],
    texts: [
      { id: 'title', x: 0.5, y: 0.065, w: 1, fontFamily: `"Baloo 2", cursive`, fontWeight: '800', fontSizeFrac: 0.04167, lineHeightRatio: 1.2, color: 'rgb(255, 246, 236)', align: 'center', rotationDeg: 0, default: "動物園的一天" },
      { id: 'caption', x: 0.2475, y: 0.9541666666666667, w: 0.33, fontFamily: `Nunito, "Noto Sans TC", sans-serif`, fontWeight: '700', fontSizeFrac: 0.01833, lineHeightRatio: 1.2, color: 'rgb(55, 55, 122)', align: 'left', rotationDeg: 0, default: "看到獅子、長頸鹿和好多鳥" },
    ],
  },
  {
    id: 'builtin-t18',
    name: '蛋糕慶生',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t18.png`,
    slots: [
      // p1：橢圓（700×440），水平/垂直半徑各佔框寬高一半但絕對值不同，要用 blob。
      { id: 'p1', x: 0.0625, y: 0.058333333333333334, w: 0.875, h: 0.36666666666666664, rotationDeg: 0, blob: { tl: [0.5, 0.5], tr: [0.5, 0.5], br: [0.5, 0.5], bl: [0.5, 0.5] } },
      { id: 'p2', x: 0.06, y: 0.6166666666666667, w: 0.4375, h: 0.2916666666666667, rotationDeg: 0, blob: { tl: [0.56, 0.48], tr: [0.44, 0.54], br: [0.52, 0.46], bl: [0.48, 0.52] } },
      { id: 'p3', x: 0.565, y: 0.6333333333333333, w: 0.375, h: 0.25, rotationDeg: 0, blob: { tl: [0.44, 0.54], tr: [0.56, 0.46], br: [0.48, 0.54], bl: [0.52, 0.46] } },
    ],
    texts: [
      { id: 'title', x: 0.5, y: 0.5066666666666667, w: 1, fontFamily: `"Baloo 2", cursive`, fontWeight: '800', fontSizeFrac: 0.06167, lineHeightRatio: 1, color: 'rgb(255, 122, 92)', align: 'center', rotationDeg: 0, default: "SWEET\nTHREE" },
      { id: 'subtitle', x: 0.5, y: 0.5841666666666666, w: 1, fontFamily: `Nunito, "Noto Sans TC", sans-serif`, fontWeight: '700', fontSizeFrac: 0.01833, lineHeightRatio: 1.2, color: 'rgb(55, 55, 122)', align: 'center', rotationDeg: 0, default: "生日蛋糕與許願時間" },
    ],
  },
  {
    id: 'builtin-t19',
    name: '手寫日期三連拍',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t19.png`,
    foreground: `${BASE}t19-fg.png`,
    slots: [
      { id: 'p1', x: 0.0906496810913086, y: 0.051462198893229165, w: 0.4975, h: 0.26666666666666666, radius: 0, rotationDeg: -6 },
      { id: 'p2', x: 0.38885663986206054, y: 0.2624336751302083, w: 0.4975, h: 0.26666666666666666, radius: 0, rotationDeg: 4 },
      { id: 'p3', x: 0.15137947082519532, y: 0.5322032674153646, w: 0.695, h: 0.3333333333333333, radius: 0, rotationDeg: -2 },
    ],
    texts: [
      { id: 'date', x: 0.2703303337097168, y: 0.8963916015625, w: 0.2025, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.03333, lineHeightRatio: 1.2, color: 'rgb(139, 95, 191)', align: 'left', rotationDeg: -2, default: "2013.4.13" },
    ],
  },
  {
    id: 'builtin-t20',
    name: '四格回憶明信片',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t20.png`,
    slots: [
      { id: 'p1', x: 0.06623470306396484, y: 0.04584426879882812, w: 0.3775, h: 0.2833333333333333, radius: 0, rotationDeg: -4 },
      { id: 'p2', x: 0.5260052490234375, y: 0.11607322692871094, w: 0.3775, h: 0.2833333333333333, radius: 0, rotationDeg: 3 },
      { id: 'p3', x: 0.04647724151611328, y: 0.44562889099121095, w: 0.39, h: 0.3333333333333333, radius: 0, rotationDeg: -3 },
      { id: 'p4', x: 0.49643783569335936, y: 0.5158853149414062, w: 0.415, h: 0.35, radius: 0, rotationDeg: 4 },
    ],
    texts: [
      { id: 'caption1', x: 0.16200729370117187, y: 0.34638875325520835, w: 0.15375, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.02, lineHeightRatio: 1.2, color: 'rgb(59, 111, 212)', align: 'left', rotationDeg: -4, default: "2012.8 台北" },
      { id: 'caption2', x: 0.5928033447265625, y: 0.4078572591145833, w: 0.1525, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.02, lineHeightRatio: 1.2, color: 'rgb(162, 79, 201)', align: 'left', rotationDeg: 3, default: "2012.6 香港" },
      { id: 'caption3', x: 0.15456218719482423, y: 0.7964139811197917, w: 0.1825, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.02, lineHeightRatio: 1.2, color: 'rgb(224, 138, 46)', align: 'left', rotationDeg: -3, default: "2012.6 北海道" },
      { id: 'caption4', x: 0.5544609832763672, y: 0.8735453287760416, w: 0.15, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.02, lineHeightRatio: 1.2, color: 'rgb(59, 111, 212)', align: 'left', rotationDeg: 4, default: "2013.1 高雄" },
    ],
  },
  {
    id: 'builtin-t21',
    name: '生日拼貼手帳',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t21.png`,
    slots: [
      { id: 'p1', x: 0.33325380325317383, y: 0.06287663777669271, w: 0.535, h: 0.22333333333333333, radius: 0, rotationDeg: 2 },
      { id: 'p2', x: 0.06623469352722168, y: 0.4958443196614583, w: 0.3775, h: 0.18916666666666668, radius: 0, rotationDeg: -4 },
      { id: 'p3', x: 0.4961361312866211, y: 0.4027422078450521, w: 0.4025, h: 0.3333333333333333, radius: 0, rotationDeg: 3 },
    ],
    texts: [
      { id: 'title', x: 0.16375, y: 0.07490885416666666, w: 0.2375, fontFamily: `"Baloo 2", cursive`, fontWeight: '800', fontSizeFrac: 0.03167, lineHeightRatio: 1.05, color: 'rgb(107, 66, 38)', align: 'left', rotationDeg: 0, default: "HAPPY\nBIRTHDAY" },
      { id: 'caption1', x: 0.4117122459411621, y: 0.29730305989583333, w: 0.17, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.03, lineHeightRatio: 1.2, color: 'rgb(162, 79, 201)', align: 'left', rotationDeg: 2, default: "TO ANNE" },
      { id: 'caption2', x: 0.5258076858520507, y: 0.7457474772135416, w: 0.0825, fontFamily: `"Gochi Hand", cursive`, fontWeight: '400', fontSizeFrac: 0.02167, lineHeightRatio: 1.2, color: 'rgb(224, 138, 46)', align: 'left', rotationDeg: 3, default: "TO ME" },
    ],
  },
];

export function getBuiltinTemplate(id) {
  return BUILTIN_TEMPLATES.find((t) => t.id === id) || null;
}
