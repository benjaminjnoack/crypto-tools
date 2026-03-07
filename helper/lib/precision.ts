import Big from 'big.js';
import { toIncrement } from '@core/increment';

/**
 * Add numbers (as strings or numbers) using an increment to preserve precision.
 * - If exactly one value is provided, round via `toIncrement` (preserves original behavior).
 * - If multiple, scale to integer units of `incrementString`, sum, then scale back.
 */
export function addStringNumbersWithPrecision(
  values: readonly (string | number)[],
  incrementString: string,
): number {
  if (values.length === 1) {
    const only = Number(values[0]);
    return parseFloat(toIncrement(incrementString, only));
  }

  const increment = Number(incrementString);
  const scaleFactor = 1 / increment;

  // Quantize each term by truncating toward zero (respecting the increment)
  const integers = values.map((v) => Math.trunc(Number(v) * scaleFactor));

  const sumInt = integers.reduce((acc, n) => acc + n, 0);

  // Return in natural scale
  return sumInt / scaleFactor;
}

/**
 * Split a base size into `numParts` pieces that respect `baseIncrementString`
 * and sum exactly to the original base size (remainder distributed first).
 * Returns strings with decimals inferred from `baseIncrementString`.
 */
export function splitBaseSizeEqually(
  baseSizeString: string,
  numParts: number,
  baseIncrementString: string,
): string[] {
  const baseSize = Number(baseSizeString);
  const baseIncrement = Number(baseIncrementString);

  if (numParts <= 0 || baseSize <= 0 || baseIncrement <= 0) {
    throw new Error('Invalid input: base size, numParts, and base increment must be positive.');
  }

  const scaleFactor = 1 / baseIncrement;

  let totalUnits = Math.round(baseSize * scaleFactor);
  const portionUnits = Math.floor(totalUnits / numParts);
  let remainder = totalUnits % numParts;

  const portions = Array<number>(numParts).fill(portionUnits);
  for (let i = 0; i < remainder; i++) {
    // We know portions has numParts elements, so this is safe
    portions[i]! += 1;
  }

  const decimals = Math.max(0, baseIncrementString.length - 2);
  return portions.map((units) => (units / scaleFactor).toFixed(decimals));
}

/**
 * Weighted-average price from {price,size} pairs.
 * Uses addStringNumbersWithPrecision for stable totals.
 */

export function calculateWeightedAveragePrice(
  orders: ReadonlyArray<{ price: string; size: string }>,
  _baseIncrement: string,
  _priceIncrement: string,
): number {
  if (orders.length === 0) return 0;

  let totalCost = new Big(0);
  let totalSize = new Big(0);

  for (const { price, size } of orders) {
    const p = new Big(price);
    const s = new Big(size);
    totalCost = totalCost.plus(p.times(s));
    totalSize = totalSize.plus(s);
  }

  if (totalSize.eq(0)) return 0;

  // Return the true average; caller can quantize if/when needed.
  return Number(totalCost.div(totalSize));
}

export default {
  addStringNumbersWithPrecision,
  splitBaseSizeEqually,
  calculateWeightedAveragePrice,
};
