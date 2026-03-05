import {
  COINBASE_ORDERS_TABLE,
  insertCoinbaseOrder,
  selectCoinbaseOrder, selectCoinbaseOrderByLastFillTime,
  selectCoinbaseOrdersSumTotalFees,
} from "../../../db/coinbase/orders/repository.js";
import type { CoinbaseOrdersFeesOptions, CoinbaseOrdersUpdateOptions } from "./schemas/orders.js";
import { COINBASE_EPOCH, getToAndFromDates } from "../../shared/utils.js";
import path from "node:path";
import fs from "node:fs/promises";
import { coinbaseOrdersDir } from "../../../../../shared/coinbase/cache/coinbase-cache.js";
import { loadOrderFromCache, saveOrderToCache } from "../../../../../shared/coinbase/cache/order-cache.js";
import {
  getProductId,
} from "../../../../../shared/coinbase/index.js";
import { requestOrder, requestOrders } from "../../../../../shared/coinbase/rest.js";
import { ORDER_STATUS, OrderPlacementValues } from "../../../../../shared/coinbase/schemas/coinbase-enum-schemas.js";
import { logger, printOrder } from "../../../../../shared/log/index.js";

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

export async function coinbaseOrdersInsert(orderId: string) {
  const order = await requestOrder(orderId);
  await insertCoinbaseOrder(order);
}

export async function coinbaseOrdersUpdate(options: CoinbaseOrdersUpdateOptions) {
  const { cache, rsync } = options;
  let from, to;
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

  const orders = [];

  if (cache) {
    logger.info("Loading the orders from cache...");
    const files = await fs.readdir(coinbaseOrdersDir);
    for (const file of files) {
      if (!file.endsWith(".json")) {continue;}

      const orderId = path.basename(file, ".json");
      console.log(orderId);
      try {
        const order = loadOrderFromCache(orderId);
        orders.push(order);
      } catch (err) {
        logger.error(err);
      }
    }
    logger.info(`Loaded ${orders.length} orders from cache.`);
  } else {
    const sources = OrderPlacementValues;

    logger.info("Downloading orders from the exchange...");
    for (const source of sources.values()) {
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
  }

  logger.info(`Inserting order into ${COINBASE_ORDERS_TABLE}...`);
  for (const order of orders) {
    await insertCoinbaseOrder(order);
  }
  logger.info(`Inserted ${orders.length} orders.`);
}
