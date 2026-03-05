import readlineSync from "readline-sync";
import chalk from "chalk";
import type {
  BracketOptions,
  LimitOptions,
  LimitTpSlOptions,
  MarketOptions,
  ModifyOptions,
  StopOptions,
} from "../commands/schemas/options.js";
import { ORDER_SIDE, ORDER_TYPES } from "../../../shared/coinbase/schemas/enums.js";
import { getProductInfo } from "../../../shared/coinbase/product.js";
import { toIncrement } from "../../../shared/common/increment.js";
import { requestOrder, requestOrderEdit } from "../../../shared/coinbase/rest.js";
import {
  createBracketOrder,
  createLimitOrder,
  createLimitTpSlOrder,
  createMarketOrder, createStopLimitOrder
} from "../../../shared/coinbase/order.js";
import type { CoinbaseOrder } from "../../../shared/coinbase/schemas/orders.js";

function confirmOrder(
  type: string,
  side: string,
  product: string,
  size: string,
  price: string,
  value: string,
): boolean {
  console.log("\nOrder Summary:");
  console.log(`  Type: ${type.toUpperCase()}`);
  if (side === ORDER_SIDE.BUY) {
    console.log(`  Side: ${chalk.green(side.toUpperCase())}`);
  } else if (side === ORDER_SIDE.SELL) {
    console.log(`  Side: ${chalk.red(side.toUpperCase())}`);
  } else {
    console.log(`  Side: ${side.toUpperCase()}`);
  }
  console.log(`  Product: ${product}`);
  console.log(`  Size: ${size}`);
  console.log(`  Price: $${price}`);
  console.log(`  Value: ${chalk.green(`$${value}`)}`);

  const confirmation = readlineSync.question("\nProceed? (yes/no): ").trim().toLowerCase();
  return confirmation.toLowerCase() === "yes" || confirmation.toLowerCase() === "y";
}

/**
 * Places a market order after validation and confirmation.
 * @param {string} productId
 * @param {Object} options - CLI options for order placement.
 */
export async function placeMarketOrder(productId: string, options: MarketOptions): Promise<void> {
  if (!options.buy && !options.sell) {throw new Error("You must specify either --buy or --sell.");}

  const { base_increment, price } = await getProductInfo(productId, true);
  const marketPrice = parseFloat(price);

  let numBaseSize, orderValue;
  if (options.baseSize) {
    numBaseSize = parseFloat(options.baseSize);
    orderValue = numBaseSize * marketPrice;
  } else if (options.value) {
    orderValue = parseFloat(options.value);
    numBaseSize = orderValue / marketPrice;
  } else {
    throw new Error("You must specify either --baseSize or --value.");
  }

  if (!numBaseSize || numBaseSize <= 0) {throw new Error("Invalid base size or value provided.");}
  const baseSize = toIncrement(base_increment, numBaseSize);
  const side = options.buy ? ORDER_SIDE.BUY : ORDER_SIDE.SELL;

  if (
    confirmOrder(
      ORDER_TYPES.MARKET,
      side,
      productId,
      baseSize,
      price,
      toIncrement("0.01", orderValue),
    )
  ) {
    await createMarketOrder(productId, side, baseSize);
  } else {
    console.log("Action canceled.");
  }
}

/**
 * Places a limit order after validation and confirmation.
 * @param {string} productId - The product ID ('BTC-USD')
 * @param {Object} options - CLI options for order placement.
 */
export async function placeLimitOrder(productId: string, options: LimitOptions): Promise<void> {
  if (!options.buy && !options.sell) {throw new Error("You must specify either --buy or --sell.");}
  const side = options.buy ? ORDER_SIDE.BUY : ORDER_SIDE.SELL;
  const postOnly = options.postOnly ?? true;

  const numLimitPrice = parseFloat(options.limitPrice);

  let numBaseSize, numValue;
  if (options.baseSize) {
    numBaseSize = parseFloat(options.baseSize);
    numValue = numBaseSize * numLimitPrice;
  } else if (options.value) {
    numValue = parseFloat(options.value);
    numBaseSize = numValue / numLimitPrice;
  } else {
    throw new Error("You must specify either --baseSize or --value.");
  }

  if (!numBaseSize || numBaseSize <= 0) {throw new Error("Invalid base size or value provided.");}

  const { base_increment, price_increment } = await getProductInfo(productId);
  const baseSize = toIncrement(base_increment, numBaseSize);
  const limitPrice = toIncrement(price_increment, numLimitPrice);

  if (
    confirmOrder(
      ORDER_TYPES.LIMIT,
      side,
      productId,
      baseSize,
      limitPrice,
      toIncrement("0.01", numValue),
    )
  ) {
    await createLimitOrder(productId, side, baseSize, limitPrice, postOnly);
  } else {
    console.log("Action canceled.");
  }
}

export async function placeLimitTpSlOrder(
  productId: string,
  options: LimitTpSlOptions,
): Promise<void> {
  const postOnly = options.postOnly ?? true;
  const numLimitPrice = parseFloat(options.limitPrice);
  const numBaseSize = parseFloat(options.baseSize);

  if (!numBaseSize || numBaseSize <= 0) {throw new Error("Invalid base size or value provided.");}

  const numValue = numBaseSize * numLimitPrice;

  if (
    confirmOrder(
      ORDER_TYPES.LIMIT,
      ORDER_SIDE.BUY,
      productId,
      options.baseSize,
      options.limitPrice,
      toIncrement("0.01", numValue),
    )
  ) {
    await createLimitTpSlOrder(
      productId,
      options.baseSize,
      options.limitPrice,
      options.stopPrice,
      options.takeProfitPrice,
      postOnly,
    );
  } else {
    console.log("Action canceled.");
  }
}

/**
 * Place a bracket order
 * @param {string} productId
 * @param {object} options
 * @return {Promise<string>}
 */
export async function placeBracketOrder(productId: string, options: BracketOptions): Promise<void> {
  const numLimitPrice = parseFloat(options.limitPrice);
  const numStopPrice = parseFloat(options.stopPrice);

  if (numStopPrice >= numLimitPrice) {
    throw new Error("Stop price must be less than limit price");
  }

  const numBaseSize = parseFloat(options.baseSize);

  const { base_increment, price_increment } = await getProductInfo(productId);
  const baseSize = toIncrement(base_increment, numBaseSize);
  const limitPrice = toIncrement(price_increment, numLimitPrice);
  const stopPrice = toIncrement(price_increment, numStopPrice);
  const side = ORDER_SIDE.SELL;

  const confirmationPrice = `${limitPrice}/${stopPrice}`;
  const limitValue = toIncrement(price_increment, numLimitPrice * numBaseSize);
  const stopValue = toIncrement(price_increment, numStopPrice * numBaseSize);
  const confirmationValue = `${limitValue}/${stopValue}`;
  if (
    confirmOrder(
      ORDER_TYPES.BRACKET,
      side,
      productId,
      baseSize,
      confirmationPrice,
      confirmationValue,
    )
  ) {
    await createBracketOrder(productId, ORDER_SIDE.SELL, baseSize, limitPrice, stopPrice);
  } else {
    console.log("Action canceled.");
  }
}

export async function placeStopLimitOrder(productId: string, options: StopOptions): Promise<void> {
  const numBaseSize = parseFloat(options.baseSize);
  const numStopPrice = parseFloat(options.stopPrice);

  let numLimitPrice;
  if (options.limitPrice) {
    numLimitPrice = parseFloat(options.limitPrice);
  } else {
    console.log("WARNING: Defaulting limit price to 1% below stop price");
    numLimitPrice = numStopPrice * 0.99;
  }

  if (numLimitPrice >= numStopPrice) {
    throw new Error("Limit price must be less than stop price");
  }

  const { base_increment, price_increment } = await getProductInfo(productId);
  const baseSize = toIncrement(base_increment, numBaseSize);
  const limitPrice = toIncrement(price_increment, numLimitPrice);
  const stopPrice = toIncrement(price_increment, numStopPrice);
  const side = ORDER_SIDE.SELL;

  const confirmationValue = (numStopPrice * numBaseSize).toFixed(2);
  const confirmationPrice = `${stopPrice}/${limitPrice}`;
  if (
    confirmOrder(
      ORDER_TYPES.STOP_LIMIT,
      side,
      productId,
      baseSize,
      confirmationPrice,
      confirmationValue,
    )
  ) {
    await createStopLimitOrder(productId, ORDER_SIDE.SELL, baseSize, limitPrice, stopPrice);
  } else {
    console.log("Action canceled.");
  }
}

function getModifiableOrderValues(order: CoinbaseOrder): {
  baseSize: string;
  limitPrice: string;
  stopPrice?: string;
} {
  switch (order.order_type) {
    case ORDER_TYPES.LIMIT: {
      const config = order.order_configuration.limit_limit_gtc;
      const attached = order.attached_order_configuration?.trigger_bracket_gtc;
      return {
        baseSize: config.base_size,
        limitPrice: config.limit_price,
        ...(attached?.stop_trigger_price
          ? { stopPrice: attached.stop_trigger_price }
          : {}),
      };
    }
    case ORDER_TYPES.BRACKET:
    case ORDER_TYPES.TAKE_PROFIT_STOP_LOSS: {
      const config = order.order_configuration.trigger_bracket_gtc;
      return {
        baseSize: config.base_size,
        limitPrice: config.limit_price,
        stopPrice: config.stop_trigger_price,
      };
    }
    case ORDER_TYPES.STOP_LIMIT: {
      const config = order.order_configuration.stop_limit_stop_limit_gtc;
      return {
        baseSize: config.base_size,
        limitPrice: config.limit_price,
        stopPrice: config.stop_price,
      };
    }
    case ORDER_TYPES.MARKET:
      throw new Error("Cannot modify market orders.");
  }
}

export async function placeModifyOrder(orderId: string, options: ModifyOptions): Promise<void> {
  let baseSize = options.baseSize;
  let limitPrice = options.limitPrice;
  let stopPrice = options.stopPrice;

  if (!baseSize || !limitPrice || !stopPrice) {
    const order = await requestOrder(orderId);
    const existing = getModifiableOrderValues(order);
    baseSize = baseSize ?? existing.baseSize;
    limitPrice = limitPrice ?? existing.limitPrice;
    stopPrice = stopPrice ?? existing.stopPrice;
  }

  if (!baseSize || !limitPrice) {
    throw new Error("Unable to determine base size and limit price for order modification.");
  }

  await requestOrderEdit(orderId, {
    price: limitPrice,
    size: baseSize,
    stop_price: stopPrice,
  });
}
