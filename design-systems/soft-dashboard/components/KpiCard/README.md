KPI 卡：奶油白大圓角卡片，由標籤、30px 大數字與增減率組成。

## 結構
- 容器：`card` 底、無邊框、`radius-lg`（20px）、`shadow-panel`、內距 20px。
- 標籤：`label`（13px、`ink-soft`）。
- 大數字：`kpi-number`（30px、700、等寬數字、`ink`），間距上 8px、下 6px。
- 增減：`kpi-delta`（13px、600）——正 `pos-ink`、負 `neg-ink`，帶 ▲▼；後接 `ink-soft` 的比較基準（400、距 4px）。

## 規則
- 4 張等寬排成一列（`repeat(4,1fr)`，間距 16px）；視窗窄時 2 欄、再窄時 1 欄。
- 大數字不超過 8 個字元；單位放在標籤或 caption。
- 卡片沒有色條與邊框；類型用標籤文字說明，不靠顏色。
