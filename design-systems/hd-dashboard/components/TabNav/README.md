頁面主導覽：一排膠囊頁籤，放在頁首下方並黏在視窗頂端（`position:sticky; top:8px`）。

## 規則
- 容器：`card` 底、`line` 1px 邊框、`radius-lg`、`shadow-sticky`。
- 啟用頁籤：`brand` 底、白字（白字在橘色上對比僅約 2.3:1，務必 14px 粗體；新設計可改用 `ink` 字，對比約 6:1）；未啟用：`paper-dim` 底、`ink-soft` 字、`line` 邊框；hover 時邊框與文字變 `brand`。
- 同一時間只有一個啟用頁籤；頁籤文字簡短（2–8 字），不使用圖示。
- 切換頁籤只顯示／隱藏面板，資料更新由各面板自行處理。
