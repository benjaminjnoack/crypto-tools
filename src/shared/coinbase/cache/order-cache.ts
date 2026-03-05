import path from "node:path";
import { loadJsonFromCache, saveJsonToCache } from "#shared/common/cache";
import { type CoinbaseOrder, CoinbaseOrderSchema } from "#shared/coinbase/schemas/coinbase-order-schemas";
import { coinbaseOrdersDir } from "./coinbase-cache.js";

export function loadOrderFromCache(orderId: string): CoinbaseOrder {
  const cachePath = path.join(coinbaseOrdersDir, `${orderId}.json`);
  const cache = loadJsonFromCache(cachePath);
  if (!cache) {
    throw new Error(`Cannot find order ${orderId}`);
  }
  return CoinbaseOrderSchema.parse(cache);
}

export function saveOrderToCache(orderId: string, data: object): void {
  const cachePath = path.join(coinbaseOrdersDir, `${orderId}.json`);
  saveJsonToCache(cachePath, data);
}
