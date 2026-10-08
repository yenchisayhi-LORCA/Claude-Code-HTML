# Icons

24 個手繪線稿圖示（`ic-*.svg`），viewBox 48（`ic-squiggle` 為 60×24），`stroke-width` 3.2（裝飾用 `ic-squiggle`、`ic-arrow` 為 3.4），round cap / join，不填色。

- 檔案中的線色寫死為 `ink-navy` #262261（以 `<img>` 顯示時無法用 currentColor）。在程式中改用 inline `<symbol>` sprite 並設 `stroke="currentColor"`，即可繼承文字色（例如選中分頁上的黃色）。
- TASK_ICONS（16）：broom、tooth、book、dish、bed、run、plant、paw、music、shirt、bag、star、heart、flower、pencil、sparkle。
- SHOP_ICONS（12）：含 gift、shop、trophy 等。
- 裝飾用、不開放選擇：`ic-squiggle`、`ic-arrow`。
