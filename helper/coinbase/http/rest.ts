import { getSigningKeys, hasSigningKeys, signUrl } from '../signing.js';
import axios, {
  type AxiosRequestConfig,
  type Method,
  type AxiosError,
  type AxiosInstance,
} from 'axios';
import { log } from '@core/logger.js';
import { safeNumber } from '@core/validation';
import { ORDER_STATUS } from '@core/dictionary';
import { toIncrement } from '@core/increment';
import { ORDER_PLACEMENT_SOURCE } from '../dictionary';
import { z, type ZodType } from 'zod';
import delay from '@core/delay';
import {
  AccountResponseSchema,
  AccountsResponseSchema,
  BestBidAskResponseSchema,
  CandlesResponseSchema,
  type CoinbaseAccount,
  type CoinbaseCandle,
  type CoinbaseOrder,
  type CoinbasePriceBook,
  type CoinbaseProduct,
  CoinbaseProductSchema,
  type OrderHistoricalBatchResponse,
  type OrderRequest,
  OrderResponseSchema,
  OrdersBatchCancelResponseSchema,
  OrdersHistoricalResponseSchema,
  ProductsResponseSchema,
  type TickerResponse,
  TickerResponseSchema,
  type TransactionSummary,
  TransactionSummaryResponseSchema,
} from '@cb/http/contracts';

const HOST = 'https://api.coinbase.com';
const MAX_RETRIES = 5;

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
      'Content-Type': 'application/json',
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
  headers: { 'Content-Type': 'application/json' },
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
        log.error(
          `[HTTP] ${config.method} ${config.url} -> ${status ?? 'ERR'} ${
            typeof data === 'string' ? data : JSON.stringify(data)
          }`,
        );
      } else if (e instanceof z.ZodError) {
        // Schema mismatch is permanent—no point retrying more times
        log.error('[HTTP] Response validation failed:', e.message);
        throw e;
      } else {
        log.error(`[HTTP] ${config.method} ${config.url} failed:`, String(e));
      }

      if (attempt < maxRetries) {
        await delay(1000 * attempt); // backoff
      }
    }
  }

  throw new Error(
    `${config.method} ${config.url} failed after ${maxRetries} attempts: ${
      (lastErr as Error)?.message ?? String(lastErr)
    }`,
  );
}

export async function requestAccounts(): Promise<CoinbaseAccount[]> {
  const requestPath = '/api/v3/brokerage/accounts';
  const q = new URLSearchParams({ limit: '250' }).toString(); // "limit=250"
  const config = await getConfig('GET', requestPath, `?${q}`);
  const parsed = await requestWithSchema(config, AccountsResponseSchema);
  return parsed.accounts;
}

async function requestData(config: AxiosRequestConfig): Promise<any> {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.request(config);
      return response.data;
    } catch (e) {
      lastError = e instanceof Error ? e.message : e;
      log.error(lastError);
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
    }
  }
  throw new Error(
    `${config.method} ${config.url} failed after ${MAX_RETRIES} attempts: ${lastError}`,
  );
}

export async function requestAccount(uuid: string): Promise<CoinbaseAccount> {
  const requestPath = `/api/v3/brokerage/accounts/${uuid}`;
  const config = await getConfig('GET', requestPath);
  const parsed = await requestWithSchema(config, AccountResponseSchema);
  return parsed.account;
}

export async function requestCurrencyAccount(currency: string = 'USD', increment: string = '0.01') {
  const accounts = await requestAccounts();
  const account = accounts.find((account) => account.currency === currency);
  if (!account) {
    throw new Error(`Could not find ${currency} account`);
  }

  const available = account.available_balance.value;
  const hold = account.hold.value;

  const numAvailable = safeNumber(available, 'requestUsdAccount => available_balance');
  const numHold = safeNumber(hold, 'requestUsdAccount => hold');
  const numTotal = numAvailable + numHold;
  const total = toIncrement(increment, numTotal);

  return {
    available,
    hold,
    total,
  };
}

export async function requestOrderCreation(order: OrderRequest): Promise<string> {
  const requestPath = '/api/v3/brokerage/orders';
  const config = await getConfig('POST', requestPath, null, order);
  const parsed = await requestWithSchema(config, OrderResponseSchema);
  if (parsed.success) {
    if (parsed.success_response) {
      return parsed.success_response.order_id;
    } else {
      throw new Error('Missing order ID in success response.');
    }
  } else {
    if (parsed.error_response) {
      throw new Error(parsed.error_response.preview_failure_reason);
    } else {
      throw new Error('Missing error response');
    }
  }
}

/**
 * Returns true if successful, otherwise throws an error.
 */
export async function requestOrderCancellation(order_id: string) {
  const request_path = `/api/v3/brokerage/orders/batch_cancel`;
  const data = { order_ids: [order_id] };

  const config = await getConfig('POST', request_path, null, data);
  const parsed = await requestWithSchema(config, OrdersBatchCancelResponseSchema);
  if (parsed.results) {
    const result = parsed.results.find((r) => r.order_id === order_id);
    if (!result) {
      console.dir(parsed);
      throw new Error(`Order ID ${order_id} not found in response`);
    }
  }

  if (parsed.success) {
    log.info(`Order ${order_id} canceled successfully.`);
    return true;
  } else {
    log.error(`Cancel failed: ${parsed.failure_reason || 'Unknown reason'}`);
    return false;
  }
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
  const request_path = '/api/v3/brokerage/orders/historical/batch';

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
    const config = await getConfig('GET', request_path, queryString);
    response_data = await requestData(config);

    if (response_data?.orders && Array.isArray(response_data.orders)) {
      orders.push(...response_data.orders);
    } else {
      console.dir(response_data);
      throw new Error('Failed to retrieve open orders.');
    }
  } while (response_data['has_next']);

  return orders;
}

export async function requestOrder(orderId: string): Promise<CoinbaseOrder> {
  const request_path = `/api/v3/brokerage/orders/historical/${orderId}`;
  const config = await getConfig('GET', request_path);
  const parsed = await requestWithSchema(config, OrdersHistoricalResponseSchema);
  return parsed.order;
}

export async function requestProduct(product_id: string): Promise<CoinbaseProduct> {
  const request_path = `/api/v3/brokerage/products/${product_id}`;
  const config = await getConfig('GET', request_path);
  return await requestWithSchema(config, CoinbaseProductSchema);
}

export async function requestProducts(productIds: string[]): Promise<CoinbaseProduct[]> {
  const request_path = '/api/v3/brokerage/products';
  let queryString = `?product_type=SPOT`;
  productIds.forEach((product: string) => (queryString += `&product_ids=${product}`));
  const config = await getConfig('GET', request_path, queryString);
  const parsed = await requestWithSchema(config, ProductsResponseSchema);
  return parsed.products;
}

export async function requestBestBidAsk(product_id: string): Promise<CoinbasePriceBook> {
  let request_path = '/api/v3/brokerage/best_bid_ask';
  let queryString = `?product_ids=${product_id}`;

  const config = await getConfig('GET', request_path, queryString);
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
  let requestPath = `/api/v3/brokerage/products/${productId}/ticker`;
  const q = new URLSearchParams({ limit: limit.toFixed(0) }).toString();
  const config = await getConfig('GET', requestPath, `?${q}`);
  return requestWithSchema(config, TickerResponseSchema);
}

export async function requestTransactionSummary(
  productType: string = 'SPOT',
): Promise<TransactionSummary> {
  let requestPath = `/api/v3/brokerage/transaction_summary`;
  const q = new URLSearchParams({
    product_type: productType,
  });

  const config = await getConfig('GET', requestPath, `?${q}`);
  return requestWithSchema(config, TransactionSummaryResponseSchema);
}

export enum Granularity {
  ONE_MINUTE = 'ONE_MINUTE',
  FIVE_MINUTE = 'FIVE_MINUTE',
  FIFTEEN_MINUTE = 'FIFTEEN_MINUTE',
  THIRTY_MINUTE = 'THIRTY_MINUTE',
  ONE_HOUR = 'ONE_HOUR',
  TWO_HOUR = 'TWO_HOUR',
  SIX_HOUR = 'SIX_HOUR',
  ONE_DAY = 'ONE_DAY',
}

export async function requestHistoricalData(
  product: string,
  start: number,
  end: number,
  granularity: string,
): Promise<CoinbaseCandle[]> {
  const requestPath = `/api/v3/brokerage/market/products/${product}/candles`;
  const q = new URLSearchParams({
    end: end.toFixed(0),
    start: start.toFixed(0),
    granularity: granularity,
  }).toString();

  const config = await getConfig('GET', requestPath, `?${q}`);
  const parsed = await requestWithSchema(config, CandlesResponseSchema);
  return parsed.candles;
}
