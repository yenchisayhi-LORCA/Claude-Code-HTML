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

// blob: { tl, tr, br, bl } 四個角各自的 [水平半徑比例, 垂直半徑比例]（0~0.5，以框的 w/h 為基準），
// 對應 CSS 多值 border-radius 做出的「不規則有機造型」（例如花園寫真款的照片框）。
// 四個角各用一段橢圓弧，弧之間用直線相接，畫法跟 CSS 的橢圓圓角完全對應。
function blobRectPath(ctx, x, y, w, h, blob) {
  let tlx = blob.tl[0] * w, tly = blob.tl[1] * h;
  let trx = blob.tr[0] * w, trY = blob.tr[1] * h;
  let brx = blob.br[0] * w, brY = blob.br[1] * h;
  let blx = blob.bl[0] * w, blY = blob.bl[1] * h;
  // CSS 圓角重疊修正：某條邊相鄰兩角的半徑加起來超過那條邊本身的長度時（花園寫真這種
  // 刻意誇張的不規則造型很容易踩到），瀏覽器算 border-radius 時全部圓角會等比例縮小到
  // 剛好貼合，這裡照搬同一套規則，畫出來的比例才會跟設計稿量出來的百分比數字一致。
  const f = Math.min(1, w / (tlx + trx), w / (blx + brx), h / (tly + blY), h / (trY + brY));
  if (f < 1) {
    tlx *= f; tly *= f; trx *= f; trY *= f; brx *= f; brY *= f; blx *= f; blY *= f;
  }
  const HALF_PI = Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(x + tlx, y);
  ctx.lineTo(x + w - trx, y);
  ctx.ellipse(x + w - trx, y + trY, trx, trY, 0, -HALF_PI, 0);
  ctx.lineTo(x + w, y + h - brY);
  ctx.ellipse(x + w - brx, y + h - brY, brx, brY, 0, 0, HALF_PI);
  ctx.lineTo(x + blx, y + h);
  ctx.ellipse(x + blx, y + h - blY, blx, blY, 0, HALF_PI, Math.PI);
  ctx.lineTo(x, y + tly);
  ctx.ellipse(x + tlx, y + tly, tlx, tly, 0, Math.PI, Math.PI * 1.5);
  ctx.closePath();
}

function shapePath(ctx, x, y, w, h, shape) {
  if (shape.blob) blobRectPath(ctx, x, y, w, h, shape.blob);
  else roundRectPath(ctx, x, y, w, h, (shape.radius || 0) * Math.min(w, h));
}

// shape: { radius (0~0.5，以 min(rw,rh) 為基準的圓角比例；0.5 = 正方形變圓形), rotationDeg }。
// 兩者都跟解析度無關，可以直接沿用同一份樣板定義畫在任何尺寸的 canvas 上。
// 有旋轉角度時，整個框（含框內的照片）繞框中心旋轉，對應設計稿理「整張拍立得卡片歪一個角度」
// 這種效果——旋轉中心固定在框中心，跟框裡的照片一起轉，不會走位。
export function drawPhotoInRect(ctx, rx, ry, rw, rh, photoState, shape = {}) {
  const { img, imgW, imgH, zoom, offX, offY } = photoState;
  const { rotationDeg = 0 } = shape;
  const { dw, dh, excessW, excessH } = computeDrawParams(rw, rh, imgW, imgH, zoom);
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const localDx = -rw / 2 - excessW / 2 - offX * (excessW / 2);
  const localDy = -rh / 2 - excessH / 2 - offY * (excessH / 2);

  ctx.save();
  ctx.translate(cx, cy);
  if (rotationDeg) ctx.rotate((rotationDeg * Math.PI) / 180);
  shapePath(ctx, -rw / 2, -rh / 2, rw, rh, shape);
  ctx.clip();
  ctx.drawImage(img, localDx, localDy, dw, dh);
  ctx.restore();
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// textDef: { x, y（文字整塊的中心點，0~1）, w（框寬，0~1，依 align 決定要用哪一邊當錨點）,
//   fontFamily, fontWeight, fontSizeFrac（以畫布高度為基準的比例）, lineHeightRatio（相對字級
//   的倍數）, color, align, rotationDeg }。跟照片框一樣是解析度無關、可以直接套用在任何尺寸。
export function drawText(ctx, w, h, textDef, value) {
  const { x, y, fontFamily, fontWeight, fontSizeFrac, lineHeightRatio, color, align, rotationDeg = 0 } = textDef;
  const fontSize = fontSizeFrac * h;
  const lineHeight = fontSize * lineHeightRatio;
  const boxW = textDef.w * w;
  const lines = String(value ?? '').split('\n');
  const totalHeight = lineHeight * lines.length;

  let anchorX = 0;
  if (align === 'left') anchorX = -boxW / 2;
  else if (align === 'right') anchorX = boxW / 2;

  ctx.save();
  ctx.translate(x * w, y * h);
  if (rotationDeg) ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textAlign = align === 'right' ? 'right' : align === 'center' ? 'center' : 'left';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    const ly = -totalHeight / 2 + lineHeight * (i + 0.5);
    ctx.fillText(line, anchorX, ly);
  });
  ctx.restore();
}

// 畫整份樣板：background 是 <img>／ImageBitmap，slots 是樣板的框定義陣列，
// slotPhotos 是跟 slots 一一對應、可能含 null 的照片狀態陣列。
// foreground（可省略）是疊在「所有照片畫完之後」最上層的裝飾圖層（例如對話泡泡、標題文字
// 設計上就是要蓋在滿版照片上面），四周留白處必須是透明的 PNG，沒有照片重疊到的樣板不需要它。
export function drawTemplate(ctx, w, h, background, slots, slotPhotos, { showPlaceholders = false, foreground = null, texts = [], textValues = {} } = {}) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  if (background) ctx.drawImage(background, 0, 0, w, h);

  slots.forEach((slot, i) => {
    const rx = slot.x * w;
    const ry = slot.y * h;
    const rw = slot.w * w;
    const rh = slot.h * h;
    const shape = { radius: slot.radius || 0, blob: slot.blob || null, rotationDeg: slot.rotationDeg || 0 };
    const photo = slotPhotos[i];
    if (photo) {
      drawPhotoInRect(ctx, rx, ry, rw, rh, photo, shape);
    } else if (showPlaceholders) {
      ctx.save();
      ctx.translate(rx + rw / 2, ry + rh / 2);
      if (shape.rotationDeg) ctx.rotate((shape.rotationDeg * Math.PI) / 180);
      shapePath(ctx, -rw / 2, -rh / 2, rw, rh, shape);
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

  texts.forEach((t) => {
    const value = textValues[t.id] ?? t.default;
    drawText(ctx, w, h, t, value);
  });
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
