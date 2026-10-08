# 設計系統備份

從 Claude「成品」頁面匯出的設計系統原始檔（2026-10-08 備份）。每個資料夾對應一個成品，內容就是該成品 `project/` 底下的檔案：

- `README.md`：設計說明（內容原則、色彩、字型、使用規則）
- `tokens.json`：色彩、字型、間距、圓角、陰影
- `components/<元件>/`：各元件的說明與預覽 HTML
- `export-spec.md`：匯出 Excel／Word 的規格（有的才有）
- `assets/`：圖示 SVG（有的才有）
- `design-system.json`：成品的索引檔

| 資料夾 | 成品名稱 | 原連結 |
| --- | --- | --- |
| `soft-dashboard` | 柔和儀表板 | https://claude.ai/artifact/QjBjp4j2RiwbKjbws9b4GQ |
| `kids-reward` | 童趣風（兒童獎勵紀錄本） | https://claude.ai/artifact/YLUwVvnur8cVTiF3wg4DGV |
| `travel-colorful` | 旅遊繽紛風格（旅遊記帳系統） | https://claude.ai/artifact/9eJxdf8rQ5fhVzn4tcS3W7 |
| `holiday-dashboard` | HOLIDAY 損益儀表板 | https://claude.ai/artifact/NDXSsgy3oMpLuDdkboqfNA |
| `dark-bigscreen` | 深色儀表板（大螢幕看板） | https://claude.ai/artifact/JRT4GsTxCuqTmPPVtF6B3q |
| `cashbox-dashboard` | CASHBOX 儀表板 | https://claude.ai/artifact/YS6EpNPc3mbxoNYNqchH1b |
| `cb-dashboard` | CB 儀表板 | https://claude.ai/artifact/JXPeRRfozLqiX9jajjyN7W |
| `hd-dashboard` | HD 儀表板 | https://claude.ai/artifact/6zwUMzyx4vK8j33X3MaYgu |

元件預覽 HTML 用的是 `var(--paper)` 這類 CSS 變數，原本由成品頁面依 `tokens.json` 注入；單獨開啟時顏色不會套用，對照 `tokens.json` 即可還原。
