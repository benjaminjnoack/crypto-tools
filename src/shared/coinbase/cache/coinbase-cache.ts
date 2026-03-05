import { mkdirSync } from "node:fs";
import path from "node:path";
import { cacheDir, loadJsonFromCache, saveJsonToCache } from "../../common/cache.js";

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

export function saveCoinbaseToCache(name: string, data: object) {
  const cachePath = path.join(coinbaseDir, `${name}.json`);
  saveJsonToCache(cachePath, data);
}
