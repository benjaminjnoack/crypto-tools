import { getSigningKeys, hasSigningKeys, signUrl } from "./signing.js";
import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type Method,
} from "axios";
import { ORDER_STATUS } from "./schemas/enums.js";
import { toIncrement } from "../common/increment.js";
import { z, type ZodType } from "zod";
import delay from "../common/delay.js";
import { type CoinbaseOrder } from "./schemas/orders.js"
import {
  AccountsResponseSchema,
  BestBidAskResponseSchema,
  type CoinbaseAccount,
  type CoinbasePriceBook,
  type CoinbaseProduct,
  CoinbaseProductSchema,
  type OrderHistoricalBatchResponse,
  type OrderRequest,
  OrderResponseSchema,
  OrdersBatchCancelResponseSchema, OrdersHistoricalBatchResponseSchema,
  OrdersHistoricalResponseSchema,
  type TickerResponse,
  TickerResponseSchema,
  type TransactionSummary,
  TransactionSummaryResponseSchema,
} from "./schemas/rest.js";
import { logger } from "../log/logger.js";

const HOST = "https://api.coinbase.com";
const MAX_RETRIES = 5;
const ORDER_PLACEMENT_SOURCE = {
  UNKNOWN: "UNKNOWN_PLACEMENT_SOURCE",
  SIMPLE: "RETAIL_SIMPLE",
  ADVANCED: "RETAIL_ADVANCED",
} as const;

async function getConfig(
  method: Method,
  requestPath: string,
  queryString: string | null = null,
  data: unknown = null,
): Promise<AxiosRequestConfig> {
  if (!hasSigningKeys()) {
    await getSigningKeys();
  }

  const config: AxiosRequestConfig = {
    method,
    maxBodyLength: Infinity,
    url: HOST + (queryString ? requestPath + queryString : requestPath),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${signUrl(method, requestPath)}`,
    },
  };

  if (data) {
    config.data = JSON.stringify(data);
  }

  return config;
}

export const http: AxiosInstance = axios.create({
  baseURL: HOST,
  maxBodyLength: Infinity,
  headers: { "Content-Type": "application/json" },
});

export async function requestWithSchema<S extends ZodType>(
  config: AxiosRequestConfig,
  schema: S,
  maxRetries: number = MAX_RETRIES,
): Promise<z.output<S>> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await http.request(config);
      return schema.parse(res.data); // runtime validation
    } catch (e) {
      lastErr = e;

      // Helpful logging
      if ((e as AxiosError).isAxiosError) {
        const ax = e as AxiosError;
        const status = ax.response?.status;
        const data = ax.response?.data;
        logger.error(
          `[HTTP] ${config.method} ${config.url} -> ${status ?? "ERR"} ${
            typeof data === "string" ? data : JSON.stringify(data)
          }`,
        );
      } else if (e instanceof z.ZodError) {
        // Schema mismatch is permanent—no point retrying more times
        logger.error("[HTTP] Response validation failed:", e.message);
        throw e;
      } else {
        logger.error(`[HTTP] ${config.method} ${config.url} failed:`, String(e));
      }

      if (attempt < maxRetries) {
        await delay(1000 * attempt); // backoff
      }
    }
  }

  throw new Error(
    `${config.method} ${config.url} failed after ${maxRetries} attempts: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}

export async function requestAccounts(): Promise<CoinbaseAccount[]> {
  const requestPath = "/api/v3/brokerage/accounts";
  const q = new URLSearchParams({ limit: "250" }).toString(); // "limit=250"
  const config = await getConfig("GET", requestPath, `?${q}`);
  const parsed = await requestWithSchema(config, AccountsResponseSchema);
  return parsed.accounts;
}

export async function requestCurrencyAccount(currency: string = "USD", increment: string = "0.01") {
  const accounts = await requestAccounts();
  const account = accounts.find((account) => account.currency === currency);
  if (!account) {
    throw new Error(`Could not find ${currency} account`);
  }

  const available = account.available_balance.value;
  const hold = account.hold.value;

  const numAvailable = parseFloat(available);
  const numHold = parseFloat(hold);
  const numTotal = numAvailable + numHold;
  const total = toIncrement(increment, numTotal);

  return {
    available,
    hold,
    total,
  };
}

export async function requestOrderCreation(order: OrderRequest): Promise<string> {
  const requestPath = "/api/v3/brokerage/orders";
  const config = await getConfig("POST", requestPath, null, order);
  const parsed = await requestWithSchema(config, OrderResponseSchema);
  if (parsed.success) {
    if (parsed.success_response) {
      return parsed.success_response.order_id;
    } else {
      throw new Error("Missing order ID in success response.");
    }
  } else {
    if (parsed.error_response) {
      throw new Error(parsed.error_response.preview_failure_reason);
    } else {
      throw new Error("Missing error response");
    }
  }
}

/**
 * Returns true if successful, otherwise throws an error.
 */
export async function requestOrderCancellation(order_id: string) {
  const request_path = "/api/v3/brokerage/orders/batch_cancel";
  const data = { order_ids: [order_id] };

  const config = await getConfig("POST", request_path, null, data);
  const parsed = await requestWithSchema(config, OrdersBatchCancelResponseSchema);
  const result = parsed.results.find((r) => r.order_id === order_id);
  if (!result) {
    throw new Error(`Order ID ${order_id} not found in response`);
  }

  if (result.success) {
    logger.info(`Order ${order_id} canceled successfully.`);
    return true;
  }

  throw new Error(`Cancel failed: ${result.failure_reason || "Unknown reason"}`);
}

export async function requestOpenOrders(
  product_id: string | null = null,
): Promise<CoinbaseOrder[]> {
  return requestOrders(ORDER_STATUS.OPEN, ORDER_PLACEMENT_SOURCE.ADVANCED, product_id, null, null);
}

export async function requestOrders(
  orderStatus: string,
  orderPlacementSource: string = ORDER_PLACEMENT_SOURCE.ADVANCED,
  productId: string | null = null,
  startDate: string | null = null,
  endDate: string | null = null,
): Promise<CoinbaseOrder[]> {
  const request_path = "/api/v3/brokerage/orders/historical/batch";

  let response_data: OrderHistoricalBatchResponse = { orders: [] };
  const orders = [];
  do {
    let queryString = `?order_status=${orderStatus}`;
    if (orderPlacementSource) {
      queryString += `&order_placement_source=${orderPlacementSource}`;
    }
    if (productId) {
      queryString += `&product_ids=${productId}`;
    }
    if (startDate) {
      queryString += `&start_date=${startDate}`;
    }
    if (endDate) {
      queryString += `&end_date=${endDate}`;
    }
    if (response_data.cursor) {
      queryString += `&cursor=${response_data.cursor}`;
    }
    const config = await getConfig("GET", request_path, queryString);
    response_data = await requestWithSchema(config, OrdersHistoricalBatchResponseSchema);

    orders.push(...response_data.orders);
  } while (response_data["has_next"]);

  return orders;
}

export async function requestOrder(orderId: string): Promise<CoinbaseOrder> {
  const request_path = `/api/v3/brokerage/orders/historical/${orderId}`;
  const config = await getConfig("GET", request_path);
  const parsed = await requestWithSchema(config, OrdersHistoricalResponseSchema);
  return parsed.order;
}

export async function requestProduct(product_id: string): Promise<CoinbaseProduct> {
  const request_path = `/api/v3/brokerage/products/${product_id}`;
  const config = await getConfig("GET", request_path);
  return await requestWithSchema(config, CoinbaseProductSchema);
}

export async function requestBestBidAsk(product_id: string): Promise<CoinbasePriceBook> {
  const request_path = "/api/v3/brokerage/best_bid_ask";
  const queryString = `?product_ids=${product_id}`;

  const config = await getConfig("GET", request_path, queryString);
  const parsed = await requestWithSchema(config, BestBidAskResponseSchema);
  if (parsed.pricebooks[0]) {
    return parsed.pricebooks[0];
  } else {
    throw new Error(`No pricebooks found for product_id=${product_id}`);
  }
}

export async function requestMarketTrades(
  productId: string,
  limit: number = 1,
): Promise<TickerResponse> {
  const requestPath = `/api/v3/brokerage/products/${productId}/ticker`;
  const q = new URLSearchParams({ limit: limit.toFixed(0) }).toString();
  const config = await getConfig("GET", requestPath, `?${q}`);
  return requestWithSchema(config, TickerResponseSchema);
}

export async function requestTransactionSummary(
  productType: string = "SPOT",
): Promise<TransactionSummary> {
  const requestPath = "/api/v3/brokerage/transaction_summary";
  const q = new URLSearchParams({
    product_type: productType,
  }).toString();

  const config = await getConfig("GET", requestPath, `?${q}`);
  return requestWithSchema(config, TransactionSummaryResponseSchema);
}
