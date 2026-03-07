import { log } from '@core/logger.js';
import { DateTime } from 'luxon';
import { selectCoinbaseOrderByLastFillTime } from '@cb/order/db/queries.js';
import { toIncrement } from '@core/increment.js';
import { getProductInstance } from '@cli/utils.js';
import { normalizeAsset } from '@cb/transactions/normalize.js';
import { COINBASE_EPOCH } from '@cb/dictionary';
import Big from 'big.js';

/**
 * 1 * 10^-8
 * @type {number}
 */
export const PRECISION_EPSILON = 1e-8;
/**
 * Same as PRECISION_EPSILON
 * @type {number}
 */
export const DUST_THRESHOLD = PRECISION_EPSILON;

/**
 * @param {Date} date
 * @param {boolean} utc
 * @returns {string} - YYYY-MM-DD
 */
export function formatDate(date, utc = true) {
  return utc
    ? date.toISOString().split('T')[0]
    : `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

/**
 * Parse asset argument and return an array of upper case strings to pass to selectCoinbaseTransactions
 * @param {string} asset - colon separated string of assets. NOTE: will return an empty array if this is a falsy value
 * @returns {string[]}
 */
export function getAssets(asset) {
  if (!asset) return [];
  return asset.split(':').map((asset) => asset.toUpperCase());
}

/**
 * @param {string} type
 * @returns {string[]}
 */
export function getTypes(type) {
  if (!type) return [];
  return type.toUpperCase().split(':');
}

/**
 * @param {object} options
 * @param {boolean} defaultStartToCoinbaseEpoch
 * @param {boolean} defaultEndToNow
 * @returns {Promise<{from: Date, to: Date}>}
 */
export async function getToAndFromDates(
  options,
  defaultStartToCoinbaseEpoch = true,
  defaultEndToNow = true,
) {
  let { from, to, range, year } = options;

  if (range) {
    ({ from, to } = await getRangeDates(range, true));
  } else if (year) {
    if (/^\d{4}$/.test(year)) {
      from = new Date(`${year}-01-01T00:00:00Z`);
      to = new Date(`${+year + 1}-01-01T00:00:00Z`);
    } else {
      throw new Error(`Invalid year format: ${year}`);
    }
  } else {
    if (from) {
      from = parseAsUtc(from);
    } else if (defaultStartToCoinbaseEpoch) {
      from = new Date(COINBASE_EPOCH);
      log.warn(`Start is COINBASE_EPOCH: ${from.toISOString()}`);
    } else {
      throw new Error(`Cannot read start date`);
    }

    if (to) {
      to = parseAsUtc(to);
    } else if (defaultEndToNow) {
      to = new Date();
      log.warn(`End is Now: ${to.toISOString()}`);
    } else {
      throw new Error(`Cannot read end date`);
    }
  }

  if (isNaN(from.getTime())) {
    throw new Error('Invalid from date format. Use ISO format');
  }
  log.debug(`From: ${from.toISOString()}`);

  if (isNaN(to.getTime())) {
    throw new Error('Invalid to date format. Use ISO format');
  }
  log.debug(`To: ${to.toISOString()}`);

  return { from, to };
}

/**
 * Ensure input string is treated as UTC.
 * Appends 'Z' if no timezone is specified.
 * Converts 'YYYY-MM-DD' to 'YYYY-MM-DDT00:00:00Z'
 * @param {string} dateStr
 * @returns {Date}
 */
export function parseAsUtc(dateStr) {
  if (typeof dateStr !== 'string') return new Date(dateStr); // fallback for Date objects or unexpected types

  const hasTimeZone = /[Z+-]\d{0,2}:?\d{0,2}$/.test(dateStr);
  const hasTime = /T/.test(dateStr);

  if (!hasTime) {
    dateStr += 'T00:00:00Z'; // date only
  } else if (!hasTimeZone) {
    dateStr += 'Z'; // timestamp without zone
  }

  return new Date(dateStr);
}

export async function getRangeDates(range, useLocaleWeeks = false) {
  const now = DateTime.utc();
  const opts = { useLocaleWeeks };

  let from, to;

  switch (range) {
    case 'week':
      from = now.startOf('week', opts).toJSDate();
      to = now.endOf('week', opts).toJSDate();
      break;
    case 'month':
      from = now.startOf('month', opts).toJSDate();
      to = now.endOf('month', opts).toJSDate();
      break;
    case 'quarter':
      from = now.startOf('quarter', opts).toJSDate();
      to = now.endOf('quarter', opts).toJSDate();
      break;
    case 'year':
      from = now.startOf('year', opts).toJSDate();
      to = now.endOf('year', opts).toJSDate();
      break;
    case 'all': //TODO is this really the best way?
      const { first } = await selectCoinbaseOrderByLastFillTime(true, false);
      from = first;
      to = now.endOf('year', opts).toJSDate();
      break;
    default:
      throw new Error(`Invalid range: ${range}`);
  }

  return { from, to };
}

const products = new Map();

/**
 * @param {string} asset
 * @param {string|number} balance
 * @param {boolean} raw - returns a number, else a string
 * @returns {Promise<number|string>}
 */
export async function getBalanceToIncrement(asset, balance, raw = false) {
  const ticker = normalizeAsset(asset);
  const rawBalance = parseFloat(balance);
  const dustedBalance = Math.abs(rawBalance) < DUST_THRESHOLD ? 0 : rawBalance;
  if (raw) {
    return dustedBalance;
  }

  switch (ticker) {
    case 'USD':
    case 'USDC':
    case 'BIT': // Disabled markets - cannot pull product information.
    case 'DYP':
      return toIncrement('0.01', dustedBalance);
    default:
      if (!products.has(ticker)) {
        const productInstance = await getProductInstance(ticker);
        products.set(ticker, productInstance);
      }
      const product = products.get(ticker);
      return toIncrement(product['base_increment'], dustedBalance);
  }
}

/**
 * @param {*[]} tableRows
 * @param {string} first
 * @param {string} last
 */
export function printFirstLastTableRows(tableRows, first, last) {
  if (first) {
    console.table(tableRows.slice(0, parseInt(first)));
  } else if (last) {
    console.table(tableRows.slice(parseInt(last) * -1));
  } else {
    console.table(tableRows);
  }
}

/**
 * Safely formats a PostgreSQL NUMERIC string to a 2-decimal string
 * suitable for IRS/financial reporting.
 *
 * @param {string|number} input - The NUMERIC value as a string or number
 * @returns {string} Rounded decimal string with 2 decimal places
 */
export function formatToCents(input) {
  if (input == null || input === '') return ''; // Guard against null/empty
  try {
    return new Big(input).round(2, Big.roundHalfUp).toFixed(2);
  } catch (err) {
    console.warn(`Invalid value passed to formatToCents:`, input);
    throw err;
  }
}

/**
 * @param {string} sizeStr
 * @returns {string}
 */
export function stripTrailingZeros(sizeStr) {
  return sizeStr.replace(/(?:\.0+|(\.\d+?)0+)$/, '$1');
}
