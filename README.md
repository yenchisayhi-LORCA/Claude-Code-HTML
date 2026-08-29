# 🧳 旅遊記帳系統

純前端（HTML/CSS/JavaScript，無框架、無建置流程）的旅遊花費記帳工具，資料儲存在瀏覽器 localStorage，不需要後端伺服器或帳號登入。

## 其他專案

這個 repo 裡還有其他完全獨立的小工具，跟本文件描述的旅遊記帳系統無關，只是共用同一個 repo：

- [🌟 小孩獎勵紀錄本](kids-reward-tracker/README.md)（作業給星星、獎狀、儲蓄挑戰）
- [🖼️ 照片沖印排版](photo-print-layout/README.md)（自訂底稿樣板，套照片匯出 4×6／5×7 沖印用圖檔）

## 功能

- **多趟旅程管理**：可建立多個旅程分別記帳，並隨時切換、編輯、刪除；每個旅程可上傳一張封面照片，一眼認出現在是哪趟旅程。
- **成員名單（跨旅程通用）**：點右上角「👤 管理成員」統一管理常出遊的朋友名單（姓名＋大頭貼），建立新旅程或替旅程加人時直接勾選就好，不用每次重新輸入名字或上傳照片。
- **花費分類**：內建常見分類（餐飲、住宿、交通…），新增分類時可從約 45 個常見圖示中選擇，也可自訂新增/刪除分類。
- **即時匯率換算**：新增花費時可選擇當地幣別，系統會用即時匯率自動換算成旅程的基準貨幣來統計總花費（使用免金鑰的 [@fawazahmed0/currency-api](https://github.com/fawazahmed0/exchange-api)，含台幣 TWD）。
- **跟朋友分帳**：每筆花費可指定付款人與分攤成員（平均分攤或自訂金額），系統會自動計算每人的淨餘額，並用最少轉帳次數算出「誰該付誰多少錢」。
- **預算控管**：可設定旅程總預算，即時顯示花費進度條與超支提醒。
- **統計圖表**：分類花費比例圓餅圖、每日花費趨勢長條圖。
- **收據照片**：可為每筆花費附上收據照片（會自動壓縮以節省儲存空間）。
- **匯出報表**：一鍵匯出 Excel (.xlsx) 或 CSV，或列印/另存成 PDF 的花費報表。
- **多裝置同步（選用）**：設定好 Firebase 後，可用 Email 登入（收信點連結，不用密碼），讓同一個帳號在電腦、手機等不同裝置間同步旅程資料。沒設定的話完全不影響其他功能，資料就只存在本機。
- **分享單一旅程給同行者（選用，唯讀）**：需要先設定好多裝置同步。把同行者的 Email 加進某趟旅程的分享名單後，對方用同一個 Email 登入分享連結，就能唯讀檢視這一趟旅程的花費明細、統計圖表、分帳結算，看不到你的其他旅程或成員名單。

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

- 所有資料預設存在瀏覽器的 `localStorage`，**只存在於目前這個瀏覽器/裝置**，換瀏覽器或清除瀏覽器資料會遺失紀錄，請定期使用「匯出報表」備份。設定好雲端同步（見下方）後，同一個帳號的資料會額外保存一份在 Firestore，換裝置登入就能拿回來。
- 分帳功能是「單機計算器」性質：所有人的花費由同一台裝置的使用者輸入紀錄，並非每個朋友各自登入即時協作的系統；雲端同步解決的是「同一個人的資料跨裝置同步」，不是多人協作。
- localStorage 通常有 5MB 左右的容量限制，收據照片會自動壓縮，但仍建議定期清理不需要的舊旅程或照片。雲端同步每趟旅程各自存成一份 Firestore 文件，單一份文件約有 1MB 上限——單一趟旅程的照片太多可能導致「那一趟旅程」同步失敗（本機資料不受影響，其他旅程仍會正常同步，畫面上也會清楚顯示是哪一趟旅程超過上限）。
- 匯率為即時抓取的當日匯率（非交易當下的歷史匯率），僅供旅遊記帳估算使用。

## 設定多裝置同步（選用）

不設定的話，App 其他功能完全正常，只是資料不會跨裝置同步。要開啟這個功能：

1. 到 [Firebase Console](https://console.firebase.google.com/) 建立一個新專案（可以關閉 Google Analytics，不需要）。
2. 左側選單 **Build → Authentication → 開始使用 → Sign-in method**，啟用 **Email/Password** 這個項目，並把裡面的 **Email link (passwordless sign-in)** 選項也打開。
3. 左側選單 **Build → Firestore Database → 建立資料庫**，選正式環境（production mode）、地區選離你近的（例如 asia-east1）。
4. 到 Firestore 的 **規則（Rules）** 分頁，貼上以下規則後發布：
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
         match /trips/{tripId} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }
       }
       match /shared_trips/{tripId} {
         allow get: if request.auth != null && request.auth.token.email_verified == true &&
           (request.auth.uid == resource.data.ownerId || request.auth.token.email in resource.data.viewerEmails);
         allow list: if false;
         allow create: if request.auth != null && request.auth.uid == request.resource.data.ownerId;
         allow update, delete: if request.auth != null && request.auth.uid == resource.data.ownerId;
       }
     }
   }
   ```
   第一段（`users/{userId}`）讓每個人只能讀寫自己的帳號同步資料（目前登入的旅程 ID、成員名單），底下巢狀的 `trips/{tripId}` 是每一趟旅程各自一份的文件（這樣單一趟旅程的照片再多，也不會拖累其他旅程的同步，也不會撞到 Firestore 單一文件 1MB 的上限就整個帳號都同步不了）；第二段（`shared_trips/{tripId}`）是給「分享單一旅程」用的，只有旅程擁有者本人、或被列在 `viewerEmails` 白名單裡的 Email，才能讀到那一份被分享出去的單一旅程內容，讀不到別人的其他旅程。

   > **既有專案要升級請注意**：如果你的 Firebase 專案是舊版就建立的，Firestore 規則分頁裡可能還是只有 `users/{userId}` 那一段、沒有巢狀的 `trips/{tripId}`。請照上面整段規則重新貼上、發布，不然雲端同步會被全部拒絕（畫面上會出現「同步失敗：雲端資料庫拒絕存取」的提示）。既有帳號的舊資料會在下次登入時自動搬到新的儲存結構，不用手動搬移。
5. 專案設定（齒輪圖示）→ 你的應用程式 → 點 `</>` 新增網頁應用程式 → 取名並註冊，會拿到一組 `firebaseConfig` 設定值。
6. 把這組設定值貼到 `js/firebase-config.js` 取代裡面的預留值。
7. **Authentication → Settings → 已授權網域**，把你網站的網域（例如 `your-name.github.io`）加進去，登入連結才會允許導回你的網站。

設定完成後，重新整理網頁，右上角會出現「☁️ 登入同步」按鈕：輸入 Email、收信點連結，就能在其他裝置用同一個 Email 登入看到同一份資料。

（技術背景：一開始用的是 Google 一鍵登入，但 Google 登入的彈出視窗/整頁導轉都需要瀏覽器允許本站跟 Firebase 的 authDomain 互相存取資料，而這種跨網域存取現在被 Safari／Firefox 封鎖、Chrome 也在跟進，在 GitHub Pages 這種跟 Firebase 網域不同的靜態網站上會直接失效。改用 Email 連結登入完全不需要跳出視窗或跨網域，不會受影響。）

## 分享單一旅程給同行者（選用，唯讀）

需要先完成上面的「設定多裝置同步」（分享功能是建立在同一套 Firebase 專案上的）。

1. 登入雲端同步後，打開某趟旅程的「匯出報表」分頁，點「🔗 分享此旅程（唯讀）」。
2. 輸入同行者的 Email 並「新增」，就會產生一個分享連結（`?share=<旅程ID>`），複製給對方。
3. 同行者打開連結後，用**同一個 Email** 收登入連結、點開完成登入，就能唯讀檢視這趟旅程；之後你繼續記帳，對方畫面會自動即時更新，不用重新分享。
4. 把某人的 Email 從名單移除、或清空整個名單，就會立刻收回他的存取權（清空名單等於直接刪除這份分享資料）。

限制：唯讀檢視頁目前不會另外抓即時匯率，混合幣別的旅程只會把跟旅程基準貨幣相同的花費計入圖表/總計；分帳結算功能本來就是單機記帳性質（見上方「資料儲存與限制」），這個唯讀分享不會變成多人協作記帳。

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
  cloud-sync.js      多裝置同步（Firebase Auth + Firestore，選用）＋分享單一旅程的推送/檢視者登入邏輯
  share-view.js      分享連結（?share=）的唯讀檢視頁，不會用到本機旅程資料
  firebase-config.js 雲端同步的 Firebase 設定值（預留值，需自行填入才會啟用）
```
