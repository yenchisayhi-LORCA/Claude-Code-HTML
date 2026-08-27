// 到 Firebase Console（https://console.firebase.google.com/）建立專案後，
// 在「專案設定 → 你的應用程式 → 新增網頁應用程式」註冊一個網頁 App，
// 會拿到類似下面這樣的設定值，整組貼過來取代這裡的預留值即可。
//
// 這組設定值本身不是密鑰，Firebase 官方説明文件說明它可以安全地放在前端程式碼、
// 甚至公開在 GitHub 上；真正的存取權限控管是靠 Firestore 安全規則（Security Rules），
// 不是靠隱藏這組設定值。
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

// 還沒設定好之前，雲端同步功能會自動停用（只用本機 localStorage），不影響其他功能。
export const isFirebaseConfigured = firebaseConfig.apiKey !== 'YOUR_API_KEY';
