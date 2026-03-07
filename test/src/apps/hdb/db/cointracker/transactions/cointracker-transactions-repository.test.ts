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
  selectCointrackerTransactions,
  selectCointrackerTransactionsGroup,
} from "../../../../../../../src/apps/hdb/db/cointracker/transactions/cointracker-transactions-repository.js";

describe("cointracker transactions repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries transaction rows with filters and includeBalances", async () => {
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: Array<{ transaction_id: string }> }>>(
      () => Promise.resolve({ rows: [{ transaction_id: "t1" }] }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });

    const rows = await selectCointrackerTransactions(
      {
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-01-31T00:00:00.000Z"),
        assets: ["BTC"],
      },
      true,
    );

    expect(rows).toEqual([{ transaction_id: "t1" }]);
    expect(queryMock).toHaveBeenCalledTimes(1);
    const firstCall = queryMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) {
      throw new Error("missing query call");
    }
    const sql = firstCall[0];
    const values = firstCall[1] as unknown[];
    expect(sql).toContain("received_currency_balance");
    expect(values[2]).toEqual(["BTC"]);
    expect(loggerDebugMock).toHaveBeenCalledWith("Selected 1 cointracker transaction rows");
  });

  it("queries grouped totals with interval", async () => {
    const queryMock = vi.fn<
      (sql: string, values?: unknown[]) => Promise<{ rows: Array<{ month: string; net_returns: string }> }>
    >(() => Promise.resolve({ rows: [{ month: "2026-01-01", net_returns: "1.23" }] }));
    getClientMock.mockResolvedValue({ query: queryMock });

    const rows = await selectCointrackerTransactionsGroup(
      {
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-01-31T00:00:00.000Z"),
      },
      "month",
    );

    expect(rows).toEqual([{ month: "2026-01-01", net_returns: "1.23" }]);
    expect(queryMock).toHaveBeenCalledTimes(1);
    const firstCall = queryMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) {
      throw new Error("missing query call");
    }
    const sql = firstCall[0];
    expect(sql).toContain("DATE_TRUNC('month', t.date)");
    expect(sql).toContain("GROUP BY month");
    expect(loggerDebugMock).toHaveBeenCalledWith("Selected 1 cointracker transaction group rows");
  });
});
