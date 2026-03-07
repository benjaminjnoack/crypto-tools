import { requestOrder, requestOrders } from '@cb/http/rest.js';
import {
  COINBASE_ORDERS_TABLE,
  createCoinbaseOrdersTable,
  dropCoinbaseOrdersTable,
  insertCoinbaseOrder,
  selectCoinbaseOrder,
  selectCoinbaseOrderByLastFillTime,
  selectCoinbaseOrdersSumTotalFees,
} from '../queries.js';
import { printCoinbaseOrderRecord, reconstructCoinbaseOrderFromDb } from '../orders.js';
import Product from '../../../Product';
import { log } from '@core/logger.js';
import { getToAndFromDates } from '@db/cli/utils.js';
import { ORDER_PLACEMENT_SOURCE } from '@cb/dictionary';
import { ORDER_STATUS } from '@core/dictionary.ts';
import { cacheDir, loadOrderFromCache, ORDERS, saveOrder } from '@core/cache.js';
import { promptYesNo } from '@cli/utils.js';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * TODO
 *  would be nice if this could generate a table of orders like the other broad selection functions based on time
 *  can print a single order raw, or maybe just use coinbase-orders-order for that
 * @param {string} orderId
 * @returns {Promise<void>}
 */
export async function coinbaseOrders(orderId) {
  const order = await selectCoinbaseOrder(orderId);
  printCoinbaseOrderRecord(order);
}

export async function coinbaseOrdersFees(productId, options) {
  let { side } = options;

  if (productId) {
    productId = Product.getProductId(productId);
    log.debug(`Product ID: ${productId}`);
  }

  if (side) {
    side = side.toUpperCase();
    log.debug(`Side: ${side}`);
  }

  const { from, to } = await getToAndFromDates(options);

  const fees = await selectCoinbaseOrdersSumTotalFees(from, to, productId, side);
  log.info(`Fees: $${fees.toFixed(2)}`);
}

/**
 * @param {string} orderId
 * @returns {Promise<void>}
 */
export async function coinbaseOrdersInsert(orderId) {
  // Download the order from coinbase
  const order = await requestOrder(orderId);

  await insertCoinbaseOrder(order);
}

/**
 * @param {string} orderId
 * @returns {Promise<void>}
 */
export async function coinbaseOrdersOrder(orderId) {
  await reconstructCoinbaseOrderFromDb(orderId, true, true);
}

/**
 * @param {object} options
 * @returns {Promise<void>}
 */
export async function coinbaseOrdersRegenerate(options) {
  const { dryRun, yes } = options;

  if (dryRun) {
    log.warn('Dry Run...');
  } else if (yes) {
    log.warn('Answering yes to all prompts...');
  } else {
    if (yes) {
      log.warn(`Re-generating ${COINBASE_ORDERS_TABLE}...`);
    } else {
      const answer = await promptYesNo(`Do you want to regenerate ${COINBASE_ORDERS_TABLE}?`, 1);
      if (answer) {
        log.warn(`Re-generating ${COINBASE_ORDERS_TABLE}...`);
      } else {
        log.info('Aborting.');
        return;
      }
    }
  }

  if (dryRun) {
    log.warn(`Not dropping the ${COINBASE_ORDERS_TABLE} table...`);
  } else {
    log.warn(`Dropping the ${COINBASE_ORDERS_TABLE} table...`);
    await dropCoinbaseOrdersTable();
  }

  if (dryRun) {
    log.warn(`Not creating the ${COINBASE_ORDERS_TABLE} table...`);
  } else {
    log.warn(`Creating the ${COINBASE_ORDERS_TABLE} table...`);
    await createCoinbaseOrdersTable();
  }

  if (dryRun) {
    log.warn(`Not update the ${COINBASE_ORDERS_TABLE} table...`);
  } else {
    await coinbaseOrdersUpdate(options);
  }
}

/**
 * @param {object} options
 * @returns {Promise<void>}
 */
export async function coinbaseOrdersUpdate(options) {
  const { cache, rsync, yes } = options;
  let from, to;
  if (rsync) {
    const { last } = await selectCoinbaseOrderByLastFillTime(false, true);
    from = last;
    to = new Date();
  } else {
    ({ from, to } = await getToAndFromDates(options));
  }
  const start = from.toISOString();
  const end = to.toISOString();

  if (yes) {
    log.info(`Updating all orders from ${start} to ${end}.`);
  } else {
    const answer = await promptYesNo(`Do you want to update orders from ${start} to ${end}?`, 1);
    if (!answer) {
      log.info('Aborting.');
      return;
    }
  }

  const orders = [];

  if (cache) {
    log.info('Loading the orders from cache...');
    const ORDERS_DIR = path.join(cacheDir, ORDERS);
    const files = await fs.readdir(ORDERS_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const orderId = path.basename(file, '.json');
      console.log(orderId);
      try {
        const order = loadOrderFromCache(orderId);
        orders.push(order);
      } catch (err) {
        log.error(err);
      }
    }
    log.info(`Loaded ${orders.length} orders from cache.`);
  } else {
    const sources = Object.entries(ORDER_PLACEMENT_SOURCE);

    log.info('Downloading orders from the exchange...');
    for (const [_, source] of sources) {
      log.info(`Requesting orders from ${source}...`);
      const data = await requestOrders(ORDER_STATUS.FILLED, source, null, start, end);
      log.info(`Retrieved ${data.length} orders.`);
      orders.push(...data);
    }

    log.info('Caching the orders on disk...');
    for (const order of orders) {
      await saveOrder(order.order_id, order);
    }
    log.info(`Cached ${orders.length} orders.`);
  }

  log.info(`Inserting order into ${COINBASE_ORDERS_TABLE}...`);
  for (const order of orders) {
    await insertCoinbaseOrder(order);
  }
  log.info(`Inserted ${orders.length} orders.`);
}
