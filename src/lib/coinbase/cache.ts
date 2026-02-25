import { mkdirSync } from "node:fs";
import path from "node:path";
import { cacheDir, loadJsonFromCache, saveJsonToCache } from "../common/cache.js";
import { type CoinbaseProduct, CoinbaseProductSchema } from "./schemas/rest.js";
import { type CoinbaseOrder, CoinbaseOrderSchema } from "./schemas/orders.js";

export const coinbaseDir = path.join(cacheDir, "coinbase");
mkdirSync(coinbaseDir, { recursive: true });
export const coinbaseProductsDir = path.join(coinbaseDir, "products");
mkdirSync(coinbaseProductsDir, { recursive: true });
export const coinbaseOrdersDir = path.join(coinbaseDir, "orders");
mkdirSync(coinbaseOrdersDir, { recursive: true });
export function loadCoinbaseFromCache(name: string) {
  const cachePath = path.join(coinbaseDir, `${name}.json`);
  return loadJsonFromCache(cachePath);
}

export function saveCoinbaseToCache(
  name: string,
  data: object,
) {
  const cachePath = path.join(coinbaseDir, `${name}.json`);
  saveJsonToCache(cachePath, data);
}

export function loadProductFromCache(productId: string): CoinbaseProduct {
  const cachePath = path.join(coinbaseProductsDir, `${productId}.json`);
  const cache = loadJsonFromCache(cachePath);
  if (!cache) {
    throw new Error(`Cannot find product ${productId}`);
  }
  return CoinbaseProductSchema.parse(cache);
}

export function saveProductToCache(productId: string, data: object): void {
  const cachePath = path.join(coinbaseProductsDir, `${productId}.json`);
  return saveJsonToCache(cachePath, data);
}

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
  return saveJsonToCache(cachePath, data);
}
