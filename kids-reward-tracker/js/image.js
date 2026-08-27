// 照片壓縮：避免原始照片太大把 localStorage 空間塞滿，也避免手機瀏覽器記憶體不足而閃退。
// 跟根目錄旅遊記帳系統的 js/image.js 是同一套做法（直接沿用），細節說明請參考那一份。

export function compressImage(file, { maxWidth = 900, quality = 0.6 } = {}) {
  return new Promise((resolve, reject) => {
    (async () => {
      let source;
      let width;
      let height;
      let cleanup = () => {};
      try {
        if (!window.createImageBitmap) throw new Error('createImageBitmap not supported');
        const bitmap = await createImageBitmap(file);
        source = bitmap;
        width = bitmap.width;
        height = bitmap.height;
        cleanup = () => bitmap.close();
      } catch (err) {
        const loaded = await loadImageViaObjectUrl(file);
        source = loaded.img;
        width = loaded.img.naturalWidth;
        height = loaded.img.naturalHeight;
        cleanup = () => URL.revokeObjectURL(loaded.url);
      }
      try {
        const scale = Math.min(1, maxWidth / width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        reject(err);
      } finally {
        cleanup();
      }
    })();
  });
}

function loadImageViaObjectUrl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}
