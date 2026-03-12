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
  type CoinbaseTransactionInsertRow,
  createCoinbaseTransactionsTable,
  dropCoinbaseTransactionsTable,
  insertCoinbaseTransactions,
  insertCoinbaseTransactionsBatch,
  selectCoinbaseTransactionById,
  selectCoinbaseTransactions,
  selectCoinbaseTransactionsByIds,
  selectCoinbaseTransactionsDistinctAsset,
  selectCoinbaseTransactionsGroup,
  truncateCoinbaseTransactionsTable,
} from "../../../../../../../src/apps/hdb/db/coinbase/transactions/coinbase-transactions-repository.js";

function makeInsertRow(overrides: Partial<CoinbaseTransactionInsertRow> = {}): CoinbaseTransactionInsertRow {
  return {
    id: "tx-1",
    timestamp: dateUtc({ year: 2026, month: 1, day: 1 }),
    type: "Buy",
    asset: "BTC",
    price_currency: "USD",
    notes: "note",
    synthetic: false,
    manual: false,
    quantity: "0.10",
    price_at_tx: "50000",
    subtotal: "5000",
    total: "5005",
    fee: "5",
    num_quantity: "0.10",
    num_price_at_tx: "50000",
    num_subtotal: "5000",
    num_total: "5005",
    num_fee: "5",
    js_num_quantity: 0.1,
    js_num_price_at_tx: 50000,
    js_num_subtotal: 5000,
    js_num_total: 5005,
    js_num_fee: 5,
    int_quantity: "10",
    int_price_at_tx: "50000",
    int_subtotal: "5000",
    int_total: "5005",
    int_fee: "5",
    ...overrides,
  };
}

describe("coinbase transactions repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs lifecycle queries with the default client", async () => {
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [] }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });

    await createCoinbaseTransactionsTable();
    await truncateCoinbaseTransactionsTable();
    await dropCoinbaseTransactionsTable();

    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(queryMock.mock.calls[0]?.[0]).toContain("CREATE TABLE IF NOT EXISTS coinbase_transactions");
    expect(queryMock.mock.calls[1]?.[0]).toContain("TRUNCATE coinbase_transactions");
    expect(queryMock.mock.calls[2]?.[0]).toContain("DROP TABLE IF EXISTS coinbase_transactions");
  });

  it("inserts a single row with DO NOTHING conflict handling by default", async () => {
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [] }),
    );

    await insertCoinbaseTransactions(makeInsertRow(), false, { query: queryMock });

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql = "", values = []] = queryMock.mock.calls[0] ?? [];

    expect(sql).toContain("INSERT INTO coinbase_transactions");
    expect(sql).toContain("ON CONFLICT (id) DO NOTHING");
    expect(values).toHaveLength(28);
    expect(values[0]).toBe("tx-1");
    expect(values[27]).toBe("5");
  });

  it("updates all columns when rewriteExisting is enabled", async () => {
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [] }),
    );

    await insertCoinbaseTransactions(makeInsertRow(), true, { query: queryMock });

    const [sql = ""] = queryMock.mock.calls[0] ?? [];
    expect(sql).toContain("ON CONFLICT (id) DO UPDATE SET");
    expect(sql).toContain("timestamp = EXCLUDED.timestamp");
    expect(sql).toContain("int_fee = EXCLUDED.int_fee");
  });

  it("skips batch inserts for an empty list", async () => {
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [] }),
    );

    await insertCoinbaseTransactionsBatch([], { query: queryMock });

    expect(queryMock).not.toHaveBeenCalled();
  });

  it("inserts batched transaction rows with stable placeholder offsets", async () => {
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [] }),
    );

    await insertCoinbaseTransactionsBatch([
      makeInsertRow(),
      makeInsertRow({ id: "tx-2", asset: "ETH" }),
    ], { query: queryMock });

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql = "", values = []] = queryMock.mock.calls[0] ?? [];

    expect(sql).toContain("VALUES ($1, $2, $3");
    expect(sql).toContain("($29, $30, $31");
    expect(values).toHaveLength(56);
    expect(values[0]).toBe("tx-1");
    expect(values[28]).toBe("tx-2");
  });

  it("selects filtered transactions with paired balances", async () => {
    const rows = [{ id: "tx-1" }];
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: typeof rows }>>(
      () => Promise.resolve({ rows }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });

    const result = await selectCoinbaseTransactions({
      from: dateUtc({ year: 2026, month: 1, day: 1 }),
      to: dateUtc({ year: 2026, month: 2, day: 1 }),
      assets: ["BTC"],
      excluded: ["ETH"],
      types: ["Buy"],
      notTypes: ["Sell"],
      selectManual: true,
      selectSynthetic: false,
    }, true, true);

    expect(result).toEqual(rows);
    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql = "", values = []] = queryMock.mock.calls[0] ?? [];
    expect(sql).toContain("WITH filtered AS");
    expect(sql).toContain("LEFT JOIN coinbase_balance_ledger b ON t.id = b.tx_id");
    expect(values).toEqual([
      dateUtc({ year: 2026, month: 1, day: 1 }),
      dateUtc({ year: 2026, month: 2, day: 1 }),
      ["BTC"],
      ["ETH"],
      ["Buy"],
      ["Sell"],
    ]);
    expect(loggerDebugMock).toHaveBeenCalledWith("Selected 1 coinbase transaction rows");
  });

  it("selects grouped transactions and logs row count", async () => {
    const rows = [{ month: "2026-01-01", quantity: "1" }];
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: typeof rows }>>(
      () => Promise.resolve({ rows }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });

    const result = await selectCoinbaseTransactionsGroup({
      from: dateUtc({ year: 2026, month: 1, day: 1 }),
      to: dateUtc({ year: 2026, month: 2, day: 1 }),
    }, "month");

    expect(result).toEqual(rows);
    expect(queryMock.mock.calls[0]?.[0]).toContain("DATE(DATE_TRUNC('month', t.timestamp)) AS month");
    expect(loggerDebugMock).toHaveBeenCalledWith("Selected 1 coinbase transaction group rows");
  });

  it("returns early for empty id lists and otherwise selects by ids", async () => {
    await expect(selectCoinbaseTransactionsByIds([])).resolves.toEqual([]);

    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: Array<{ id: string }> }>>(
      () => Promise.resolve({ rows: [{ id: "tx-1" }] }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });
    const rows = await selectCoinbaseTransactionsByIds(["tx-1", "tx-2"]);

    expect(rows).toEqual([{ id: "tx-1" }]);
    expect(queryMock.mock.calls[0]?.[0]).toContain("WHERE id = ANY($1::text[])");
    expect(queryMock.mock.calls[0]?.[1]).toEqual([["tx-1", "tx-2"]]);
    expect(loggerDebugMock).toHaveBeenCalledWith("Selected 1 coinbase transaction rows by ids");
  });

  it("selects by id and maps distinct assets", async () => {
    const queryMock = vi
      .fn<(sql: string, values?: unknown[]) => Promise<{ rows: Array<{ id: string }> | Array<{ asset: string }> }>>()
      .mockResolvedValueOnce({ rows: [{ id: "tx-1" }] })
      .mockResolvedValueOnce({ rows: [{ asset: "BTC" }, { asset: "ETH" }] });
    getClientMock.mockResolvedValue({ query: queryMock });

    const rows = await selectCoinbaseTransactionById("tx-1");
    const assets = await selectCoinbaseTransactionsDistinctAsset(
      dateUtc({ year: 2026, month: 1, day: 1 }),
      dateUtc({ year: 2026, month: 2, day: 1 }),
    );

    expect(rows).toEqual([{ id: "tx-1" }]);
    expect(assets).toEqual(["BTC", "ETH"]);
    expect(queryMock.mock.calls[0]?.[0]).toContain("WHERE id = $1");
    expect(queryMock.mock.calls[0]?.[1]).toEqual(["tx-1"]);
    expect(queryMock.mock.calls[1]?.[0]).toContain("SELECT DISTINCT asset");
    expect(queryMock.mock.calls[1]?.[1]).toEqual([
      dateUtc({ year: 2026, month: 1, day: 1 }),
      dateUtc({ year: 2026, month: 2, day: 1 }),
    ]);
    expect(loggerDebugMock).toHaveBeenCalledWith("Selected 1 coinbase transaction rows by id");
  });
});
