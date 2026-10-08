大螢幕表格：列名靠左、數字置中、25px 大字，只有橫向列線；最右欄放膠囊狀分級標籤。

## 結構
- 容器：`card` 面板（`line` 外框、`radius-md`），標題用 `panel-title`。
- 表頭：`table-head`（25px、500、`ink-soft`），底線 1px `line`，置中；第一欄靠左、寬 150px。
- 內文：`table`（25px、等寬數字、置中），列線 1px `line`；儲存格內距 5px 10px。
- 分級標籤：膠囊（`radius-pill`），最小寬 60px、內距 2px 14px、800 粗；「優」＝`pos`字＋`pos-soft`底、「中」＝`gold`＋`gold-soft`、「劣」＝`neg`＋`neg-soft`。

## 規則
- 欄位最多 5 欄、列數最多 6 列；放不下就改用 RankBars 或拆屏。
- 不加斑馬紋、不加垂直線；強調某列時只把該列文字改 `ink` 並加粗。
- 數值負向用 `neg`，並保留負號。
