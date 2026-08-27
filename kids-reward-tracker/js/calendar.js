// 月曆格 + streak 徽章的畫面渲染小工具。實際的「哪幾天有活動」資料來自 ledger.js 的
// getMonthCalendar()，這裡只負責把那份資料排成 HTML。

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

export function formatMonthLabel(year, month) {
  return `${year} 年 ${month + 1} 月`;
}

export function renderCalendarGrid(cells) {
  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const header = WEEKDAY_LABELS.map((w) => `<div class="cal-weekday">${w}</div>`).join('');
  const days = cells
    .map((cell) => {
      if (!cell) return `<div class="cal-cell cal-empty"></div>`;
      const classes = ['cal-cell'];
      if (cell.hasActivity) classes.push('cal-active');
      if (cell.dateStr === todayKey) classes.push('cal-today');
      return `<div class="${classes.join(' ')}"><span class="cal-day-num">${cell.day}</span>${cell.hasActivity ? '<span class="cal-star">⭐</span>' : ''}</div>`;
    })
    .join('');

  return `<div class="cal-grid">${header}${days}</div>`;
}

export function renderStreakBadge(streak) {
  if (streak <= 0) return `<div class="streak-badge streak-none">還沒開始連續紀錄，今天完成一項任務開始吧！</div>`;
  const flames = streak >= 30 ? '🔥🔥🔥' : streak >= 14 ? '🔥🔥' : '🔥';
  return `<div class="streak-badge"><span class="streak-flames">${flames}</span> 連續 <strong>${streak}</strong> 天都有完成任務！</div>`;
}
