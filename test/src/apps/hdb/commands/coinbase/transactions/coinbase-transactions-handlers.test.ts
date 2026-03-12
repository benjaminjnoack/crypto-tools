import { dateUtc, isoUtc } from "../../../../../fixtures/time.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getToAndFromDatesMock,
  selectCoinbaseTransactionsMock,
  selectCoinbaseTransactionsGroupMock,
  selectCoinbaseTransactionsByIdsMock,
  selectCoinbaseTransactionByIdMock,
  createCoinbaseTransactionsTableMock,
  dropCoinbaseTransactionsTableMock,
  truncateCoinbaseTransactionsTableMock,
  insertCoinbaseTransactionsBatchMock,
  insertCoinbaseTransactionsMock,
  parseCoinbaseTransactionsStatementCsvMock,
  getClientMock,
  readFileMock,
  readdirMock,
  requestAccountsMock,
  requestProductMock,
  getEnvConfigMock,
  loggerWarnMock,
  loggerInfoMock,
  tableMock,
  logMock,
  dirMock,
} = vi.hoisted(() => ({
  getToAndFromDatesMock: vi.fn(() => Promise.resolve({
    from: dateUtc({ year: 2026, month: 1, day: 1 }),
    to: dateUtc({ year: 2026, month: 2, day: 1 }),
  })),
  selectCoinbaseTransactionsMock: vi.fn<() => Promise<Array<Record<string, unknown>>>>(() => Promise.resolve([
    {
      id: "tx-1",
      timestamp: dateUtc({ year: 2026, month: 1, day: 2 }),
      type: "Advanced Trade Buy",
      asset: "BTC",
      num_quantity: "0.10",
      num_price_at_tx: "50000",
      num_total: "5000",
      num_fee: "5",
      notes: "note",
      balance: "1.10",
    },
  ])),
  selectCoinbaseTransactionsGroupMock: vi.fn<() => Promise<Array<Record<string, unknown>>>>(() => Promise.resolve([
    { month: "2026-01-01", quantity: "1", subtotal: "2", fee: "3", total: "5" },
  ])),
  selectCoinbaseTransactionsByIdsMock: vi.fn(() => Promise.resolve([
    {
      id: "tx-1",
      timestamp: dateUtc({ year: 2026, month: 1, day: 2 }),
      type: "Buy",
      asset: "BTC",
      num_quantity: "0.10",
      num_price_at_tx: "50000",
      num_total: "5000",
      num_fee: "5",
      notes: "note",
    },
  ])),
  selectCoinbaseTransactionByIdMock: vi.fn(() => Promise.resolve([{ id: "manual-1" }])),
  createCoinbaseTransactionsTableMock: vi.fn(() => Promise.resolve(undefined)),
  dropCoinbaseTransactionsTableMock: vi.fn(() => Promise.resolve(undefined)),
  truncateCoinbaseTransactionsTableMock: vi.fn(() => Promise.resolve(undefined)),
  insertCoinbaseTransactionsBatchMock: vi.fn(() => Promise.resolve(undefined)),
  insertCoinbaseTransactionsMock: vi.fn(() => Promise.resolve(undefined)),
  parseCoinbaseTransactionsStatementCsvMock: vi.fn(() => [{ id: "row-1" }, { id: "row-2" }]),
  getClientMock: vi.fn(() => Promise.resolve({
    connect: vi.fn(() => Promise.resolve({
      query: vi.fn(() => Promise.resolve(undefined)),
      release: vi.fn(),
    })),
  })),
  readFileMock: vi.fn(() => Promise.resolve("csv")),
  readdirMock: vi.fn(() => Promise.resolve(["a.csv", "manual.csv"])),
  requestAccountsMock: vi.fn(() => Promise.resolve([
    { currency: "USD", available_balance: { value: "1000" }, hold: { value: "0" } },
    { currency: "BTC", available_balance: { value: "0.1" }, hold: { value: "0" } },
  ])),
  requestProductMock: vi.fn(() => Promise.resolve({ price: "50000" })),
  getEnvConfigMock: vi.fn(() => ({ HELPER_HDB_ROOT_DIR: "/tmp/hdb-root" })),
  loggerWarnMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  tableMock: vi.fn(),
  logMock: vi.fn(),
  dirMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: readFileMock,
    readdir: readdirMock,
  },
}));

vi.mock("../../../../../../../src/apps/hdb/commands/shared/date-range-utils.js", () => ({
  getToAndFromDates: getToAndFromDatesMock,
}));

vi.mock("../../../../../../../src/apps/hdb/db/coinbase/transactions/coinbase-transactions-repository.js", () => ({
  selectCoinbaseTransactions: selectCoinbaseTransactionsMock,
  selectCoinbaseTransactionsGroup: selectCoinbaseTransactionsGroupMock,
  selectCoinbaseTransactionsByIds: selectCoinbaseTransactionsByIdsMock,
  selectCoinbaseTransactionById: selectCoinbaseTransactionByIdMock,
  createCoinbaseTransactionsTable: createCoinbaseTransactionsTableMock,
  dropCoinbaseTransactionsTable: dropCoinbaseTransactionsTableMock,
  truncateCoinbaseTransactionsTable: truncateCoinbaseTransactionsTableMock,
  insertCoinbaseTransactionsBatch: insertCoinbaseTransactionsBatchMock,
  insertCoinbaseTransactions: insertCoinbaseTransactionsMock,
}));

vi.mock("../../../../../../../src/apps/hdb/db/coinbase/transactions/coinbase-transactions-mappers.js", () => ({
  parseCoinbaseTransactionsStatementCsv: parseCoinbaseTransactionsStatementCsvMock,
}));

vi.mock("../../../../../../../src/apps/hdb/db/db-client.js", () => ({
  getClient: getClientMock,
}));

vi.mock("../../../../../../../src/shared/coinbase/rest.js", () => ({
  requestAccounts: requestAccountsMock,
  requestProduct: requestProductMock,
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
  coinbaseTransactions,
  coinbaseTransactionsGroup,
  coinbaseTransactionsId,
  coinbaseTransactionsManual,
  coinbaseTransactionsNav,
  coinbaseTransactionsRegenerate,
  coinbaseTransactionsStatement,
} from "../../../../../../../src/apps/hdb/commands/coinbase/transactions/coinbase-transactions-handlers.js";

describe("hdb coinbase transaction handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "table").mockImplementation(tableMock);
    vi.spyOn(console, "log").mockImplementation(logMock);
    vi.spyOn(console, "dir").mockImplementation(dirMock);
  });

  it("queries transactions with classifier and toggles", async () => {
    const rows = await coinbaseTransactions("btc", {
      classifier: "trade_buy",
      exclude: "eth",
      manual: true,
      synthetic: false,
      paired: true,
      balance: true,
      quiet: false,
    });

    expect(selectCoinbaseTransactionsMock).toHaveBeenCalledWith(
      {
        from: dateUtc({ year: 2026, month: 1, day: 1 }),
        to: dateUtc({ year: 2026, month: 2, day: 1 }),
        assets: ["BTC"],
        excluded: ["ETH"],
        types: ["Advanced Trade Buy", "Buy"],
        notTypes: [],
        selectManual: true,
        selectSynthetic: null,
      },
      true,
      true,
    );
    expect(tableMock).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
  });

  it("prints warning when no transactions are found", async () => {
    selectCoinbaseTransactionsMock.mockResolvedValueOnce([]);

    const rows = await coinbaseTransactions(undefined, { quiet: false });

    expect(loggerWarnMock).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([]);
  });

  it("groups transactions and prints totals when interval is set", async () => {
    const rows = await coinbaseTransactionsGroup("btc", { interval: "month", quiet: false });

    expect(selectCoinbaseTransactionsGroupMock).toHaveBeenNthCalledWith(
      1,
      {
        from: dateUtc({ year: 2026, month: 1, day: 1 }),
        to: dateUtc({ year: 2026, month: 2, day: 1 }),
        assets: ["BTC"],
        excluded: [],
        types: [],
        notTypes: [],
        selectManual: null,
        selectSynthetic: null,
      },
      "month",
    );
    expect(logMock).toHaveBeenCalledWith("Totals:");
    expect(tableMock).toHaveBeenCalledTimes(2);
    expect(rows).toHaveLength(1);
  });

  it("prints transaction list as json", async () => {
    await coinbaseTransactions("btc", {
      json: true,
      balance: true,
      paired: true,
      quiet: false,
    });

    expect(tableMock).not.toHaveBeenCalled();
    expect(logMock).toHaveBeenCalledTimes(1);
    expect(logMock.mock.calls[0]?.[0]).toContain("\"rows\"");
    expect(logMock.mock.calls[0]?.[0]).toContain("\"includeBalances\": true");
  });

  it("prints grouped transactions as json with totals", async () => {
    await coinbaseTransactionsGroup("btc", { interval: "month", json: true });

    expect(tableMock).not.toHaveBeenCalled();
    expect(logMock).toHaveBeenCalledTimes(1);
    expect(logMock.mock.calls[0]?.[0]).toContain("\"totals\"");
  });

  it("selects transaction IDs from colon-separated id string", async () => {
    const rows = await coinbaseTransactionsId("id-1:id-2", { quiet: false });

    expect(selectCoinbaseTransactionsByIdsMock).toHaveBeenCalledWith(["id-1", "id-2"]);
    expect(tableMock).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
  });

  it("prints transaction ids as json", async () => {
    await coinbaseTransactionsId("id-1:id-2", { json: true });

    expect(tableMock).not.toHaveBeenCalled();
    expect(logMock).toHaveBeenCalledTimes(1);
    expect(logMock.mock.calls[0]?.[0]).toContain("\"ids\"");
  });

  it("throws for unsupported lot-id mode", async () => {
    await expect(coinbaseTransactionsId(undefined, { lotId: "abc" })).rejects.toThrow(
      "--lot-id is not yet migrated",
    );
  });

  it("imports statement csv rows in a transaction", async () => {
    const count = await coinbaseTransactionsStatement("/tmp/statement.csv", { normalize: true });

    expect(parseCoinbaseTransactionsStatementCsvMock).toHaveBeenCalledTimes(1);
    expect(insertCoinbaseTransactionsBatchMock).toHaveBeenCalledTimes(1);
    expect(count).toBe(2);
  });

  it("regenerates from csv directory with drop flow", async () => {
    const count = await coinbaseTransactionsRegenerate({ drop: true, normalize: true });

    expect(dropCoinbaseTransactionsTableMock).toHaveBeenCalledTimes(1);
    expect(createCoinbaseTransactionsTableMock).toHaveBeenCalledTimes(1);
    expect(truncateCoinbaseTransactionsTableMock).not.toHaveBeenCalled();
    expect(insertCoinbaseTransactionsBatchMock).toHaveBeenCalledTimes(1);
    expect(count).toBe(4);
  });

  it("inserts manual transaction when not dry-run", async () => {
    const rows = await coinbaseTransactionsManual("btc", {
      notes: "manual note",
      quantity: "1",
      timestamp: isoUtc({ year: 2026, month: 1, day: 1 }),
      type: "Buy",
      dryRun: false,
    });

    expect(insertCoinbaseTransactionsMock).toHaveBeenCalledTimes(1);
    expect(selectCoinbaseTransactionByIdMock).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([{ id: "manual-1" }]);
  });

  it("requires explicit remote flag for nav live calls", async () => {
    await expect(coinbaseTransactionsNav({})).rejects.toThrow("Missing source: use --remote");
  });

  it("computes nav from account balances and transaction cash flow", async () => {
    selectCoinbaseTransactionsMock
      .mockResolvedValueOnce([{ num_quantity: "1000" }])
      .mockResolvedValueOnce([{ num_quantity: "200" }]);
    selectCoinbaseTransactionsGroupMock.mockResolvedValueOnce([{ fee: "12.34" }]);

    const pnl = await coinbaseTransactionsNav({ remote: true, quiet: false });

    expect(requestAccountsMock).toHaveBeenCalledTimes(1);
    expect(requestProductMock).toHaveBeenCalledWith("BTC-USD");
    expect(tableMock).toHaveBeenCalledTimes(1);
    expect(pnl).toBe(5200);
  });
});
