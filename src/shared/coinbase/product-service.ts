import { requestProduct } from "./rest.js";
import { loadProductFromCache, saveProductToCache } from "./cache/product-cache.js";
import { type CoinbaseProduct } from "./schemas/coinbase-rest-schemas.js";
import { printError } from "../log/error.js";
import { logger } from "../log/logger.js";
import { type ProductId, ProductIdSchema } from "../schemas/shared-primitives.js";
import { loadCoinbaseFromCache, saveCoinbaseToCache } from "./cache/coinbase-cache.js";

const UNSUPPORTED_PRODUCTS_CACHE_KEY = "unsupported-products";

type UnsupportedProductsCache = {
  products: string[];
};

export type GetProductInfoOptions = {
  tryFetchOnce?: boolean;
};

export function getProductId(product: string, currency: string = "USD"): ProductId {
  let productId = product.toUpperCase();
  if (!productId.includes("-")) {productId = `${productId}-${currency}`;}
  return ProductIdSchema.parse(productId);
}

export async function getProductInfo(
  productId: string,
  forceUpdate: boolean = false,
  options: GetProductInfoOptions = {},
): Promise<CoinbaseProduct> {
  let data: CoinbaseProduct;
  const { tryFetchOnce = false } = options;
  const unsupportedProducts = getUnsupportedProductsFromCache();
  const normalizedProductId = productId.toUpperCase();

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
      if (tryFetchOnce && unsupportedProducts.has(normalizedProductId)) {
        logger.warn(`getProductInfo => Skipping fetch for unsupported product ${normalizedProductId}`);
        throw new Error(`Product ${normalizedProductId} is marked unsupported`);
      }

      logger.warn(`getProductInfo => Cache miss for ${productId}, fetching from Coinbase...`);
      try {
        data = tryFetchOnce
          ? await requestProduct(productId, 1)
          : await requestProduct(productId);
      } catch (requestError) {
        if (tryFetchOnce && isUnsupportedProductError(requestError)) {
          unsupportedProducts.add(normalizedProductId);
          saveUnsupportedProductsToCache(unsupportedProducts);
          logger.warn(`getProductInfo => Marked unsupported product ${normalizedProductId}`);
        }
        throw requestError;
      }
      saveProductToCache(productId, data);
    }
  }
  return data;
}

function getUnsupportedProductsFromCache(): Set<string> {
  const raw = loadCoinbaseFromCache(UNSUPPORTED_PRODUCTS_CACHE_KEY);
  if (!raw || typeof raw !== "object") {
    return new Set<string>();
  }
  const products = (raw as UnsupportedProductsCache).products;
  if (!Array.isArray(products)) {
    return new Set<string>();
  }
  return new Set(
    products
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.toUpperCase()),
  );
}

function saveUnsupportedProductsToCache(products: Set<string>): void {
  const payload: UnsupportedProductsCache = {
    products: Array.from(products).sort(),
  };
  saveCoinbaseToCache(UNSUPPORTED_PRODUCTS_CACHE_KEY, payload);
}

function isUnsupportedProductError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes("status code 404")
    || message.includes("not supported")
    || message.includes("not_found");
}
