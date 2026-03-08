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
  tableMock,
} = vi.hoisted(() => ({
  getToAndFromDatesMock: vi.fn(() => Promise.resolve({
    from: new Date("2026-01-01T00:00:00.000Z"),
    to: new Date("2026-01-31T00:00:00.000Z"),
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
      timestamp: new Date("2026-01-02T00:00:00.000Z"),
      asset: "BTC",
      balance: "0.5",
      tx_id: "tx-1",
      notes: "row",
    },
  ])),
  selectCoinbaseBalancesAtTimeMock: vi.fn(() => Promise.resolve([
    {
      id: "10",
      timestamp: new Date("2026-01-31T00:00:00.000Z"),
      asset: "BTC",
      balance: "1.25",
      tx_id: "tx-2",
      notes: "snapshot",
    },
  ])),
  traceCoinbaseBalanceLedgerMock: vi.fn(() => Promise.resolve([
    {
      id: "2",
      timestamp: new Date("2026-01-03T00:00:00.000Z"),
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
      timestamp: new Date("2026-01-02T00:00:00.000Z"),
      type: "Buy",
      asset: "ETH2",
      num_quantity: "1",
      notes: "buy",
    },
    {
      id: "tx-b",
      timestamp: new Date("2026-01-03T00:00:00.000Z"),
      type: "Sell",
      asset: "ETH",
      num_quantity: "0.4",
      notes: "sell",
    },
    {
      id: "tx-c",
      timestamp: new Date("2026-01-04T00:00:00.000Z"),
      type: "Unwrap",
      asset: "CBETH",
      num_quantity: "0.3",
      notes: "unwrap",
    },
  ])),
  getClientMock: vi.fn(() => Promise.resolve({
    connect: vi.fn(() => Promise.resolve({
      query: vi.fn(() => Promise.resolve(undefined)),
      release: vi.fn(),
    })),
  })),
  loggerWarnMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  tableMock: vi.fn(),
}));

vi.mock("../../../../../../../src/apps/hdb/commands/shared/date-range-utils.js", () => ({
  COINBASE_EPOCH: "2024-01-01T00:00:00.000Z",
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
  });

  it("queries balances and prints rows", async () => {
    const rows = await coinbaseBalances("btc:eth", { quiet: false, raw: false });

    expect(selectCoinbaseBalanceLedgerMock).toHaveBeenCalledWith({
      assets: ["BTC", "ETH"],
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-01-31T00:00:00.000Z"),
    });
    expect(tableMock).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
  });

  it("requires explicit confirmation flags for current live checks", async () => {
    await expect(coinbaseBalances("btc", { current: true })).rejects.toThrow("Missing source: use --remote");
    await expect(coinbaseBalances("btc", { current: true, remote: true })).rejects.toThrow("without confirmation");
  });

  it("supports current balance check with remote+yes", async () => {
    await coinbaseBalances("btc", { current: true, remote: true, yes: true });

    expect(requestAccountsMock).toHaveBeenCalledTimes(1);
    expect(tableMock).toHaveBeenCalledTimes(1);
  });

  it("queries batch snapshot and trace", async () => {
    await coinbaseBalancesBatch({ quiet: false, raw: true });
    await coinbaseBalancesTrace("eth2", { quiet: false, raw: true });

    expect(selectCoinbaseBalancesAtTimeMock).toHaveBeenCalledTimes(1);
    expect(traceCoinbaseBalanceLedgerMock).toHaveBeenCalledWith(
      "ETH",
      new Date("2026-01-31T00:00:00.000Z"),
    );
  });

  it("regenerates balance ledger and writes computed rows", async () => {
    const count = await coinbaseBalancesRegenerate({ yes: true, drop: false });

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

  it("refuses regenerate without --yes", async () => {
    await expect(coinbaseBalancesRegenerate({ yes: false })).rejects.toThrow(
      "Refusing to regenerate without confirmation. Re-run with --yes.",
    );
  });
});
