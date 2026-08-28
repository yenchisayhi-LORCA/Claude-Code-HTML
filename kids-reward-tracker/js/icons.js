// 共用手繪塗鴉圖示 id 清單：對應 index.html 裡內嵌的 <symbol id="ic-x"> sprite，
// 作業清單、商店品項都從這裡選圖示。不用 emoji，一律墨藍線條圖示（見設計系統 handoff）。

export const TASK_ICONS = [
  'ic-broom', 'ic-tooth', 'ic-book', 'ic-dish', 'ic-bed', 'ic-run', 'ic-plant', 'ic-paw',
  'ic-music', 'ic-shirt', 'ic-bag', 'ic-star', 'ic-heart', 'ic-flower', 'ic-pencil', 'ic-sparkle',
];

export const SHOP_ICONS = [
  'ic-gift', 'ic-shop', 'ic-star', 'ic-heart', 'ic-music', 'ic-shirt', 'ic-run', 'ic-book',
  'ic-bag', 'ic-sparkle', 'ic-flower', 'ic-trophy',
];

// 運動項目沒有專屬圖示，一律用跑步圖示代表「運動」這個大類別。
export const EXERCISE_ICON = 'ic-run';

// 圖示底塊輪替色（四色）
export const CHIP_COLORS = ['#FFF0AF', '#CFDDF8', '#FBD3D0', '#C9F0E9'];

// 小孩頭像色塊輪替色（無照片時用）
export const MASCOT_COLORS = ['#FF9EC4', '#4FD2C2', '#FFD426', '#3F6FD1'];
