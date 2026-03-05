import type {
  BracketOptions,
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
import {
  buildBracketOrderValues,
  buildBreakEvenStopPrice,
  buildLimitOrderValues,
  buildLimitTpSlValues,
  buildMarketOrderValues,
  buildModifyOrderValues,
  buildStopLimitOrderValues,
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
  let existing;
  let resolvedOptions: ModifyOptions = options;

  if (options.breakEvenStop || !options.baseSize || !options.limitPrice || !options.stopPrice) {
    const order = await getOrder(orderId);
    existing = getModifiableOrderValues(order);

    if (options.breakEvenStop) {
      const { price_increment } = await getProductInfo(order.product_id);
      const { fee_tier } = await getTransactionSummary();
      const breakEvenStopPrice = buildBreakEvenStopPrice(
        options.buyPrice!,
        parseFloat(fee_tier.maker_fee_rate),
        parseFloat(fee_tier.taker_fee_rate),
        price_increment,
      );
      resolvedOptions = {
        ...options,
        stopPrice: breakEvenStopPrice,
      };
    }
  }

  const values = buildModifyOrderValues(resolvedOptions, existing);

  await editOrder(orderId, {
    price: values.limitPrice,
    size: values.baseSize,
    stop_price: values.stopPrice,
  });
}
