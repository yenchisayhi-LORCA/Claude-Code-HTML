// 星星商店兌換：檢查餘額足夠才寫入一筆負數帳本紀錄。

import { getBalance, addLedgerEntry, todayStr } from './ledger.js';

export function canRedeem(kidId, item) {
  return getBalance(kidId) >= item.cost;
}

export function redeemShopItem(kidId, item) {
  if (!canRedeem(kidId, item)) return null;
  return addLedgerEntry(kidId, {
    amount: -item.cost,
    type: 'shop_redeem',
    refId: item.id,
    label: item.name,
    date: todayStr(),
  });
}
