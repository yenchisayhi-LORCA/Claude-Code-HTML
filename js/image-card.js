// 匯出「花費報表圖卡」：純手繪 Canvas 產生一張可分享的旅遊花費總結圖片（PNG），
// 跟其他匯出功能一樣不依賴任何 CDN 套件。

import { convertToBase } from './currency.js';
import { DEFAULT_CATEGORIES } from './storage.js';

const DEFAULT_CATEGORY_STYLE = Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.id, c]));

function styleOf(category) {
  if (!category) return { icon: '📦', name: '未分類', color: '#64748b' };
  return DEFAULT_CATEGORY_STYLE[category.id] || category;
}

function lighten(hex, amount) {
  const c = (hex || '#64748b').replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const mix = (ch) => Math.round(ch + (255 - ch) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

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

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function fmtMD(d) {
  if (!d) return '';
  const parts = d.split('-');
  return parts.length >= 3 ? `${parts[1]}-${parts[2]}` : d;
}

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", "PingFang TC", sans-serif`;

export async function buildExpenseCard(trip, ratesCache, balances, transactions) {
  const W = 560;
  const PAD = 28;
  const rowH = 60;
  const settleRowH = 62;
  const rowGap = 10;
  const sectionGap = 30;

  const memberOf = (id) => trip.members.find((m) => m.id === id);
  const catOf = (id) => trip.categories.find((c) => c.id === id);
  const sortedExpenses = [...trip.expenses].sort(
    (a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || 0) - (b.createdAt || 0)
  );

  const expenseAreaH = sortedExpenses.length ? sortedExpenses.length * (rowH + rowGap) : 40;
  const settleAreaH = transactions.length ? transactions.length * (settleRowH + rowGap) : settleRowH;

  const headerH = 40 + 20 + 28; // logo 列 + 間距 + 標題
  const boxH = 50;
  const statH = boxH * 2 + 8;
  const H =
    PAD + headerH + statH + sectionGap + 30 + expenseAreaH + sectionGap + 30 + settleAreaH + 40 + PAD;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(W * scale);
  canvas.height = Math.ceil(H * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // 事先載入所有需要顯示的頭像，避免畫到一半圖片還沒 decode 完成
  const avatarImages = {};
  await Promise.all(
    trip.members.filter((m) => m.avatar).map(async (m) => {
      avatarImages[m.id] = await loadImage(m.avatar);
    })
  );

  function drawAvatarChip(x, centerY, member) {
    const r = 12;
    const img = member && avatarImages[member.id];
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + r, centerY, r, 0, Math.PI * 2);
    if (img) {
      ctx.clip();
      ctx.drawImage(img, x, centerY - r, r * 2, r * 2);
    } else {
      ctx.fillStyle = '#e2e8f0';
      ctx.fill();
    }
    ctx.restore();
    if (!img) {
      ctx.fillStyle = '#64748b';
      ctx.font = `700 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText((member?.name || '?').slice(0, 1), x + r, centerY + 4);
      ctx.textAlign = 'left';
    }
    const name = member?.name || '（已刪除成員）';
    ctx.fillStyle = '#3E2C1E';
    ctx.font = `600 13px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(name, x + r * 2 + 6, centerY + 4);
    return x + r * 2 + 6 + ctx.measureText(name).width;
  }

  function sectionHeader(x, y, text, dotColor) {
    ctx.beginPath();
    ctx.arc(x + 4, y - 4, 4, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();
    ctx.fillStyle = '#3E2C1E';
    ctx.font = `700 15px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 14, y);
  }

  // 背景
  ctx.fillStyle = '#FBF3E7';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.fillStyle = 'rgba(245, 187, 79, 0.22)';
  ctx.beginPath();
  ctx.arc(W + 20, 10, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(140, 198, 160, 0.20)';
  ctx.beginPath();
  ctx.arc(-20, H - 10, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  let y = PAD;

  // logo
  roundRect(ctx, PAD, y, 40, 40, 10);
  ctx.fillStyle = '#F5BB4F';
  ctx.fill();
  ctx.fillStyle = '#5C3A1E';
  ctx.font = `700 20px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('琪', PAD + 20, y + 27);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#B08968';
  ctx.font = `700 10px ${FONT}`;
  ctx.fillText('T R A V E L   E X P E N S E   R E P O R T', PAD + 52, y + 16);

  y += 40 + 20;

  const start = trip.startDate || '';
  const titleDate = start ? `${start.slice(0, 4)}/${Number(start.slice(5, 7))}` : '';
  ctx.fillStyle = '#3E2C1E';
  ctx.font = `700 23px ${FONT}`;
  ctx.fillText(truncate(ctx, `${titleDate} ${trip.name} 旅遊花費報表`, W - PAD * 2), PAD, y);

  y += 28;

  // 統計方塊
  const total = trip.expenses.reduce(
    (sum, e) => sum + (convertToBase(e.amount, e.currency, trip.baseCurrency, ratesCache) || 0),
    0
  );
  const leftW = (W - PAD * 2) * 0.46;
  const rightW = W - PAD * 2 - leftW - 12;

  roundRect(ctx, PAD, y, leftW, boxH, 10);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.fillStyle = '#94836f';
  ctx.font = `600 10px ${FONT}`;
  ctx.fillText('旅行期間', PAD + 12, y + 18);
  ctx.fillStyle = '#3E2C1E';
  ctx.font = `700 14px ${FONT}`;
  ctx.fillText(`${fmtMD(trip.startDate)} ~ ${fmtMD(trip.endDate)}`, PAD + 12, y + 38);

  roundRect(ctx, PAD, y + boxH + 8, leftW, boxH, 10);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.fillStyle = '#94836f';
  ctx.font = `600 10px ${FONT}`;
  ctx.fillText('基準貨幣', PAD + 12, y + boxH + 8 + 18);
  ctx.fillStyle = '#3E2C1E';
  ctx.font = `700 14px ${FONT}`;
  ctx.fillText(trip.baseCurrency, PAD + 12, y + boxH + 8 + 38);

  const totalBoxX = PAD + leftW + 12;
  roundRect(ctx, totalBoxX, y, rightW, statH, 12);
  ctx.fillStyle = '#F0965A';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `600 11px ${FONT}`;
  ctx.fillText('總花費', totalBoxX + 14, y + 22);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText(Math.round(total).toLocaleString('en-US'), totalBoxX + 14, y + 58);
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText(trip.baseCurrency, totalBoxX + 14, y + 78);

  y += statH + sectionGap;

  // 花費明細
  sectionHeader(PAD, y, '花費明細', '#F0965A');
  y += 30;

  if (!sortedExpenses.length) {
    ctx.fillStyle = '#a8967f';
    ctx.font = `13px ${FONT}`;
    ctx.fillText('尚無花費紀錄', PAD, y + 20);
    y += 40;
  } else {
    for (const exp of sortedExpenses) {
      const cat = styleOf(catOf(exp.categoryId));
      const payer = memberOf(exp.paidBy);
      roundRect(ctx, PAD, y, W - PAD * 2, rowH, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      const badgeSize = 36;
      const badgeY = y + (rowH - badgeSize) / 2;
      roundRect(ctx, PAD + 10, badgeY, badgeSize, badgeSize, 9);
      ctx.fillStyle = lighten(cat.color, 0.82);
      ctx.fill();
      // 顏色 emoji 圖示的顏色是內建的，不受 fillStyle 影響；但純文字符號（例如「其他」的點點）
      // 會直接套用 fillStyle，若沿用剛剛畫底色用的淺色，字就會跟底色融在一起看不見。
      ctx.fillStyle = cat.color || '#64748b';
      ctx.font = `700 16px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(cat.icon || '📦', PAD + 10 + badgeSize / 2, badgeY + badgeSize / 2 + 6);
      ctx.textAlign = 'left';

      const textX = PAD + 10 + badgeSize + 12;
      const amountText = `${Math.round(exp.amount).toLocaleString('en-US')} ${exp.currency}`;
      ctx.font = `700 15px ${FONT}`;
      const amountW = ctx.measureText(amountText).width;

      ctx.fillStyle = '#3E2C1E';
      ctx.font = `700 14px ${FONT}`;
      ctx.fillText(
        truncate(ctx, exp.description || cat.name, W - PAD - 14 - amountW - 16 - textX),
        textX,
        y + 26
      );
      ctx.fillStyle = '#a8967f';
      ctx.font = `500 11px ${FONT}`;
      ctx.fillText(
        `${fmtMD(exp.date)} · ${cat.name || ''}${payer ? ' · ' + payer.name + ' 付款' : ''}`,
        textX,
        y + 44
      );

      ctx.fillStyle = '#3E2C1E';
      ctx.font = `700 15px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(amountText, W - PAD - 14, y + rowH / 2 + 5);
      ctx.textAlign = 'left';

      y += rowH + rowGap;
    }
  }

  y += sectionGap - rowGap;

  // 分帳結算
  sectionHeader(PAD, y, '分帳結算', '#3EAE7C');
  y += 30;

  if (!transactions.length) {
    roundRect(ctx, PAD, y, W - PAD * 2, settleRowH, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.fillStyle = '#3EAE7C';
    ctx.font = `700 14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('已全部結清 🎉', W / 2, y + settleRowH / 2 + 5);
    ctx.textAlign = 'left';
    y += settleRowH;
  } else {
    for (const t of transactions) {
      const from = memberOf(t.from);
      const to = memberOf(t.to);
      roundRect(ctx, PAD, y, W - PAD * 2, settleRowH, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = '#e7dcc9';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      let cx = drawAvatarChip(PAD + 16, y + settleRowH / 2, from);
      ctx.fillStyle = '#c9bda8';
      ctx.font = `16px ${FONT}`;
      ctx.fillText('→', cx + 8, y + settleRowH / 2 + 5);
      cx += 30;
      drawAvatarChip(cx, y + settleRowH / 2, to);

      const amountText = `${Math.round(t.amount).toLocaleString('en-US')} ${trip.baseCurrency}`;
      ctx.font = `700 13px ${FONT}`;
      const pillW = Math.max(90, ctx.measureText(amountText).width + 32);
      const pillH = 30;
      const pillX = W - PAD - 14 - pillW;
      const pillY = y + (settleRowH - pillH) / 2;
      roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
      ctx.fillStyle = '#3EAE7C';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(amountText, pillX + pillW / 2, pillY + pillH / 2 + 4);
      ctx.textAlign = 'left';

      y += settleRowH + rowGap;
    }
  }

  y += 26;
  ctx.fillStyle = '#b6a68d';
  ctx.font = `600 11px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('琪・旅遊記帳', W / 2, y);
  ctx.textAlign = 'left';

  return canvas;
}

export async function downloadExpenseCard(trip, ratesCache, balances, transactions) {
  const canvas = await buildExpenseCard(trip, ratesCache, balances, transactions);
  await new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${trip.name}-花費圖卡.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}
