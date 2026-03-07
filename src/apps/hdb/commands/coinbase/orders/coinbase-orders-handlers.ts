import {
  COINBASE_ORDERS_TABLE,
  insertCoinbaseOrder,
  selectCoinbaseOrder,
  selectCoinbaseOrderByLastFillTime,
  selectCoinbaseOrdersSumTotalFees,
} from "../../../db/coinbase/orders/coinbase-orders-repository.js";
import type {
  CoinbaseOrdersFeesOptions,
  CoinbaseOrdersInsertOptions,
  CoinbaseOrdersUpdateOptions,
} from "./schemas/coinbase-orders-options.js";
import { COINBASE_EPOCH, getToAndFromDates } from "../../shared/date-range-utils.js";
import path from "node:path";
import fs from "node:fs/promises";
import { coinbaseOrdersDir } from "#shared/coinbase/cache/coinbase-cache";
import { loadOrderFromCache, saveOrderToCache } from "#shared/coinbase/cache/order-cache";
import {
  getProductId,
} from "#shared/coinbase/index";
import { requestOrder, requestOrders } from "#shared/coinbase/rest";
import { ORDER_STATUS, OrderPlacementValues } from "#shared/coinbase/schemas/coinbase-enum-schemas";
import type { CoinbaseOrder } from "#shared/coinbase/schemas/coinbase-order-schemas";
import { logger, printOrder } from "#shared/log/index";

export async function coinbaseOrders(orderId: string) {
  const order = await selectCoinbaseOrder(orderId);
  printOrder(order);
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
  const { remote, yes } = options;
  if (!remote) {
    throw new Error("Missing source: use --remote for live Coinbase requests.");
  }
  if (!yes) {
    throw new Error("Refusing live Coinbase request without confirmation. Re-run with --remote --yes.");
  }

  const order = await requestOrder(orderId);
  await insertCoinbaseOrder(order);
}

export async function coinbaseOrdersUpdate(options: CoinbaseOrdersUpdateOptions) {
  const { cache, remote, rsync, yes } = options;
  if (cache && remote) {
    throw new Error("Invalid source: use either --cache or --remote, not both.");
  }
  if (!cache && !remote) {
    throw new Error("Missing source: select either --cache or --remote.");
  }
  if (remote && !yes) {
    throw new Error("Refusing live Coinbase requests without confirmation. Re-run with --remote --yes.");
  }

  const orders: Array<Record<string, unknown>> = [];

  if (cache) {
    logger.info("Loading the orders from cache...");
    const files = await fs.readdir(coinbaseOrdersDir);
    for (const file of files) {
      if (!file.endsWith(".json")) {continue;}

      const orderId = path.basename(file, ".json");
      try {
        const order = loadOrderFromCache(orderId) as Record<string, unknown>;
        orders.push(order);
      } catch (err) {
        logger.error(err);
      }
    }
    logger.info(`Loaded ${orders.length} orders from cache.`);
  } else if (remote) {
    let from: Date;
    let to: Date;
    if (rsync) {
      let { last } = await selectCoinbaseOrderByLastFillTime(false, true);
      if (!last) {
        last = new Date(COINBASE_EPOCH);
      }
      from = last;
      to = new Date();
    } else {
      ({ from, to } = await getToAndFromDates(options, true, true));
    }
    const start = from.toISOString();
    const end = to.toISOString();

    const sources = OrderPlacementValues;

    logger.info("Downloading orders from the exchange...");
    for (const source of sources.values()) {
      logger.info(`Requesting orders from ${source}...`);
      const data = await requestOrders(ORDER_STATUS.FILLED, source, null, start, end);
      logger.info(`Retrieved ${data.length} orders.`);
      orders.push(...(data as Array<Record<string, unknown>>));
    }

    logger.info("Caching the orders on disk...");
    for (const order of orders) {
      const orderId = typeof order.order_id === "string" ? order.order_id : null;
      if (!orderId) {
        logger.warn("Skipping cache write for order without order_id");
        continue;
      }
      saveOrderToCache(orderId, order as CoinbaseOrder);
    }
    logger.info(`Cached ${orders.length} orders.`);
  }

  const dedupedOrders: Array<Record<string, unknown>> = [];
  const seenOrderIds = new Set<string>();
  for (const order of orders) {
    const orderId = typeof order.order_id === "string" ? order.order_id : null;
    if (!orderId) {
      logger.warn("Skipping insert for order without order_id");
      continue;
    }
    if (seenOrderIds.has(orderId)) {
      continue;
    }
    seenOrderIds.add(orderId);
    dedupedOrders.push(order);
  }

  logger.info(`Inserting order into ${COINBASE_ORDERS_TABLE}...`);
  for (const order of dedupedOrders) {
    await insertCoinbaseOrder(order as CoinbaseOrder);
  }
  logger.info(`Inserted ${dedupedOrders.length} orders.`);
}
