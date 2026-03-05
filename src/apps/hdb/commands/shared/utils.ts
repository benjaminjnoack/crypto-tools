import { DateTime } from "luxon";
import { selectCoinbaseOrderByLastFillTime } from "../../db/coinbase/orders/repository.js";
import { DateRange, type DateRangeValue } from "../schemas/DateRange.js";
import { logger } from "../../../../shared/log/index.js";

/**
 * 1 * 10^-8
 */
export const PRECISION_EPSILON = 1e-8;
/**
 * Same as PRECISION_EPSILON
 */
export const DUST_THRESHOLD = PRECISION_EPSILON;
/**
 * Start of the year I opened my coinbase account
 */
export const COINBASE_EPOCH = "2024-01-01T00:00:00.000Z";

type TimeOptions = {
  from?: string | undefined;
  to?: string | undefined;
  range?: DateRangeValue | undefined;
  year?: string | undefined;
};

export async function getRangeDates(range: DateRangeValue, useLocaleWeeks = false) {
  const now = DateTime.utc();
  const opts = { useLocaleWeeks };

  let from: Date;
  let to: Date;

  switch (range) {
    case DateRange.WEEK:
      from = now.startOf("week", opts).toJSDate();
      to = now.endOf("week", opts).toJSDate();
      break;
    case DateRange.MONTH:
      from = now.startOf("month", opts).toJSDate();
      to = now.endOf("month", opts).toJSDate();
      break;
    case DateRange.QUARTER:
      from = now.startOf("quarter", opts).toJSDate();
      to = now.endOf("quarter", opts).toJSDate();
      break;
    case DateRange.YEAR:
      from = now.startOf("year", opts).toJSDate();
      to = now.endOf("year", opts).toJSDate();
      break;
    case DateRange.ALL: { // TODO is this really the best way?
      const { first } = await selectCoinbaseOrderByLastFillTime(true, false);
      from = first ?? new Date(COINBASE_EPOCH);
      to = now.endOf("year", opts).toJSDate();
      break;
    }
    default:
      throw new Error("Invalid range");
  }

  return { from, to };
}
export async function getToAndFromDates(
  options: TimeOptions,
  defaultStartToCoinbaseEpoch = true,
  defaultEndToNow = true,
) {
  const { from: fromInput, to: toInput, range, year } = options;
  let from: Date;
  let to: Date;

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
    if (fromInput) {
      from = parseAsUtc(fromInput);
    } else if (defaultStartToCoinbaseEpoch) {
      from = new Date(COINBASE_EPOCH);
      logger.warn(`Start is COINBASE_EPOCH: ${from.toISOString()}`);
    } else {
      throw new Error("Cannot read start date");
    }

    if (toInput) {
      to = parseAsUtc(toInput);
    } else if (defaultEndToNow) {
      to = new Date();
      logger.warn(`End is Now: ${to.toISOString()}`);
    } else {
      throw new Error("Cannot read end date");
    }
  }

  if (isNaN(from.getTime())) {
    throw new Error("Invalid from date format. Use ISO format");
  }
  logger.debug(`From: ${from.toISOString()}`);

  if (isNaN(to.getTime())) {
    throw new Error("Invalid to date format. Use ISO format");
  }
  logger.debug(`To: ${to.toISOString()}`);

  return { from, to };
}

/**
 * Ensure input string is treated as UTC.
 * Appends 'Z' if no timezone is specified.
 * Converts 'YYYY-MM-DD' to 'YYYY-MM-DDT00:00:00Z'
 */
export function parseAsUtc(dateStr: string) {
  const hasTimeZone = /[Z+-]\d{0,2}:?\d{0,2}$/.test(dateStr);
  const hasTime = /T/.test(dateStr);

  if (!hasTime) {
    dateStr += "T00:00:00Z"; // date only
  } else if (!hasTimeZone) {
    dateStr += "Z"; // timestamp without zone
  }

  return new Date(dateStr);
}
