import { getSignedConfig, requestWithSchema } from "#shared/coinbase/http/http-client";
import { type CoinbaseProduct, CoinbaseProductSchema } from "#shared/coinbase/schemas/coinbase-rest-schemas";

export async function requestProduct(product_id: string): Promise<CoinbaseProduct> {
  const requestPath = `/api/v3/brokerage/products/${product_id}`;
  const config = await getSignedConfig("GET", requestPath);
  return requestWithSchema(config, CoinbaseProductSchema);
}
