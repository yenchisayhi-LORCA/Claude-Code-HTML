// 家長 PIN 保護：純粹是給小孩用的軟性門檻（明碼儲存即可），不是真正的安全機制。
// 用法：initPin() 在 app 啟動時呼叫一次接上 DOM；受保護的操作用 withPinGate(fn) 包起來，
// 沒設定 PIN 時會直接放行。

import { getPin } from './storage.js';

let dialogEl, formEl, inputEl, errorEl;
let pendingResolve = null;

function settle(result) {
  const resolve = pendingResolve;
  pendingResolve = null;
  if (resolve) resolve(result);
}

export function initPin() {
  dialogEl = document.getElementById('dialog-pin');
  formEl = document.getElementById('form-pin');
  inputEl = document.getElementById('pin-input');
  errorEl = document.getElementById('pin-error');

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = inputEl.value.trim();
    const pin = getPin();
    if (!pin || val === pin) {
      inputEl.value = '';
      errorEl.hidden = true;
      settle(true); // 先 settle 再 close：close() 會同步觸發 'close' 事件，要先清空 pendingResolve 避免被誤判成取消
      dialogEl.close();
    } else {
      errorEl.hidden = false;
      inputEl.value = '';
      inputEl.focus();
    }
  });

  dialogEl.querySelectorAll('[data-close]').forEach((btn) =>
    btn.addEventListener('click', () => {
      dialogEl.close();
    })
  );

  dialogEl.addEventListener('cancel', () => settle(false));
  dialogEl.addEventListener('close', () => {
    // 透過 X / 取消關閉（沒有先 settle(true)）就視為取消
    if (pendingResolve) settle(false);
  });
}

export function requestPin() {
  const pin = getPin();
  if (!pin) return Promise.resolve(true);
  return new Promise((resolve) => {
    pendingResolve = resolve;
    errorEl.hidden = true;
    inputEl.value = '';
    dialogEl.showModal();
    inputEl.focus();
  });
}

export function withPinGate(action) {
  return async (...args) => {
    const ok = await requestPin();
    if (ok) action(...args);
  };
}
