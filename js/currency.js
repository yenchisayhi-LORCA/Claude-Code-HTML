// 匯率轉換：使用免費、免金鑰的 @fawazahmed0/currency-api（有支援台幣 TWD）。
// 文件： https://github.com/fawazahmed0/exchange-api

import { getRatesCache, setRatesCache } from './storage.js';

export const COMMON_CURRENCIES = [
  'TWD', 'USD', 'JPY', 'EUR', 'GBP', 'KRW', 'HKD', 'CNY', 'THB', 'SGD',
  'AUD', 'CAD', 'VND', 'MYR', 'PHP', 'IDR', 'NZD', 'CHF', 'MOP', 'CZK',
];

const PRIMARY_URL = (base) =>
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base.toLowerCase()}.json`;
const FALLBACK_URL = (base) =>
  `https://latest.currency-api.pages.dev/v1/currencies/${base.toLowerCase()}.json`;

const ONE_HOUR = 60 * 60 * 1000;

// rates[TARGET] = 1 單位 base 換算成多少 TARGET
export async function fetchRates(baseCurrency, { force = false } = {}) {
  const base = baseCurrency.toUpperCase();
  const cached = getRatesCache(base);
  if (!force && cached && Date.now() - cached.fetchedAt < ONE_HOUR) {
    return cached;
  }

  let data;
  try {
    data = await fetchJson(PRIMARY_URL(base));
  } catch (err) {
    try {
      data = await fetchJson(FALLBACK_URL(base));
    } catch (err2) {
      if (cached) return cached; // 離線時退回舊快取
      throw new Error('無法取得即時匯率，請檢查網路連線後重試。');
    }
  }

  const rawRates = data[base.toLowerCase()] || {};
  const rates = {};
  Object.entries(rawRates).forEach(([code, value]) => {
    rates[code.toUpperCase()] = value;
  });
  rates[base] = 1;

  const result = { base, date: data.date, rates, fetchedAt: Date.now() };
  setRatesCache(base, result);
  return result;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 將 amount（fromCurrency）換算成 toCurrency 的金額，需要 ratesCache（以 toCurrency 為基準抓回來的匯率表）。
// 若幣別相同則不需要匯率資料也能直接回傳，避免匯率 API 尚未載入或離線時把同幣別的金額也算成 0。
export function convertToBase(amount, fromCurrency, toCurrency, ratesCache) {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) return amount;
  if (!ratesCache || ratesCache.base !== to) return null;
  const rate = ratesCache.rates[from];
  if (!rate) return null;
  return amount / rate;
}

export function getRate(fromCurrency, ratesCache) {
  if (!ratesCache) return null;
  const from = fromCurrency.toUpperCase();
  if (from === ratesCache.base) return 1;
  return ratesCache.rates[from] || null;
}

// amount 已經是「基準貨幣」金額時，換算成台幣（基準貨幣本身就是 TWD 時回傳 null，不用重複顯示同一個數字）
export function baseAmountToTWD(amount, baseCurrency, ratesCache) {
  if (baseCurrency.toUpperCase() === 'TWD') return null;
  const rate = ratesCache && ratesCache.rates ? ratesCache.rates['TWD'] : null;
  if (!rate) return null;
  return amount * rate;
}

// 不管基準貨幣是什麼，都額外算出台幣金額當參考，方便台灣使用者換算
export function convertToTWD(amount, fromCurrency, baseCurrency, ratesCache) {
  if (baseCurrency.toUpperCase() === 'TWD') return null;
  if (fromCurrency.toUpperCase() === 'TWD') return amount;
  const inBase = convertToBase(amount, fromCurrency, baseCurrency, ratesCache);
  if (inBase === null) return null;
  return baseAmountToTWD(inBase, baseCurrency, ratesCache);
}
