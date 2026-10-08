膠囊形按鈕與狀態標籤，以及表單控制項外觀。

## 變體
- **實心按鈕（主要）**：`accent-ink` 底、`card` 白字、`radius-md`（12px）、內距 8px 16px、13px 粗體；hover 稍微加深。用於「匯出」「產生」。
- **外框按鈕**：`card` 底、`accent-ink` 文字、1px `line-control` 外框、`radius-md`；hover 填 `accent-soft`。用於次要動作。
- **標籤（狀態）**：膠囊、12px 粗體、內距 2px 12px，淡底＋深色字：優／正向＝`pos-soft`＋`pos-ink`；中／留意＝`sand-soft`＋`sand-ink`；劣／重大＝`neg-soft`＋`neg-ink`。
- **輸入框、下拉**：`card` 底、1px `line-control` 外框、`radius-md`、13px；focus 時外框改 `accent-ink` 並加 2px `accent-soft` 外光圈。

## 規則
- 一個區塊最多一個實心按鈕。
- 標籤一律短詞（1–4 字），不可只靠顏色表達狀態。
- 不使用 `accent` 原色當文字或當白字底色（約 2.8:1）。
