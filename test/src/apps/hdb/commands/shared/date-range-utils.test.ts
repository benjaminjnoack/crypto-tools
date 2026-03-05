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
    expect(parseAsUtc("2025-02-03").toISOString()).toBe("2025-02-03T00:00:00.000Z");
    expect(parseAsUtc("2025-02-03T01:02:03").toISOString()).toBe("2025-02-03T01:02:03.000Z");
    expect(parseAsUtc("2025-02-03T01:02:03Z").toISOString()).toBe("2025-02-03T01:02:03.000Z");
  });

  it("returns year boundaries for --year option", async () => {
    const { from, to } = await getToAndFromDates({ year: "2025" });

    expect(from.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("rejects invalid year format", async () => {
    await expect(getToAndFromDates({ year: "25" })).rejects.toThrow("Invalid year format: 25");
  });

  it("uses explicit from/to inputs", async () => {
    const { from, to } = await getToAndFromDates({
      from: "2025-01-10",
      to: "2025-01-11T06:07:08",
    });

    expect(from.toISOString()).toBe("2025-01-10T00:00:00.000Z");
    expect(to.toISOString()).toBe("2025-01-11T06:07:08.000Z");
  });

  it("defaults to epoch and now when from/to are omitted", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T12:00:00.000Z"));

    const { from, to } = await getToAndFromDates({});

    expect(from.toISOString()).toBe(COINBASE_EPOCH);
    expect(to.toISOString()).toBe("2026-03-01T12:00:00.000Z");
    expect(loggerWarnMock).toHaveBeenCalledTimes(2);
  });

  it("throws when defaults are disabled and dates are missing", async () => {
    await expect(getToAndFromDates({}, false, true)).rejects.toThrow("Cannot read start date");
    await expect(getToAndFromDates({}, true, false)).rejects.toThrow("Cannot read end date");
  });

  it("supports DateRange.ALL with repository first-fill fallback", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    selectCoinbaseOrderByLastFillTimeMock.mockResolvedValueOnce({
      first: new Date("2025-04-05T01:02:03.000Z"),
      last: null,
    });

    const { from, to } = await getRangeDates(DateRange.ALL);

    expect(from.toISOString()).toBe("2025-04-05T01:02:03.000Z");
    expect(to.toISOString()).toBe("2026-12-31T23:59:59.999Z");
  });

  it("uses COINBASE_EPOCH when DateRange.ALL has no first fill", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
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
