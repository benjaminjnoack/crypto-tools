import path from "node:path";
import { loadJsonFromCache, saveJsonToCache } from "#shared/common/cache";
import { type CoinbaseProduct, CoinbaseProductSchema } from "#shared/coinbase/schemas/coinbase-rest-schemas";
import { coinbaseProductsDir } from "./coinbase-cache.js";

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
  saveJsonToCache(cachePath, data);
}
