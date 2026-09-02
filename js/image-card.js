// 把花費報表畫成可下載的 PNG 圖片，拆成兩張各自獨立下載：「總覽」（總花費、每人結算、
// 建議轉帳）跟「明細」（花費明細）——原本擠在同一張長圖裡，花費一多整張圖會拉得很長，
// 分成兩張讓兩種用途（跟同行的人對帳 vs. 記錄留存）可以各自單獨分享。兩張圖各自都有
// 完整的頁首（旅程標題）跟頁尾，單獨看其中一張也看得出是哪趟旅程。
//
// 這裡刻意不是「把 renderExpenseReport() 的 HTML 轉成圖片」，而是用 canvas 指令把同一份
// 版面手動重畫一次：試過用 SVG <foreignObject> 包住那段 HTML 再畫進 canvas，結果被 Chromium
// 判定成「tainted canvas」而無法 toBlob() 匯出（這是 foreignObject 在瀏覽器裡的已知限制，
// 就算完全沒有載入任何外部資源也一樣會被標記，不是我們能繞過的東西）。改成手動用 canvas
// 畫矩形/圓形/路徑重現同一份設計稿的 9 款分類圖示跟排版，才能可靠匯出。
// 版面數字（間距、字級、圓角、顏色）都對照設計交接包 expense-report-template.html 的規格；
// 「每人結算」卡片則是照 app.js renderSplitTab() 畫面上的分帳結算頁籤重畫一次（同樣的
// 理由：DOM 沒辦法直接搬進 canvas，只能用畫的方式重現一樣的版面）。
// 需要跟設計稿一模一樣的字型（Zen Maru Gothic）時，改用旁邊的「列印 / 存成 PDF」——
// 那是開新分頁走正常網頁渲染，可以安全載入 Google Fonts。

const FONT = `'Noto Sans TC', -apple-system, sans-serif`;
const W = 794;
const H_PAD = 44;
const SIDE_PAD = 56;
const CONTENT_W = W - SIDE_PAD * 2;
const SECTION_GAP = 30;
const HEADER_ADVANCE = 56 + 20 + 20; // logo 高度 + 跟標題的間距 + 跟下面內容的間距
const FOOTER_GAP_BEFORE = 30; // 最後一個區塊跟頁尾線之間的間距
const BOTTOM_MARGIN = 30; // 頁尾文字下面留的邊界

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

// ---------------------------------------------------------------- 頁面共用元素（背景/頁首/頁尾）

function drawBackground(ctx, H) {
  ctx.fillStyle = '#FDF8F0';
  ctx.fillRect(0, 0, W, H);
  const circle = (cx, cy, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); };
  circle(W - 60 + 115 - 230, -70 + 115, 115, '#FBE3CF');
  circle(W - 60 - 35, 120 + 35, 35, '#F9D9B8');
  circle(-50 + 100, H + 60 - 100, 100, '#DCEFE6');
  circle(52 + 22, H - 150 - 22, 22, '#CDE7DA');
}

function drawHeader(ctx, data, y) {
  drawLogoMark(ctx, SIDE_PAD, y + 4, 56);
  ctx.fillStyle = '#B08A6E';
  ctx.font = `700 13px ${FONT}`;
  ctx.fillText('TRAVEL EXPENSE REPORT', SIDE_PAD + 56 + 18, y + 16);
  ctx.fillStyle = '#3B3330';
  ctx.font = `900 32px ${FONT}`;
  ctx.fillText(truncate(ctx, data.title || '', CONTENT_W - 56 - 18), SIDE_PAD + 56 + 18, y + 46);
  return y + HEADER_ADVANCE;
}

function drawFooter(ctx, data, y) {
  ctx.strokeStyle = '#F0E2D2'; ctx.lineWidth = 2;
  ctx.fillStyle = '#B0A093'; ctx.font = `700 12.5px ${FONT}`; ctx.textAlign = 'center';
  const footerText = data.footerText || '琪 · 旅遊記帳';
  const footerW = ctx.measureText(footerText).width;
  ctx.beginPath(); ctx.moveTo(SIDE_PAD, y); ctx.lineTo(W / 2 - footerW / 2 - 10, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W / 2 + footerW / 2 + 10, y); ctx.lineTo(SIDE_PAD + CONTENT_W, y); ctx.stroke();
  ctx.fillText(footerText, W / 2, y + 4);
  ctx.textAlign = 'left';
}

function drawSectionHeader(ctx, y, label, dotColor) {
  ctx.fillStyle = dotColor; roundRect(ctx, SIDE_PAD, y - 12, 14, 14, 5); ctx.fill();
  ctx.fillStyle = '#3B3330'; ctx.font = `900 20px ${FONT}`;
  ctx.fillText(label, SIDE_PAD + 24, y);
  ctx.strokeStyle = '#F0E2D2'; ctx.lineWidth = 2;
  const labelW = ctx.measureText(label).width;
  ctx.beginPath(); ctx.moveTo(SIDE_PAD + 24 + labelW + 10, y - 5); ctx.lineTo(SIDE_PAD + CONTENT_W, y - 5); ctx.stroke();
}

function setupCanvas(H) {
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = Math.ceil(H) * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  drawBackground(ctx, H);
  return { canvas, ctx };
}

// ---------------------------------------------------------------- 統計卡（旅行期間/基準貨幣/總花費）

const STAT_BOX_H = 68; // padding 16 + 標籤 13 + 間距 6 + 數值 16 + padding 16，四捨五入

function statRowHeight(data) {
  // 總花費有台幣參考時多印一行，三張卡等高（對齊瀏覽器 flex 預設 stretch 行為）
  return data.totalTwd != null ? STAT_BOX_H + 20 : STAT_BOX_H;
}

function drawStatRow(ctx, data, y) {
  const statH = statRowHeight(data);
  const cur = data.currency || 'TWD';
  const gapX = 14;
  const flexUnit = (CONTENT_W - gapX * 2) / 3.4;
  const box1W = flexUnit;
  const box2W = flexUnit;
  const box3W = flexUnit * 1.4;
  const box1X = SIDE_PAD;
  const box2X = box1X + box1W + gapX;
  const box3X = box2X + box2W + gapX;

  roundRect(ctx, box1X, y, box1W, statH, 20); ctx.fillStyle = '#FFFFFF'; ctx.fill();
  ctx.strokeStyle = '#F2E3D2'; ctx.lineWidth = 2; roundRect(ctx, box1X, y, box1W, statH, 20); ctx.stroke();
  ctx.fillStyle = '#A08C7D'; ctx.font = `700 12.5px ${FONT}`; ctx.fillText('旅行期間', box1X + 20, y + 22);
  ctx.fillStyle = '#3B3330'; ctx.font = `900 16px ${FONT}`;
  ctx.fillText(`${fmtMD(data.startDate)} – ${fmtMD(data.endDate)}`, box1X + 20, y + 42);

  roundRect(ctx, box2X, y, box2W, statH, 20); ctx.fillStyle = '#FFFFFF'; ctx.fill();
  ctx.strokeStyle = '#F2E3D2'; roundRect(ctx, box2X, y, box2W, statH, 20); ctx.stroke();
  ctx.fillStyle = '#A08C7D'; ctx.font = `700 12.5px ${FONT}`; ctx.fillText('基準貨幣', box2X + 20, y + 22);
  ctx.fillStyle = '#3B3330'; ctx.font = `900 16px ${FONT}`; ctx.fillText(cur, box2X + 20, y + 42);

  roundRect(ctx, box3X, y, box3W, statH, 20);
  ctx.fillStyle = '#F79256'; ctx.fill();
  ctx.fillStyle = '#FFEBD9'; ctx.font = `700 12.5px ${FONT}`; ctx.fillText('總花費', box3X + 20, y + 24);
  ctx.fillStyle = '#FFFDF8'; ctx.font = `900 22px ${FONT}`;
  const totalText = Number(data.total || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  ctx.fillText(totalText, box3X + 20, y + 51);
  const totalWidth = ctx.measureText(totalText).width;
  ctx.font = `900 14px ${FONT}`;
  ctx.fillText(cur, box3X + 20 + totalWidth + 5, y + 51);
  if (data.totalTwd != null) {
    ctx.fillStyle = '#FFEBD9'; ctx.font = `700 12px ${FONT}`;
    // 台幣是參考換算值，不需要小數，四捨五入到整數比較好讀
    ctx.fillText(`≈ ${Math.round(Number(data.totalTwd)).toLocaleString('en-US')} TWD`, box3X + 20, y + 66);
  }

  return y + statH + SECTION_GAP;
}

// ---------------------------------------------------------------- 每人結算（照分帳結算頁籤畫面重畫）

const MEMBER_GRID_GAP_X = 14;
const MEMBER_GRID_GAP_Y = 10;
const MEMBER_CARD_H = 138;
const MEMBER_CARD_H_TWD = 160; // 三行數字都多印一行台幣參考金額

function memberCardHeightFor(data) {
  return data.totalTwd != null ? MEMBER_CARD_H_TWD : MEMBER_CARD_H;
}

function memberGridAreaHeight(data) {
  const members = data.memberBalance || [];
  if (!members.length) return 0;
  const rows = Math.ceil(members.length / 2);
  return rows * memberCardHeightFor(data) + (rows - 1) * MEMBER_GRID_GAP_Y;
}

// 每人結算整個區塊（含區塊標題）在有資料時佔的高度，含後面銜接下一區塊的間距
function memberSectionHeight(data) {
  const members = data.memberBalance || [];
  if (!members.length) return 0;
  return 30 + memberGridAreaHeight(data) + SECTION_GAP;
}

function drawMemberCard(ctx, m, x, y, w, h, hasTwd) {
  roundRect(ctx, x, y, w, h, 18);
  ctx.fillStyle = '#FFFFFF'; ctx.fill();
  ctx.strokeStyle = '#F2E3D2'; ctx.lineWidth = 2; roundRect(ctx, x, y, w, h, 18); ctx.stroke();

  const padX = 20;
  let ty = y + 16;
  ctx.fillStyle = '#3B3330'; ctx.font = `900 16px ${FONT}`;
  ctx.fillText(truncate(ctx, m.name || '', w - padX * 2), x + padX, ty + 12);
  ty += 26;

  const statTopY = ty;
  ctx.strokeStyle = '#F0E2D2'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + padX, statTopY); ctx.lineTo(x + w - padX, statTopY); ctx.stroke();

  const statLine = (label, amount, twdAmount, lineY) => {
    ctx.fillStyle = '#6B739A'; ctx.font = `700 12.5px ${FONT}`;
    ctx.fillText(label, x + padX, lineY);
    ctx.textAlign = 'right';
    let rx = x + w - padX;
    if (twdAmount != null) {
      const twdText = `≈ ${Math.round(Number(twdAmount)).toLocaleString('en-US')} TWD`;
      ctx.fillStyle = '#B0A093'; ctx.font = `700 10.5px ${FONT}`;
      ctx.fillText(twdText, rx, lineY);
      rx -= ctx.measureText(twdText).width + 6;
    }
    const amt = `${Number(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} ${m.currency || ''}`;
    ctx.fillStyle = '#3B3330'; ctx.font = `900 13.5px ${FONT}`;
    ctx.fillText(amt, rx, lineY);
    ctx.textAlign = 'left';
  };
  statLine('實際花費', m.spent, m.spentTwd, statTopY + 20);
  statLine('已付款', m.paid, m.paidTwd, statTopY + 40);

  const statBottomY = statTopY + 50;
  ctx.strokeStyle = '#F0E2D2'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + padX, statBottomY); ctx.lineTo(x + w - padX, statBottomY); ctx.stroke();

  const bal = m.balance || 0;
  const balColor = bal > 0.01 ? '#3F8B76' : bal < -0.01 ? '#E37B7B' : '#B0A093';
  const balText = bal > 0.01 ? `應收回 ${Math.round(bal)}` : bal < -0.01 ? `應付出 ${Math.round(Math.abs(bal))}` : '已結清';
  ctx.fillStyle = balColor; ctx.font = `900 17px ${FONT}`;
  ctx.fillText(`${balText} ${m.currency || ''}`, x + padX, statBottomY + 26);
  if (hasTwd && m.balanceTwd != null) {
    ctx.fillStyle = '#B0A093'; ctx.font = `700 11.5px ${FONT}`;
    ctx.fillText(`≈ ${Math.round(Number(m.balanceTwd)).toLocaleString('en-US')} TWD`, x + padX, statBottomY + 42);
  }
}

function drawMemberGrid(ctx, data, y) {
  const members = data.memberBalance || [];
  if (!members.length) return y;

  drawSectionHeader(ctx, y, '每人結算', '#6FA8DC');
  y += 30;

  const hasTwd = data.totalTwd != null;
  const cardH = memberCardHeightFor(data);
  const cardW = (CONTENT_W - MEMBER_GRID_GAP_X) / 2;
  members.forEach((m, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = SIDE_PAD + col * (cardW + MEMBER_GRID_GAP_X);
    const cy = y + row * (cardH + MEMBER_GRID_GAP_Y);
    drawMemberCard(ctx, m, x, cy, cardW, cardH, hasTwd);
  });

  return y + memberGridAreaHeight(data) + SECTION_GAP;
}

// ---------------------------------------------------------------- 花費明細

const ROW_H = 60;
const ROW_H_WITH_TWD = 76; // 多一行「≈ X TWD」參考金額
const ROW_GAP = 10;

function rowHeightFor(exp) {
  return exp.twdAmount != null ? ROW_H_WITH_TWD : ROW_H;
}

function expenseAreaHeight(data) {
  const expenses = data.expenses || [];
  return expenses.length
    ? expenses.reduce((sum, e) => sum + rowHeightFor(e), 0) + (expenses.length - 1) * ROW_GAP
    : 30;
}

function drawExpenseList(ctx, data, y) {
  const expenses = data.expenses || [];
  const cur = data.currency || 'TWD';

  drawSectionHeader(ctx, y, '花費明細', '#F79256');
  y += 30;

  if (!expenses.length) {
    ctx.fillStyle = '#B0A093'; ctx.font = `13px ${FONT}`; ctx.fillText('尚無花費紀錄', SIDE_PAD, y + 16);
    return y + 30;
  }

  for (const exp of expenses) {
    const rowH = rowHeightFor(exp);
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
    const amountLeftEdgeX = SIDE_PAD + CONTENT_W - 20 - curW - 4 - amountW;

    // 分攤成員獨立占一欄，畫在說明文字跟金額中間，寬度固定，跟著金額欄的實際寬度往左排
    const SPLIT_COL_W = 150;
    const SPLIT_COL_GAP = 18;
    const splitColRightX = amountLeftEdgeX - SPLIT_COL_GAP;
    const splitColLeftX = splitColRightX - SPLIT_COL_W;

    const textTopY = y + rowH / 2 - 15;
    ctx.fillStyle = '#3B3330'; ctx.font = `900 16px ${FONT}`;
    ctx.fillText(truncate(ctx, exp.title || '', Math.max(40, splitColLeftX - textX - 12)), textX, textTopY + 10);

    ctx.font = `700 12.5px ${FONT}`;
    let mx = textX;
    const my = textTopY + 28;
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

    if (exp.splitNames) {
      ctx.fillStyle = '#A08C7D'; ctx.font = `700 11px ${FONT}`;
      ctx.fillText('分攤', splitColLeftX, y + rowH / 2 - 6);
      ctx.fillStyle = '#6B5B4E'; ctx.font = `700 13px ${FONT}`;
      ctx.fillText(truncate(ctx, exp.splitNames, SPLIT_COL_W), splitColLeftX, y + rowH / 2 + 12);
    }

    const amountCenterY = exp.twdAmount != null ? y + rowH / 2 - 8 : y + rowH / 2 + 6;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#3B3330'; ctx.font = `900 19px ${FONT}`;
    ctx.fillText(amountText, SIDE_PAD + CONTENT_W - 20 - curW - 4, amountCenterY);
    ctx.fillStyle = '#A08C7D'; ctx.font = `900 12px ${FONT}`;
    ctx.fillText(curLabel, SIDE_PAD + CONTENT_W - 20, amountCenterY);
    if (exp.twdAmount != null) {
      ctx.fillStyle = '#B0A093'; ctx.font = `700 11.5px ${FONT}`;
      ctx.fillText(`≈ ${Number(exp.twdAmount).toLocaleString('en-US', { maximumFractionDigits: 2 })} TWD`, SIDE_PAD + CONTENT_W - 20, amountCenterY + 18);
    }
    ctx.textAlign = 'left';

    y += rowH + ROW_GAP;
  }
  return y - ROW_GAP;
}

// ---------------------------------------------------------------- 建議轉帳

const SETTLE_ROW_H = 62;
const SETTLE_ROW_H_WITH_TWD = 82;

function settleRowHeightFor(s) {
  return s.twdAmount != null ? SETTLE_ROW_H_WITH_TWD : SETTLE_ROW_H;
}

function settleAreaHeight(data) {
  const settlements = data.settlements || [];
  return settlements.length
    ? settlements.reduce((sum, s) => sum + settleRowHeightFor(s), 0) + (settlements.length - 1) * ROW_GAP
    : SETTLE_ROW_H;
}

function drawSettleList(ctx, data, y) {
  const settlements = data.settlements || [];
  const cur = data.currency || 'TWD';

  drawSectionHeader(ctx, y, '建議轉帳（最少次數結清）', '#5FBFA8');
  y += 30;

  if (!settlements.length) {
    roundRect(ctx, SIDE_PAD, y, CONTENT_W, SETTLE_ROW_H, 20);
    ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.fillStyle = '#5FBFA8'; ctx.font = `900 14px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText('已全部結清 🎉', W / 2, y + SETTLE_ROW_H / 2 + 5);
    ctx.textAlign = 'left';
    return y + SETTLE_ROW_H;
  }

  for (const s of settlements) {
    const settleRowH = settleRowHeightFor(s);
    roundRect(ctx, SIDE_PAD, y, CONTENT_W, settleRowH, 20);
    ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = '#B9DFD1'; ctx.lineWidth = 2;
    roundRect(ctx, SIDE_PAD, y, CONTENT_W, settleRowH, 20); ctx.stroke();
    ctx.setLineDash([]);

    const rowCenterY = s.twdAmount != null ? y + settleRowH / 2 - 9 : y + settleRowH / 2;
    let cx = SIDE_PAD + 24;
    cx = drawSettleChip(ctx, cx, rowCenterY, s.from, '#FBE3CF', '#C4703A');

    ctx.strokeStyle = '#5FBFA8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx + 6, rowCenterY); ctx.lineTo(cx + 40, rowCenterY); ctx.stroke();
    ctx.fillStyle = '#5FBFA8';
    ctx.beginPath(); ctx.moveTo(cx + 40, rowCenterY - 6); ctx.lineTo(cx + 40, rowCenterY + 6); ctx.lineTo(cx + 49, rowCenterY); ctx.closePath(); ctx.fill();
    cx += 55;

    cx = drawSettleChip(ctx, cx, rowCenterY, s.to, '#DCEFE6', '#3F8B76');

    const amt = `${Number(s.amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} ${s.currency || cur}`;
    ctx.font = `900 17px ${FONT}`;
    const pillW = ctx.measureText(amt).width + 36;
    const pillH = 40;
    const pillX = SIDE_PAD + CONTENT_W - 24 - pillW;
    const pillY = rowCenterY - pillH / 2;
    roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fillStyle = '#5FBFA8'; ctx.fill();
    ctx.fillStyle = '#FFFDF8'; ctx.textAlign = 'center';
    ctx.fillText(amt, pillX + pillW / 2, pillY + pillH / 2 + 6);
    if (s.twdAmount != null) {
      ctx.fillStyle = '#B0A093'; ctx.font = `700 11.5px ${FONT}`;
      ctx.fillText(`≈ ${Number(s.twdAmount).toLocaleString('en-US', { maximumFractionDigits: 0 })} TWD`, pillX + pillW / 2, pillY + pillH + 14);
    }
    ctx.textAlign = 'left';

    y += settleRowH + ROW_GAP;
  }
  return y - ROW_GAP;
}

// ---------------------------------------------------------------- 兩張卡片各自的組裝

// 第一張：總花費 + 每人結算 + 建議轉帳
export function buildSummaryCardCanvas(data) {
  const H =
    H_PAD + HEADER_ADVANCE + statRowHeight(data) + memberSectionHeight(data) + 30 + settleAreaHeight(data) +
    FOOTER_GAP_BEFORE + BOTTOM_MARGIN;

  const { canvas, ctx } = setupCanvas(H);
  let y = H_PAD;
  y = drawHeader(ctx, data, y);
  y = drawStatRow(ctx, data, y);
  y = drawMemberGrid(ctx, data, y);
  y = drawSettleList(ctx, data, y);
  y += FOOTER_GAP_BEFORE;
  drawFooter(ctx, data, y);

  return canvas;
}

// 第二張：花費明細
export function buildExpenseListCardCanvas(data) {
  const H = H_PAD + HEADER_ADVANCE + 30 + expenseAreaHeight(data) + FOOTER_GAP_BEFORE + BOTTOM_MARGIN;

  const { canvas, ctx } = setupCanvas(H);
  let y = H_PAD;
  y = drawHeader(ctx, data, y);
  y = drawExpenseList(ctx, data, y);
  y += FOOTER_GAP_BEFORE;
  drawFooter(ctx, data, y);

  return canvas;
}

function downloadCanvas(canvas, filename) {
  return new Promise((resolve, reject) => {
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

export async function downloadExpenseReportCard(reportData, filenameBase) {
  const summaryCanvas = buildSummaryCardCanvas(reportData);
  const detailCanvas = buildExpenseListCardCanvas(reportData);
  await downloadCanvas(summaryCanvas, `${filenameBase}-總覽.png`);
  // 兩個檔案幾乎同時觸發下載，瀏覽器第一次可能會跳出「這個網站想要下載多個檔案」的
  // 攔截提示（使用者要按一次「允許」，這是瀏覽器本身的機制，程式碼繞不過去）；隔一點
  // 時間再觸發第二個，至少能降低被當成同時發生、直接擋下來的機會。
  await new Promise((r) => setTimeout(r, 300));
  await downloadCanvas(detailCanvas, `${filenameBase}-明細.png`);
}
