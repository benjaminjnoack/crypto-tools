import { dateUtc } from "../../../../../fixtures/time.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClientMock, loggerDebugMock } = vi.hoisted(() => ({
  getClientMock: vi.fn(),
  loggerDebugMock: vi.fn(),
}));

vi.mock("../../../../../../../src/apps/hdb/db/db-client.js", () => ({
  getClient: getClientMock,
}));

vi.mock("../../../../../../../src/shared/log/logger.js", () => ({
  logger: {
    debug: loggerDebugMock,
  },
}));

import {
  createCointrackerCapitalGainsTable,
  dropCointrackerCapitalGainsTable,
  insertCointrackerCapitalGainsBatch,
  selectCointrackerCapitalGains,
  selectCointrackerCapitalGainsGroup,
  selectCointrackerCapitalGainsTotals,
  selectCointrackerCapitalGainsUsdcBuckets,
  selectCointrackerCapitalGainsUsdcInterval,
  truncateCointrackerCapitalGainsTable,
} from "../../../../../../../src/apps/hdb/db/cointracker/capital-gains/cointracker-capital-gains-repository.js";

describe("cointracker capital gains repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs lifecycle queries", async () => {
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [] }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });

    await createCointrackerCapitalGainsTable();
    await truncateCointrackerCapitalGainsTable();
    await dropCointrackerCapitalGainsTable();

    expect(queryMock).toHaveBeenCalledTimes(3);
  });

  it("inserts batch rows", async () => {
    const queryMock = vi.fn(() => Promise.resolve({ rowCount: 1 }));
    getClientMock.mockResolvedValue({ query: queryMock });

    const count = await insertCointrackerCapitalGainsBatch([
      {
        asset_amount: "1",
        asset_name: "BTC",
        received_date: dateUtc({ year: 2026, month: 1, day: 1 }),
        date_sold: dateUtc({ year: 2026, month: 2, day: 1 }),
        proceeds_usd: "100",
        cost_basis_usd: "90",
        gain_usd: "10",
        type: "Short Term",
      },
    ]);

    expect(count).toBe(1);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("selects gains/group/totals", async () => {
    const queryMock = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ asset_name: "BTC" }] })
      .mockResolvedValueOnce({ rows: [{ group: "BTC" }] })
      .mockResolvedValueOnce({ rows: [{ trades: "1", cost_basis: "1", proceeds: "1", gain: "0" }] })
      .mockResolvedValueOnce({ rows: [{ bucket: "1" }] })
      .mockResolvedValueOnce({ rows: [{ month: "2026-01-01" }] });
    getClientMock.mockResolvedValue({ query: queryMock });

    const filters = {
      assets: ["BTC"],
      excluding: [],
      from: dateUtc({ year: 2026, month: 1, day: 1 }),
      to: dateUtc({ year: 2026, month: 2, day: 1 }),
    };

    const gains = await selectCointrackerCapitalGains(filters, false);
    const grouped = await selectCointrackerCapitalGainsGroup(filters, false);
    const totals = await selectCointrackerCapitalGainsTotals(filters);
    const buckets = await selectCointrackerCapitalGainsUsdcBuckets();
    const intervals = await selectCointrackerCapitalGainsUsdcInterval("month");

    expect(gains).toEqual([{ asset_name: "BTC" }]);
    expect(grouped).toEqual([{ group: "BTC" }]);
    expect(totals).toEqual({ trades: "1", cost_basis: "1", proceeds: "1", gain: "0" });
    expect(buckets).toEqual([{ bucket: "1" }]);
    expect(intervals).toEqual([{ month: "2026-01-01" }]);
    expect(loggerDebugMock).toHaveBeenCalledTimes(4);
  });
});
