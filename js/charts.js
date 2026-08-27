// 純手刻 SVG 圖表（不依賴外部圖表套件）：分類圓餅圖 + 每日花費長條圖。

function polarToCartesian(cx, cy, r, angleDeg) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

// slices: [{ label, value, color }]
export function renderPieChart(slices, { size = 220 } = {}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (!total) return '<p class="empty-hint">尚無資料可顯示</p>';

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  let angle = 0;
  const nonZero = slices.filter((s) => s.value > 0);
  const paths = nonZero
    .map((s) => {
      // 整圓（360 度）的弧線起訖點會重合變成看不見的形狀，改畫正圓
      const sweep = (s.value / total) * 360;
      const title = `<title>${escapeXml(s.label)}: ${s.value.toFixed(2)}</title>`;
      if (nonZero.length === 1 || sweep >= 359.99) {
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${s.color}">${title}</circle>`;
      }
      const path = arcPath(cx, cy, r, angle, angle + sweep);
      angle += sweep;
      return `<path d="${path}" fill="${s.color}">${title}</path>`;
    })
    .join('');

  const legend = slices
    .filter((s) => s.value > 0)
    .map(
      (s) => `<div class="legend-item">
        <span class="legend-dot" style="background:${s.color}"></span>
        <span class="legend-label">${escapeHtml(s.label)}</span>
        <span class="legend-value">${((s.value / total) * 100).toFixed(1)}%</span>
      </div>`
    )
    .join('');

  return `
    <div class="chart-row">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="pie-chart">${paths}</svg>
      <div class="chart-legend">${legend}</div>
    </div>`;
}

// points: [{ label, value }]
export function renderBarChart(points, { width = 480, height = 200, color = '#6366f1' } = {}) {
  if (!points.length) return '<p class="empty-hint">尚無資料可顯示</p>';
  const max = Math.max(...points.map((p) => p.value), 1);
  const padding = 24;
  const barGap = 6;
  const barWidth = Math.max(6, (width - padding) / points.length - barGap);

  const bars = points
    .map((p, idx) => {
      const barHeight = (p.value / max) * (height - padding - 16);
      const x = padding + idx * (barWidth + barGap);
      const y = height - padding - barHeight;
      return `<g>
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="3">
          <title>${escapeXml(p.label)}: ${p.value.toFixed(2)}</title>
        </rect>
      </g>`;
    })
    .join('');

  const labels = points
    .map((p, idx) => {
      const x = padding + idx * (barWidth + barGap) + barWidth / 2;
      if (points.length > 14 && idx % Math.ceil(points.length / 14) !== 0) return '';
      return `<text x="${x}" y="${height - 6}" font-size="9" text-anchor="middle" fill="var(--text-muted)">${escapeXml(p.label)}</text>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" class="bar-chart">
    <line x1="${padding}" y1="${height - padding}" x2="${width}" y2="${height - padding}" stroke="var(--border)" />
    ${bars}
    ${labels}
  </svg>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeXml(str) {
  return escapeHtml(str);
}
