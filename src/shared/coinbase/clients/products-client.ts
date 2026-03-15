import { getSignedConfig, requestWithSchema } from "../http/http-client.js";
import { type CoinbaseProduct, CoinbaseProductSchema } from "../schemas/coinbase-rest-schemas.js";

export async function requestProduct(
  product_id: string,
  maxRetries?: number,
): Promise<CoinbaseProduct> {
  const requestPath = `/api/v3/brokerage/products/${product_id}`;
  const config = await getSignedConfig("GET", requestPath);
  return requestWithSchema(config, CoinbaseProductSchema, maxRetries);
}
