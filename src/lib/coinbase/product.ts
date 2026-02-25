import { requestProduct } from "./rest.js";
import { loadProductFromCache, saveProductToCache } from "./cache.js";
import { type CoinbaseProduct } from "./schemas/rest.js";
import { printError } from "../log/error.js";
import { logger } from "../log/logger.js";
import { type ProductId, ProductIdSchema } from "../schemas/primitives.js";

export function getProductId(product: string, currency: string = "USD"): ProductId {
  let productId = product.toUpperCase();
  if (!productId.includes("-")) {productId = `${productId}-${currency}`;}
  return ProductIdSchema.parse(productId);
}

export async function getProductInfo(
  productId: string,
  forceUpdate: boolean = false,
): Promise<CoinbaseProduct> {
  let data: CoinbaseProduct;

  if (forceUpdate) {
    logger.info(`getProductInfo => Force update for ${productId}`);
    data = await requestProduct(productId);
    saveProductToCache(productId, data);
  } else {
    try {
      data = loadProductFromCache(productId);
      logger.debug(`getProductInfo => Cache hit for ${productId}`);
    } catch (e) {
      printError(e);
      logger.warn(`getProductInfo => Cache miss for ${productId}, fetching from Coinbase...`);
      data = await requestProduct(productId);
      saveProductToCache(productId, data);
    }
  }
  return data;
}
