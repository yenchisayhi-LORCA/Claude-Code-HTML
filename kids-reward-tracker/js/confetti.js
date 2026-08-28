// 輕量慶祝動畫：加星星、解鎖獎狀、達成儲蓄挑戰時放個彩帶/星星爆炸，全部手刻 canvas，
// 不依賴任何外部套件。星星形狀直接沿用手繪圖示 sprite 的 ic-star path data（見 index.html），
// 不用 emoji（符合設計系統 handoff 的「不用 emoji」規則）。

const COLORS = ['#FFD426', '#3F6FD1', '#EE3E33', '#4FD2C2', '#FF9EC4'];

// 跟 index.html 內嵌 sprite 裡 <symbol id="ic-star"> 同一份 path，viewBox 0 0 48 48（中心約在 24,24）
const STAR_PATH = new Path2D(
  'M24 6c1.6 1 3.4 6.6 5.2 11.6 5.4.4 11 .8 12 1.6.9.9-3.6 4.6-7.6 8.4 1.2 5.2 2.7 10.8 2.1 11.6-.7.8-5.8-2.1-11.7-5.3-5.6 3-10.8 6.1-11.6 5.3-.8-.8.7-6.3 2-11.6-4-3.8-8.5-7.5-7.6-8.4.9-.8 6.5-1.2 12-1.6C20.5 12.6 22.4 7 24 6Z'
);

export function celebrate({ durationMs = 1400 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const w = window.innerWidth;
  const h = window.innerHeight;
  const count = 50;
  const particles = Array.from({ length: count }, () => ({
    x: w / 2 + (Math.random() - 0.5) * 120,
    y: h * 0.35 + (Math.random() - 0.5) * 60,
    vx: (Math.random() - 0.5) * 9,
    vy: -Math.random() * 9 - 3,
    size: 10 + Math.random() * 10,
    rotation: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    star: Math.random() < 0.4,
  }));

  const start = performance.now();
  const gravity = 0.32;

  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vr;
      const fade = Math.max(0, 1 - elapsed / durationMs);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      if (p.star) {
        const scale = p.size / 24;
        ctx.scale(scale, scale);
        ctx.translate(-24, -24);
        ctx.fill(STAR_PATH);
      } else {
        const rr = Math.min(3, p.size * 0.2);
        roundRectPath(ctx, -p.size / 2, -p.size / 2.6, p.size, p.size * 0.55, rr);
        ctx.fill();
      }
      ctx.restore();
    }
    if (elapsed < durationMs) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(frame);
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
