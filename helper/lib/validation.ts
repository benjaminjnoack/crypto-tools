/**
 * Safely converts a value to a finite number.
 *
 * @param value - The value to convert (string or number).
 * @param message - Error message prefix used in thrown errors.
 * @param insistString - If true, rejects non-string inputs even if numeric.
 * @returns A finite number parsed from `value`.
 * @throws Error with helpful suffixes:
 *  - " (not a string: <type>)"   when `insistString` is true and value isn't a string
 *  - " (invalid type: <type>)"   when value isn't string or number
 *  - " (empty)"                  when value is an empty string
 *  - " (<original>)"             when the parsed number is NaN/±Infinity
 */
export function safeNumber(
  value: string | number,
  message: string,
  insistString: boolean = false,
): number {
  if (typeof value !== 'string') {
    if (insistString) {
      throw new Error(`${message} (not a string: ${typeof value})`);
    } else if (typeof value !== 'number') {
      throw new Error(`${message} (invalid type: ${typeof value})`);
    }
  } else if (value === '') {
    throw new Error(`${message} (empty)`);
  }

  const num = Number(value);

  if (!Number.isFinite(num)) {
    throw new Error(`${message} (${String(value)})`);
  }

  return num;
}
