import { dateUtc } from "../../../../../fixtures/time.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getToAndFromDatesMock,
  createCointrackerCapitalGainsTableMock,
  dropCointrackerCapitalGainsTableMock,
  insertCointrackerCapitalGainsBatchMock,
  selectCointrackerCapitalGainsMock,
  selectCointrackerCapitalGainsGroupMock,
  selectCointrackerCapitalGainsGroupTotalsMock,
  selectCointrackerCapitalGainsTotalsMock,
  selectCointrackerCapitalGainsUsdcBucketsMock,
  selectCointrackerCapitalGainsUsdcIntervalMock,
  truncateCointrackerCapitalGainsTableMock,
  parseCointrackerCapitalGainsCsvMock,
  buildDateRangeFilenameMock,
  resolveCointrackerCapitalGainsOutputDirMock,
  writeCapitalGainsCsvMock,
  writeCapitalGainsF8949Mock,
  writeCapitalGainsGroupCsvMock,
  writeCapitalGainsGroupF8949Mock,
  readdirMock,
  readFileMock,
  getEnvConfigMock,
  loggerWarnMock,
  loggerInfoMock,
  tableMock,
} = vi.hoisted(() => ({
  getToAndFromDatesMock: vi.fn(() => Promise.resolve({
    from: dateUtc({ year: 2026, month: 1, day: 1 }),
    to: dateUtc({ year: 2026, month: 2, day: 1 }),
  })),
  createCointrackerCapitalGainsTableMock: vi.fn(() => Promise.resolve(undefined)),
  dropCointrackerCapitalGainsTableMock: vi.fn(() => Promise.resolve(undefined)),
  insertCointrackerCapitalGainsBatchMock: vi.fn(() => Promise.resolve(2)),
  selectCointrackerCapitalGainsMock: vi.fn(() => Promise.resolve([{ asset_name: "BTC" }])),
  selectCointrackerCapitalGainsGroupMock: vi.fn(() => Promise.resolve([{ group: "BTC" }])),
  selectCointrackerCapitalGainsGroupTotalsMock: vi.fn(() => Promise.resolve({ trades: "1", cost_basis: "1", proceeds: "1", gain: "0" })),
  selectCointrackerCapitalGainsTotalsMock: vi.fn(() => Promise.resolve({ trades: "1", cost_basis: "1", proceeds: "1", gain: "0" })),
  selectCointrackerCapitalGainsUsdcBucketsMock: vi.fn(() => Promise.resolve([{ bucket: "1" }])),
  selectCointrackerCapitalGainsUsdcIntervalMock: vi.fn(() => Promise.resolve([{ month: "2026-01-01" }])),
  truncateCointrackerCapitalGainsTableMock: vi.fn(() => Promise.resolve(undefined)),
  parseCointrackerCapitalGainsCsvMock: vi.fn(() => [{
    asset_amount: "1",
    asset_name: "BTC",
    received_date: dateUtc({ year: 2026, month: 1, day: 1 }),
    date_sold: dateUtc({ year: 2026, month: 1, day: 2 }),
    proceeds_usd: "100",
    cost_basis_usd: "90",
    gain_usd: "10",
    type: "Short Term",
  }]),
  buildDateRangeFilenameMock: vi.fn(() => "2026-01-01_2026-02-01"),
  resolveCointrackerCapitalGainsOutputDirMock: vi.fn(() => "/tmp/hdb-root/output/cointracker-capital-gains"),
  writeCapitalGainsCsvMock: vi.fn(() => Promise.resolve(undefined)),
  writeCapitalGainsF8949Mock: vi.fn(() => Promise.resolve(undefined)),
  writeCapitalGainsGroupCsvMock: vi.fn(() => Promise.resolve(undefined)),
  writeCapitalGainsGroupF8949Mock: vi.fn(() => Promise.resolve(undefined)),
  readdirMock: vi.fn(() => Promise.resolve([] as string[])),
  readFileMock: vi.fn(() => Promise.resolve("csv")),
  getEnvConfigMock: vi.fn(() => ({ HELPER_HDB_ROOT_DIR: "/tmp/hdb-root" })),
  loggerWarnMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  tableMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    readdir: readdirMock,
    readFile: readFileMock,
  },
}));

vi.mock("../../../../../../../src/apps/hdb/commands/shared/date-range-utils.js", () => ({
  getToAndFromDates: getToAndFromDatesMock,
  parseAsUtc: (raw: string) => new Date(`${raw}T00:00:00.000Z`),
}));

vi.mock("../../../../../../../src/apps/hdb/db/cointracker/capital-gains/cointracker-capital-gains-repository.js", () => ({
  createCointrackerCapitalGainsTable: createCointrackerCapitalGainsTableMock,
  dropCointrackerCapitalGainsTable: dropCointrackerCapitalGainsTableMock,
  insertCointrackerCapitalGainsBatch: insertCointrackerCapitalGainsBatchMock,
  selectCointrackerCapitalGains: selectCointrackerCapitalGainsMock,
  selectCointrackerCapitalGainsGroup: selectCointrackerCapitalGainsGroupMock,
  selectCointrackerCapitalGainsGroupTotals: selectCointrackerCapitalGainsGroupTotalsMock,
  selectCointrackerCapitalGainsTotals: selectCointrackerCapitalGainsTotalsMock,
  selectCointrackerCapitalGainsUsdcBuckets: selectCointrackerCapitalGainsUsdcBucketsMock,
  selectCointrackerCapitalGainsUsdcInterval: selectCointrackerCapitalGainsUsdcIntervalMock,
  truncateCointrackerCapitalGainsTable: truncateCointrackerCapitalGainsTableMock,
}));

vi.mock("../../../../../../../src/apps/hdb/db/cointracker/capital-gains/cointracker-capital-gains-mappers.js", () => ({
  parseCointrackerCapitalGainsCsv: parseCointrackerCapitalGainsCsvMock,
}));

vi.mock("../../../../../../../src/apps/hdb/commands/cointracker/capital-gains/cointracker-capital-gains-export.js", () => ({
  buildCointrackerCapitalGainsDateRangeFilename: buildDateRangeFilenameMock,
  buildDateRangeFilename: buildDateRangeFilenameMock,
  resolveCointrackerCapitalGainsOutputDir: resolveCointrackerCapitalGainsOutputDirMock,
  writeCapitalGainsCsv: writeCapitalGainsCsvMock,
  writeCapitalGainsF8949: writeCapitalGainsF8949Mock,
  writeCapitalGainsGroupCsv: writeCapitalGainsGroupCsvMock,
  writeCapitalGainsGroupF8949: writeCapitalGainsGroupF8949Mock,
}));

vi.mock("../../../../../../../src/shared/common/env.js", () => ({
  getEnvConfig: getEnvConfigMock,
}));

vi.mock("../../../../../../../src/shared/log/logger.js", () => ({
  logger: {
    warn: loggerWarnMock,
    info: loggerInfoMock,
  },
}));

import {
  cointrackerCapitalGains,
  cointrackerCapitalGainsGroup,
  cointrackerCapitalGainsRegenerate,
  cointrackerCapitalGainsUsdc,
} from "../../../../../../../src/apps/hdb/commands/cointracker/capital-gains/cointracker-capital-gains-handlers.js";

describe("cointracker capital gains handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "table").mockImplementation(tableMock);
  });

  it("queries gains and totals", async () => {
    const rows = await cointrackerCapitalGains("btc", { totals: true, quiet: false, csv: true, f8949: true });

    expect(selectCointrackerCapitalGainsMock).toHaveBeenCalledTimes(1);
    expect(selectCointrackerCapitalGainsTotalsMock).toHaveBeenCalledTimes(1);
    expect(writeCapitalGainsCsvMock).toHaveBeenCalledTimes(1);
    expect(writeCapitalGainsF8949Mock).toHaveBeenCalledTimes(1);
    expect(tableMock).toHaveBeenCalledTimes(2);
    expect(rows).toEqual([{ asset_name: "BTC" }]);
  });

  it("queries grouped gains", async () => {
    const rows = await cointrackerCapitalGainsGroup("btc", { quiet: false, csv: true, totals: true });

    expect(selectCointrackerCapitalGainsGroupMock).toHaveBeenCalledTimes(1);
    expect(selectCointrackerCapitalGainsGroupTotalsMock).toHaveBeenCalledTimes(1);
    expect(writeCapitalGainsGroupCsvMock).toHaveBeenCalledTimes(1);
    expect(tableMock).toHaveBeenCalledTimes(2);
    expect(rows).toEqual([{ group: "BTC" }]);
  });

  it("passes pages option to grouped f8949 export", async () => {
    await cointrackerCapitalGainsGroup("btc", { quiet: true, f8949: true, pages: true });
    expect(writeCapitalGainsGroupF8949Mock).toHaveBeenCalledWith(
      "/tmp/hdb-root/output/cointracker-capital-gains",
      "2026-01-01_2026-02-01",
      [{ group: "BTC" }],
      false,
      true,
      undefined,
    );
  });

  it("formats totals unless raw=true", async () => {
    await cointrackerCapitalGains("btc", { totals: true, quiet: true, raw: false });
    const firstTotals = tableMock.mock.calls[0]![0] as Array<Record<string, string>>;
    expect(firstTotals[0]!.cost_basis).toBe("1.00");

    tableMock.mockClear();
    await cointrackerCapitalGains("btc", { totals: true, quiet: true, raw: true });
    const rawTotals = tableMock.mock.calls[0]![0] as Array<Record<string, string>>;
    expect(rawTotals[0]!.cost_basis).toBe("1");
  });

  it("refuses regenerate without --yes", async () => {
    await expect(cointrackerCapitalGainsRegenerate({ yes: false })).rejects.toThrow(
      "Refusing to regenerate without confirmation. Re-run with --yes.",
    );
  });

  it("returns zero when no csv files found", async () => {
    readdirMock.mockResolvedValueOnce(["notes.txt"]);

    const count = await cointrackerCapitalGainsRegenerate({ yes: true });

    expect(count).toBe(0);
    expect(loggerWarnMock).toHaveBeenCalledTimes(1);
  });

  it("rebuilds and inserts parsed rows", async () => {
    readdirMock.mockResolvedValueOnce(["a.csv", "b.csv"]);

    const count = await cointrackerCapitalGainsRegenerate({ yes: true, drop: true });

    expect(dropCointrackerCapitalGainsTableMock).toHaveBeenCalledTimes(1);
    expect(createCointrackerCapitalGainsTableMock).toHaveBeenCalledTimes(1);
    expect(parseCointrackerCapitalGainsCsvMock).toHaveBeenCalledTimes(2);
    expect(insertCointrackerCapitalGainsBatchMock).toHaveBeenCalledTimes(1);
    expect(count).toBe(2);
  });

  it("runs usdc bucket analysis", async () => {
    const rows = await cointrackerCapitalGainsUsdc({ buckets: true });
    expect(selectCointrackerCapitalGainsUsdcBucketsMock).toHaveBeenCalledTimes(1);
    expect(tableMock).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([{ bucket: "1" }]);
  });

  it("runs usdc interval analysis and yearly rollup", async () => {
    const rows = await cointrackerCapitalGainsUsdc({ interval: "month" });
    expect(selectCointrackerCapitalGainsUsdcIntervalMock).toHaveBeenNthCalledWith(1, "month");
    expect(selectCointrackerCapitalGainsUsdcIntervalMock).toHaveBeenNthCalledWith(2, "year");
    expect(tableMock).toHaveBeenCalledTimes(2);
    expect(rows).toEqual([{ month: "2026-01-01" }]);
  });

  it("throws when usdc analysis has no mode selected", async () => {
    await expect(cointrackerCapitalGainsUsdc({})).rejects.toThrow("Missing instructions");
  });

  it("warns when grouped export is requested with type filter", async () => {
    await cointrackerCapitalGainsGroup("btc", { quiet: true, type: "short", csv: true });
    expect(loggerWarnMock).toHaveBeenCalledWith("CSV/F8949 export with --type is not supported for grouped gains");
    expect(writeCapitalGainsGroupCsvMock).not.toHaveBeenCalled();
  });
});
