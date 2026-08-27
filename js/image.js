// 照片壓縮：避免原始照片太大把 localStorage 空間塞滿，也避免手機瀏覽器記憶體不足而閃退。
//
// 舊做法是用 FileReader.readAsDataURL() 把整個檔案讀成 base64 字串（比原始檔案大約多 33%），
// 再塞進 <img> 解碼成完整解析度的點陣圖——現在手機拍的照片動輒 20~50MP，光是這樣就可能同時
// 佔用好幾十 MB 記憶體，在 iOS Safari 上很容易被系統判定佔用過多記憶體而直接把分頁砍掉閃退。
// 改用 createImageBitmap() 直接從檔案解碼（不用先轉成 base64 字串），沒有這個 API 時才退回
// 用 blob URL（一樣不用 base64）餵給 <img>。

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
