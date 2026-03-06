import type {
  BracketOptions,
  BreakEvenStopOptions,
  LimitOptions,
  LimitTpSlOptions,
  MarketOptions,
  ModifyOptions,
  StopOptions,
} from "../commands/schemas/command-options.js";
import {
  createBracketOrder,
  createLimitOrder,
  createLimitTpSlOrder,
  createMarketOrder,
  createStopLimitOrder,
  editOrder,
  getOrder,
  getProductInfo,
  getTransactionSummary,
  ORDER_SIDE,
  ORDER_TYPES,
} from "#shared/coinbase/index";
import type { EditOrderRequest } from "#shared/coinbase/schemas/coinbase-rest-schemas";
import {
  buildBracketOrderValues,
  buildBreakEvenStopPrice,
  buildLimitOrderValues,
  buildLimitTpSlValues,
  buildMarketOrderValues,
  buildModifyOrderValues,
  buildStopLimitOrderValues,
  getAttachedTpSlValues,
  getModifiableOrderValues,
} from "./order-builders.js";
import { confirmOrder } from "./order-prompts.js";

/**
 * Places a market order after validation and confirmation.
 * @param {string} productId
 * @param {Object} options - CLI options for order placement.
 */
export async function placeMarketOrder(productId: string, options: MarketOptions): Promise<void> {
  const { base_increment, price } = await getProductInfo(productId, true);
  const values = buildMarketOrderValues(options, price, base_increment);

  if (
    confirmOrder(
      ORDER_TYPES.MARKET,
      values.side,
      productId,
      values.baseSize,
      price,
      values.orderValue,
    )
  ) {
    await createMarketOrder(productId, values.side, values.baseSize);
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
  const { base_increment, price_increment } = await getProductInfo(productId);
  const values = buildLimitOrderValues(options, base_increment, price_increment);

  if (
    confirmOrder(
      ORDER_TYPES.LIMIT,
      values.side,
      productId,
      values.baseSize,
      values.limitPrice,
      values.orderValue,
    )
  ) {
    await createLimitOrder(
      productId,
      values.side,
      values.baseSize,
      values.limitPrice,
      values.postOnly,
    );
  } else {
    console.log("Action canceled.");
  }
}

export async function placeLimitTpSlOrder(
  productId: string,
  options: LimitTpSlOptions,
): Promise<void> {
  const values = buildLimitTpSlValues(options);

  if (
    confirmOrder(
      ORDER_TYPES.LIMIT,
      ORDER_SIDE.BUY,
      productId,
      options.baseSize,
      options.limitPrice,
      values.orderValue,
    )
  ) {
    await createLimitTpSlOrder(
      productId,
      options.baseSize,
      options.limitPrice,
      options.stopPrice,
      options.takeProfitPrice,
      values.postOnly,
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
  const { base_increment, price_increment } = await getProductInfo(productId);
  const values = buildBracketOrderValues(options, base_increment, price_increment);
  if (
    confirmOrder(
      ORDER_TYPES.BRACKET,
      values.side,
      productId,
      values.baseSize,
      values.confirmationPrice,
      values.confirmationValue,
    )
  ) {
    await createBracketOrder(
      productId,
      ORDER_SIDE.SELL,
      values.baseSize,
      values.limitPrice,
      values.stopPrice,
    );
  } else {
    console.log("Action canceled.");
  }
}

export async function placeStopLimitOrder(productId: string, options: StopOptions): Promise<void> {
  const { base_increment, price_increment } = await getProductInfo(productId);
  const values = buildStopLimitOrderValues(options, base_increment, price_increment);
  if (values.defaultedLimitPrice) {
    console.log("WARNING: Defaulting limit price to 1% below stop price");
  }
  if (
    confirmOrder(
      ORDER_TYPES.STOP_LIMIT,
      values.side,
      productId,
      values.baseSize,
      values.confirmationPrice,
      values.confirmationValue,
    )
  ) {
    await createStopLimitOrder(
      productId,
      ORDER_SIDE.SELL,
      values.baseSize,
      values.limitPrice,
      values.stopPrice,
    );
  } else {
    console.log("Action canceled.");
  }
}

export async function placeModifyOrder(orderId: string, options: ModifyOptions): Promise<void> {
  const order = await getOrder(orderId);
  const existing = getModifiableOrderValues(order);
  const values = buildModifyOrderValues(options, existing);

  const payload: Omit<EditOrderRequest, "order_id"> = {
    price: values.limitPrice,
    size: values.baseSize,
  };

  if (order.order_type === ORDER_TYPES.LIMIT) {
    const attachedTpSl = getAttachedTpSlValues(order);
    if (options.stopPrice || options.takeProfitPrice) {
      if (!attachedTpSl) {
        throw new Error("This limit order has no attached TP/SL configuration to modify.");
      }

      payload.attached_order_configuration = {
        trigger_bracket_gtc: {
          limit_price: options.takeProfitPrice ?? attachedTpSl.takeProfitPrice,
          stop_trigger_price: options.stopPrice ?? attachedTpSl.stopPrice,
        },
      };
    }
  } else if (order.order_type === ORDER_TYPES.STOP_LIMIT) {
    if (options.takeProfitPrice) {
      throw new Error("--takeProfitPrice is only supported for limit orders with attached TP/SL.");
    }
    if (options.stopPrice) {
      payload.stop_price = options.stopPrice;
    }
  } else if (
    order.order_type === ORDER_TYPES.BRACKET
    || order.order_type === ORDER_TYPES.TAKE_PROFIT_STOP_LOSS
  ) {
    if (options.limitPrice && options.takeProfitPrice && options.limitPrice !== options.takeProfitPrice) {
      throw new Error("For bracket/TP-SL orders, pass only one of --limitPrice or --takeProfitPrice.");
    }
    if (options.takeProfitPrice) {
      payload.price = options.takeProfitPrice;
    }
    if (options.stopPrice) {
      payload.stop_price = options.stopPrice;
    }
  }

  await editOrder(orderId, payload);
}

export async function placeBreakEvenStopOrder(
  orderId: string,
  options: BreakEvenStopOptions,
): Promise<void> {
  const order = await getOrder(orderId);
  if (
    order.order_type !== ORDER_TYPES.BRACKET
    && order.order_type !== ORDER_TYPES.TAKE_PROFIT_STOP_LOSS
  ) {
    throw new Error("Break-even stop is only supported for BRACKET and TAKE_PROFIT_STOP_LOSS orders.");
  }
  const existing = getModifiableOrderValues(order);

  const { price_increment } = await getProductInfo(order.product_id);
  const { fee_tier } = await getTransactionSummary();
  const stopPrice = buildBreakEvenStopPrice(
    options.buyPrice,
    parseFloat(fee_tier.maker_fee_rate),
    parseFloat(fee_tier.taker_fee_rate),
    price_increment,
  );

  await editOrder(orderId, {
    price: options.limitPrice ?? existing.limitPrice,
    size: existing.baseSize,
    stop_price: stopPrice,
  });
}
