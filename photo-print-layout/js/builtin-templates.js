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
      { id: 'p1', x: 0.08, y: 0.35, w: 0.84, h: 0.5, radius: 0.06, rotationDeg: 0 },
    ],
  },
  {
    id: 'builtin-t2',
    name: '雙寶並排',
    printSize: '4x6',
    canvasW: 1200,
    canvasH: 1800,
    background: `${BASE}t2.png`,
    slots: [
      { id: 'p1', x: 0.08, y: 0.18, w: 0.84, h: 0.35, radius: 0.0667, rotationDeg: 0 },
      { id: 'p2', x: 0.08, y: 0.5566666666666666, w: 0.84, h: 0.35, radius: 0.0667, rotationDeg: 0 },
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
      { id: 'p1', x: 0.08, y: 0.21666666666666667, w: 0.84, h: 0.37333333333333335, radius: 0.0714, rotationDeg: 0 },
      { id: 'p2', x: 0.08, y: 0.6133333333333333, w: 0.4075, h: 0.27166666666666667, radius: 0.0798, rotationDeg: 0 },
      { id: 'p3', x: 0.5125, y: 0.6133333333333333, w: 0.4075, h: 0.27166666666666667, radius: 0.0798, rotationDeg: 0 },
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
      { id: 'p2', x: 0.5375, y: 0.6133333333333333, w: 0.375, h: 0.25, radius: 0.08, rotationDeg: 0 },
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
      { id: 'p2', x: 0.08, y: 0.39166666666666666, w: 0.4075, h: 0.36666666666666664, radius: 0.0736, rotationDeg: 0 },
      { id: 'p3', x: 0.5125, y: 0.39166666666666666, w: 0.4075, h: 0.36666666666666664, radius: 0.0736, rotationDeg: 0 },
    ],
  },
];

export function getBuiltinTemplate(id) {
  return BUILTIN_TEMPLATES.find((t) => t.id === id) || null;
}
