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

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// shape: { radius (0~0.5，以 min(rw,rh) 為基準的圓角比例；0.5 = 正方形變圓形), rotationDeg }。
// 兩者都跟解析度無關，可以直接沿用同一份樣板定義畫在任何尺寸的 canvas 上。
// 有旋轉角度時，整個框（含框內的照片）繞框中心旋轉，對應設計稿理「整張拍立得卡片歪一個角度」
// 這種效果——旋轉中心固定在框中心，跟框裡的照片一起轉，不會走位。
export function drawPhotoInRect(ctx, rx, ry, rw, rh, photoState, shape = {}) {
  const { img, imgW, imgH, zoom, offX, offY } = photoState;
  const { radius = 0, rotationDeg = 0 } = shape;
  const { dw, dh, excessW, excessH } = computeDrawParams(rw, rh, imgW, imgH, zoom);
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const localDx = -rw / 2 - excessW / 2 - offX * (excessW / 2);
  const localDy = -rh / 2 - excessH / 2 - offY * (excessH / 2);

  ctx.save();
  ctx.translate(cx, cy);
  if (rotationDeg) ctx.rotate((rotationDeg * Math.PI) / 180);
  roundRectPath(ctx, -rw / 2, -rh / 2, rw, rh, radius * Math.min(rw, rh));
  ctx.clip();
  ctx.drawImage(img, localDx, localDy, dw, dh);
  ctx.restore();
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// 畫整份樣板：background 是 <img>／ImageBitmap，slots 是樣板的框定義陣列，
// slotPhotos 是跟 slots 一一對應、可能含 null 的照片狀態陣列。
// foreground（可省略）是疊在「所有照片畫完之後」最上層的裝飾圖層（例如對話泡泡、標題文字
// 設計上就是要蓋在滿版照片上面），四周留白處必須是透明的 PNG，沒有照片重疊到的樣板不需要它。
export function drawTemplate(ctx, w, h, background, slots, slotPhotos, { showPlaceholders = false, foreground = null } = {}) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  if (background) ctx.drawImage(background, 0, 0, w, h);

  slots.forEach((slot, i) => {
    const rx = slot.x * w;
    const ry = slot.y * h;
    const rw = slot.w * w;
    const rh = slot.h * h;
    const shape = { radius: slot.radius || 0, rotationDeg: slot.rotationDeg || 0 };
    const photo = slotPhotos[i];
    if (photo) {
      drawPhotoInRect(ctx, rx, ry, rw, rh, photo, shape);
    } else if (showPlaceholders) {
      ctx.save();
      ctx.translate(rx + rw / 2, ry + rh / 2);
      if (shape.rotationDeg) ctx.rotate((shape.rotationDeg * Math.PI) / 180);
      roundRectPath(ctx, -rw / 2, -rh / 2, rw, rh, shape.radius * Math.min(rw, rh));
      ctx.fillStyle = 'rgba(120,120,120,0.18)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,90,90,0.6)';
      ctx.lineWidth = Math.max(1, w * 0.003);
      ctx.setLineDash([w * 0.01, w * 0.008]);
      ctx.stroke();
      ctx.restore();
    }
  });

  if (foreground) ctx.drawImage(foreground, 0, 0, w, h);
}

// 一般網頁環境用 <a download> 存檔即可；如果是跑在 Claude Artifact 預覽環境裡
// （沒有真正的下載權限，<a download> 點了沒反應），改用 Artifact 提供的
// downloads 能力跳出存檔確認。window.claude 不存在時就是一般網頁，直接走 <a download>。
export async function canvasToDownload(canvas, filename) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;

  if (window.claude && typeof window.claude.use === 'function') {
    const downloads = await window.claude.use('downloads').catch(() => null);
    if (downloads) {
      try {
        await downloads.save({ filename, data: blob });
      } catch (err) {
        console.error('儲存失敗', err);
      }
      return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
