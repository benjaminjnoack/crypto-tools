import path from "node:path";
import { loadJsonFromCache, saveJsonToCache } from "../../common/cache.js";
import { type CoinbaseProduct, CoinbaseProductSchema } from "../schemas/coinbase-rest-schemas.js";
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
