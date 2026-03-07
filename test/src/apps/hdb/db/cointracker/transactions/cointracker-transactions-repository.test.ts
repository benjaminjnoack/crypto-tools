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
  createCointrackerTransactionsTable,
  dropCointrackerTransactionsTable,
  insertCointrackerTransactionsBatch,
  selectCointrackerTransactions,
  selectCointrackerTransactionsGroup,
  truncateCointrackerTransactionsTable,
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

  it("creates, truncates, and drops table", async () => {
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [] }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });

    await createCointrackerTransactionsTable();
    await truncateCointrackerTransactionsTable();
    await dropCointrackerTransactionsTable();

    expect(queryMock).toHaveBeenCalledTimes(3);
    const firstCall = queryMock.mock.calls[0];
    const secondCall = queryMock.mock.calls[1];
    const thirdCall = queryMock.mock.calls[2];
    if (!firstCall || !secondCall || !thirdCall) {
      throw new Error("missing query calls");
    }
    expect(firstCall[0]).toContain("CREATE TABLE IF NOT EXISTS cointracker_transactions");
    expect(secondCall[0]).toContain("TRUNCATE cointracker_transactions");
    expect(thirdCall[0]).toContain("DROP TABLE IF EXISTS cointracker_transactions");
  });

  it("inserts a batch with positional placeholders", async () => {
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [] }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });

    await insertCointrackerTransactionsBatch([
      {
        transaction_id: "tx-1",
        date: new Date("2026-01-01T00:00:00.000Z"),
        type: "BUY",
        received_quantity: "1",
        received_currency: "BTC",
        received_cost_basis: "100",
        received_wallet: null,
        received_address: null,
        received_comment: null,
        sent_quantity: "50000",
        sent_currency: "USD",
        sent_cost_basis: "50000",
        sent_wallet: null,
        sent_address: null,
        sent_comment: null,
        fee_amount: "10",
        fee_currency: "USD",
        fee_cost_basis: "10",
        realized_return: "0",
        fee_realized_return: "0",
        transaction_hash: null,
      },
    ]);

    expect(queryMock).toHaveBeenCalledTimes(1);
    const firstCall = queryMock.mock.calls[0];
    if (!firstCall) {
      throw new Error("missing query call");
    }
    const sql = firstCall[0];
    const values = firstCall[1] as unknown[];
    expect(sql).toContain("INSERT INTO cointracker_transactions");
    expect(sql).toContain("$1");
    expect(sql).toContain("$21");
    expect(values).toHaveLength(21);
  });
});
