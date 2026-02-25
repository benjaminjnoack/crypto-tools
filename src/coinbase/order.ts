import * as uuid from "uuid";
import { requestOrderCreation } from "./rest.js";
import { ORDER_SIDE, type OrderSide } from "./schemas/enums.js";
import type { OrderRequest } from "./schemas/rest.js";
import { logger } from "../log/logger.js";

export async function createMarketOrder(
  productId: string,
  side: OrderSide,
  baseSize: string,
): Promise<string> {
  logger.info(`createMarketOrder => ${side} ${baseSize} ${productId}`);
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
  logger.info(`createMarketOrder => ${orderId}`);
  return orderId;
}

export async function createLimitOrder(
  productId: string,
  side: OrderSide,
  baseSize: string,
  limitPrice: string,
  postOnly: boolean = true,
): Promise<string> {
  logger.info(`createLimitOrder => ${side} ${baseSize} ${productId} @ ${limitPrice} (postOnly=${postOnly})`);
  const order = {
    client_order_id: uuid.v4(),
    product_id: productId,
    side: side,
    order_configuration: {
      limit_limit_gtc: {
        base_size: baseSize,
        limit_price: limitPrice,
        post_only: postOnly,
      },
    },
  };

  const orderId = await requestOrderCreation(order);
  logger.info(`createLimitOrder => ${orderId}`);
  return orderId;
}

export async function createLimitTpSlOrder(
  productId: string,
  baseSize: string,
  limitPrice: string,
  stopPrice: string,
  takeProfitPrice: string,
  postOnly: boolean = true,
): Promise<string> {
  logger.info(
    `createLimitTpSlOrder => ${ORDER_SIDE.BUY} ${baseSize} ${productId} @ ${limitPrice} => ${takeProfitPrice}/${stopPrice} (postOnly=${postOnly})`,
  );
  const order = {
    client_order_id: uuid.v4(),
    product_id: productId,
    side: ORDER_SIDE.BUY,
    order_configuration: {
      limit_limit_gtc: {
        base_size: baseSize,
        limit_price: limitPrice,
        post_only: postOnly,
      },
    },
    attached_order_configuration: {
      trigger_bracket_gtc: {
        limit_price: takeProfitPrice,
        stop_trigger_price: stopPrice,
      },
    },
  };
  const orderId = await requestOrderCreation(order);
  logger.info(`createLimitOrder => ${orderId}`);
  return orderId;
}

export async function createBracketOrder(
  productId: string,
  side: OrderSide,
  baseSize: string,
  limitPrice: string,
  stopPrice: string,
): Promise<string> {
  logger.info(`createBracketOrder => ${baseSize} ${productId} @ ${stopPrice}/${limitPrice}`);
  const order = {
    client_order_id: uuid.v4(),
    product_id: productId,
    side: side,
    order_configuration: {
      trigger_bracket_gtc: {
        base_size: baseSize,
        limit_price: limitPrice,
        stop_trigger_price: stopPrice,
      },
    },
  };

  const orderId = await requestOrderCreation(order);
  logger.info(`createBracketOrder => ${orderId}`);
  return orderId;
}

export async function createStopLimitOrder(
  productId: string,
  side: OrderSide,
  baseSize: string,
  limitPrice: string,
  stopPrice: string,
): Promise<string> {
  logger.info(`createStopLimitOrder => ${baseSize} ${productId} @ ${stopPrice}/${limitPrice}`);
  const order = {
    client_order_id: uuid.v4(),
    product_id: productId,
    side: side,
    order_configuration: {
      stop_limit_stop_limit_gtc: {
        base_size: baseSize,
        limit_price: limitPrice,
        stop_direction: side === ORDER_SIDE.BUY ? "STOP_DIRECTION_STOP_UP" : "STOP_DIRECTION_STOP_DOWN",
        stop_price: stopPrice,
      },
    },
  };

  const orderId = await requestOrderCreation(order);
  logger.info(`createStopLimitOrder => ${orderId}`);
  return orderId;
}
