/**
 * Parse an increment string with strict rules suitable for crypto ticks:
 * - Allowed forms:
 *    • Positive integer (e.g., "1", "10")  → whole-unit step sizes
 *    • Power-of-ten decimals (e.g., "0.1", "0.01", "0.00000001")
 * - Disallowed examples: "2.5", "0.05", "00.010", negatives, empty.
 *
 * Returns the decimal places (dp) and the increment in scaled integer units.
 * For decimal increments, incUnits is always 1n (one unit at that dp).
 */
function parseIncrementStrict(increment: string): {
  dp: number;
  incUnits: bigint;
} {
  if (increment.trim() === '') {
    throw new Error('Invalid increment: expected non-empty string.');
  }

  // Integer form: "1", "10", ...
  if (/^[1-9]\d*$/.test(increment)) {
    const incUnits = BigInt(increment); // step is this many whole units
    return { dp: 0, incUnits };
  }

  // Decimal power-of-ten form: "0.1", "0.01", "0.00000001" ...
  // Normalize trailing zeros in the fractional part.
  const m = /^0\.(\d+)$/.exec(increment);
  if (!m) {
    throw new Error('Invalid increment: must be integer or power-of-ten decimal.');
  }

  // At this point m is RegExpExecArray, so m[1] is defined
  const fracRaw = m[1]!.replace(/0+$/, ''); // trim trailing zeros

  // After trimming, only forms like "1", "01", "001", ... are allowed (exactly one '1').
  if (!/^0*1$/.test(fracRaw)) {
    throw new Error('Invalid increment: only power-of-ten decimals are allowed.');
  }
  const dp = fracRaw.length; // number of decimals after trimming to the 1
  return { dp, incUnits: 1n };
}

/**
 * Convert a JS number to a scaled integer with gentle bias to avoid
 * cases like 1.23 * 100 = 122.999999999 (due to FP).
 * Floors toward -∞.
 */
function toScaledFloor(value: number, scale: number): bigint {
  const n = value * scale;
  // add/subtract a tiny epsilon to land on the correct side before floor/ceil
  const eps = 1e-12;
  const floored = n >= 0 ? Math.floor(n + eps) : Math.floor(n - eps);
  return BigInt(floored);
}

/**
 * Floor a value DOWN to the nearest valid multiple of `increment`,
 * returning a string formatted with the correct number of decimals.
 *
 * Examples:
 *  toIncrement("0.01", 123.47)        -> "123.47"
 *  toIncrement("0.01", 123.47999)     -> "123.47"
 *  toIncrement("1", 3.7)              -> "3"
 *  toIncrement("0.00000001", 0.1234)  -> "0.12340000"
 */
export function toIncrement(increment: string, value: number): string {
  const { dp, incUnits } = parseIncrementStrict(increment);
  const scale = 10 ** dp; // number scale as JS number
  const scaled = toScaledFloor(value, scale); // bigint, scaled integer

  // incUnits is:
  //  - for decimals: 1n (one unit at this dp)
  //  - for integers: e.g., 10n (ten whole units)
  const steps = scaled / incUnits; // integer division floors
  const roundedUnits = steps * incUnits;

  const rounded = Number(roundedUnits) / scale;
  return rounded.toFixed(dp);
}

/**
 * Truncate a number to a fixed number of decimal places (no rounding).
 * Examples:
 *  toFixedNumber(1.2345, 3) -> 1.234
 *  toFixedNumber(-1.2345, 3) -> -1.234
 */
export function toFixedNumber(num: number, decimalPlaces = 2): number {
  const factor = 10 ** decimalPlaces;
  const scaled = num * factor;
  const truncated = scaled < 0 ? Math.ceil(scaled) : Math.floor(scaled);
  return truncated / factor;
}
