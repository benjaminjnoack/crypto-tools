import { log } from '@core/logger.js';
import { reconstructCoinbaseOrderFromDb } from '@cb/order/db/orders.js';
import { loadOrderFromCache, saveOrder } from '@core/cache.js';
import { requestOrder } from '@cb/http/rest.js';
import { insertCoinbaseOrder } from '@cb/order/db/queries.js';
import { ORDER_KEYS, ORDER_STATUS } from '@core/dictionary';
import { type CoinbaseOrder, CoinbaseOrderSchema } from '@cb/http/contracts';

/**
 * Read the order from the database, cache, or server
 * @param orderId
 * @param forceUpdate
 * @param updateIncomplete
 * @param printRecord
 * @param printOrder
 */
export async function readOrder(
  orderId: string,
  forceUpdate: boolean = false,
  updateIncomplete: boolean = false,
  printRecord: boolean = false,
  printOrder: boolean = false,
) {
  let order: CoinbaseOrder;

  // Force Updates always download from the server and then update the local storage
  if (forceUpdate) {
    log.info(`readOrder => force update ${orderId} from server`);
    order = await requestOrder(orderId);
    await writeOrder(order, true, true);
    return order;
  }

  // Try the database first
  try {
    log.info(`readOrder => attempting to load ${orderId} from the database`);
    const record = await reconstructCoinbaseOrderFromDb(orderId, printRecord, printOrder);
    let order: CoinbaseOrder = CoinbaseOrderSchema.parse(record);
    // and we have been instructed to update incomplete orders
    if (updateIncomplete) {
      switch (order.status) {
        case ORDER_STATUS.FILLED:
        case ORDER_STATUS.CANCELLED:
          break;
        default:
          // then download the order from the server and update local storage
          log.info(`readOrder => updating ${order.status} ${orderId}`);
          order = await requestOrder(orderId);
          await writeOrder(order, true, true);
      }
    }
    return order;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error(message);
  }

  // Try to get the order from cache
  log.info(`readOrder => attempting to load ${orderId} from the cache`);
  order = loadOrderFromCache(orderId);

  // If the order is in the cache
  if (order) {
    // and we have been instructed to update incomplete orders
    if (updateIncomplete) {
      switch (order[ORDER_KEYS.STATUS]) {
        case ORDER_STATUS.FILLED:
        case ORDER_STATUS.CANCELLED:
          break;
        default:
          // then download the order from the server and update local storage
          log.info(`readOrder => updating ${order.status} ${orderId}`);
          order = await requestOrder(orderId);
          await writeOrder(order, true, true);
      }
    }
    return order;
  }

  // Fallback to downloading the order from the server and updating local storage
  log.info(`readOrder => downloading ${orderId} from the server`);
  order = await requestOrder(orderId);
  await writeOrder(order, true, true);
  return order;
}

/**
 * @param order - object, not Order
 * @param cache - store in cache?
 * @param database - store in database?
 */
export async function writeOrder(
  order: CoinbaseOrder,
  cache: boolean = true,
  database: boolean = true,
) {
  log.info(`writeOrder => printing order argument`);
  console.dir(order);
  if (cache) {
    await saveOrder(order.order_id, order);
  }
  if (database) {
    await insertCoinbaseOrder(order);
  }
}
