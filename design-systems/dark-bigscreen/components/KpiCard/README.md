超大 KPI 卡：一張卡只放一個指標——標籤、92px 主數字（含單位）、增減與比較基準。

## 結構
- 容器：由 `card-raised` 往 `card` 的垂直漸層，1px `line` 外框，`radius-md`（18px），內距 18px 28px。
- 標籤：`kpi-label`（26px、`ink-soft`）。
- 主數字：`kpi-number`（92px、800、等寬數字）＋ `kpi-unit`（36px、600、`ink-soft`，距數字 6px）。顏色依卡片順序取 `chart-1`、`chart-2`、`chart-3`、`chart-4`。
- 增減：`kpi-delta`（28px、700），正 `pos`、負 `neg`，帶 ▲／▼；後接 22px `ink-soft` 的比較基準（「較去年同期」）。

## 規則
- 4 張等寬排成一列（`repeat(4,1fr)`，間距 20px）；多於 4 張就拆屏。
- 數字顏色代表第幾個指標，不代表好壞；好壞看增減那一行。
- 主數字不超過 5 個字元（含小數點）；太長改用「萬」「M」單位。
