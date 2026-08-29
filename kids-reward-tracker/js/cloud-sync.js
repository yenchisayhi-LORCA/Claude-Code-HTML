// 多裝置同步：跟根目錄旅遊記帳系統的 js/cloud-sync.js 同一套做法——用 Firebase
// Authentication 的「Email 連結登入」(passwordless email link) 辨識「你是誰」，用 Firestore
// 存放資料，這樣同一個 Email 在不同裝置（手機、小孩的平板）登入時能看到同一份資料、即時同步。
// 沒有設定 firebase-config.js 之前，這個模組完全不會啟用，其他功能不受影響。
//
// 這裡刻意直接沿用同一個 Firebase 專案，但寫進不同的 Firestore collection
// （kids_reward_users，不是旅遊記帳系統用的 users），兩邊資料不會互相干擾；因為是同一個
// Firebase 專案，登入狀態也是同源共用的——如果這台裝置的瀏覽器已經在旅遊記帳系統登入過
// 同一個 Email，打開這個 app 時通常會自動已經是登入狀態，不用重新收信驗證一次。
//
// 不用 Google 登入彈出視窗/整頁導轉的原因、Email 連結登入的細節，都跟根目錄那份檔案開頭的
// 說明一樣，這裡不重複贅述。

import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';
import { getSyncableState, applySyncedState, subscribe as onLocalChange } from './storage.js';

const FIREBASE_VERSION = '10.14.1';
const gstatic = (pkg) => `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-${pkg}.js`;
const EMAIL_STORAGE_KEY = 'kids-reward-tracker/pending-sign-in-email';
const SYNC_COLLECTION = 'kids_reward_users';

let currentUser = null;
let db = null;
let auth = null;
let unsubscribeSnapshot = null;
let pushTimer = null;
let pushScheduled = false;
let pushInFlight = false;
let pushAgainAfter = false;
let lastSyncedJson = null;
let onRemoteChangeCb = null;
let onStatusChangeCb = null;
let justCompletedEmailLinkSignIn = false;

// 除了「Firebase 根本沒設定好」那次以外，這個檔案裡幾乎每個 setStatus() 呼叫都只帶
// { signedIn, user, syncing, error } 這幾個欄位，沒有重複帶 available——這樣沒問題的前提
// 是 renderSyncArea() 收到 available 是 undefined 時，不能被當成「服務不可用」處理，
// 不然一旦真的登入、開始有 setStatus() 呼叫進來，畫面上的登入狀態/登出按鈕就會直接消失
// （使用者會看到「明明已經登入過，怎麼連登入按鈕都不見了」）。用這個模組層級的旗標統一補上
// available 欄位，這樣呼叫端不用每次都自己記得帶，也不會漏掉。理由同根目錄同一份檔案的說明。
let isAvailable = false;

function setStatus(status) {
  if (onStatusChangeCb) onStatusChangeCb({ available: isAvailable, ...status });
}

export function isSyncAvailable() {
  return isFirebaseConfigured;
}

export function getCurrentUser() {
  return currentUser;
}

// callbacks: { onRemoteChange(), onStatusChange(status) }
export async function initCloudSync({ onRemoteChange, onStatusChange } = {}) {
  onRemoteChangeCb = onRemoteChange || null;
  onStatusChangeCb = onStatusChange || null;

  if (!isFirebaseConfigured) {
    setStatus({ signedIn: false, available: false });
    return;
  }
  isAvailable = true;

  let initializeApp;
  let authModule;
  let firestoreModule;
  try {
    [{ initializeApp }, authModule, firestoreModule] = await Promise.all([
      import(gstatic('app')),
      import(gstatic('auth')),
      import(gstatic('firestore')),
    ]);
  } catch (err) {
    console.error('載入雲端同步套件失敗', err);
    setStatus({ signedIn: false, available: true, error: '無法載入雲端同步功能，請檢查網路連線' });
    return;
  }

  const app = initializeApp(firebaseConfig);
  auth = authModule.getAuth(app);
  db = firestoreModule.getFirestore(app);

  const { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signOut, onAuthStateChanged } = authModule;
  window.__kidsCloudSyncAuth = { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signOut };

  await completeEmailLinkSignInIfPresent(authModule);

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      setStatus({ signedIn: true, user, syncing: true });
      await handleSignedIn(firestoreModule);
      justCompletedEmailLinkSignIn = false;
      setStatus({ signedIn: true, user, syncing: false });
    } else {
      currentUser = null;
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      unsubscribeSnapshot = null;
      clearTimeout(pushTimer);
      pushScheduled = false;
      pushInFlight = false;
      pushAgainAfter = false;
      lastSyncedJson = null;
      justCompletedEmailLinkSignIn = false;
      setStatus({ signedIn: false, available: true });
    }
  });

  onLocalChange(() => schedulePush(firestoreModule));

  // 手機瀏覽器把分頁切到背景時常常很快就把它砍掉重來，排隊中還沒送出的變更如果還在等
  // debounce，就會來不及送出。分頁一被切到背景就立刻把排隊中的變更送出去，不用等 debounce。
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    if (pushScheduled) {
      clearTimeout(pushTimer);
      runPush(firestoreModule);
    }
  });
}

export async function requestSignInLink(email) {
  if (!auth || !window.__kidsCloudSyncAuth) throw new Error('雲端同步尚未就緒，請稍後再試');
  const { sendSignInLinkToEmail } = window.__kidsCloudSyncAuth;
  const actionCodeSettings = {
    url: window.location.href.split('#')[0].split('?')[0],
    handleCodeInApp: true,
  };
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
  armReloadOnReturn();
}

// iOS「加到主畫面」的獨立模式下，Mail App 點連結一律用 Safari 開，不會直接跳回這個獨立模式
// 分頁——登入是在 Safari 那邊完成的，切回這個分頁只是從背景恢復，不是真的重新整理，不會自動
// 注意到登入已經完成。這裡記住「剛剛寄出過登入連結、還在等」，下次這個分頁重新變成可見時就
// 強制重新整理一次，讓它重新走一次登入狀態檢查（只掛一次，避免每次切換分頁都重整）。
let reloadOnReturnArmed = false;
function armReloadOnReturn() {
  if (reloadOnReturnArmed) return;
  reloadOnReturnArmed = true;
  const handler = () => {
    if (document.visibilityState !== 'visible') return;
    document.removeEventListener('visibilitychange', handler);
    window.location.reload();
  };
  document.addEventListener('visibilitychange', handler);
}

async function completeEmailLinkSignInIfPresent(authModule) {
  const { isSignInWithEmailLink, signInWithEmailLink } = authModule;
  if (!isSignInWithEmailLink(auth, window.location.href)) return;

  let email = window.localStorage.getItem(EMAIL_STORAGE_KEY);
  if (!email) {
    email = window.prompt('請輸入你用來收登入連結的 Email，以完成登入：');
  }
  if (!email) return;

  try {
    await signInWithEmailLink(auth, email, window.location.href);
    window.localStorage.removeItem(EMAIL_STORAGE_KEY);
    window.history.replaceState({}, document.title, window.location.pathname);
    justCompletedEmailLinkSignIn = true;
  } catch (err) {
    console.error('Email 連結登入失敗', err);
    setStatus({ signedIn: false, available: true, error: `登入失敗：${err.code || err.message}` });
  }
}

export function signOutOfSync() {
  if (!auth || !window.__kidsCloudSyncAuth) return;
  window.__kidsCloudSyncAuth.signOut(auth);
}

async function handleSignedIn(firestoreModule) {
  const { doc, getDoc } = firestoreModule;
  const ref = doc(db, SYNC_COLLECTION, currentUser.uid);
  const local = getSyncableState();
  const localJson = JSON.stringify(local);
  const hasLocalKids = Object.keys(local.kids || {}).length > 0;

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (err) {
    console.error('讀取雲端資料失敗', err);
    setStatus({ signedIn: true, user: currentUser, syncing: false, error: '讀取雲端資料失敗，暫時只使用本機資料' });
    return;
  }

  if (snap.exists()) {
    const cloudJson = snap.data().stateJson;
    if (cloudJson === localJson) {
      lastSyncedJson = cloudJson;
    } else if (!hasLocalKids) {
      // 本機根本沒有小孩資料（例如換了新裝置、清過瀏覽器資料）：雲端有資料的話直接拉下來用，
      // 絕不能把這個「空的」本機狀態推上去蓋掉雲端——那樣會把小孩過去所有星星紀錄永久刪除，
      // 是最嚴重的一種資料遺失。理由同根目錄旅遊記帳系統同一份檔案的說明。
      const cloudData = JSON.parse(cloudJson);
      if (Object.keys(cloudData.kids || {}).length > 0) {
        applyRemoteJson(cloudJson);
      } else {
        await pushNow(firestoreModule, local);
      }
    } else if (!justCompletedEmailLinkSignIn) {
      // 本機確實有小孩資料、這次只是重新整理（不是剛點信件連結登入）：直接信任本機、送出去，
      // 不跳視窗冒險蓋掉使用者剛做的變更。理由同根目錄旅遊記帳系統同一份檔案的說明。
      await pushNow(firestoreModule, local);
    } else {
      const useCloud = confirm(
        '偵測到這個帳號的雲端已經有小孩獎勵資料，且跟這台裝置目前顯示的不一樣。\n\n' +
          '按「確定」= 改用雲端資料（會覆蓋這台裝置目前顯示的內容）\n' +
          '按「取消」= 用這台裝置目前的資料覆蓋雲端'
      );
      if (useCloud) {
        applyRemoteJson(cloudJson);
      } else {
        await pushNow(firestoreModule, local);
      }
    }
  } else {
    await pushNow(firestoreModule, local);
  }

  listenToCloud(firestoreModule);
}

function applyRemoteJson(json) {
  lastSyncedJson = json;
  try {
    applySyncedState(JSON.parse(json));
    if (onRemoteChangeCb) onRemoteChangeCb();
  } catch (err) {
    console.error('解析雲端資料失敗', err);
  }
}

function listenToCloud(firestoreModule) {
  const { doc, onSnapshot } = firestoreModule;
  if (unsubscribeSnapshot) unsubscribeSnapshot();
  unsubscribeSnapshot = onSnapshot(doc(db, SYNC_COLLECTION, currentUser.uid), (snap) => {
    // 本機還有變更正在排隊等送出、或正在送出中時，先不要套用這筆遠端快照，避免用較舊的
    // 回音蓋掉使用者剛做的新變更。理由同根目錄那份檔案的說明。
    if (pushScheduled || pushInFlight) return;
    if (!snap.exists()) return;
    const json = snap.data().stateJson;
    if (json === lastSyncedJson) return;
    applyRemoteJson(json);
  });
}

function schedulePush(firestoreModule) {
  if (!currentUser) return;
  clearTimeout(pushTimer);
  pushScheduled = true;
  pushTimer = setTimeout(() => runPush(firestoreModule), 1200);
}

async function runPush(firestoreModule) {
  pushScheduled = false;
  if (pushInFlight) {
    pushAgainAfter = true;
    return;
  }
  pushInFlight = true;
  do {
    pushAgainAfter = false;
    await pushNow(firestoreModule);
  } while (pushAgainAfter);
  pushInFlight = false;
}

async function pushNow(firestoreModule, stateOverride) {
  if (!currentUser) return;
  const { doc, setDoc, serverTimestamp } = firestoreModule;
  const localState = stateOverride || getSyncableState();
  const json = JSON.stringify(localState);
  if (json === lastSyncedJson) return;

  setStatus({ signedIn: true, user: currentUser, syncing: true });
  try {
    await setDoc(doc(db, SYNC_COLLECTION, currentUser.uid), { stateJson: json, updatedAt: serverTimestamp() });
    lastSyncedJson = json;
    setStatus({ signedIn: true, user: currentUser, syncing: false });
  } catch (err) {
    console.error('同步到雲端失敗', err);
    setStatus({
      signedIn: true,
      user: currentUser,
      syncing: false,
      error: '同步失敗（資料量可能太大，常見原因是照片太多；本機資料仍安全保留）',
    });
  }
}
