// 直接沿用根目錄旅遊記帳系統已經設定好的同一個 Firebase 專案（這組設定值本身不是密鑰，
// 官方文件說明可以安全地放在前端程式碼裡，見 js/cloud-sync.js 開頭的說明）。不需要另外
// 申請一個新專案；資料會寫進不同的 Firestore collection（kids_reward_users），
// 不會跟旅遊記帳系統的 users/shared_trips 資料混在一起。

export const firebaseConfig = {
  apiKey: 'AIzaSyCW8WyZ4fSwEDnrcXiJceOaVaYFyXzsQOM',
  authDomain: 'papago-a4f14.firebaseapp.com',
  projectId: 'papago-a4f14',
  storageBucket: 'papago-a4f14.firebasestorage.app',
  messagingSenderId: '241878517605',
  appId: '1:241878517605:web:49ce55e31832b071c0c38c',
};

export const isFirebaseConfigured = firebaseConfig.apiKey !== 'YOUR_API_KEY';
