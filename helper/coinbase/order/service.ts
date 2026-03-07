import * as uuid from 'uuid';
import { requestOrderCreation } from '@cb/http/rest.js';
import { log } from '@core/logger.js';
import { ORDER_SIDE, ORDER_TYPES, type OrderSide } from '@core/dictionary';
import BracketSellOrder from '@cb/order/BracketSellOrder.js';
import LimitBuyOrder from '@cb/order/LimitBuyOrder.js';
import StopLimitOrder from '@cb/order/StopLimitOrder.js';
import MarketOrder from '@cb/order/MarketOrder.js';
import { readOrder } from '@order/service.js';
import type { OrderRequest } from '@cb/http/contracts';

/**
 * TODO it would be nice if product identifiers could be verified with zod - must be of a certain form
 * @param productId - the product identifier (BTC-USD)
 * @param side - order side (BUY || SELL)
 * @param baseSize - size to buy or sell
 * @returns - returns the order_id
 */
export async function createMarketOrder(
  productId: string,
  side: OrderSide,
  baseSize: string,
): Promise<string> {
  log.info(`createMarketOrder => ${side} ${baseSize} ${productId}`);
  const order: OrderRequest = {
    client_order_id: uuid.v4(),
    product_id: productId,
    side: side,
    order_configuration: {
      market_market_ioc: {
        base_size: baseSize,
      },
    },
  };

  const orderId = await requestOrderCreation(order);
  log.info(`createMarketOrder => ${orderId}`);
  return orderId;
}

/**
 * @param productId - the product identifier (BTC-USD)
 * @param side - order side (BUY || SELL)
 * @param baseSize - size to buy or sell
 * @param limitPrice - price to buy or sell
 * @returns - returns the order_id
 */
export async function createLimitOrder(
  productId: string,
  side: OrderSide,
  baseSize: string,
  limitPrice: string,
): Promise<string> {
  log.info(`createLimitOrder => ${side} ${baseSize} ${productId} @ ${limitPrice}`);
  const order = {
    client_order_id: uuid.v4(),
    product_id: productId,
    side: side,
    order_configuration: {
      limit_limit_gtc: {
        base_size: baseSize,
        limit_price: limitPrice,
      },
    },
  };

  const orderId = await requestOrderCreation(order);
  log.info(`createLimitOrder => ${orderId}`);
  return orderId;
}

export async function createLimitTpSlOrder(
  productId: string,
  baseSize: string,
  limitPrice: string,
  stopPrice: string,
  takeProfitPrice: string,
): Promise<string> {
  log.info(
    `createLimitTpSlOrder => ${ORDER_SIDE.BUY} ${baseSize} ${productId} @ ${limitPrice} => ${takeProfitPrice}/${stopPrice}`,
  );
  const order = {
    client_order_id: uuid.v4(),
    product_id: productId,
    side: ORDER_SIDE.BUY,
    order_configuration: {
      limit_limit_gtc: {
        base_size: baseSize,
        limit_price: limitPrice,
      },
    },
    attached_order_configuration: {
      trigger_bracket_gtc: {
        limit_price: takeProfitPrice,
        stop_trigger_price: stopPrice,
      },
    },
  };
  console.dir(order);
  const orderId = await requestOrderCreation(order);
  log.info(`createLimitOrder => ${orderId}`);
  return orderId;
}

/**
 * TODO only supports bracket SELL order
 * @param productId - the product identifier (BTC-USD)
 * @param baseSize - size to sell
 * @param limitPrice - price to sell in profit
 * @param stopPrice - price to sell at a loss
 * @returns - returns the order_id
 */
export async function createBracketOrder(
  productId: string,
  baseSize: string,
  limitPrice: string,
  stopPrice: string,
): Promise<string> {
  log.info(`createBracketOrder => ${baseSize} ${productId} @ ${stopPrice}/${limitPrice}`);
  const order = {
    client_order_id: uuid.v4(),
    product_id: productId,
    side: ORDER_SIDE.SELL,
    order_configuration: {
      trigger_bracket_gtc: {
        base_size: baseSize,
        limit_price: limitPrice,
        stop_trigger_price: stopPrice,
      },
    },
  };

  const orderId = await requestOrderCreation(order);
  log.info(`createBracketOrder => ${orderId}`);
  return orderId;
}

/**
 * TODO only supports stop limit SELL order
 * @param productId - the product identifier (BTC-USD)
 * @param baseSize - size to sell
 * @param limitPrice - stop limit price
 * @param stopPrice - stop trigger price
 * @returns - returns the order_id
 */
export async function createStopLimitOrder(
  productId: string,
  baseSize: string,
  limitPrice: string,
  stopPrice: string,
): Promise<string> {
  log.info(`createStopLimitOrder => ${baseSize} ${productId} @ ${stopPrice}/${limitPrice}`);
  const order = {
    client_order_id: uuid.v4(),
    product_id: productId,
    side: ORDER_SIDE.SELL,
    order_configuration: {
      stop_limit_stop_limit_gtc: {
        base_size: baseSize,
        limit_price: limitPrice,
        stop_direction: 'STOP_DIRECTION_STOP_DOWN',
        stop_price: stopPrice,
      },
    },
  };

  const orderId = await requestOrderCreation(order);
  log.info(`createStopLimitOrder => ${orderId}`);
  return orderId;
}

/**
 * request order from the exchange and load it as an Order
 * @param orderId
 * @param forceUpdate
 * @param updateIncomplete
 * @param printRecord
 * @param printOrder
 */
export async function loadOrder(
  orderId: string,
  forceUpdate: boolean,
  updateIncomplete: boolean = false,
  printRecord: boolean = false,
  printOrder: boolean = false,
) {
  const order = await readOrder(orderId, forceUpdate, updateIncomplete, printRecord, printOrder);
  let orderInstance = null;
  switch (order['order_type']) {
    case ORDER_TYPES.BRACKET:
      orderInstance = new BracketSellOrder(order);
      break;
    case ORDER_TYPES.LIMIT:
      orderInstance = new LimitBuyOrder(order);
      break;
    case ORDER_TYPES.STOP_LIMIT:
      orderInstance = new StopLimitOrder(order);
      break;
    case ORDER_TYPES.MARKET:
      orderInstance = new MarketOrder(order);
      break;
    default:
      throw new Error(`loadOrder => cannot load order of unknown type: ${order['order_type']}`);
  }

  if (orderInstance) {
    log.info(
      `loadOrder => successfully loaded ${order['order_type']} order ${orderInstance.order_id}`,
    );
    if (printOrder) {
      log.info(`loadOrder => orderInstance.getOrder()`);
      console.dir(orderInstance.getOrder());
    }
    return orderInstance;
  } else {
    throw new Error(`loadOrder => no order instance was created for ${orderId}`);
  }
}
