import { execSync } from 'child_process';
import process from 'node:process';
import {
  type AnyOrderConfig,
  ORDER_KEYS,
  ORDER_STATUS,
  OrderKind,
  type PositionJSON,
} from '@core/dictionary';
import { safeNumber } from '@core/validation';
import Product from '@cb/Product';
import { log } from '@core/logger';
import type { ApiResponse } from '@http/types';

const { HELPER_UNDER_SYSTEMCTL } = process.env;

/**
 * Parses `value` with `safeNumber`.
 * If no value is provided, then `readNumber` reads the number from the CLI
 * Both `safeNumber` and `readNumber` throw errors on `null` in inputs,
 * so this function always returns a number.
 */
export async function getOptionNumber(
  value: string,
  name: string,
  defaultValue: string | null,
): Promise<number> {
  if (value) {
    return safeNumber(value, `${name} is not a number`);
  } else {
    if (defaultValue === null) {
      return readNumber(`${name}: `, null);
    } else {
      return readNumber(`${name} (default ${defaultValue}):`, defaultValue);
    }
  }
}

/**
 * Read a number entered in response to `question`.
 * Throws an error if no data is read.
 * Parses with `safeNumber` before returning result
 */
export async function readNumber(question: string, defaultValue: string | null): Promise<number> {
  const input = await readline(question, defaultValue);
  if (input === null) {
    throw new Error(`readNumber => input is null`);
  } else {
    return safeNumber(input, 'readNumber => input');
  }
}

/**
 * Reads data entered in response to `question`.
 * `defaultValue` (itself defaulting to `null`) is returned if no data is read.
 */
export async function readline(
  question: string,
  defaultValue: string | null = null,
): Promise<string | null> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.once('data', (data) => {
      const str = data.toString().trim();
      if (data) {
        resolve(str);
      } else {
        log.warn(`Using default value: ${defaultValue}`);
        resolve(defaultValue);
      }
    });
  });
}

export const DEFAULT_PRODUCT = 'btc';

/**
 * Use DEFAULT_PRODUCT if none is provided
 */
export async function ensureProduct(product: string): Promise<string> {
  if (!product) {
    log.warn(`Defaulting to ${DEFAULT_PRODUCT}`);
    product = DEFAULT_PRODUCT;
  }
  return product;
}

/**
 * @param {string} product
 * @returns {Promise<Product>}
 */
export async function getProductInstance(product: string): Promise<Product> {
  const productId = Product.getProductId(product);
  const productInstance = new Product(productId);
  await productInstance.update(false);
  return productInstance;
}

/**
 * @param {string} question
 * @param {number} points
 * @returns {Promise<number>}
 */
export async function promptYesNo(question: string, points: number): Promise<number> {
  let answer = await readline(`${question} (y/n): `);
  if (answer !== null) {
    answer = answer.toLowerCase();
  }
  return checkConfirmation(answer) ? points : 0;
}

/**
 * @param {string} input
 * @returns {boolean}
 */
export function checkConfirmation(input: string | null): boolean {
  if (!input) {
    log.warn(`checkConfirmation => no input`);
    return false;
  }
  switch (input.toLowerCase()) {
    case 'y':
    case 'ye':
    case 'yes':
      return true;
    default:
      return false;
  }
}

export function printApiResponseData(data: ApiResponse): void {
  console.log('\nSuccess:');
  data.success.forEach((pos) => console.log(`  - ${pos}`));
  console.log();
}

function printOrder(orderClass: string, order: AnyOrderConfig): void {
  console.log(`  ${orderClass} Order:`);
  console.log(`    Order ID:    ${order.order_id}`);
  console.log(`    Status:      ${order.status}`);
  console.log(`    Base Size:   ${order.base_size}`);
  switch (order.kind) {
    case OrderKind.LimitBuy:
      console.log(`    Limit Price: ${order.limit_price}`);
      break;
    case OrderKind.BracketSell:
      console.log(`    Limit Price: ${order.limit_price}`);
      console.log(`    Stop Price: ${order.stop_price}`);
      break;
  }
  if (order[ORDER_KEYS.STATUS] === ORDER_STATUS.FILLED) {
    console.log(`    Fill Size:   ${order.filled_size}`);
    console.log(`    Fill Price:  ${order.average_filled_price}`);
    console.log(`    Fill Value:  ${order.filled_value}`);
  }
}

export function printPosition(position: PositionJSON): void {
  console.log(`  Name:          ${position.name}`);
  console.log(`  Status:        ${position.status}`);
  console.log(`  Current Price: ${position.current_price}`);
  console.log(`  PnL:           ${position.PnL}`);
  console.log(`  Percent Done:  ${position.percent_complete}%`);

  for (const order of position.buy.limit_limit_gtc) {
    printOrder('Limit Buy', order);
  }

  for (const order of position.sell.trigger_bracket_gtc) {
    printOrder('Bracket Sell', order);
  }

  for (const order of position.sell.market_market_ioc) {
    printOrder('Market Sell', order);
  }

  if (position.log.length > 0) {
    console.log(`  Log:`);
    position.log.forEach((entry) => console.log(`    ${entry}`));
  }
  console.log();
}

/**
 * TODO how does this function work?
 *  this function is designed to throw errors
 *  is that really a good idea?
 */
export function isHelperServiceRunning(): void {
  if (HELPER_UNDER_SYSTEMCTL) {
    try {
      // Check if the service is installed
      execSync('systemctl list-unit-files --type=service | grep -q "^helper.service"', {
        stdio: 'ignore',
      });
    } catch {
      throw new Error(`helper is not installed on this system`);
    }

    try {
      // Check if the service is running
      execSync('systemctl is-active --quiet helper.service', {
        stdio: 'ignore',
      });
    } catch {
      throw new Error(`helper is not currently running`);
    }
  }
}

export function getProductNameFromPositionName(position: string): string {
  if (position.indexOf('-') === -1) {
    return position;
  } else {
    const split = position.split('-');
    if (split[0]) {
      return split[0];
    } else {
      return position; //TODO this should not be possible
    }
  }
}
