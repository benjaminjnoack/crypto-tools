import readlineSync from 'readline-sync';
import chalk from 'chalk';
import { toIncrement } from '@core/increment';
import Product from '@cb/Product';
import { safeNumber } from '@core/validation';
import {
  createBracketOrder,
  createLimitOrder,
  createLimitTpSlOrder,
  createMarketOrder,
  createStopLimitOrder,
} from '@cb/order/service';
import { ORDER_SIDE, ORDER_TYPES } from '@core/dictionary';
import type {
  BracketOptions,
  LimitOptions,
  LimitTpSlOptions,
  MarketOptions,
  StopOptions,
} from '@cb/cli/contracts';

function confirmOrder(
  type: string,
  side: string,
  product: string,
  size: string,
  price: string,
  value: string,
): boolean {
  console.log('\nOrder Summary:');
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

  const confirmation = readlineSync.question('\nProceed? (yes/no): ').trim().toLowerCase();
  return confirmation.toLowerCase() === 'yes' || confirmation.toLowerCase() === 'y';
}

/**
 * Places a market order after validation and confirmation.
 * @param {string} productId
 * @param {Object} options - CLI options for order placement.
 */
export async function placeMarketOrder(productId: string, options: MarketOptions): Promise<void> {
  if (!options.buy && !options.sell) throw new Error('You must specify either --buy or --sell.');

  const { base_increment, price } = await Product.getProductInfo(productId, true);
  const marketPrice = safeNumber(price, 'price');

  let numBaseSize, orderValue;
  if (options.baseSize) {
    numBaseSize = safeNumber(options.baseSize, 'placeMarketOrder => options.baseSize');
    orderValue = numBaseSize * marketPrice;
  } else if (options.value) {
    orderValue = safeNumber(options.value, 'placeMarketOrder => options.value');
    numBaseSize = orderValue / marketPrice;
  } else {
    throw new Error('You must specify either --baseSize or --value.');
  }

  if (!numBaseSize || numBaseSize <= 0) throw new Error('Invalid base size or value provided.');
  const baseSize = toIncrement(base_increment, numBaseSize);
  const side = options.buy ? ORDER_SIDE.BUY : ORDER_SIDE.SELL;

  if (
    confirmOrder(
      ORDER_TYPES.MARKET,
      side,
      productId,
      baseSize,
      price,
      toIncrement('0.01', orderValue),
    )
  ) {
    await createMarketOrder(productId, side, baseSize);
  } else {
    console.log('Action canceled.');
  }
}

/**
 * Places a limit order after validation and confirmation.
 * @param {string} productId - The product ID ('BTC-USD')
 * @param {Object} options - CLI options for order placement.
 */
export async function placeLimitOrder(productId: string, options: LimitOptions): Promise<void> {
  if (!options.buy && !options.sell) throw new Error('You must specify either --buy or --sell.');
  const side = options.buy ? ORDER_SIDE.BUY : ORDER_SIDE.SELL;

  const numLimitPrice = safeNumber(options.limitPrice, 'placeLimitOrder => options.limitPrice');

  let numBaseSize, numValue;
  if (options.baseSize) {
    numBaseSize = safeNumber(options.baseSize, 'placeLimitOrder => options.baseSize');
    numValue = numBaseSize * numLimitPrice;
  } else if (options.value) {
    numValue = safeNumber(options.value, 'placeLimitOrder => options.value');
    numBaseSize = numValue / numLimitPrice;
  } else {
    throw new Error('You must specify either --baseSize or --value.');
  }

  if (!numBaseSize || numBaseSize <= 0) throw new Error('Invalid base size or value provided.');

  const { base_increment, price_increment } = await Product.getProductInfo(productId);
  const baseSize = toIncrement(base_increment, numBaseSize);
  const limitPrice = toIncrement(price_increment, numLimitPrice);

  if (
    confirmOrder(
      ORDER_TYPES.LIMIT,
      side,
      productId,
      baseSize,
      limitPrice,
      toIncrement('0.01', numValue),
    )
  ) {
    await createLimitOrder(productId, side, baseSize, limitPrice);
  } else {
    console.log('Action canceled.');
  }
}

export async function placeLimitTpSlOrder(
  productId: string,
  options: LimitTpSlOptions,
): Promise<void> {
  const numLimitPrice = safeNumber(options.limitPrice, 'placeLimitOrder => options.limitPrice');
  const numBaseSize = safeNumber(options.baseSize, 'placeLimitOrder => options.baseSize');

  if (!numBaseSize || numBaseSize <= 0) throw new Error('Invalid base size or value provided.');

  const numValue = numBaseSize * numLimitPrice;

  if (
    confirmOrder(
      ORDER_TYPES.LIMIT,
      ORDER_SIDE.BUY,
      productId,
      options.baseSize,
      options.limitPrice,
      toIncrement('0.01', numValue),
    )
  ) {
    await createLimitTpSlOrder(
      productId,
      options.baseSize,
      options.limitPrice,
      options.stopPrice,
      options.takeProfitPrice,
    );
  } else {
    console.log('Action canceled.');
  }
}

/**
 * Place a bracket order
 * @param {string} productId
 * @param {object} options
 * @return {Promise<string>}
 */
export async function placeBracketOrder(productId: string, options: BracketOptions): Promise<void> {
  const numLimitPrice = safeNumber(options.limitPrice, 'placeBracketOrder => options.limitPrice');
  const numStopPrice = safeNumber(options.stopPrice, 'placeBracketOrder => options.stopPrice');

  if (numStopPrice >= numLimitPrice) {
    throw new Error('Stop price must be less than limit price');
  }

  const numBaseSize = safeNumber(options.baseSize, 'placeBracketOrder => options.baseSize');

  const { base_increment, price_increment } = await Product.getProductInfo(productId);
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
    await createBracketOrder(productId, baseSize, limitPrice, stopPrice);
  } else {
    console.log('Action canceled.');
  }
}

export async function placeStopLimitOrder(productId: string, options: StopOptions): Promise<void> {
  const numBaseSize = safeNumber(options.baseSize, 'placeStopLimitOrder => options.baseSize');
  const numStopPrice = safeNumber(options.stopPrice, 'placeStopLimitOrder => options.stopPrice');

  let numLimitPrice;
  if (options.limitPrice) {
    numLimitPrice = safeNumber(options.limitPrice, 'placeStopLimitOrder => options.limitPrice');
  } else {
    console.log('WARNING: Defaulting limit price to 1% below stop price');
    numLimitPrice = numStopPrice * 0.99;
  }

  if (numLimitPrice >= numStopPrice) {
    throw new Error(`Limit price must be less than stop price`);
  }

  const { base_increment, price_increment } = await Product.getProductInfo(productId);
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
    await createStopLimitOrder(productId, baseSize, limitPrice, stopPrice);
  } else {
    console.log('Action canceled.');
  }
}
