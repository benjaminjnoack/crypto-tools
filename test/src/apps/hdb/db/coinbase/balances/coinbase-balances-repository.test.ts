import { beforeEach, describe, expect, it, vi } from "vitest";
import { dateUtc } from "../../../../../fixtures/time.js";

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
  createCoinbaseBalanceLedgerTable,
  dropCoinbaseBalanceLedgerTable,
  insertCoinbaseBalanceLedgerBatch,
  selectCoinbaseBalanceLedger,
  selectCoinbaseBalancesAtTime,
  traceCoinbaseBalanceLedger,
  truncateCoinbaseBalanceLedgerTable,
} from "../../../../../../../src/apps/hdb/db/coinbase/balances/coinbase-balances-repository.js";

describe("coinbase balances repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs lifecycle queries with the default client", async () => {
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [] }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });

    await createCoinbaseBalanceLedgerTable();
    await truncateCoinbaseBalanceLedgerTable();
    await dropCoinbaseBalanceLedgerTable();

    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(queryMock.mock.calls[0]?.[0]).toContain("CREATE TABLE IF NOT EXISTS coinbase_balance_ledger");
    expect(queryMock.mock.calls[1]?.[0]).toContain("TRUNCATE coinbase_balance_ledger");
    expect(queryMock.mock.calls[2]?.[0]).toContain("DROP TABLE IF EXISTS coinbase_balance_ledger");
  });

  it("skips inserts for an empty batch", async () => {
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [] }),
    );

    await insertCoinbaseBalanceLedgerBatch([], { query: queryMock });

    expect(queryMock).not.toHaveBeenCalled();
  });

  it("inserts a batch with stable placeholders and values", async () => {
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [] }),
    );

    await insertCoinbaseBalanceLedgerBatch([
      {
        timestamp: dateUtc({ year: 2026, month: 1, day: 1 }),
        asset: "BTC",
        balance: "1.25",
        tx_id: "tx-1",
        notes: "first",
      },
      {
        timestamp: dateUtc({ year: 2026, month: 1, day: 2 }),
        asset: "ETH",
        balance: "2.50",
        tx_id: "tx-2",
        notes: "second",
      },
    ], { query: queryMock });

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql = "", values = []] = queryMock.mock.calls[0] ?? [];

    expect(sql).toContain("INSERT INTO coinbase_balance_ledger");
    expect(sql).toContain("($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)");
    expect(values).toEqual([
      dateUtc({ year: 2026, month: 1, day: 1 }),
      "BTC",
      "1.25",
      "tx-1",
      "first",
      dateUtc({ year: 2026, month: 1, day: 2 }),
      "ETH",
      "2.50",
      "tx-2",
      "second",
    ]);
  });

  it("selects ledger rows with filters and logs row count", async () => {
    const rows = [{ asset: "BTC", balance: "1.25" }];
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: typeof rows }>>(
      () => Promise.resolve({ rows }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });

    const result = await selectCoinbaseBalanceLedger({
      assets: ["BTC"],
      from: dateUtc({ year: 2026, month: 1, day: 1 }),
      to: dateUtc({ year: 2026, month: 1, day: 31 }),
    });

    expect(result).toEqual(rows);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0]?.[0]).toContain("asset = ANY($1::text[])");
    expect(queryMock.mock.calls[0]?.[0]).toContain("timestamp >= $2");
    expect(queryMock.mock.calls[0]?.[0]).toContain("timestamp <= $3");
    expect(queryMock.mock.calls[0]?.[1]).toEqual([
      ["BTC"],
      dateUtc({ year: 2026, month: 1, day: 1 }),
      dateUtc({ year: 2026, month: 1, day: 31 }),
    ]);
    expect(loggerDebugMock).toHaveBeenCalledWith("Selected 1 coinbase balance rows");
  });

  it("traces balances and selects snapshot rows", async () => {
    const queryMock = vi
      .fn<(sql: string, values?: unknown[]) => Promise<{ rows: Array<{ asset: string; balance: string }> }>>()
      .mockResolvedValueOnce({ rows: [{ asset: "ETH", balance: "0.5" }] })
      .mockResolvedValueOnce({ rows: [{ asset: "ETH", balance: "0.75" }] });
    getClientMock.mockResolvedValue({ query: queryMock });

    const traceRows = await traceCoinbaseBalanceLedger("ETH", dateUtc({ year: 2026, month: 2, day: 1 }));
    const snapshotRows = await selectCoinbaseBalancesAtTime(dateUtc({ year: 2026, month: 2, day: 1 }));

    expect(traceRows).toEqual([{ asset: "ETH", balance: "0.5" }]);
    expect(snapshotRows).toEqual([{ asset: "ETH", balance: "0.75" }]);
    expect(queryMock.mock.calls[0]?.[0]).toContain("WHERE asset = $1");
    expect(queryMock.mock.calls[0]?.[1]).toEqual(["ETH", dateUtc({ year: 2026, month: 2, day: 1 })]);
    expect(queryMock.mock.calls[1]?.[0]).toContain("SELECT DISTINCT ON (asset)");
    expect(queryMock.mock.calls[1]?.[1]).toEqual([dateUtc({ year: 2026, month: 2, day: 1 })]);
    expect(loggerDebugMock).toHaveBeenNthCalledWith(1, "Traced 1 coinbase balance rows");
    expect(loggerDebugMock).toHaveBeenNthCalledWith(2, "Selected 1 coinbase balances at time");
  });
});
