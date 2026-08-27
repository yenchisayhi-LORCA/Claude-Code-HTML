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
let firestoreModuleRef = null; // 存起來給分享功能用（setDoc/deleteDoc/serverTimestamp），不用重新動態載入一次
let unsubscribeSnapshot = null;
let pushTimer = null;
let pushScheduled = false; // 有本機變更排隊等 1200ms debounce 過後送出，還沒真的呼叫 setDoc()
let pushInFlight = false; // 目前正有一個 setDoc() 呼叫還沒結束
let pushAgainAfter = false; // pushInFlight 期間又有新的本機變更，要等這次做完後再補送一次最新的
let lastSyncedJson = null; // 用來判斷「這筆變動是不是我們自己剛寫入/讀回的回音」，避免同步無限循環
let onRemoteChangeCb = null;
let onStatusChangeCb = null;

let shareSyncTimer = null;
const lastPushedShareJson = new Map(); // tripId -> 上次成功推到 shared_trips 的內容，避免沒變化也重推

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
  firestoreModuleRef = firestoreModule;

  const { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signOut, onAuthStateChanged } = authModule;
  window.__cloudSyncAuth = { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signOut };

  await completeEmailLinkSignInIfPresent(authModule);

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      setStatus({ signedIn: true, user, syncing: true });
      await handleSignedIn(firestoreModule);
      justCompletedEmailLinkSignIn = false; // 只在「剛登入那一次」的判斷裡有效，用過就消耗掉
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
      clearTimeout(shareSyncTimer);
      lastPushedShareJson.clear();
      justCompletedEmailLinkSignIn = false;
      setStatus({ signedIn: false, available: true });
    }
  });

  onLocalChange(() => {
    schedulePush(firestoreModule);
    scheduleShareSync();
  });

  // 手機瀏覽器把分頁切到背景時常常很快就把它砍掉重來（不是「使用者關掉分頁」那種正常關閉），
  // 排隊中、還沒送出去的變更如果還在等 1200ms 的 debounce，就會直接來不及送出、留在雲端的
  // 還是舊資料——下次打開時 handleSignedIn() 讀到「雲端跟本機不一樣」，就是這樣來的。分頁一
  // 被切到背景就立刻把排隊中的變更送出去（不用等 debounce），盡量縮小這個來不及送出的空窗。
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    if (pushScheduled) {
      clearTimeout(pushTimer);
      runPush(firestoreModule);
    }
  });
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

// 這次執行是不是「剛點信件裡的登入連結完成登入」，而不是單純重新整理一個本來就已經登入的
// 分頁（Firebase 會自動幫你保留登入狀態，之後每次重新整理都會直接恢復，不需要再點一次連結）。
// handleSignedIn() 靠這個旗標判斷要不要跳出「雲端跟本機不一樣，選哪一份」的視窗。
let justCompletedEmailLinkSignIn = false;

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
    justCompletedEmailLinkSignIn = true;
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
    } else if (!hasLocalTrips || !justCompletedEmailLinkSignIn) {
      // 這裡走進來的情境，幾乎都不是真的需要人來選「用哪一份」：
      // - 本機根本沒有旅程資料，雲端有的話直接拿來用最合理；
      // - 這次不是剛點信件裡的連結完成登入，而是本來就已經登入、單純重新整理頁面
      //   （Firebase 會自動保留登入狀態，每次重新整理都會直接恢復），這種情況下
      //   雲端和本機會不一樣，幾乎都是「本機剛做的變更、還沒送出去就被手機重新整理/
      //   背景關閉打斷」造成的落差——例如剛存好封面照片，1200ms 的 debounce 還沒送出、
      //   頁面就被系統回收重新整理，重新整理後這裡讀到的雲端資料自然還是舊的。之前這裡
      //   一律跳出視窗要求選「用雲端」或「用本機」，但選「用雲端」等於直接拿舊資料蓋掉
      //   使用者剛做的變更、永久遺失（回報的「封面照片/成員縮圖/花費紀錄不管選哪個都不
      //   見了」就是這樣來的，而且這個情境每次重新整理都可能再發生一次，不是單一事件）。
      //   既然不是剛登入，直接信任本機現在的內容送出去就好，不用跳出視窗冒險；真的需要
      //   人來選「留哪一份」的情境，只保留給下面這個 else 分支：剛點連結完成登入、本機卻
      //   已經有自己的旅程資料，這才是兩邊各自有獨立歷史紀錄、真的需要問的狀況。
      await pushNow(firestoreModule, local);
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

  window.localStorage.setItem(HAS_SYNCED_BEFORE_KEY, '1');
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

// ---------------------------------------------------------------- 分享單一旅程（唯讀）
//
// 跟整帳號同步（users/{uid}，一整包所有旅程）不同：分享出去的是 shared_trips/{tripId}
// 這份「單一旅程」的獨立文件，只有被列在 viewerEmails 白名單裡的人（用 Email 連結登入後）
// 才能讀到，讀不到其他旅程、也讀不到你的成員名單。清空 viewerEmails 等於直接刪除這份文件、
// 收回所有人的存取權。詳見 README「分享單一旅程」一節要在 Firebase Console 貼的規則。

// 把某趟旅程目前的內容同步推到 shared_trips/{trip.id}；viewers 是空陣列時改成直接刪除該文件。
export async function pushSharedTrip(trip) {
  if (!currentUser || !db || !firestoreModuleRef) return { ok: false, error: 'not-signed-in' };
  const { shareViewers, ...tripSnapshot } = trip;
  const viewers = shareViewers || [];
  const json = JSON.stringify({ viewers, tripSnapshot });
  if (lastPushedShareJson.get(trip.id) === json) return { ok: true, skipped: true };

  const { doc, setDoc, deleteDoc, serverTimestamp } = firestoreModuleRef;
  const ref = doc(db, 'shared_trips', trip.id);
  try {
    if (!viewers.length) {
      await deleteDoc(ref);
    } else {
      await setDoc(ref, {
        ownerId: currentUser.uid,
        ownerEmail: currentUser.email || '',
        viewerEmails: viewers,
        trip: tripSnapshot,
        updatedAt: serverTimestamp(),
      });
    }
    lastPushedShareJson.set(trip.id, json);
    return { ok: true };
  } catch (err) {
    console.error('分享旅程更新失敗', err);
    return { ok: false, error: err.code || err.message };
  }
}

function scheduleShareSync() {
  if (!currentUser) return;
  clearTimeout(shareSyncTimer);
  shareSyncTimer = setTimeout(runShareSync, 1500);
}

// 旅程被分享後，之後每次記帳/改資料都會自動把最新內容補推給 shared_trips，
// 同行者不用等你手動再分享一次就能看到新增的花費。
async function runShareSync() {
  if (!currentUser) return;
  const trips = Object.values(getSyncableState().trips || {});
  for (const trip of trips) {
    if (!trip.shareViewers && !lastPushedShareJson.has(trip.id)) continue;
    await pushSharedTrip(trip);
  }
}

// ---------------------------------------------------------------- 分享連結的檢視者登入
//
// 同行者打開分享連結不需要、也不應該碰到整帳號同步（initCloudSync）：那會把他自己帳號底下
// 所有旅程整批讀進這台裝置的本機資料，完全不是「唯讀檢視某一趟旅程」該做的事。這裡另外用
// 同一個 Firebase 專案、同一套 Email 連結登入機制，做一個獨立、輕量、不碰本機旅程資料的
// 登入流程，登入完只回傳 { auth, db, firestoreModule, user }，剩下的（讀取/訂閱 shared_trips
// 文件、畫面渲染）交給呼叫者（js/share-view.js）自己處理。
export async function initShareViewerAuth({ onUser, onError } = {}) {
  if (!isFirebaseConfigured) {
    onError && onError(new Error('not-configured'));
    return null;
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
    console.error('載入分享檢視所需套件失敗', err);
    onError && onError(err);
    return null;
  }

  const app = initializeApp(firebaseConfig);
  const viewerAuth = authModule.getAuth(app);
  const viewerDb = firestoreModule.getFirestore(app);
  const { isSignInWithEmailLink, signInWithEmailLink, sendSignInLinkToEmail, onAuthStateChanged } = authModule;

  if (isSignInWithEmailLink(viewerAuth, window.location.href)) {
    let email = window.localStorage.getItem(EMAIL_STORAGE_KEY);
    if (!email) email = window.prompt('請輸入你用來收登入連結的 Email，以完成登入：');
    if (email) {
      try {
        await signInWithEmailLink(viewerAuth, email, window.location.href);
        window.localStorage.removeItem(EMAIL_STORAGE_KEY);
        // 清掉網址上 Firebase 附加的登入參數，但保留 ?share=tripId，不然重新整理就找不到要看哪趟旅程了
        const shareId = new URLSearchParams(window.location.search).get('share');
        const cleanUrl = window.location.pathname + (shareId ? `?share=${encodeURIComponent(shareId)}` : '');
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (err) {
        console.error('分享檢視登入失敗', err);
        onError && onError(err);
      }
    }
  }

  onAuthStateChanged(viewerAuth, (user) => onUser && onUser(user));

  return {
    auth: viewerAuth,
    db: viewerDb,
    firestoreModule,
    async requestLink(email) {
      const actionCodeSettings = { url: window.location.href.split('#')[0], handleCodeInApp: true };
      await sendSignInLinkToEmail(viewerAuth, email, actionCodeSettings);
      window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
    },
  };
}
