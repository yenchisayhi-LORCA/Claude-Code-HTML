// 獎狀畫布繪製：比照根目錄 js/image-card.js 的做法，純手動 canvas 指令重畫整張獎狀，
// 不用「把 HTML 轉成 canvas」（那條路在 Chromium 會被判定成 tainted canvas 而無法匯出，
// image-card.js 的註解裡已經解釋過原因，這裡直接沿用手動繪圖的作法）。
//
// 色票／字型跟著 css/style.css 的設計系統走：Gluten 給數字、Noto Sans TC 給中文，
// 手繪星星/獎盃直接用 index.html 內嵌 sprite 裡同一份 path data 畫（Path2D），
// 不用 emoji，維持跟畫面其他地方一致的塗鴉童趣風。

const W = 1000;
const H = 700;
const FONT = `'Noto Sans TC', sans-serif`;
const NUM_FONT = `'Gluten', 'Noto Sans TC', sans-serif`;

const INK_NAVY = '#262261';
const TOMATO_RED = '#EE3E33';
const SUN_YELLOW = '#FFD426';
const TEXT_BODY = '#5A5788';
const TEXT_FAINT = '#9E9BC0';
const CREAM_PAPER = '#FFFCEF';
const PALETTE = ['#FFD426', '#3F6FD1', '#EE3E33', '#4FD2C2', '#FF9EC4'];

// 跟 index.html sprite 同一份 path data（viewBox 0 0 48 48）
const STAR_PATH = new Path2D(
  'M24 6c1.6 1 3.4 6.6 5.2 11.6 5.4.4 11 .8 12 1.6.9.9-3.6 4.6-7.6 8.4 1.2 5.2 2.7 10.8 2.1 11.6-.7.8-5.8-2.1-11.7-5.3-5.6 3-10.8 6.1-11.6 5.3-.8-.8.7-6.3 2-11.6-4-3.8-8.5-7.5-7.6-8.4.9-.8 6.5-1.2 12-1.6C20.5 12.6 22.4 7 24 6Z'
);
// 獎盃圖示是線條畫（stroke，不是 fill），跟 sprite 裡的 ic-trophy 同一份 path
const TROPHY_STROKE_PATH = new Path2D(
  'M15.5 9.5c5.5-.8 11.5-.8 17 0 .5 12-2.5 19-8.5 19s-9-7-8.5-19Z M15.5 13c-3-.5-5 .5-5 3.5s2 5 5 5.5M32.5 13c3-.5 5 .5 5 3.5s-2 5-5 5.5 M24 28.5V35 M16 40c5.5-.8 10.5-.8 16 0-5.5.8-10.5.8-16 0Z'
);
const MASCOT_HEAD_PATH = new Path2D('M30 3c16 0 28 14 28 31 0 14-12 23-28 23S2 48 2 34C2 17 14 3 30 3Z');
const MASCOT_MOUTH_PATH = new Path2D('M22 39c4 5 13 5 17-1');

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawStar(ctx, cx, cy, size, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size / 24, size / 24);
  ctx.translate(-24, -24);
  ctx.fillStyle = color;
  ctx.fill(STAR_PATH);
  ctx.restore();
}

function drawTrophy(ctx, cx, cy, size, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size / 48, size / 48);
  ctx.translate(-24, -24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(TROPHY_STROKE_PATH);
  ctx.restore();
}

function drawBackground(ctx) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#FFFCEF');
  grad.addColorStop(0.5, '#FFF6D9');
  grad.addColorStop(1, '#EAF2FE');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const deco = [
    { x: 65, y: 75, r: 15 }, { x: 925, y: 90, r: 19 }, { x: 80, y: 610, r: 17 },
    { x: 930, y: 615, r: 15 }, { x: 500, y: 45, r: 11 }, { x: 45, y: 360, r: 11 }, { x: 960, y: 360, r: 13 },
  ];
  ctx.globalAlpha = 0.85;
  deco.forEach((d, i) => drawStar(ctx, d.x, d.y, d.r * 2, PALETTE[i % PALETTE.length]));
  ctx.globalAlpha = 1;
}

function drawFrame(ctx) {
  ctx.lineWidth = 14;
  ctx.strokeStyle = TOMATO_RED;
  roundRect(ctx, 28, 28, W - 56, H - 56, 36);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,252,239,0.9)';
  roundRect(ctx, 44, 44, W - 88, H - 88, 28);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = SUN_YELLOW;
  roundRect(ctx, 44, 44, W - 88, H - 88, 28);
  ctx.stroke();
}

function drawPhoto(ctx, img, cx, cy, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const iw = img.width || img.naturalWidth;
  const ih = img.height || img.naturalHeight;
  const scale = Math.max((radius * 2) / iw, (radius * 2) / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
  drawPhotoRing(ctx, cx, cy, radius);
}

// 沒有照片時的預設頭像：跟畫面其他地方同一隻色塊小怪獸（圓潤色塊 + 圓點眼睛 + 微笑線）
function drawMascotPlaceholder(ctx, cx, cy, radius) {
  const scale = (radius * 2) / 60;
  ctx.save();
  ctx.translate(cx - radius, cy - radius);
  ctx.scale(scale, scale);
  ctx.fillStyle = SUN_YELLOW;
  ctx.fill(MASCOT_HEAD_PATH);
  ctx.fillStyle = INK_NAVY;
  ctx.beginPath(); ctx.arc(21, 30, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(39, 30, 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK_NAVY;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.stroke(MASCOT_MOUTH_PATH);
  ctx.restore();
  drawPhotoRing(ctx, cx, cy, radius);
}

function drawPhotoRing(ctx, cx, cy, radius) {
  ctx.lineWidth = 8;
  ctx.strokeStyle = SUN_YELLOW;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
  ctx.stroke();
  const points = 10;
  for (let i = 0; i < points; i++) {
    const a = ((Math.PI * 2) / points) * i;
    const x = cx + Math.cos(a) * (radius + 6);
    const y = cy + Math.sin(a) * (radius + 6);
    drawStar(ctx, x, y, 12, PALETTE[i % PALETTE.length]);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function renderCertificateCanvas({ kidName, tierTitle, threshold, stars, date, photoDataUrl }) {
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch { /* 字型載入失敗就直接用退回字型畫，不擋流程 */ }
  }

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  drawBackground(ctx);
  drawFrame(ctx);

  drawTrophy(ctx, W / 2, 78, 44, TOMATO_RED);

  ctx.fillStyle = INK_NAVY;
  ctx.font = `900 30px ${FONT}`;
  ctx.fillText('獎　狀', W / 2, 128);

  ctx.fillStyle = TOMATO_RED;
  ctx.font = `900 42px ${FONT}`;
  ctx.fillText(tierTitle || '星星小達人', W / 2, 178);

  const photoCX = W / 2;
  const photoCY = 320;
  const photoR = 110;
  if (photoDataUrl) {
    try {
      const img = await loadImage(photoDataUrl);
      drawPhoto(ctx, img, photoCX, photoCY, photoR);
    } catch {
      drawMascotPlaceholder(ctx, photoCX, photoCY, photoR);
    }
  } else {
    drawMascotPlaceholder(ctx, photoCX, photoCY, photoR);
  }

  ctx.fillStyle = INK_NAVY;
  ctx.font = `900 36px ${FONT}`;
  ctx.fillText(kidName || '小朋友', W / 2, 490);

  {
    // 三段文字（前段中文／數字用 Gluten／後段中文）合起來置中，用 measureText 算寬度組合位置，
    // 這樣不管星星數是幾位數都不會偏掉。
    const segFont = `500 24px ${FONT}`;
    const numFont = `800 26px ${NUM_FONT}`;
    const seg1 = `累積達到 ${threshold} 顆星星，目前擁有 `;
    const seg2 = `${stars}`;
    const seg3 = ' 顆';
    ctx.font = segFont;
    const w1 = ctx.measureText(seg1).width;
    ctx.font = numFont;
    const w2 = ctx.measureText(seg2).width;
    ctx.font = segFont;
    const w3 = ctx.measureText(seg3).width;
    let x = W / 2 - (w1 + w2 + w3) / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = TEXT_BODY;
    ctx.font = segFont;
    ctx.fillText(seg1, x, 530);
    x += w1;
    ctx.fillStyle = TOMATO_RED;
    ctx.font = numFont;
    ctx.fillText(seg2, x, 530);
    x += w2;
    ctx.fillStyle = TEXT_BODY;
    ctx.font = segFont;
    ctx.fillText(seg3, x, 530);
    ctx.textAlign = 'center';
  }

  ctx.fillStyle = TEXT_FAINT;
  ctx.font = `500 18px ${FONT}`;
  ctx.fillText(date, W / 2, H - 60);

  ctx.fillStyle = INK_NAVY;
  ctx.font = `900 16px ${FONT}`;
  ctx.fillText('樂媗&琂熙的獎勵紀錄本', W / 2, H - 36);

  return canvas;
}

export function downloadCertificatePng(canvas, filename = '獎狀.png') {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

export function printCertificateImage(canvas) {
  const dataUrl = canvas.toDataURL('image/png');
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(
    `<!doctype html><html><head><title>列印獎狀</title><style>
      body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:${CREAM_PAPER}}
      img{max-width:100%;max-height:100vh}
      @media print { body{height:auto} }
    </style></head><body><img src="${dataUrl}" onload="window.print()"></body></html>`
  );
  win.document.close();
}
