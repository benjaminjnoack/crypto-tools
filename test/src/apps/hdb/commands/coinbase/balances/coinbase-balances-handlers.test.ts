import { dateUtc, isoUtc } from "../../../../../fixtures/time.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getToAndFromDatesMock,
  requestAccountsMock,
  createCoinbaseBalanceLedgerTableMock,
  dropCoinbaseBalanceLedgerTableMock,
  insertCoinbaseBalanceLedgerBatchMock,
  selectCoinbaseBalanceLedgerMock,
  selectCoinbaseBalancesAtTimeMock,
  traceCoinbaseBalanceLedgerMock,
  truncateCoinbaseBalanceLedgerTableMock,
  selectCoinbaseTransactionsMock,
  getClientMock,
  loggerWarnMock,
  loggerInfoMock,
  loggerErrorMock,
  logMock,
  tableMock,
  clientQueryMock,
  clientReleaseMock,
  poolConnectMock,
} = vi.hoisted(() => ({
  getToAndFromDatesMock: vi.fn(() => Promise.resolve({
    from: dateUtc({ year: 2026, month: 1, day: 1 }),
    to: dateUtc({ year: 2026, month: 1, day: 31 }),
  })),
  requestAccountsMock: vi.fn(() => Promise.resolve([
    { currency: "BTC", available_balance: { value: "1.25" }, hold: { value: "0.25" } },
    { currency: "ETH", available_balance: { value: "2" }, hold: { value: "0" } },
  ])),
  createCoinbaseBalanceLedgerTableMock: vi.fn(() => Promise.resolve(undefined)),
  dropCoinbaseBalanceLedgerTableMock: vi.fn(() => Promise.resolve(undefined)),
  insertCoinbaseBalanceLedgerBatchMock: vi.fn<
    (rows: Array<Record<string, unknown>>, queryable?: unknown) => Promise<void>
  >(() => Promise.resolve(undefined)),
  selectCoinbaseBalanceLedgerMock: vi.fn(() => Promise.resolve([
    {
      id: "1",
      timestamp: dateUtc({ year: 2026, month: 1, day: 2 }),
      asset: "BTC",
      balance: "0.5",
      tx_id: "tx-1",
      notes: "row",
    },
  ])),
  selectCoinbaseBalancesAtTimeMock: vi.fn(() => Promise.resolve([
    {
      id: "10",
      timestamp: dateUtc({ year: 2026, month: 1, day: 31 }),
      asset: "BTC",
      balance: "1.25",
      tx_id: "tx-2",
      notes: "snapshot",
    },
  ])),
  traceCoinbaseBalanceLedgerMock: vi.fn(() => Promise.resolve([
    {
      id: "2",
      timestamp: dateUtc({ year: 2026, month: 1, day: 3 }),
      asset: "BTC",
      balance: "0.75",
      tx_id: "tx-3",
      notes: "trace",
    },
  ])),
  truncateCoinbaseBalanceLedgerTableMock: vi.fn(() => Promise.resolve(undefined)),
  selectCoinbaseTransactionsMock: vi.fn(() => Promise.resolve([
    {
      id: "tx-a",
      timestamp: dateUtc({ year: 2026, month: 1, day: 2 }),
      type: "Buy",
      asset: "ETH2",
      num_quantity: "1",
      notes: "buy",
    },
    {
      id: "tx-b",
      timestamp: dateUtc({ year: 2026, month: 1, day: 3 }),
      type: "Sell",
      asset: "ETH",
      num_quantity: "0.4",
      notes: "sell",
    },
    {
      id: "tx-c",
      timestamp: dateUtc({ year: 2026, month: 1, day: 4 }),
      type: "Unwrap",
      asset: "CBETH",
      num_quantity: "0.3",
      notes: "unwrap",
    },
  ])),
  getClientMock: vi.fn(() => Promise.resolve({
    connect: poolConnectMock,
  })),
  loggerWarnMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  logMock: vi.fn(),
  tableMock: vi.fn(),
  clientQueryMock: vi.fn(() => Promise.resolve(undefined)),
  clientReleaseMock: vi.fn(),
  poolConnectMock: vi.fn(() => Promise.resolve({
    query: clientQueryMock,
    release: clientReleaseMock,
  })),
}));

vi.mock("../../../../../../../src/apps/hdb/commands/shared/date-range-utils.js", () => ({
  COINBASE_EPOCH: isoUtc({ year: 2024, month: 1, day: 1 }),
  DUST_THRESHOLD: 1e-8,
  getToAndFromDates: getToAndFromDatesMock,
}));

vi.mock("../../../../../../../src/shared/coinbase/rest.js", () => ({
  requestAccounts: requestAccountsMock,
}));

vi.mock("../../../../../../../src/apps/hdb/db/coinbase/balances/coinbase-balances-repository.js", () => ({
  COINBASE_BALANCE_LEDGER_TABLE: "coinbase_balance_ledger",
  createCoinbaseBalanceLedgerTable: createCoinbaseBalanceLedgerTableMock,
  dropCoinbaseBalanceLedgerTable: dropCoinbaseBalanceLedgerTableMock,
  insertCoinbaseBalanceLedgerBatch: insertCoinbaseBalanceLedgerBatchMock,
  selectCoinbaseBalanceLedger: selectCoinbaseBalanceLedgerMock,
  selectCoinbaseBalancesAtTime: selectCoinbaseBalancesAtTimeMock,
  traceCoinbaseBalanceLedger: traceCoinbaseBalanceLedgerMock,
  truncateCoinbaseBalanceLedgerTable: truncateCoinbaseBalanceLedgerTableMock,
}));

vi.mock("../../../../../../../src/apps/hdb/db/coinbase/transactions/coinbase-transactions-repository.js", () => ({
  selectCoinbaseTransactions: selectCoinbaseTransactionsMock,
}));

vi.mock("../../../../../../../src/apps/hdb/db/db-client.js", () => ({
  getClient: getClientMock,
}));

vi.mock("../../../../../../../src/shared/log/logger.js", () => ({
  logger: {
    warn: loggerWarnMock,
    info: loggerInfoMock,
    error: loggerErrorMock,
  },
}));

import {
  coinbaseBalances,
  coinbaseBalancesBatch,
  coinbaseBalancesRegenerate,
  coinbaseBalancesTrace,
} from "../../../../../../../src/apps/hdb/commands/coinbase/balances/coinbase-balances-handlers.js";

describe("hdb coinbase balance handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "table").mockImplementation(tableMock);
    vi.spyOn(console, "log").mockImplementation(logMock);
  });

  it("queries balances and prints rows", async () => {
    const rows = await coinbaseBalances("btc:eth", { quiet: false, raw: false });

    expect(selectCoinbaseBalanceLedgerMock).toHaveBeenCalledWith({
      assets: ["BTC", "ETH"],
      from: dateUtc({ year: 2026, month: 1, day: 1 }),
      to: dateUtc({ year: 2026, month: 1, day: 31 }),
    });
    expect(tableMock).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
  });

  it("requires explicit remote flag for current live checks", async () => {
    await expect(coinbaseBalances("btc", { current: true })).rejects.toThrow("Missing source: use --remote");
  });

  it("supports current balance check with remote", async () => {
    await coinbaseBalances("btc", { current: true, remote: true });

    expect(requestAccountsMock).toHaveBeenCalledTimes(1);
    expect(tableMock).toHaveBeenCalledTimes(1);
  });

  it("prints balances as json", async () => {
    await coinbaseBalances("btc:eth", { json: true, raw: false });

    expect(tableMock).not.toHaveBeenCalled();
    expect(logMock).toHaveBeenCalledTimes(1);
    expect(logMock.mock.calls[0]?.[0]).toContain("\"rows\"");
    expect(logMock.mock.calls[0]?.[0]).toContain("\"filters\"");
  });

  it("prints current snapshot balances as json with current-balance metadata", async () => {
    await coinbaseBalancesBatch({ current: true, remote: true, json: true, raw: true });

    expect(requestAccountsMock).toHaveBeenCalledTimes(1);
    expect(tableMock).not.toHaveBeenCalled();
    expect(logMock.mock.calls[0]?.[0]).toContain("\"mode\": \"snapshot\"");
    expect(logMock.mock.calls[0]?.[0]).toContain("\"includesCurrentBalance\": true");
    expect(logMock.mock.calls[0]?.[0]).toContain("\"raw\": true");
  });

  it("queries batch snapshot and trace", async () => {
    await coinbaseBalancesBatch({ quiet: false, raw: true });
    await coinbaseBalancesTrace("eth2", { quiet: false, raw: true });

    expect(selectCoinbaseBalancesAtTimeMock).toHaveBeenCalledTimes(1);
    expect(traceCoinbaseBalanceLedgerMock).toHaveBeenCalledWith(
      "ETH",
      dateUtc({ year: 2026, month: 1, day: 31 }),
    );
  });

  it("warns when list or trace lookups return no balances", async () => {
    selectCoinbaseBalanceLedgerMock.mockResolvedValueOnce([]);
    traceCoinbaseBalanceLedgerMock.mockResolvedValueOnce([]);

    await expect(coinbaseBalances("btc", { quiet: false })).resolves.toEqual([]);
    await expect(coinbaseBalancesTrace("btc", { quiet: false })).resolves.toEqual([]);

    expect(loggerWarnMock).toHaveBeenCalledTimes(2);
  });

  it("uses drop flow when regenerating from scratch", async () => {
    await coinbaseBalancesRegenerate({ drop: true, quiet: true });

    expect(dropCoinbaseBalanceLedgerTableMock).toHaveBeenCalledTimes(1);
    expect(createCoinbaseBalanceLedgerTableMock).toHaveBeenCalledTimes(1);
    expect(truncateCoinbaseBalanceLedgerTableMock).not.toHaveBeenCalled();
  });

  it("regenerates balance ledger and writes computed rows", async () => {
    const count = await coinbaseBalancesRegenerate({ drop: false });

    expect(createCoinbaseBalanceLedgerTableMock).toHaveBeenCalledTimes(1);
    expect(truncateCoinbaseBalanceLedgerTableMock).toHaveBeenCalledTimes(1);
    expect(insertCoinbaseBalanceLedgerBatchMock).toHaveBeenCalledTimes(1);

    const firstBatch = insertCoinbaseBalanceLedgerBatchMock.mock.calls[0];
    expect(firstBatch).toBeDefined();
    if (!firstBatch) {
      throw new Error("Expected inserted rows");
    }
    const insertedRows = firstBatch[0];
    expect(insertedRows[0]?.tx_id).toBe("synthetic-zero-CBETH");
    expect(insertedRows[1]?.tx_id).toBe("synthetic-zero-ETH");
    expect(insertedRows[2]?.tx_id).toBe("tx-a");
    expect(insertedRows[2]?.balance).toBe("1");
    expect(insertedRows[3]?.tx_id).toBe("tx-b");
    expect(insertedRows[3]?.balance).toBe("0.6");
    expect(insertedRows[4]?.tx_id).toBe("tx-c");
    expect(insertedRows[4]?.asset).toBe("CBETH");
    expect(insertedRows[4]?.balance).toBe("-0.3");
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
    expect(count).toBe(5);
  });

  it("supports unwrap into ETH without a negative balance", async () => {
    selectCoinbaseTransactionsMock.mockResolvedValueOnce([
      {
        id: "tx-eth",
        timestamp: dateUtc({ year: 2026, month: 1, day: 5 }),
        type: "Unwrap",
        asset: "ETH",
        num_quantity: "0.25",
        notes: "unwrap eth",
      },
    ]);

    const count = await coinbaseBalancesRegenerate({ quiet: true });

    const firstBatch = insertCoinbaseBalanceLedgerBatchMock.mock.calls[0]?.[0];
    expect(firstBatch?.[0]?.asset).toBe("ETH");
    expect(firstBatch?.[1]?.tx_id).toBe("tx-eth");
    expect(firstBatch?.[1]?.balance).toBe("0.25");
    expect(loggerErrorMock).not.toHaveBeenCalled();
    expect(count).toBe(2);
  });

  it("rolls back and rethrows when batched inserts fail", async () => {
    insertCoinbaseBalanceLedgerBatchMock.mockRejectedValueOnce(new Error("insert failed"));

    await expect(coinbaseBalancesRegenerate({ quiet: true })).rejects.toThrow("insert failed");

    expect(clientQueryMock).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(clientQueryMock).toHaveBeenNthCalledWith(2, "ROLLBACK");
    expect(clientReleaseMock).toHaveBeenCalledTimes(1);
  });

  it("throws when a transaction quantity is invalid during regenerate", async () => {
    selectCoinbaseTransactionsMock.mockResolvedValueOnce([
      {
        id: "tx-bad",
        timestamp: dateUtc({ year: 2026, month: 1, day: 2 }),
        type: "Buy",
        asset: "BTC",
        num_quantity: "not-a-number",
        notes: "bad row",
      },
    ]);

    await expect(coinbaseBalancesRegenerate({ quiet: true })).rejects.toThrow(
      "Invalid transaction quantity for tx-bad: not-a-number",
    );
  });

});
