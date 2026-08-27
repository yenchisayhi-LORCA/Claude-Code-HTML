// 把花費報表畫成可下載的 PNG 圖片。
//
// 這裡刻意不是「把 renderExpenseReport() 的 HTML 轉成圖片」，而是用 canvas 指令把同一份
// 版面手動重畫一次：試過用 SVG <foreignObject> 包住那段 HTML 再畫進 canvas，結果被 Chromium
// 判定成「tainted canvas」而無法 toBlob() 匯出（這是 foreignObject 在瀏覽器裡的已知限制，
// 就算完全沒有載入任何外部資源也一樣會被標記，不是我們能繞過的東西）。改成手動用 canvas
// 畫矩形/圓形/路徑重現同一份設計稿的 9 款分類圖示跟排版，才能可靠匯出。
// 版面數字（間距、字級、圓角、顏色）都對照設計交接包 expense-report-template.html 的規格。
// 需要跟設計稿一模一樣的字型（Zen Maru Gothic）時，改用旁邊的「列印 / 存成 PDF」——
// 那是開新分頁走正常網頁渲染，可以安全載入 Google Fonts。

const FONT = `'Noto Sans TC', -apple-system, sans-serif`;
const W = 794;
const H_PAD = 44;
const SIDE_PAD = 56;
const CONTENT_W = W - SIDE_PAD * 2;

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

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

function fmtMD(d) {
  if (!d) return '';
  const parts = d.split('-');
  return parts.length >= 3 ? `${parts[1]}-${parts[2]}` : d;
}

// 分類徽章底色（跟 category-icons.js 的 ICONS 同一份色票）
const ICON_BG = {
  transport: '#DCEBF9', stay: '#DCEFE6', food: '#FBE3CF', ticket: '#E7E0F5',
  shopping: '#FBDDE4', entertainment: '#FBF0CE', telecom: '#D8EEF2', medical: '#FBDDDD', other: '#EFE7DA',
};

// 把每款分類圖示用 canvas 指令重畫一次（座標直接沿用設計稿 SVG 的 26x26 viewBox 數值，
// 畫之前用 ctx.scale(size/26, size/26) 縮放，數字不用重新換算）。
function drawIcon(ctx, key, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 26, size / 26);

  const rr = (rx, ry, w, h, r) => roundRect(ctx, rx, ry, w, h, r);

  switch (key) {
    case 'transport':
      ctx.fillStyle = '#6FA8DC'; rr(4, 3, 18, 15, 4); ctx.fill();
      ctx.fillStyle = '#FFFDF8'; rr(7, 6, 12, 6, 1.5); ctx.fill();
      ctx.fillStyle = '#3B3330';
      ctx.beginPath(); ctx.arc(8, 20, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(18, 20, 2.6, 0, Math.PI * 2); ctx.fill();
      break;
    case 'stay':
      ctx.fillStyle = '#4AA48E';
      ctx.beginPath(); ctx.moveTo(13, 3); ctx.lineTo(23, 11); ctx.lineTo(3, 11); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5FBFA8'; rr(5, 11, 16, 11, 2); ctx.fill();
      ctx.fillStyle = '#FFFDF8'; rr(11, 15, 5, 7, 1); ctx.fill();
      break;
    case 'food':
      ctx.fillStyle = '#C4703A';
      ctx.save(); ctx.translate(14.6, 5.7); ctx.rotate((10 * Math.PI) / 180); rr(-1, -3.7, 2, 7.5, 1); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(18.4, 5.7); ctx.rotate((20 * Math.PI) / 180); rr(-1, -3.7, 2, 7.5, 1); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#F79256';
      ctx.beginPath(); ctx.moveTo(4, 12.6); ctx.lineTo(22, 12.6); ctx.arc(13, 12.6, 9, 0, Math.PI, false); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#E0762F'; rr(2.5, 9.4, 21, 3.3, 1.65); ctx.fill();
      ctx.fillStyle = '#C4703A'; rr(9, 20.6, 8, 2.4, 1.2); ctx.fill();
      break;
    case 'ticket':
      ctx.fillStyle = '#9B87D4'; rr(2.5, 6.5, 21, 13, 3.5); ctx.fill();
      ctx.fillStyle = '#E7E0F5';
      ctx.beginPath(); ctx.arc(15, 6.5, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(15, 19.5, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#FFFDF8'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.setLineDash([2, 2.4]);
      ctx.beginPath(); ctx.moveTo(15, 9.6); ctx.lineTo(15, 16.4); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#FFFDF8'; rr(5.5, 10, 6, 1.8, 0.9); ctx.fill(); rr(5.5, 14.2, 4, 1.8, 0.9); ctx.fill();
      break;
    case 'shopping':
      ctx.strokeStyle = '#C9566F'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(9, 10); ctx.lineTo(9, 9); ctx.bezierCurveTo(9, 6.8, 10.8, 5, 13, 5); ctx.bezierCurveTo(15.2, 5, 17, 6.8, 17, 9); ctx.lineTo(17, 10); ctx.stroke();
      ctx.fillStyle = '#E7809A'; rr(3.5, 10.5, 19, 11.5, 3.5); ctx.fill();
      ctx.fillStyle = '#F6BECB'; rr(3.5, 10.5, 19, 3.4, 1.7); ctx.fill();
      break;
    case 'entertainment':
      ctx.fillStyle = '#EFB93C';
      ctx.beginPath(); ctx.moveTo(5, 21); ctx.lineTo(14, 8); ctx.lineTo(20, 14); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#E09A1F';
      ctx.beginPath(); ctx.moveTo(5, 21); ctx.lineTo(9.5, 19.5); ctx.lineTo(7, 15); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#E7809A'; ctx.beginPath(); ctx.arc(19, 6, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6FA8DC'; ctx.beginPath(); ctx.arc(23, 11, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5FBFA8'; ctx.beginPath(); ctx.arc(15, 3.5, 1.4, 0, Math.PI * 2); ctx.fill();
      break;
    case 'telecom':
      ctx.fillStyle = '#4FAFC0'; rr(7, 4, 12, 18, 3.5); ctx.fill();
      ctx.fillStyle = '#FFFDF8'; rr(9.5, 7, 7, 9, 1.5); ctx.fill();
      ctx.beginPath(); ctx.arc(13, 19, 1.5, 0, Math.PI * 2); ctx.fill();
      break;
    case 'medical':
      ctx.fillStyle = '#E37B7B'; rr(4, 4, 18, 18, 5); ctx.fill();
      ctx.fillStyle = '#FFFDF8'; rr(11.4, 8, 3.2, 10, 1.6); ctx.fill(); rr(8, 11.4, 10, 3.2, 1.6); ctx.fill();
      break;
    default:
      ctx.fillStyle = '#B0A093';
      [7, 13, 19].forEach((cx) => { ctx.beginPath(); ctx.arc(cx, 13, 2.4, 0, Math.PI * 2); ctx.fill(); });
  }
  ctx.restore();
}

function drawIconBadge(ctx, key, x, y, size, radius) {
  roundRect(ctx, x, y, size, size, radius);
  ctx.fillStyle = ICON_BG[key] || ICON_BG.other;
  ctx.fill();
  const inner = size * 0.6;
  drawIcon(ctx, key, x + (size - inner) / 2, y + (size - inner) / 2, inner);
}

function drawLogoMark(ctx, x, y, size) {
  // 提把（只有上/左/右三邊，跟設計稿的 CSS border 一致：底部開口讓箱體蓋住）
  const handleW = size * 0.39;
  const handleH = size * 0.18;
  const bodyH = size * 0.84;
  const r = handleH * 0.55;
  const hx = x + (size - handleW) / 2;
  const hy = y;
  ctx.strokeStyle = '#E8734A';
  ctx.lineWidth = size * 0.09;
  ctx.beginPath();
  ctx.moveTo(hx, hy + handleH + 4);
  ctx.lineTo(hx, hy + r);
  ctx.arcTo(hx, hy, hx + r, hy, r);
  ctx.lineTo(hx + handleW - r, hy);
  ctx.arcTo(hx + handleW, hy, hx + handleW, hy + r, r);
  ctx.lineTo(hx + handleW, hy + handleH + 4);
  ctx.stroke();

  // 箱體
  const bodyY = y + size - bodyH;
  roundRect(ctx, x, bodyY, size, bodyH, size * 0.27);
  ctx.fillStyle = '#F79256';
  ctx.fill();

  ctx.fillStyle = '#FFFDF8';
  ctx.font = `900 ${Math.round(bodyH * 0.6)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('琪', x + size / 2, bodyY + bodyH / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

export function buildReportCanvas(data) {
  const rowH = 60;
  const settleRowH = 62;
  const rowGap = 10;
  const sectionGap = 30;

  const expenses = data.expenses || [];
  const settlements = data.settlements || [];
  const expenseAreaH = expenses.length ? expenses.length * (rowH + rowGap) - rowGap : 30;
  const settleAreaH = settlements.length ? settlements.length * (settleRowH + rowGap) - rowGap : settleRowH;

  const headerH = 56 + 20; // logo 高度 + 跟下面統計卡的間距
  const statH = 108; // 50*2 + 8
  const H = H_PAD + headerH + statH + sectionGap + 30 + expenseAreaH + sectionGap + 30 + settleAreaH + 40 + 48;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = Math.ceil(H) * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // 背景
  ctx.fillStyle = '#FDF8F0';
  ctx.fillRect(0, 0, W, H);

  // 裝飾圓（數字對照設計稿的四個背景圓）
  const circle = (cx, cy, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); };
  circle(W - 60 + 115 - 230, -70 + 115, 115, '#FBE3CF');
  circle(W - 60 - 35, 120 + 35, 35, '#F9D9B8');
  circle(-50 + 100, H + 60 - 100, 100, '#DCEFE6');
  circle(52 + 22, H - 150 - 22, 22, '#CDE7DA');

  let y = H_PAD;

  // 頁首：琪 logo + 標題
  drawLogoMark(ctx, SIDE_PAD, y + 4, 56);
  ctx.fillStyle = '#B08A6E';
  ctx.font = `700 13px ${FONT}`;
  ctx.fillText('TRAVEL EXPENSE REPORT', SIDE_PAD + 56 + 18, y + 16);
  ctx.fillStyle = '#3B3330';
  ctx.font = `900 32px ${FONT}`;
  ctx.fillText(truncate(ctx, data.title || '', CONTENT_W - 56 - 18), SIDE_PAD + 56 + 18, y + 46);

  y += headerH + 20;

  // 統計卡：旅行期間 / 基準貨幣（左側疊兩張）+ 總花費（右側高亮）
  const cur = data.currency || 'TWD';
  const leftW = CONTENT_W * ((CONTENT_W - 14) / CONTENT_W) * 0.42;
  const boxH = 50;
  const rightX = SIDE_PAD + leftW + 14;
  const rightW = CONTENT_W - leftW - 14;

  roundRect(ctx, SIDE_PAD, y, leftW, boxH, 20); ctx.fillStyle = '#FFFFFF'; ctx.fill();
  ctx.strokeStyle = '#F2E3D2'; ctx.lineWidth = 2; roundRect(ctx, SIDE_PAD, y, leftW, boxH, 20); ctx.stroke();
  ctx.fillStyle = '#A08C7D'; ctx.font = `700 12.5px ${FONT}`; ctx.fillText('旅行期間', SIDE_PAD + 20, y + 22);
  ctx.fillStyle = '#3B3330'; ctx.font = `900 16px ${FONT}`;
  ctx.fillText(`${fmtMD(data.startDate)} – ${fmtMD(data.endDate)}`, SIDE_PAD + 20, y + 42);

  const y2 = y + boxH + 8;
  roundRect(ctx, SIDE_PAD, y2, leftW, boxH, 20); ctx.fillStyle = '#FFFFFF'; ctx.fill();
  ctx.strokeStyle = '#F2E3D2'; roundRect(ctx, SIDE_PAD, y2, leftW, boxH, 20); ctx.stroke();
  ctx.fillStyle = '#A08C7D'; ctx.font = `700 12.5px ${FONT}`; ctx.fillText('基準貨幣', SIDE_PAD + 20, y2 + 22);
  ctx.fillStyle = '#3B3330'; ctx.font = `900 16px ${FONT}`; ctx.fillText(cur, SIDE_PAD + 20, y2 + 42);

  const totalH = boxH * 2 + 8;
  roundRect(ctx, rightX, y, rightW, totalH, 20);
  ctx.fillStyle = '#F79256'; ctx.fill();
  ctx.fillStyle = '#FFEBD9'; ctx.font = `700 12.5px ${FONT}`; ctx.fillText('總花費', rightX + 20, y + 24);
  ctx.fillStyle = '#FFFDF8'; ctx.font = `900 22px ${FONT}`;
  const totalText = Number(data.total || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  ctx.fillText(totalText, rightX + 20, y + 56);
  const totalWidth = ctx.measureText(totalText).width;
  ctx.font = `900 14px ${FONT}`;
  ctx.fillText(cur, rightX + 20 + totalWidth + 5, y + 56);

  y += totalH + sectionGap;

  // 花費明細
  const sectionHeader = (label, dotColor) => {
    ctx.fillStyle = dotColor; roundRect(ctx, SIDE_PAD, y - 12, 14, 14, 5); ctx.fill();
    ctx.fillStyle = '#3B3330'; ctx.font = `900 20px ${FONT}`;
    ctx.fillText(label, SIDE_PAD + 24, y);
    ctx.strokeStyle = '#F0E2D2'; ctx.lineWidth = 2;
    const labelW = ctx.measureText(label).width;
    ctx.beginPath(); ctx.moveTo(SIDE_PAD + 24 + labelW + 10, y - 5); ctx.lineTo(SIDE_PAD + CONTENT_W, y - 5); ctx.stroke();
  };

  sectionHeader('花費明細', '#F79256');
  y += 30;

  if (!expenses.length) {
    ctx.fillStyle = '#B0A093'; ctx.font = `13px ${FONT}`; ctx.fillText('尚無花費紀錄', SIDE_PAD, y + 16);
    y += 30;
  } else {
    for (const exp of expenses) {
      roundRect(ctx, SIDE_PAD, y, CONTENT_W, rowH, 20);
      ctx.fillStyle = '#FFFFFF'; ctx.fill();
      ctx.strokeStyle = '#F2E3D2'; ctx.lineWidth = 2; roundRect(ctx, SIDE_PAD, y, CONTENT_W, rowH, 20); ctx.stroke();

      const badgeSize = 46;
      const badgeY = y + (rowH - badgeSize) / 2;
      drawIconBadge(ctx, exp.type, SIDE_PAD + 20, badgeY, badgeSize, 15);

      const textX = SIDE_PAD + 20 + badgeSize + 16;
      const amountText = Number(exp.amount || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
      const curLabel = exp.currency || cur;
      ctx.font = `900 19px ${FONT}`;
      const amountW = ctx.measureText(amountText).width;
      ctx.font = `900 12px ${FONT}`;
      const curW = ctx.measureText(curLabel).width;

      ctx.fillStyle = '#3B3330'; ctx.font = `900 16px ${FONT}`;
      ctx.fillText(truncate(ctx, exp.title || '', CONTENT_W - 40 - badgeSize - 16 - amountW - curW - 20), textX, y + 26);

      ctx.font = `700 12.5px ${FONT}`;
      let mx = textX;
      const my = y + 44;
      ctx.fillStyle = '#9A8A7D'; ctx.fillText(exp.date || '', mx, my);
      mx += ctx.measureText(exp.date || '').width + 8;
      ctx.fillStyle = '#D6C6B6'; ctx.beginPath(); ctx.arc(mx, my - 4, 1.5, 0, Math.PI * 2); ctx.fill(); mx += 9;
      const chipLabel = exp.category || exp.type || '';
      ctx.font = `700 12px ${FONT}`;
      const chipW = ctx.measureText(chipLabel).width + 18;
      roundRect(ctx, mx, my - 13, chipW, 18, 9); ctx.fillStyle = '#F6EDE2'; ctx.fill();
      ctx.fillStyle = '#8A6E56'; ctx.fillText(chipLabel, mx + 9, my);
      mx += chipW + 8;
      ctx.fillStyle = '#D6C6B6'; ctx.beginPath(); ctx.arc(mx, my - 4, 1.5, 0, Math.PI * 2); ctx.fill(); mx += 9;
      ctx.font = `700 12.5px ${FONT}`;
      ctx.fillStyle = '#9A8A7D'; ctx.fillText(`${exp.payer || ''} 付款`, mx, my);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#3B3330'; ctx.font = `900 19px ${FONT}`;
      ctx.fillText(amountText, SIDE_PAD + CONTENT_W - 20 - curW - 4, y + rowH / 2 + 6);
      ctx.fillStyle = '#A08C7D'; ctx.font = `900 12px ${FONT}`;
      ctx.fillText(curLabel, SIDE_PAD + CONTENT_W - 20, y + rowH / 2 + 6);
      ctx.textAlign = 'left';

      y += rowH + rowGap;
    }
    y -= rowGap;
  }

  y += sectionGap;
  sectionHeader('分帳結算', '#5FBFA8');
  y += 30;

  if (!settlements.length) {
    roundRect(ctx, SIDE_PAD, y, CONTENT_W, settleRowH, 20);
    ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.fillStyle = '#5FBFA8'; ctx.font = `900 14px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText('已全部結清 🎉', W / 2, y + settleRowH / 2 + 5);
    ctx.textAlign = 'left';
    y += settleRowH;
  } else {
    for (const s of settlements) {
      roundRect(ctx, SIDE_PAD, y, CONTENT_W, settleRowH, 20);
      ctx.fillStyle = '#FFFFFF'; ctx.fill();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = '#B9DFD1'; ctx.lineWidth = 2;
      roundRect(ctx, SIDE_PAD, y, CONTENT_W, settleRowH, 20); ctx.stroke();
      ctx.setLineDash([]);

      const cy = y + settleRowH / 2;
      let cx = SIDE_PAD + 24;
      cx = drawSettleChip(ctx, cx, cy, s.from, '#FBE3CF', '#C4703A');

      ctx.strokeStyle = '#5FBFA8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx + 6, cy); ctx.lineTo(cx + 40, cy); ctx.stroke();
      ctx.fillStyle = '#5FBFA8';
      ctx.beginPath(); ctx.moveTo(cx + 40, cy - 6); ctx.lineTo(cx + 40, cy + 6); ctx.lineTo(cx + 49, cy); ctx.closePath(); ctx.fill();
      cx += 55;

      cx = drawSettleChip(ctx, cx, cy, s.to, '#DCEFE6', '#3F8B76');

      const amt = `${Number(s.amount || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${s.currency || cur}`;
      ctx.font = `900 17px ${FONT}`;
      const pillW = ctx.measureText(amt).width + 36;
      const pillH = 40;
      const pillX = SIDE_PAD + CONTENT_W - 24 - pillW;
      const pillY = cy - pillH / 2;
      roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
      ctx.fillStyle = '#5FBFA8'; ctx.fill();
      ctx.fillStyle = '#FFFDF8'; ctx.textAlign = 'center';
      ctx.fillText(amt, pillX + pillW / 2, pillY + pillH / 2 + 6);
      ctx.textAlign = 'left';

      y += settleRowH + rowGap;
    }
    y -= rowGap;
  }

  y += 30;
  ctx.strokeStyle = '#F0E2D2'; ctx.lineWidth = 2;
  ctx.fillStyle = '#B0A093'; ctx.font = `700 12.5px ${FONT}`; ctx.textAlign = 'center';
  const footerText = data.footerText || '琪 · 旅遊記帳';
  const footerW = ctx.measureText(footerText).width;
  ctx.beginPath(); ctx.moveTo(SIDE_PAD, y); ctx.lineTo(W / 2 - footerW / 2 - 10, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W / 2 + footerW / 2 + 10, y); ctx.lineTo(SIDE_PAD + CONTENT_W, y); ctx.stroke();
  ctx.fillText(footerText, W / 2, y + 4);
  ctx.textAlign = 'left';

  return canvas;
}

function drawSettleChip(ctx, x, cy, name, bg, fg) {
  const r = 19;
  ctx.beginPath(); ctx.arc(x + r, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = bg; ctx.fill();
  ctx.fillStyle = fg; ctx.font = `900 15px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(String(name || '').slice(-1), x + r, cy + 5);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#3B3330'; ctx.font = `900 16px ${FONT}`;
  ctx.fillText(name || '', x + r * 2 + 10, cy + 5);
  return x + r * 2 + 10 + ctx.measureText(name || '').width;
}

export async function downloadExpenseReportCard(reportData, filename) {
  const canvas = buildReportCanvas(reportData);
  await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('圖片產生失敗'));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}
