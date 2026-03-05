import { getSignedConfig, requestWithSchema } from "../http/http-client.js";
import {
  BestBidAskResponseSchema,
  type CoinbasePriceBook,
  type TickerResponse,
  TickerResponseSchema,
} from "../schemas/coinbase-rest-schemas.js";

export async function requestBestBidAsk(product_id: string): Promise<CoinbasePriceBook> {
  const requestPath = "/api/v3/brokerage/best_bid_ask";
  const queryString = `?product_ids=${product_id}`;
  const config = await getSignedConfig("GET", requestPath, queryString);
  const parsed = await requestWithSchema(config, BestBidAskResponseSchema);
  if (!parsed.pricebooks[0]) {
    throw new Error(`No pricebooks found for product_id=${product_id}`);
  }
  return parsed.pricebooks[0];
}

export async function requestMarketTrades(
  productId: string,
  limit: number = 1,
): Promise<TickerResponse> {
  const requestPath = `/api/v3/brokerage/products/${productId}/ticker`;
  const q = new URLSearchParams({ limit: limit.toFixed(0) }).toString();
  const config = await getSignedConfig("GET", requestPath, `?${q}`);
  return requestWithSchema(config, TickerResponseSchema);
}
