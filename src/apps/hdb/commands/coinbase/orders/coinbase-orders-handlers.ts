import {
  COINBASE_ORDERS_TABLE,
  createCoinbaseOrdersTable,
  dropCoinbaseOrdersTable,
  insertCoinbaseOrder,
  selectCoinbaseOrder,
  selectCoinbaseOrderByLastFillTime,
  selectCoinbaseOrdersSumTotalFees,
  truncateCoinbaseOrdersTable,
} from "../../../db/coinbase/orders/coinbase-orders-repository.js";
import type {
  CoinbaseOrdersFeesOptions,
  CoinbaseOrdersInsertOptions,
  CoinbaseOrdersRegenerateOptions,
  CoinbaseOrdersUpdateOptions,
} from "./schemas/coinbase-orders-options.js";
import { COINBASE_EPOCH, getToAndFromDates } from "../../shared/date-range-utils.js";
import path from "node:path";
import fs from "node:fs/promises";
import { coinbaseOrdersDir } from "../../../../../shared/coinbase/cache/coinbase-cache.js";
import { loadOrderFromCache, saveOrderToCache } from "../../../../../shared/coinbase/cache/order-cache.js";
import {
  getProductId,
} from "../../../../../shared/coinbase/index.js";
import { requestOrder, requestOrders } from "../../../../../shared/coinbase/rest.js";
import { ORDER_STATUS, OrderPlacementValues } from "../../../../../shared/coinbase/schemas/coinbase-enum-schemas.js";
import type { CoinbaseOrder } from "../../../../../shared/coinbase/schemas/coinbase-order-schemas.js";
import { logger, printOrder } from "../../../../../shared/log/index.js";

function assertUpdateSource(cache?: boolean, remote?: boolean): void {
  if (cache && remote) {
    throw new Error("Invalid source: use either --cache or --remote, not both.");
  }
  if (!cache && !remote) {
    throw new Error("Missing source: select either --cache or --remote.");
  }
}

function dedupeOrdersById(orders: CoinbaseOrder[]): CoinbaseOrder[] {
  const deduped: CoinbaseOrder[] = [];
  const seenOrderIds = new Set<string>();

  for (const order of orders) {
    const orderId = order.order_id;
    if (seenOrderIds.has(orderId)) {
      continue;
    }
    seenOrderIds.add(orderId);
    deduped.push(order);
  }

  return deduped;
}

async function loadOrdersFromCache(): Promise<CoinbaseOrder[]> {
  logger.info("Loading the orders from cache...");
  const files = await fs.readdir(coinbaseOrdersDir);
  const orders: CoinbaseOrder[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) {
      continue;
    }

    const orderId = path.basename(file, ".json");
    try {
      orders.push(loadOrderFromCache(orderId));
    } catch (err) {
      logger.error(err);
    }
  }

  logger.info(`Loaded ${orders.length} orders from cache.`);
  return orders;
}

async function resolveRemoteDateRange(options: CoinbaseOrdersUpdateOptions): Promise<{ from: Date; to: Date }> {
  if (options.rsync) {
    let { last } = await selectCoinbaseOrderByLastFillTime(false, true);
    if (!last) {
      last = new Date(COINBASE_EPOCH);
    }
    return { from: last, to: new Date() };
  }

  return getToAndFromDates(options, true, true);
}

async function loadOrdersFromRemote(options: CoinbaseOrdersUpdateOptions): Promise<CoinbaseOrder[]> {
  const { from, to } = await resolveRemoteDateRange(options);
  const start = from.toISOString();
  const end = to.toISOString();
  const orders: CoinbaseOrder[] = [];

  logger.info("Downloading orders from the exchange...");
  for (const source of OrderPlacementValues.values()) {
    logger.info(`Requesting orders from ${source}...`);
    const data = await requestOrders(ORDER_STATUS.FILLED, source, null, start, end);
    logger.info(`Retrieved ${data.length} orders.`);
    orders.push(...data);
  }

  logger.info("Caching the orders on disk...");
  for (const order of orders) {
    saveOrderToCache(order.order_id, order);
  }
  logger.info(`Cached ${orders.length} orders.`);

  return orders;
}

export async function coinbaseOrders(orderId: string): Promise<CoinbaseOrder> {
  const order = await selectCoinbaseOrder(orderId);
  printOrder(order);
  return order;
}

export async function coinbaseOrdersObject(orderId: string): Promise<CoinbaseOrder> {
  const order = await selectCoinbaseOrder(orderId);
  console.dir(order, { depth: null });
  return order;
}

export async function coinbaseOrdersFees(productId: string | undefined, options: CoinbaseOrdersFeesOptions) {
  const { side } = options;

  if (productId) {
    productId = getProductId(productId);
  }

  const { from, to } = await getToAndFromDates(options);

  const fees = await selectCoinbaseOrdersSumTotalFees(from, to, productId ?? null, side ?? null);
  logger.info(`Fees: $${fees.toFixed(2)}`);
}

export async function coinbaseOrdersInsert(orderId: string, options: CoinbaseOrdersInsertOptions) {
  const { remote } = options;
  if (!remote) {
    throw new Error("Missing source: use --remote for live Coinbase requests.");
  }

  const order = await requestOrder(orderId);
  await insertCoinbaseOrder(order);
}

export async function coinbaseOrdersUpdate(options: CoinbaseOrdersUpdateOptions) {
  const { cache, remote, rsync } = options;
  assertUpdateSource(cache, remote);

  const orders = cache
    ? await loadOrdersFromCache()
    : await loadOrdersFromRemote({ ...options, rsync });
  const dedupedOrders = dedupeOrdersById(orders);

  logger.info(`Inserting order into ${COINBASE_ORDERS_TABLE}...`);
  for (const order of dedupedOrders) {
    await insertCoinbaseOrder(order);
  }
  logger.info(`Inserted ${dedupedOrders.length} orders.`);
}

export async function coinbaseOrdersRegenerate(options: CoinbaseOrdersRegenerateOptions): Promise<void> {
  const { drop } = options;

  if (drop) {
    await dropCoinbaseOrdersTable();
    await createCoinbaseOrdersTable();
  } else {
    await createCoinbaseOrdersTable();
    await truncateCoinbaseOrdersTable();
  }

  await coinbaseOrdersUpdate(options);
}
