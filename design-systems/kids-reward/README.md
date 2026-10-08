# 兒童獎勵紀錄本

塗鴉童趣風：高彩度原色 + 米白紙感背景，墨藍色收斂所有文字與線稿圖示，不用灰階中性色。像貼在冰箱上的手作貼紙，鮮豔、圓潤、有點歪歪的。App 內標題寫作「小孩獎勵紀錄本」。

## 內容基調

- 對孩子說話：短句、肯定語氣。例：「連續 5 天都有完成任務！」「還沒開始連續紀錄，今天完成一項任務開始吧！」
- 數字是主角：星星數、餘額、進度分數用 Gluten（`num-*` 樣式），文字退居說明。
- 鼓勵而非責備：未達門檻寫「還差 15 顆」，不寫「未達成」。
- 星星一律用手繪 `ic-star` 圖示，不用 emoji。

## 視覺基礎

**顏色。** 頁面底 `cream-paper`，卡片 `white`，文字與線稿 `ink-navy`。
- 紅色是**主要動作**色：按鈕底 `tomato-deep`（儲存），進度條與分數 `tomato-red`；`block-blue` 是次要動作（＋新增小孩）；`sun-yellow` 是獎勵色（星星徽章、兌換、選中的小孩、餘額卡、已解鎖獎狀）。
- `lake-teal`、`bubble-pink` 主要出現在小怪獸頭像；完成狀態用 `teal-100` 底 + `teal-text` / `teal-check`。
- 狀態靠**換底色**表達，不加勾選框：完成 → `teal-100`；未解鎖／停用 → `surface-disabled`。
- 亮色底（`sun-yellow`、`lake-teal`、`bubble-pink`）上的字一律 `ink-navy`。

**對比修正（2026-10-06）：** 原設計中對比不足的組合已調整如下。

| 位置 | 原本 | 改為 | 對比 |
| --- | --- | --- | --- |
| 紅色按鈕（儲存、退回）白字 | `tomato-red` 底 3.91:1 | `tomato-deep` #D93A2F 底 | 4.57:1 |
| 餘額卡數字 | `tomato-red` on 黃 2.74:1 | `ink-navy` | 9.9:1 |
| 退回徽章 | `tomato-red` on `pink-100` 2.85:1 | `tomato-text` #B8261E | 4.6:1 |
| 核准徽章、完成勾勾 | `teal-check` #1F8A79 3.45:1 | `teal-check` 改為 #17705F | 4.87:1 |
| 未解鎖獎狀文字 | `text-disabled-2` 2.0:1 | `text-body` | 5.73:1 |
| 尚無連續紀錄 streak | `text-muted` 500 2.88:1 | `text-body` 700 | 5.73:1 |
| 新增小孩虛線框 | `border-dashed` #C7C4DE 1.65:1 | `border-dashed` 改為 #8F8CB5 | 3.1:1 |
| 區塊小標、表單欄位名稱 | `text-muted` 3.3:1 | `text-body` | 6.5:1 |

- 規則：紅色當**底**用 `tomato-deep`，紅色當**小字**用 `tomato-text`；`tomato-red` 留給進度條、大字分數與裝飾。黃底上的字一律 `ink-navy`。

**字體。** Gluten（圓潤手寫感）只給數字與英文小標；Noto Sans TC 負責所有中文。中文標題與按鈕用 900，內文最細 500，**不用 300/400**；淺色底上的提示文字用 700。

```html
<link href="https://fonts.googleapis.com/css2?family=Gluten:wght@600;700;800&family=Noto+Sans+TC:wght@500;700;900&display=swap" rel="stylesheet">
```

**形狀。**

| 元素 | 圓角 token |
| --- | --- |
| 按鈕、徽章、進度條、分頁列、streak、小孩分頁 | `radius-pill` 999px |
| 對話框／表單面板 | `radius-panel` 40px |
| 餘額卡、獎狀卡 | `radius-hero` 34px |
| 白底卡片（無邊框、無陰影） | `radius-card` 28px |
| 設定列表項目 | `radius-list` 20px |
| 輸入框、圖示選擇格 | `radius-input` 18px |
| icon-only 按鈕 | `radius-icon-btn` 10px |

- 立體感不靠陰影：按鈕 hover 上浮 2px、active 下沉。唯一的陰影是對話框的 `shadow-frame`。
- 手工感：icon-chip、app-logo、獎狀卡、選中的圖示選項都略微旋轉（±2~5 度）。

## 圖示

- 手繪線稿 SVG，`viewBox 0 0 48 48`、`stroke-width` 3.2（`icon-stroke`）、round cap / join、`fill="none"`、顏色 `currentColor` 繼承 `ink-navy`。不用 emoji，不用色塊填滿（唯一例外：進度條終點的實心黃星）。
- 實作上存成同一份 `<symbol>` sprite，用 `<svg><use href="#ic-star"></svg>` 引用。
- 子集合：**TASK_ICONS**（16 個，作業可選）、**SHOP_ICONS**（12 個，商品可選）；`ic-squiggle`、`ic-arrow` 只做裝飾。
- 檔案在 Assets 的 Icons 群組。

## icon-chip 與小怪獸頭像

- **icon-chip**：圖示放在淺色不規則色塊上；底色在 `yellow-100` → `blue-100` → `pink-100` → `teal-100` 間輪替，圓角八個值各在 40–65%、旋轉 ±4 度內，全由項目 id 的 hash 算出，同一項目永遠長一樣。尺寸 64／60／40px，圖示約為色塊的 55%。
- **色塊小怪獸**：沒有照片的小孩用一個圓潤 blob + 兩個圓點眼睛 + 一條微笑弧線。顏色由小孩 id 的 hash 在 `bubble-pink`、`lake-teal`、`sun-yellow`、`block-blue` 間決定；`block-blue` 那隻的五官改用白色。

## 元件總覽

元件頁依原始設計稿收錄：Buttons、CardsLists、BadgesProgress、AvatarsChips、HeaderHeroForms；基礎頁：Colors、Typography、Icons。
