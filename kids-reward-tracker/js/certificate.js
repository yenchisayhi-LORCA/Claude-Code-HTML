// 獎狀畫布繪製：比照根目錄 js/image-card.js 的做法，純手動 canvas 指令重畫整張獎狀，
// 不用「把 HTML 轉成 canvas」（那條路在 Chromium 會被判定成 tainted canvas 而無法匯出，
// image-card.js 的註解裡已經解釋過原因，這裡直接沿用手動繪圖的作法）。

const W = 1000;
const H = 700;
const FONT = `'Zen Maru Gothic', 'Noto Sans TC', sans-serif`;

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

function drawStarPath(ctx, cx, cy, outerR, innerR, points = 5, rotation = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = rotation + (Math.PI / points) * i;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawBackground(ctx) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#FFF4E0');
  grad.addColorStop(0.5, '#FFE8F0');
  grad.addColorStop(1, '#E8F4FF');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const deco = [
    { x: 65, y: 75, r: 14, c: '#FFD166' },
    { x: 925, y: 90, r: 18, c: '#FF8FAB' },
    { x: 80, y: 610, r: 16, c: '#6EC6FF' },
    { x: 930, y: 615, r: 14, c: '#C79DFF' },
    { x: 500, y: 45, r: 10, c: '#4CD4B0' },
    { x: 45, y: 360, r: 10, c: '#FF9F68' },
    { x: 960, y: 360, r: 12, c: '#FFD166' },
  ];
  ctx.globalAlpha = 0.85;
  for (const d of deco) {
    ctx.fillStyle = d.c;
    drawStarPath(ctx, d.x, d.y, d.r, d.r * 0.45);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFrame(ctx) {
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#FF8FAB';
  roundRect(ctx, 28, 28, W - 56, H - 56, 36);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  roundRect(ctx, 44, 44, W - 88, H - 88, 28);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#FFD166';
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

function drawPhotoPlaceholder(ctx, cx, cy, radius) {
  ctx.fillStyle = '#FFE8F0';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `${radius * 0.8}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🧒', cx, cy + radius * 0.05);
  drawPhotoRing(ctx, cx, cy, radius);
}

function drawPhotoRing(ctx, cx, cy, radius) {
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#FFD166';
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
  ctx.stroke();
  const points = 10;
  for (let i = 0; i < points; i++) {
    const a = ((Math.PI * 2) / points) * i;
    const x = cx + Math.cos(a) * (radius + 6);
    const y = cy + Math.sin(a) * (radius + 6);
    ctx.fillStyle = i % 2 === 0 ? '#FF8FAB' : '#6EC6FF';
    drawStarPath(ctx, x, y, 7, 3.2);
    ctx.fill();
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

  ctx.fillStyle = '#B5495B';
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText('🏆 獎 狀 🏆', W / 2, 108);

  ctx.fillStyle = '#3B3330';
  ctx.font = `900 42px ${FONT}`;
  ctx.fillText(tierTitle || '星星小達人', W / 2, 172);

  const photoCX = W / 2;
  const photoCY = 320;
  const photoR = 110;
  if (photoDataUrl) {
    try {
      const img = await loadImage(photoDataUrl);
      drawPhoto(ctx, img, photoCX, photoCY, photoR);
    } catch {
      drawPhotoPlaceholder(ctx, photoCX, photoCY, photoR);
    }
  } else {
    drawPhotoPlaceholder(ctx, photoCX, photoCY, photoR);
  }

  ctx.fillStyle = '#3B3330';
  ctx.font = `700 36px ${FONT}`;
  ctx.fillText(kidName || '小朋友', W / 2, 490);

  ctx.fillStyle = '#6B5B54';
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText(`累積達到 ${threshold} 顆星星，目前擁有 ${stars} 顆 🌟`, W / 2, 530);

  ctx.fillStyle = '#9C8C82';
  ctx.font = `400 18px ${FONT}`;
  ctx.fillText(date, W / 2, H - 60);

  ctx.fillStyle = '#B5495B';
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText('⭐ 小孩獎勵紀錄本 ⭐', W / 2, H - 36);

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
      body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#fff}
      img{max-width:100%;max-height:100vh}
      @media print { body{height:auto} }
    </style></head><body><img src="${dataUrl}" onload="window.print()"></body></html>`
  );
  win.document.close();
}
