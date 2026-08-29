// 圖片載入／裁切共用工具。優先用 createImageBitmap() 直接從檔案解碼（不用先轉成
// base64 字串），沒有這個 API 時才退回用 blob URL 餵給 <img>（跟根目錄 js/image.js 同套策略）。

export function loadImageSource(file) {
  return new Promise((resolve, reject) => {
    (async () => {
      if (window.createImageBitmap) {
        try {
          const bitmap = await createImageBitmap(file);
          resolve({ source: bitmap, width: bitmap.width, height: bitmap.height, cleanup: () => bitmap.close() });
          return;
        } catch (err) {
          // 部分格式（例如某些 HEIC）createImageBitmap 會失敗，退回 <img> 再試一次。
        }
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight, cleanup: () => URL.revokeObjectURL(url) });
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    })();
  });
}

function coverDrawToDataURL(source, width, height, targetW, targetH, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  const scale = Math.max(targetW / width, targetH / height);
  const dw = width * scale;
  const dh = height * scale;
  const dx = (targetW - dw) / 2;
  const dy = (targetH - dh) / 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(source, dx, dy, dw, dh);
  return canvas.toDataURL('image/jpeg', quality);
}

// 把使用者上傳的底稿圖以「鋪滿裁切」(cover) 的方式，統一轉成樣板要輸出的目標解析度
// （4x6 -> 1200x1800、5x7 -> 1500x2100，即 300 DPI）的 JPEG dataURL。
export async function renderCoverToDataURL(file, targetW, targetH, quality = 0.9) {
  const { source, width, height, cleanup } = await loadImageSource(file);
  try {
    return coverDrawToDataURL(source, width, height, targetW, targetH, quality);
  } finally {
    cleanup();
  }
}

// 已存在的底稿（存成 dataURL 的舊樣板）換沖印尺寸時，用這個從既有圖片重新 cover 裁切，
// 不用重新上傳檔案。
export async function recoverExistingBackground(dataURL, targetW, targetH, quality = 0.9) {
  const img = await loadImageElement(dataURL);
  return coverDrawToDataURL(img, img.naturalWidth, img.naturalHeight, targetW, targetH, quality);
}

export function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
