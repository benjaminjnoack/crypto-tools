import { requestProduct } from './http/rest';
import { loadProduct, saveProduct } from '@core/cache';
import { log } from '@core/logger';
import { type CoinbaseProduct } from '@cb/http/contracts';

class Product {
  product_id: string;
  product: CoinbaseProduct | null = null;

  constructor(product_id: string) {
    this.product_id = product_id;
  }

  get base_increment() {
    if (!this.product) {
      throw new Error(`cannot read base_increment of product`);
    }
    return this.product.base_increment;
  }

  get price_increment() {
    if (!this.product) {
      throw new Error(`cannot read price_increment of product`);
    }
    return this.product.price_increment;
  }

  async update(force: boolean = false): Promise<CoinbaseProduct> {
    this.product = await Product.getProductInfo(this.product_id, force);
    return this.product;
  }

  static async getProductInfo(
    productId: string,
    forceUpdate: boolean = false,
  ): Promise<CoinbaseProduct> {
    let data: CoinbaseProduct;

    if (forceUpdate) {
      log.info(`getProductInfo => Force update for ${productId}`);
      data = await requestProduct(productId);
      await saveProduct(productId, data);
    } else {
      try {
        data = await loadProduct(productId);
        log.debug(`getProductInfo => Cache hit for ${productId}`);
      } catch (e) {
        log.warn(`getProductInfo => Cache miss for ${productId}, fetching from Coinbase...`);
        data = await requestProduct(productId);
        await saveProduct(productId, data);
      }
    }
    return data;
  }

  /**
   * Convert product ('BTC') to product ID ('BTC-USD')
   */
  static getProductId(product: string, currency: string = 'USD'): string {
    if (!product) {
      throw new Error(`Product.getProductId => missing product argument`);
    }
    let productId = product.toUpperCase();
    if (!productId.includes('-')) productId = `${productId}-${currency}`;
    return productId;
  }
}

export default Product;
