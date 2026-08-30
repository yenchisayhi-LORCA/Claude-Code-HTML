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

// 除了「Firebase 根本沒設定好」那次以外，這個檔案裡幾乎每個 setStatus() 呼叫都只帶
// { signedIn, user, syncing, error } 這幾個欄位，沒有重複帶 available——這樣沒問題的前提
// 是 renderSyncArea() 收到 available 是 undefined 時，不能被當成「服務不可用」處理，
// 不然一旦真的登入、開始有 setStatus() 呼叫進來，畫面上的登入狀態/登出按鈕就會直接消失
// （使用者會看到「明明已經登入過，怎麼連登入按鈕都不見了」）。用這個模組層級的旗標統一補上
// available 欄位，這樣呼叫端不用每次都自己記得帶，也不會漏掉。
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
// status 是 { signedIn, user, syncing, error } 這樣的簡單物件，給畫面渲染用
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
  firestoreModuleRef = firestoreModule;

  const { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signOut, onAuthStateChanged } = authModule;
  window.__cloudSyncAuth = { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signOut };

  await completeEmailLinkSignInIfPresent(authModule);

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      setStatus({ signedIn: true, user, syncing: true });
      const ok = await handleSignedIn(firestoreModule);
      justCompletedEmailLinkSignIn = false; // 只在「剛登入那一次」的判斷裡有效，用過就消耗掉
      // handleSignedIn() 失敗時（讀取雲端資料失敗、權限被拒、容量超過上限……）已經自己用
      // setStatus() 設好會顯示在畫面上的錯誤訊息；這裡如果不分青紅皂白地再蓋一次「已同步、
      // 沒有錯誤」的乾淨狀態，剛剛那個錯誤就會在同一輪事件循環裡被立刻蓋掉，畫面上只會看到
      // 錯誤文字一閃即逝，使用者根本來不及看清楚是什麼問題（實際上同步可能整個沒有成功）。
      if (ok) setStatus({ signedIn: true, user, syncing: false });
    } else {
      currentUser = null;
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      unsubscribeSnapshot = null;
      clearTimeout(pushTimer);
      pushScheduled = false;
      pushInFlight = false;
      pushAgainAfter = false;
      lastSyncedJson = null;
      lastSyncedTripJson = new Map();
      lastSyncedAccountJson = null;
      cachedCloudTrips = {};
      cachedCloudAccount = { activeTripId: null, people: [] };
      alertedTooLargeForSync = false;
      listeningForUid = null;
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

  const signInHref = window.location.href;
  // Firebase 的登入連結是一次性的，成功用過一次、或連結本身已經過期/失效之後，網址上帶的
  // 那組參數就沒有用了。原本只有登入「成功」才會清掉網址上的參數，一旦連結過期、或使用者
  // 在等一下的 Email 輸入框按了取消，網址上的參數會一直留著——這個分頁只要重新整理、或是
  // 被系統從背景還原，就會又被誤判成「剛點了登入連結」，重新跳出輸入 Email 的提示、再拿
  // 同一組已經失效的連結試一次，註定失敗，不斷重複。不管接下來成功、失敗、還是使用者取消，
  // 都先把網址清乾淨，這組連結不會再被用第二次。
  window.history.replaceState({}, document.title, window.location.pathname);

  let email = window.localStorage.getItem(EMAIL_STORAGE_KEY);
  if (!email) {
    email = window.prompt('請輸入你用來收登入連結的 Email，以完成登入：');
  }
  if (!email) return;

  try {
    await signInWithEmailLink(auth, email, signInHref);
    window.localStorage.removeItem(EMAIL_STORAGE_KEY);
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

// ---------------------------------------------------------------- 帳號同步的資料結構
//
// 一開始是整個帳號（activeTripId + 所有旅程 + 成員名單）塞進 users/{uid} 這「一份」文件的
// stateJson 欄位。這在旅程數量、收據照片累積起來後很容易撞上 Firestore 單一文件 1MiB 的
// 硬性上限——一旦撞到，整個帳號的同步就全部停擺（連只是新增一筆花費這種小變更都推不上去），
// 而且啟用「加入主畫面」等於是新的、空的本機儲存空間，換裝置時很容易誤判成資料不見了。
//
// 改成「每趟旅程各自一份文件」（users/{uid}/trips/{tripId}），限制就從「整個帳號共用 1MB」
// 變成「每一趟旅程各自的 1MB」，單一趟旅程的照片再多，也不會拖累其他旅程的同步；帳號文件
// （users/{uid}）縮小成只放 activeTripId + 成員名單這種小資料。
//
// 重要：這個新的子集合路徑需要在 Firebase Console 的 Firestore 安全規則額外加一段
// （見 README「設定多裝置同步」），舊規則只涵蓋 users/{uid} 這份文件本身，不會自動涵蓋
// 底下的 trips 子集合，沒有補上新規則的話，同步會全部被拒絕（permission-denied）。
//
// 舊帳號第一次用這版程式登入時，trips 子集合還是空的，readCloudState() 會退回去讀舊的
// stateJson 當作目前的雲端狀態；只要之後有任何一次成功的 push，就會自動改寫成新結構
// （寫入新版帳號文件時用的是 setDoc() 整份覆蓋、不是 merge，舊的 stateJson 欄位會自然消失）。

let lastSyncedTripJson = new Map(); // tripId -> 上次成功推上雲端 trips/{tripId} 的內容
let lastSyncedAccountJson = null; // 上次成功推上雲端帳號文件（activeTripId + people）的內容

function seedSyncedBaseline(state) {
  lastSyncedJson = JSON.stringify(state);
  lastSyncedTripJson = new Map(Object.entries(state.trips || {}).map(([id, trip]) => [id, JSON.stringify(trip)]));
  lastSyncedAccountJson = JSON.stringify({ activeTripId: state.activeTripId ?? null, people: state.people || [] });
}

async function readCloudState(firestoreModule) {
  const { doc, getDoc, collection, getDocs } = firestoreModule;
  const accountRef = doc(db, 'users', currentUser.uid);
  const tripsCol = collection(db, 'users', currentUser.uid, 'trips');
  const [accountSnap, tripsSnap] = await Promise.all([getDoc(accountRef), getDocs(tripsCol)]);

  const trips = {};
  tripsSnap.forEach((d) => {
    try {
      trips[d.id] = JSON.parse(d.data().tripJson);
    } catch (err) {
      console.error('解析雲端旅程資料失敗', d.id, err);
    }
  });

  let activeTripId = null;
  let people = [];
  let legacyAccountFormat = false;
  if (accountSnap.exists()) {
    const data = accountSnap.data();
    if (data.accountJson) {
      try {
        const acc = JSON.parse(data.accountJson);
        activeTripId = acc.activeTripId ?? null;
        people = acc.people || [];
      } catch (err) {
        console.error('解析雲端帳號資料失敗', err);
      }
    } else if (data.stateJson && Object.keys(trips).length === 0) {
      // 舊版整包資料格式、且新結構的 trips 子集合還是空的：代表這個帳號還沒搬過來，
      // 直接把整包舊資料當作目前的雲端狀態，之後第一次成功 push 就會自動改寫成新結構。
      try {
        const legacy = JSON.parse(data.stateJson);
        activeTripId = legacy.activeTripId ?? null;
        people = legacy.people || [];
        Object.assign(trips, legacy.trips || {});
        legacyAccountFormat = true;
      } catch (err) {
        console.error('解析雲端舊版資料失敗', err);
      }
    }
  }
  return { state: { activeTripId, trips, people }, legacyAccountFormat };
}

async function handleSignedIn(firestoreModule) {
  const local = getSyncableState();
  const localJson = JSON.stringify(local);
  const hasLocalTrips = Object.keys(local.trips).length > 0;

  let cloudState;
  let legacyAccountFormat;
  try {
    ({ state: cloudState, legacyAccountFormat } = await readCloudState(firestoreModule));
  } catch (err) {
    console.error('讀取雲端資料失敗', err);
    const isPermissionError = err && err.code === 'permission-denied';
    setStatus({
      signedIn: true,
      user: currentUser,
      syncing: false,
      error: isPermissionError
        ? '讀取雲端資料失敗：雲端資料庫拒絕存取，請確認 Firebase Console 的 Firestore 安全規則已更新（見 README），暫時只使用本機資料'
        : '讀取雲端資料失敗，暫時只使用本機資料',
    });
    return false;
  }
  const cloudJson = JSON.stringify(cloudState);

  // 不管接下來要拉雲端、推本機、還是先問使用者，都先把「目前雲端子集合裡實際有哪些旅程」
  // 記錄成 diff 的基準（seedSyncedBaseline 會設好 lastSyncedTripJson/lastSyncedAccountJson）。
  // 這一步不能省略：如果本機贏、直接呼叫 pushNow() 推本機資料上去，pushNow 判斷「雲端有、
  // 本機沒有的旅程要刪掉」是靠這個基準表；如果没有先讀一次雲端現況就設好基準（例如剛登入的
  // 全新一次 session，這張表原本是空的），雲端那些本機這裡從沒同步過、但其實已經不存在的
  // 舊旅程就永遠不會被清掉，還會在下次連線監聽（listenToCloud）時被誤判成「另一台裝置新增的
  // 旅程」又同步回本機，造成刪掉的旅程「陰魂不散」。
  seedSyncedBaseline(cloudState);
  if (legacyAccountFormat) {
    // 雲端的帳號文件目前還是舊版的 stateJson 格式：即使 activeTripId/people 的「內容」
    // 剛好跟本機一樣，實體文件本身還沒改寫成新格式，不能讓 pushNow() 誤判成「沒變化不用推」
    // 而略過帳號文件——把基準清成 null，強制下一次 push 一定會把它改寫成新格式。
    lastSyncedAccountJson = null;
  }

  let ok = true;
  if (cloudJson === localJson) {
    // 已經一致，上面 seedSyncedBaseline() 就處理完了，不用再做事
  } else if (!hasLocalTrips) {
    // 本機根本沒有旅程資料（例如換了新裝置、清過瀏覽器資料，或是 iOS「加入主畫面」建立的
    // 獨立儲存空間——這種情況下瀏覽器版跟主畫面版即使是同一個網站，本機資料也是分開的），
    // 雲端有資料的話直接拉下來用才合理，絕不能把這個「空的」本機狀態推上去蓋掉雲端——
    // 那樣會直接把使用者過去所有旅程資料永久刪除，是最嚴重的一種資料遺失。
    if (Object.keys(cloudState.trips).length > 0) applyRemoteState(cloudState);
  } else if (!justCompletedEmailLinkSignIn) {
    // 這次不是剛點信件裡的連結完成登入，而是本來就已經登入、單純重新整理頁面
    // （Firebase 會自動保留登入狀態，每次重新整理都會直接恢復），這種情況下
    // 雲端和本機會不一樣，幾乎都是「本機剛做的變更、還沒送出去就被手機重新整理/
    // 背景關閉打斷」造成的落差——例如剛存好封面照片，1200ms 的 debounce 還沒送出、
    // 頁面就被系統回收重新整理，重新整理後這裡讀到的雲端資料自然還是舊的。之前這裡
    // 一律跳出視窗要求選「用雲端」或「用本機」，但選「用雲端」等於直接拿舊資料蓋掉
    // 使用者剛做的變更、永久遺失（回報的「封面照片/成員縮圖/花費紀錄不管選哪個都不
    // 見了」就是這樣來的，而且這個情境每次重新整理都可能再發生一次，不是單一事件）。
    // 既然不是剛登入、本機也確實有旅程資料，直接信任本機現在的內容送出去就好，不用
    // 跳出視窗冒險；真的需要人來選「留哪一份」的情境，只保留給下面這個 else 分支：
    // 剛點連結完成登入、本機卻已經有自己的旅程資料，這才是兩邊各自有獨立歷史紀錄、
    // 真的需要問的狀況。
    ok = await pushNow(firestoreModule, local);
  } else {
    const useCloud = confirm(
      '偵測到這個帳號的雲端已經有旅程資料，且跟這台裝置目前顯示的不一樣。\n\n' +
        '按「確定」= 改用雲端資料（這台裝置目前顯示的旅程會被永久覆蓋、清除）\n' +
        '按「取消」= 用這台裝置目前的資料覆蓋雲端（保留這台裝置目前看到的內容）\n\n' +
        '不確定要選哪個，通常選「取消」比較安全。'
    );
    if (useCloud) {
      applyRemoteState(cloudState);
    } else {
      ok = await pushNow(firestoreModule, local);
    }
  }

  listenToCloud(firestoreModule);
  return ok;
}

function applyRemoteState(state) {
  seedSyncedBaseline(state);
  try {
    applySyncedState(state);
    if (onRemoteChangeCb) onRemoteChangeCb();
  } catch (err) {
    console.error('套用雲端資料失敗', err);
  }
}

// 帳號文件（activeTripId + people）跟 trips 子集合是兩個獨立的 onSnapshot 訂閱，
// 各自更新自己快取的那一半，兩邊都收到過至少一次之後，才開始比對、決定要不要套用。
let cachedCloudTrips = {};
let cachedCloudAccount = { activeTripId: null, people: [] };

function currentCachedCloudState() {
  return { activeTripId: cachedCloudAccount.activeTripId, trips: { ...cachedCloudTrips }, people: cachedCloudAccount.people };
}

function handleIncomingCloudSnapshot() {
  // 本機還有變更正在排隊等送出、或正在送出中（pushScheduled / pushInFlight）時，
  // 先不要套用這筆遠端快照。原本的問題（連續設定兩張大頭貼，前一張存好又消失）發生在：
  // 第一筆變更送出後、伺服器還沒確認前，使用者又做了第二筆變更；這時候第一筆的回音送達，
  // 內容比對只跟 lastSyncedJson 比對「是不是自己剛寫入的」，卻沒考慮到本機現在已經有
  // 更新的、還沒送出去的資料——於是用這筆較舊的回音蓋掉了使用者剛做的新變更。
  // 只要本機還有未確認送出的變更，就先不套用任何遠端資料（不管是自己的舊回音，還是剛好
  // 同時間別的裝置寫入的資料），等本機這輪全部 push 完再處理；到時候 onSnapshot 本來就會
  // 再送一次最新的文件內容過來，不會漏掉。
  if (pushScheduled || pushInFlight) return;
  const state = currentCachedCloudState();
  const json = JSON.stringify(state);
  if (json === lastSyncedJson) return; // 自己剛寫入或讀過的資料，略過避免無限循環

  // 多一道保險：即時更新的訂閱理論上一個 session 只會建立一次（見 listenToCloud 的
  // listeningForUid 防呆），但這裡還是不相信「這筆遠端快照，比本機少了幾趟本機現有的
  // 旅程」這種訊號——這種落差幾乎都是訂閱剛建立瞬間、真正的內容還沒完全載入完成前的
  // 暫時性不完整結果（不管是完全沒有旅程，還是只是缺了其中幾趟），而不是真的有人在
  // 別的裝置上把這些旅程都刪掉了（那種操作本來就少見，而且如果是這台裝置自己刪的，
  // 根本不會走到這個監聽分支，走的是本機刪除→pushNow 那條路）。發現任何本機有、
  // 這筆遠端快照卻沒有的旅程，就整筆跳過不套用，寧可這次不同步，也不要冒險把本機
  // 還有的旅程清掉——真的是別的裝置刪除的話，下次重新登入時的完整讀取仍然抓得到。
  const localTripIds = Object.keys(getSyncableState().trips);
  const remoteTripIds = new Set(Object.keys(state.trips));
  if (localTripIds.some((id) => !remoteTripIds.has(id))) {
    console.warn('忽略一筆遠端快照：本機有的旅程，這筆快照卻沒有，避免誤判成雲端把旅程刪掉了');
    return;
  }
  applyRemoteState(state);
}

// 正常情況下，一整個登入 session 只需要訂閱一次即時更新；但 Firebase Auth 在某些瀏覽器
// （目前確認 Safari 會發生）偶爾會在同一個使用者、根本沒有真的登出/登入的情況下，無緣無故
// 讓 onAuthStateChanged 又觸發一次，導致 handleSignedIn() 重新執行一遍，包含結尾這裡的
// listenToCloud()。如果讓它真的重新訂閱一次：舊的訂閱被取消、新的訂閱剛建立那一瞬間，
// Firestore SDK 對 trips 子集合的第一次回呼有可能先送一次「目前還沒有任何本地快取資料」
// 的空結果（0 份文件），比真正的內容早到——這個空結果會被誤判成「雲端旅程被清空了」，
// 直接把本機的旅程資料整批覆蓋成空的（使用者回報的「Safari 切換旅程時旅程通通不見」
// 極可能就是這樣來的）。既然同一個使用者只需要訂閱一次，這裡用一個旗標擋掉多餘的重新訂閱，
// 從根本避免這個「重新訂閱瞬間收到不完整快照」的競爭情況。
let listeningForUid = null;

function listenToCloud(firestoreModule) {
  if (listeningForUid === currentUser.uid) return;
  listeningForUid = currentUser.uid;

  const { doc, collection, onSnapshot } = firestoreModule;
  if (unsubscribeSnapshot) unsubscribeSnapshot();

  let accountReady = false;
  let tripsReady = false;

  const unsubAccount = onSnapshot(doc(db, 'users', currentUser.uid), (snap) => {
    if (snap.exists() && snap.data().accountJson) {
      try {
        const acc = JSON.parse(snap.data().accountJson);
        cachedCloudAccount = { activeTripId: acc.activeTripId ?? null, people: acc.people || [] };
      } catch (err) {
        console.error('解析雲端帳號資料失敗', err);
      }
    }
    accountReady = true;
    if (tripsReady) handleIncomingCloudSnapshot();
  });

  const unsubTrips = onSnapshot(collection(db, 'users', currentUser.uid, 'trips'), (snap) => {
    const trips = {};
    snap.forEach((d) => {
      try {
        trips[d.id] = JSON.parse(d.data().tripJson);
      } catch (err) {
        console.error('解析雲端旅程資料失敗', d.id, err);
      }
    });
    cachedCloudTrips = trips;
    tripsReady = true;
    if (accountReady) handleIncomingCloudSnapshot();
  });

  unsubscribeSnapshot = () => {
    unsubAccount();
    unsubTrips();
  };
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

// Firestore 單一文件硬性上限是 1MiB。改成每趟旅程各自一份文件之後，這個上限只套用在單一
// 一趟旅程身上，不會因為其他旅程也有照片就被拖累；帳號文件（activeTripId + people）也單獨
// 套用同一個門檻。超過時不硬送出去等失敗，而是先用位元組大小主動擋下來，用 alert() 講清楚
// 是哪一部分超過、該怎麼辦，其餘沒超過的部分照常同步，不會整個帳號的同步都被卡住。
const MAX_SYNC_DOC_BYTES = 900 * 1024; // 留一點餘裕給 Firestore 文件本身欄位名稱等額外開銷
let alertedTooLargeForSync = false;

async function pushNow(firestoreModule, stateOverride) {
  if (!currentUser) return true;
  const { doc, collection, setDoc, deleteDoc, serverTimestamp } = firestoreModule;
  const localState = stateOverride || getSyncableState();
  const json = JSON.stringify(localState);
  if (json === lastSyncedJson) return true;

  setStatus({ signedIn: true, user: currentUser, syncing: true });

  const oversizedNames = [];
  try {
    const tripsCol = collection(db, 'users', currentUser.uid, 'trips');

    for (const [tripId, trip] of Object.entries(localState.trips)) {
      const tripJson = JSON.stringify(trip);
      if (lastSyncedTripJson.get(tripId) === tripJson) continue;
      if (new Blob([tripJson]).size > MAX_SYNC_DOC_BYTES) {
        oversizedNames.push(trip.name || '（未命名旅程）');
        continue;
      }
      await setDoc(doc(tripsCol, tripId), { tripJson, updatedAt: serverTimestamp() });
      lastSyncedTripJson.set(tripId, tripJson);
    }

    const localTripIds = new Set(Object.keys(localState.trips));
    for (const tripId of Array.from(lastSyncedTripJson.keys())) {
      if (localTripIds.has(tripId)) continue;
      await deleteDoc(doc(tripsCol, tripId));
      lastSyncedTripJson.delete(tripId);
    }

    const accountJson = JSON.stringify({ activeTripId: localState.activeTripId ?? null, people: localState.people || [] });
    if (accountJson !== lastSyncedAccountJson) {
      if (new Blob([accountJson]).size > MAX_SYNC_DOC_BYTES) {
        oversizedNames.push('成員名單');
      } else {
        await setDoc(doc(db, 'users', currentUser.uid), { accountJson, updatedAt: serverTimestamp() });
        lastSyncedAccountJson = accountJson;
      }
    }

    if (oversizedNames.length) {
      const message = `雲端同步失敗：「${oversizedNames.join('、')}」的資料量（主要是照片）超過雲端單一份文件的容量上限。本機資料仍安全保留，其他旅程仍會正常同步，但這部分要刪除一些照片瘦身後才能同步。`;
      setStatus({ signedIn: true, user: currentUser, syncing: false, error: message });
      if (!alertedTooLargeForSync) {
        alertedTooLargeForSync = true;
        alert(message);
      }
      return false;
    }
    alertedTooLargeForSync = false;

    lastSyncedJson = json;
    setStatus({ signedIn: true, user: currentUser, syncing: false });
    return true;
  } catch (err) {
    console.error('同步到雲端失敗', err);
    const isPermissionError = err && err.code === 'permission-denied';
    setStatus({
      signedIn: true,
      user: currentUser,
      syncing: false,
      error: isPermissionError
        ? '同步失敗：雲端資料庫拒絕存取，請確認 Firebase Console 的 Firestore 安全規則已更新（見 README）'
        : '同步失敗（本機資料仍安全保留）',
    });
    return false;
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
  if (viewers.length && new Blob([json]).size > MAX_SYNC_DOC_BYTES) {
    return { ok: false, error: '這趟旅程的資料量（收據照片太多）超過雲端單一份文件的容量上限，無法分享，請先刪除部分收據照片' };
  }

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
    const signInHref = window.location.href;
    // 登入連結是一次性的，成功用過、或過期失效之後就沒用了：不管接下來成功、失敗、還是
    // 使用者在輸入 Email 時按取消，都先清掉網址上的登入參數（但保留 ?share=tripId，不然
    // 重新整理就找不到要看哪趟旅程了），避免這組壞掉的連結卡在網址上，每次重新整理都
    // 又跳出一次輸入 Email 的提示、拿同一組已經失效的連結再試一次。
    const shareId = new URLSearchParams(window.location.search).get('share');
    const cleanUrl = window.location.pathname + (shareId ? `?share=${encodeURIComponent(shareId)}` : '');
    window.history.replaceState({}, document.title, cleanUrl);

    let email = window.localStorage.getItem(EMAIL_STORAGE_KEY);
    if (!email) email = window.prompt('請輸入你用來收登入連結的 Email，以完成登入：');
    if (email) {
      try {
        await signInWithEmailLink(viewerAuth, email, signInHref);
        window.localStorage.removeItem(EMAIL_STORAGE_KEY);
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
