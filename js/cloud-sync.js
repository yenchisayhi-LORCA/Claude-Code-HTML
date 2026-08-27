// 多裝置同步：用 Firebase Authentication（Google 登入）辨識「你是誰」，
// 用 Firestore 存放你的旅程資料，這樣同一個 Google 帳號在不同裝置登入時能看到同一份資料。
// 沒有設定 firebase-config.js 之前，這個模組完全不會啟用，其他功能不受影響。

import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';
import { getSyncableState, applySyncedState, subscribe as onLocalChange } from './storage.js';

const FIREBASE_VERSION = '10.14.1';
const gstatic = (pkg) => `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-${pkg}.js`;

let currentUser = null;
let db = null;
let auth = null;
let unsubscribeSnapshot = null;
let pushTimer = null;
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

  const { GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } = authModule;
  window.__cloudSyncAuth = { GoogleAuthProvider, signInWithRedirect, signOut, authModule };

  try {
    await getRedirectResult(auth); // 從 Google 登入頁導回來後，把結果消化掉（觸發下面的 onAuthStateChanged）
  } catch (err) {
    console.error('Google 登入失敗', err);
    setStatus({ signedIn: false, available: true, error: '登入失敗，請再試一次' });
  }

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
      lastSyncedJson = null;
      setStatus({ signedIn: false, available: true });
    }
  });

  onLocalChange(() => schedulePush(firestoreModule));
}

export function signIn() {
  if (!auth || !window.__cloudSyncAuth) return;
  const { GoogleAuthProvider, signInWithRedirect } = window.__cloudSyncAuth;
  signInWithRedirect(auth, new GoogleAuthProvider());
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
        '偵測到這個 Google 帳號的雲端已經有旅程資料，且跟這台裝置目前顯示的不一樣。\n\n' +
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
    if (!snap.exists()) return;
    const json = snap.data().stateJson;
    if (json === lastSyncedJson) return; // 自己剛寫入或讀過的資料，略過避免無限循環
    applyRemoteJson(json);
  });
}

function schedulePush(firestoreModule) {
  if (!currentUser) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushNow(firestoreModule), 1200);
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
