柔和表格：只有橫向細線、沒有垂直線與斑馬紋，最右欄是膠囊分級標籤。

## 結構
- 容器：`card` 卡片（`radius-lg`、`shadow-panel`、內距 20px）；標題 `card-title`，單位用 `caption`。
- 表頭：`table-head`（13px、500、`ink-soft`），靠左（數字欄靠右），底線 1px `line`，不填底色。
- 內文：`body`（13px、等寬數字）；儲存格內距 9px 6px、列線 1px `line`；名稱靠左、數字靠右。
- 資料條（選用）：欄內 8px 高膠囊，軌道 `line`、填色 `accent`，旁邊一定放數值。
- 分級標籤：膠囊，優＝`pos-soft`＋`pos-ink`、中＝`sand-soft`＋`sand-ink`、劣＝`neg-soft`＋`neg-ink`。

## 規則
- 負值用 `neg-ink` 並保留負號；增減率帶 ▲▼ 與正負號。
- 欄位多時外層橫向捲動，第一欄保持不換行。
- 合計列加粗、上緣 1px `line-control`，不加底色。
