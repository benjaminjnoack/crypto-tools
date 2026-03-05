import { requestProduct } from "./rest.js";
import { loadProductFromCache, saveProductToCache } from "./cache/product-cache.js";
import { type CoinbaseProduct } from "./schemas/coinbase-rest-schemas.js";
import { printError } from "#shared/log/error";
import { logger } from "#shared/log/logger";
import { type ProductId, ProductIdSchema } from "#shared/schemas/shared-primitives";

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
