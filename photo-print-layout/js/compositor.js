// 畫面合成：把底稿背景 + 每個照片框裡的照片畫到同一個 canvas 上。
// 這裡的函式跟解析度無關（傳進來的 w/h 可以是預覽用的小尺寸，也可以是匯出用的滿版尺寸），
// 讓「即時預覽」跟「最終匯出」共用同一套繪圖邏輯，畫面才會完全一致。

// photoState: { img, imgW, imgH, zoom (>=1), offX, offY (各自 -1..1，0 為置中) }
// excessW/excessH（照片實際畫出尺寸超出框的量）會跟著框的解析度等比例縮放，
// 所以拖曳時只要用「當下這個 canvas 的像素位移 ÷ 當下的 excess」，
// 不管是在小的即時預覽 canvas 上拖，還是在滿版匯出解析度上拖，換算出來的 offX/offY 都一致。
export function computeDrawParams(rw, rh, imgW, imgH, zoom) {
  const baseScale = Math.max(rw / imgW, rh / imgH);
  const scale = baseScale * zoom;
  const dw = imgW * scale;
  const dh = imgH * scale;
  const excessW = Math.max(0, dw - rw);
  const excessH = Math.max(0, dh - rh);
  return { dw, dh, excessW, excessH };
}

export function drawPhotoInRect(ctx, rx, ry, rw, rh, photoState) {
  const { img, imgW, imgH, zoom, offX, offY } = photoState;
  const { dw, dh, excessW, excessH } = computeDrawParams(rw, rh, imgW, imgH, zoom);
  const dx = rx - excessW / 2 - offX * (excessW / 2);
  const dy = ry - excessH / 2 - offY * (excessH / 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rx, ry, rw, rh);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// 畫整份樣板：background 是 <img>／ImageBitmap，slots 是樣板的框定義陣列，
// slotPhotos 是跟 slots 一一對應、可能含 null 的照片狀態陣列。
export function drawTemplate(ctx, w, h, background, slots, slotPhotos, { showPlaceholders = false } = {}) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  if (background) ctx.drawImage(background, 0, 0, w, h);

  slots.forEach((slot, i) => {
    const rx = slot.x * w;
    const ry = slot.y * h;
    const rw = slot.w * w;
    const rh = slot.h * h;
    const photo = slotPhotos[i];
    if (photo) {
      drawPhotoInRect(ctx, rx, ry, rw, rh, photo);
    } else if (showPlaceholders) {
      ctx.save();
      ctx.fillStyle = 'rgba(120,120,120,0.18)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = 'rgba(90,90,90,0.6)';
      ctx.lineWidth = Math.max(1, w * 0.003);
      ctx.setLineDash([w * 0.01, w * 0.008]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    }
  });
}

export function canvasToDownload(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
}
