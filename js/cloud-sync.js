// 多裝置同步：用 Firebase Authentication 的「Email 連結登入」(passwordless email link)
// 辨識「你是誰」，用 Firestore 存放你的旅程資料，這樣同一個 Email 在不同裝置登入時能看到同一份資料。
// 沒有設定 firebase-config.js 之前，這個模組完全不會啟用，其他功能不受影響。
//
// 之所以不用 Google 登入的彈出視窗/整頁導轉：兩者都需要瀏覽器允許我們的網站跟 Firebase 的
// authDomain（*.firebaseapp.com）互相存取儲存空間或用 postMessage 溝通，而 Safari/Firefox 已經
// 封鎖、Chrome 也在跟進封鎖這種「第三方儲存空間」存取（尤其是像 GitHub Pages 這種跟 Firebase
// 網域不同的靜態網站）。Email 連結登入完全不需要跳出視窗或跨網域，直接靠信件裡的連結完成登入，
// 不會受這個限制影響。詳見 https://firebase.google.com/docs/auth/web/redirect-best-practices

import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';
import { getSyncableState, applySyncedState, subscribe as onLocalChange } from './storage.js';

const FIREBASE_VERSION = '10.14.1';
const gstatic = (pkg) => `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-${pkg}.js`;
const EMAIL_STORAGE_KEY = 'travel-expense-tracker/pending-sign-in-email';

let currentUser = null;
let db = null;
let auth = null;
let unsubscribeSnapshot = null;
let pushTimer = null;
let pushScheduled = false; // 有本機變更排隊等 1200ms debounce 過後送出，還沒真的呼叫 setDoc()
let pushInFlight = false; // 目前正有一個 setDoc() 呼叫還沒結束
let pushAgainAfter = false; // pushInFlight 期間又有新的本機變更，要等這次做完後再補送一次最新的
let lastSyncedJson = null; // 用來判斷「這筆變動是不是我們自己剛寫入/讀回的回音」，避免同步無限循環
let onRemoteChangeCb = null;
let onStatusChangeCb = null;

function setStatus(status) {
  if (onStatusChangeCb) onStatusChangeCb(status);
}

export function isSyncAvailable() {
  return isFirebaseConfigured;
}

export function getCurrentUser() {
  return currentUser;
}

// callbacks: { onRemoteChange(), onStatusChange(status) }
// status 是 { signedIn, user, syncing, error } 這樣的簡單物件，給畫面渲染用
export async function initCloudSync({ onRemoteChange, onStatusChange } = {}) {
  onRemoteChangeCb = onRemoteChange || null;
  onStatusChangeCb = onStatusChange || null;

  if (!isFirebaseConfigured) {
    setStatus({ signedIn: false, available: false });
    return;
  }

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
  window.__cloudSyncAuth = { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signOut };

  await completeEmailLinkSignInIfPresent(authModule);

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      setStatus({ signedIn: true, user, syncing: true });
      await handleSignedIn(firestoreModule);
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
      setStatus({ signedIn: false, available: true });
    }
  });

  onLocalChange(() => schedulePush(firestoreModule));
}

// 寄送登入連結到指定 email；使用者點信裡的連結回到本頁後，completeEmailLinkSignInIfPresent 會自動完成登入
export async function requestSignInLink(email) {
  if (!auth || !window.__cloudSyncAuth) throw new Error('雲端同步尚未就緒，請稍後再試');
  const { sendSignInLinkToEmail } = window.__cloudSyncAuth;
  const actionCodeSettings = {
    url: window.location.href.split('#')[0].split('?')[0],
    handleCodeInApp: true,
  };
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
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
    window.history.replaceState({}, document.title, window.location.pathname); // 清掉網址上的登入參數
  } catch (err) {
    console.error('Email 連結登入失敗', err);
    setStatus({ signedIn: false, available: true, error: `登入失敗：${err.code || err.message}` });
  }
}

export function signOutOfSync() {
  if (!auth || !window.__cloudSyncAuth) return;
  window.__cloudSyncAuth.signOut(auth);
}

async function handleSignedIn(firestoreModule) {
  const { doc, getDoc } = firestoreModule;
  const ref = doc(db, 'users', currentUser.uid);
  const local = getSyncableState();
  const localJson = JSON.stringify(local);
  const hasLocalTrips = Object.keys(local.trips).length > 0;

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
    } else if (!hasLocalTrips) {
      applyRemoteJson(cloudJson);
    } else {
      const useCloud = confirm(
        '偵測到這個帳號的雲端已經有旅程資料，且跟這台裝置目前顯示的不一樣。\n\n' +
          '按「確定」= 改用雲端資料（會覆蓋這台裝置目前顯示的旅程）\n' +
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
  unsubscribeSnapshot = onSnapshot(doc(db, 'users', currentUser.uid), (snap) => {
    // 本機還有變更正在排隊等送出、或正在送出中（pushScheduled / pushInFlight）時，
    // 先不要套用這筆遠端快照。原本的問題（連續設定兩張大頭貼，前一張存好又消失）發生在：
    // 第一筆變更送出後、伺服器還沒確認前，使用者又做了第二筆變更；這時候第一筆的回音送達，
    // 內容比對只跟 lastSyncedJson 比對「是不是自己剛寫入的」，卻沒考慮到本機現在已經有
    // 更新的、還沒送出去的資料——於是用這筆較舊的回音蓋掉了使用者剛做的新變更。
    // 只要本機還有未確認送出的變更，就先不套用任何遠端資料（不管是自己的舊回音，還是剛好
    // 同時間別的裝置寫入的資料），等本機這輪全部 push 完再處理；到時候 onSnapshot 本來就會
    // 再送一次最新的文件內容過來，不會漏掉。
    if (pushScheduled || pushInFlight) return;
    if (!snap.exists()) return;
    const json = snap.data().stateJson;
    if (json === lastSyncedJson) return; // 自己剛寫入或讀過的資料，略過避免無限循環
    applyRemoteJson(json);
  });
}

function schedulePush(firestoreModule) {
  if (!currentUser) return;
  clearTimeout(pushTimer);
  pushScheduled = true;
  pushTimer = setTimeout(() => runPush(firestoreModule), 1200);
}

// 確保同一時間最多只有一個 setDoc() 在飛行中：如果排程要 push 時發現前一次還沒做完，
// 就先記住「等它做完要再補送一次最新的」，而不是讓兩筆內容不同的寫入同時飛向伺服器
// ——不然伺服器最後收到哪一筆是不確定的，較新的變更有可能反而被較舊的那筆蓋掉。
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
    await setDoc(doc(db, 'users', currentUser.uid), { stateJson: json, updatedAt: serverTimestamp() });
    lastSyncedJson = json;
    setStatus({ signedIn: true, user: currentUser, syncing: false });
  } catch (err) {
    console.error('同步到雲端失敗', err);
    setStatus({
      signedIn: true,
      user: currentUser,
      syncing: false,
      error: '同步失敗（資料量可能太大，常見原因是收據照片太多；本機資料仍安全保留）',
    });
  }
}
