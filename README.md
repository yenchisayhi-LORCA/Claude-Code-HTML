# 🧳 旅遊記帳系統

純前端（HTML/CSS/JavaScript，無框架、無建置流程）的旅遊花費記帳工具，資料儲存在瀏覽器 localStorage，不需要後端伺服器或帳號登入。

## 功能

- **多趟旅程管理**：可建立多個旅程分別記帳，並隨時切換、編輯、刪除。
- **花費分類**：內建常見分類（餐飲、住宿、交通…），也可自訂新增/刪除分類。
- **即時匯率換算**：新增花費時可選擇當地幣別，系統會用即時匯率自動換算成旅程的基準貨幣來統計總花費（使用免金鑰的 [@fawazahmed0/currency-api](https://github.com/fawazahmed0/exchange-api)，含台幣 TWD）。
- **跟朋友分帳**：每筆花費可指定付款人與分攤成員（平均分攤或自訂金額），系統會自動計算每人的淨餘額，並用最少轉帳次數算出「誰該付誰多少錢」。
- **預算控管**：可設定旅程總預算，即時顯示花費進度條與超支提醒。
- **統計圖表**：分類花費比例圓餅圖、每日花費趨勢長條圖。
- **收據照片**：可為每筆花費附上收據照片（會自動壓縮以節省儲存空間）。
- **匯出報表**：一鍵匯出 Excel (.xlsx) 或 CSV，或列印/另存成 PDF 的花費報表。
- **多裝置同步（選用）**：設定好 Firebase 後，可用 Google 帳號登入，讓同一個帳號在電腦、手機等不同裝置間同步旅程資料。沒設定的話完全不影響其他功能，資料就只存在本機。

## 如何執行

這是純前端專案，但因為使用了 ES modules 與 `fetch`，瀏覽器對 `file://` 協定會有安全限制，**需要透過本機伺服器開啟**，不能直接雙擊 `index.html`。任選一種方式：

```bash
# 方法一：Python
python3 -m http.server 8080

# 方法二：Node.js
npx serve .
```

然後用瀏覽器開啟 `http://localhost:8080`（或對應的網址）。

## 部署

因為是純靜態網頁，可直接部署到 GitHub Pages、Netlify、Vercel 等靜態代管服務，不需要任何後端設定。

## 資料儲存與限制

- 所有資料預設存在瀏覽器的 `localStorage`，**只存在於目前這個瀏覽器/裝置**，換瀏覽器或清除瀏覽器資料會遺失紀錄，請定期使用「匯出報表」備份。設定好雲端同步（見下方）後，同一個 Google 帳號的資料會額外保存一份在 Firestore，換裝置登入就能拿回來。
- 分帳功能是「單機計算器」性質：所有人的花費由同一台裝置的使用者輸入紀錄，並非每個朋友各自登入即時協作的系統；雲端同步解決的是「同一個人的資料跨裝置同步」，不是多人協作。
- localStorage 通常有 5MB 左右的容量限制，收據照片會自動壓縮，但仍建議定期清理不需要的舊旅程或照片。雲端同步的 Firestore 單一文件也有約 1MB 上限，收據照片太多可能導致同步失敗（本機資料不受影響，畫面上會顯示同步失敗的提示）。
- 匯率為即時抓取的當日匯率（非交易當下的歷史匯率），僅供旅遊記帳估算使用。

## 設定多裝置同步（選用）

不設定的話，App 其他功能完全正常，只是資料不會跨裝置同步。要開啟這個功能：

1. 到 [Firebase Console](https://console.firebase.google.com/) 建立一個新專案（可以關閉 Google Analytics，不需要）。
2. 左側選單 **Build → Authentication → 開始使用 → Sign-in method**，啟用 **Google** 登入方式。
3. 左側選單 **Build → Firestore Database → 建立資料庫**，選正式環境（production mode）、地區選離你近的（例如 asia-east1）。
4. 到 Firestore 的 **規則（Rules）** 分頁，貼上以下規則後發布，讓每個人只能讀寫自己的資料：
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```
5. 專案設定（齒輪圖示）→ 你的應用程式 → 點 `</>` 新增網頁應用程式 → 取名並註冊，會拿到一組 `firebaseConfig` 設定值。
6. 把這組設定值貼到 `js/firebase-config.js` 取代裡面的預留值。
7. **Authentication → Settings → 已授權網域**，把你網站的網域（例如 `your-name.github.io`）加進去，Google 登入才會允許。

設定完成後，重新整理網頁，右上角會出現「☁️ 登入同步」按鈕。

## 專案結構

```
index.html          主頁面結構與所有彈窗（Dialog）
css/style.css        樣式
js/
  app.js             主要邏輯：畫面渲染、事件綁定
  storage.js         localStorage 資料存取（旅程/花費/成員/分類 CRUD）
  currency.js        即時匯率抓取與轉換
  split.js           分帳計算（淨餘額 + 最少轉帳次數演算法）
  charts.js          手刻 SVG 圖表（圓餅圖、長條圖），不依賴外部套件
  export.js          Excel / CSV 匯出、列印報表
  xlsx-writer.js     手刻最小可用 .xlsx 產生器，不依賴外部套件
  image.js           收據照片壓縮
  cloud-sync.js      多裝置同步（Firebase Auth + Firestore，選用）
  firebase-config.js 雲端同步的 Firebase 設定值（預留值，需自行填入才會啟用）
```
