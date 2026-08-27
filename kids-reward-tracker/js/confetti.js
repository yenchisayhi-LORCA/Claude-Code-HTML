// 輕量慶祝動畫：加星星、解鎖獎狀、達成儲蓄挑戰時放個彩帶/星星爆炸，全部手刻 canvas，
// 不依賴任何外部套件（跟這個 repo 一貫「零 CDN 依賴」的作法一致）。

const COLORS = ['#FF6B9D', '#FFC75F', '#4CD4B0', '#6EC6FF', '#C79DFF', '#FF9F68'];
const EMOJI = ['⭐', '✨', '🌟'];

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
  const count = 60;
  const particles = Array.from({ length: count }, () => ({
    x: w / 2 + (Math.random() - 0.5) * 120,
    y: h * 0.35 + (Math.random() - 0.5) * 60,
    vx: (Math.random() - 0.5) * 9,
    vy: -Math.random() * 9 - 3,
    size: 8 + Math.random() * 10,
    rotation: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    emoji: Math.random() < 0.35 ? EMOJI[Math.floor(Math.random() * EMOJI.length)] : null,
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
      if (p.emoji) {
        ctx.font = `${p.size * 1.8}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, 0, 0);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
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
