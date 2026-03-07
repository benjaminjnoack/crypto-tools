import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getToAndFromDatesMock,
  selectCoinbaseTransactionsMock,
  selectCoinbaseTransactionsGroupMock,
  selectCoinbaseTransactionsByIdsMock,
  loggerWarnMock,
  tableMock,
  logMock,
} = vi.hoisted(() => ({
  getToAndFromDatesMock: vi.fn(() => Promise.resolve({
    from: new Date("2026-01-01T00:00:00.000Z"),
    to: new Date("2026-02-01T00:00:00.000Z"),
  })),
  selectCoinbaseTransactionsMock: vi.fn(() => Promise.resolve([
    {
      id: "tx-1",
      timestamp: new Date("2026-01-02T00:00:00.000Z"),
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
  selectCoinbaseTransactionsGroupMock: vi.fn(() => Promise.resolve([
    { month: "2026-01-01", quantity: "1", subtotal: "2", fee: "3", total: "5" },
  ])),
  selectCoinbaseTransactionsByIdsMock: vi.fn(() => Promise.resolve([
    {
      id: "tx-1",
      timestamp: new Date("2026-01-02T00:00:00.000Z"),
      type: "Buy",
      asset: "BTC",
      num_quantity: "0.10",
      num_price_at_tx: "50000",
      num_total: "5000",
      num_fee: "5",
      notes: "note",
    },
  ])),
  loggerWarnMock: vi.fn(),
  tableMock: vi.fn(),
  logMock: vi.fn(),
}));

vi.mock("../../../../../../../src/apps/hdb/commands/shared/date-range-utils.js", () => ({
  getToAndFromDates: getToAndFromDatesMock,
}));

vi.mock("../../../../../../../src/apps/hdb/db/coinbase/transactions/coinbase-transactions-repository.js", () => ({
  selectCoinbaseTransactions: selectCoinbaseTransactionsMock,
  selectCoinbaseTransactionsGroup: selectCoinbaseTransactionsGroupMock,
  selectCoinbaseTransactionsByIds: selectCoinbaseTransactionsByIdsMock,
}));

vi.mock("../../../../../../../src/shared/log/logger.js", () => ({
  logger: {
    warn: loggerWarnMock,
  },
}));

import {
  coinbaseTransactions,
  coinbaseTransactionsGroup,
  coinbaseTransactionsId,
} from "../../../../../../../src/apps/hdb/commands/coinbase/transactions/coinbase-transactions-handlers.js";

describe("hdb coinbase transaction handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "table").mockImplementation(tableMock);
    vi.spyOn(console, "log").mockImplementation(logMock);
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
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-02-01T00:00:00.000Z"),
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
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-02-01T00:00:00.000Z"),
        assets: ["BTC"],
        excluded: [],
        types: [],
        notTypes: [],
        selectManual: null,
        selectSynthetic: null,
      },
      "month",
    );
    expect(selectCoinbaseTransactionsGroupMock).toHaveBeenNthCalledWith(
      2,
      {
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-02-01T00:00:00.000Z"),
        assets: ["BTC"],
        excluded: [],
        types: [],
        notTypes: [],
        selectManual: null,
        selectSynthetic: null,
      },
    );
    expect(logMock).toHaveBeenCalledWith("Totals:");
    expect(tableMock).toHaveBeenCalledTimes(2);
    expect(rows).toHaveLength(1);
  });

  it("selects transaction IDs from colon-separated id string", async () => {
    const rows = await coinbaseTransactionsId("id-1:id-2", { quiet: false });

    expect(selectCoinbaseTransactionsByIdsMock).toHaveBeenCalledWith(["id-1", "id-2"]);
    expect(tableMock).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
  });

  it("throws for unsupported lot-id mode", async () => {
    await expect(coinbaseTransactionsId(undefined, { lotId: "abc" })).rejects.toThrow(
      "--lot-id is not yet migrated",
    );
  });
});
