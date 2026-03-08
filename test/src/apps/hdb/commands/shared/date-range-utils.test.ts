import { dateUtc, isoUtc } from "../../../../fixtures/time.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DateRange } from "../../../../../../src/apps/hdb/commands/schemas/date-range.js";

const { selectCoinbaseOrderByLastFillTimeMock, loggerWarnMock, loggerDebugMock } = vi.hoisted(() => ({
  selectCoinbaseOrderByLastFillTimeMock: vi.fn<
    (first: boolean, last: boolean) => Promise<{ first: Date | null; last: Date | null }>
  >(() => Promise.resolve({ first: null, last: null })),
  loggerWarnMock: vi.fn(),
  loggerDebugMock: vi.fn(),
}));

vi.mock("../../../../../../src/apps/hdb/db/coinbase/orders/coinbase-orders-repository.js", () => ({
  selectCoinbaseOrderByLastFillTime: selectCoinbaseOrderByLastFillTimeMock,
}));

vi.mock("../../../../../../src/shared/log/logger.js", () => ({
  logger: {
    warn: loggerWarnMock,
    debug: loggerDebugMock,
  },
}));

import {
  COINBASE_EPOCH,
  getRangeDates,
  getToAndFromDates,
  parseAsUtc,
} from "../../../../../../src/apps/hdb/commands/shared/date-range-utils.js";

describe("hdb shared date utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("parseAsUtc normalizes date-only and no-timezone timestamps", () => {
    expect(parseAsUtc("2025-02-03").toISOString()).toBe(isoUtc({ year: 2025, month: 2, day: 3 }));
    expect(parseAsUtc("2025-02-03T01:02:03").toISOString())
      .toBe(isoUtc({ year: 2025, month: 2, day: 3, hour: 1, minute: 2, second: 3 }));
    expect(parseAsUtc("2025-02-03T01:02:03Z").toISOString())
      .toBe(isoUtc({ year: 2025, month: 2, day: 3, hour: 1, minute: 2, second: 3 }));
  });

  it("returns year boundaries for --year option", async () => {
    const { from, to } = await getToAndFromDates({ year: "2025" });

    expect(from.toISOString()).toBe(isoUtc({ year: 2025, month: 1, day: 1 }));
    expect(to.toISOString()).toBe(isoUtc({ year: 2026, month: 1, day: 1 }));
  });

  it("rejects invalid year format", async () => {
    await expect(getToAndFromDates({ year: "25" })).rejects.toThrow("Invalid year format: 25");
  });

  it("uses explicit from/to inputs", async () => {
    const { from, to } = await getToAndFromDates({
      from: "2025-01-10",
      to: "2025-01-11T06:07:08",
    });

    expect(from.toISOString()).toBe(isoUtc({ year: 2025, month: 1, day: 10 }));
    expect(to.toISOString()).toBe(isoUtc({ year: 2025, month: 1, day: 11, hour: 6, minute: 7, second: 8 }));
  });

  it("defaults to epoch and now when from/to are omitted", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(dateUtc({ year: 2026, month: 3, day: 1, hour: 12 }));

    const { from, to } = await getToAndFromDates({});

    expect(from.toISOString()).toBe(COINBASE_EPOCH);
    expect(to.toISOString()).toBe(isoUtc({ year: 2026, month: 3, day: 1, hour: 12 }));
    expect(loggerWarnMock).toHaveBeenCalledTimes(2);
  });

  it("throws when defaults are disabled and dates are missing", async () => {
    await expect(getToAndFromDates({}, false, true)).rejects.toThrow("Cannot read start date");
    await expect(getToAndFromDates({}, true, false)).rejects.toThrow("Cannot read end date");
  });

  it("supports DateRange.ALL with repository first-fill fallback", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(dateUtc({ year: 2026, month: 6, day: 15 }));
    selectCoinbaseOrderByLastFillTimeMock.mockResolvedValueOnce({
      first: dateUtc({ year: 2025, month: 4, day: 5, hour: 1, minute: 2, second: 3 }),
      last: null,
    });

    const { from, to } = await getRangeDates(DateRange.ALL);

    expect(from.toISOString()).toBe(isoUtc({ year: 2025, month: 4, day: 5, hour: 1, minute: 2, second: 3 }));
    expect(to.toISOString()).toBe(isoUtc({ year: 2026, month: 12, day: 31, hour: 23, minute: 59, second: 59, millisecond: 999 }));
  });

  it("uses COINBASE_EPOCH when DateRange.ALL has no first fill", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(dateUtc({ year: 2026, month: 6, day: 15 }));
    selectCoinbaseOrderByLastFillTimeMock.mockResolvedValueOnce({
      first: null,
      last: null,
    });

    const { from } = await getRangeDates(DateRange.ALL);
    expect(from.toISOString()).toBe(COINBASE_EPOCH);
  });

  it("throws on invalid range values", async () => {
    await expect(getRangeDates("bad-range" as never)).rejects.toThrow("Invalid range");
  });
});
