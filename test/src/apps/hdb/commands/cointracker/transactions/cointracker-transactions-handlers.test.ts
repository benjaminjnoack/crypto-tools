import { dateUtc, isoUtc } from "../../../../../fixtures/time.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getToAndFromDatesMock,
  createCointrackerTransactionsTableMock,
  dropCointrackerTransactionsTableMock,
  insertCointrackerTransactionsBatchMock,
  truncateCointrackerTransactionsTableMock,
  selectCointrackerTransactionsMock,
  selectCointrackerTransactionsGroupMock,
  parseCointrackerTransactionsCsvMock,
  cointrackerBalancesRegenerateMock,
  readdirMock,
  readFileMock,
  getClientMock,
  getEnvConfigMock,
  loggerInfoMock,
  loggerWarnMock,
  tableMock,
} = vi.hoisted(() => ({
  getToAndFromDatesMock: vi.fn(() => Promise.resolve({
    from: dateUtc({ year: 2026, month: 1, day: 1 }),
    to: dateUtc({ year: 2026, month: 1, day: 31 }),
  })),
  createCointrackerTransactionsTableMock: vi.fn(() => Promise.resolve(undefined)),
  dropCointrackerTransactionsTableMock: vi.fn(() => Promise.resolve(undefined)),
  insertCointrackerTransactionsBatchMock: vi.fn(() => Promise.resolve(undefined)),
  truncateCointrackerTransactionsTableMock: vi.fn(() => Promise.resolve(undefined)),
  selectCointrackerTransactionsMock: vi.fn(() => Promise.resolve([{ transaction_id: "tx-1", date: isoUtc({ year: 2026, month: 1, day: 2 }), type: "BUY", received_currency: "BTC", received_quantity: "1", sent_currency: "USD", sent_quantity: "50000", fee_amount: "10", realized_return: "0" }])),
  selectCointrackerTransactionsGroupMock: vi.fn(() => Promise.resolve([{ month: "2026-01-01", received: "1", sent: "2", fees: "3", returns: "4", net_returns: "1" }])),
  parseCointrackerTransactionsCsvMock: vi.fn(() => [
    {
      transaction_id: "tx-1",
      date: dateUtc({ year: 2026, month: 1, day: 1 }),
      type: "BUY",
      received_quantity: "1",
      received_currency: "BTC",
      received_cost_basis: "1",
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
  ]),
  cointrackerBalancesRegenerateMock: vi.fn(() => Promise.resolve(1)),
  readdirMock: vi.fn(() => Promise.resolve([] as string[])),
  readFileMock: vi.fn(() => Promise.resolve("csv")),
  getClientMock: vi.fn(() => Promise.resolve({
    connect: vi.fn(() => Promise.resolve({
      query: vi.fn(() => Promise.resolve(undefined)),
      release: vi.fn(),
    })),
  })),
  getEnvConfigMock: vi.fn(() => ({ HELPER_HDB_ROOT_DIR: "/tmp/hdb-root" })),
  loggerInfoMock: vi.fn(),
  loggerWarnMock: vi.fn(),
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
}));

vi.mock("../../../../../../../src/apps/hdb/db/cointracker/transactions/cointracker-transactions-repository.js", () => ({
  createCointrackerTransactionsTable: createCointrackerTransactionsTableMock,
  dropCointrackerTransactionsTable: dropCointrackerTransactionsTableMock,
  insertCointrackerTransactionsBatch: insertCointrackerTransactionsBatchMock,
  selectCointrackerTransactions: selectCointrackerTransactionsMock,
  selectCointrackerTransactionsGroup: selectCointrackerTransactionsGroupMock,
  truncateCointrackerTransactionsTable: truncateCointrackerTransactionsTableMock,
}));

vi.mock("../../../../../../../src/apps/hdb/db/cointracker/transactions/cointracker-transactions-mappers.js", () => ({
  parseCointrackerTransactionsCsv: parseCointrackerTransactionsCsvMock,
}));

vi.mock("../../../../../../../src/apps/hdb/db/db-client.js", () => ({
  getClient: getClientMock,
}));

vi.mock("../../../../../../../src/apps/hdb/commands/cointracker/balances/cointracker-balances-handlers.js", () => ({
  cointrackerBalancesRegenerate: cointrackerBalancesRegenerateMock,
}));

vi.mock("../../../../../../../src/shared/common/env.js", () => ({
  getEnvConfig: getEnvConfigMock,
}));

vi.mock("../../../../../../../src/shared/log/logger.js", () => ({
  logger: {
    info: loggerInfoMock,
    warn: loggerWarnMock,
  },
}));

import {
  cointrackerTransactions,
  cointrackerTransactionsGroup,
  cointrackerTransactionsRegenerate,
} from "../../../../../../../src/apps/hdb/commands/cointracker/transactions/cointracker-transactions-handlers.js";

describe("cointracker transaction handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "table").mockImplementation(tableMock);
  });

  it("normalizes filters and prints transaction rows", async () => {
    const rows = await cointrackerTransactions("btc:eth", {
      exclude: "usdc",
      includeBalances: true,
      quiet: false,
      received: "btc",
      sent: "usd",
      type: "buy:sell",
    });

    expect(getToAndFromDatesMock).toHaveBeenCalled();
    expect(selectCointrackerTransactionsMock).toHaveBeenCalledWith(
      {
        from: dateUtc({ year: 2026, month: 1, day: 1 }),
        to: dateUtc({ year: 2026, month: 1, day: 31 }),
        assets: ["BTC", "ETH"],
        excluded: ["USDC"],
        types: ["BUY", "SELL"],
        received: ["BTC"],
        sent: ["USD"],
      },
      true,
    );
    expect(tableMock).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
  });

  it("suppresses output when quiet=true", async () => {
    await cointrackerTransactions(undefined, { quiet: true });
    expect(tableMock).not.toHaveBeenCalled();
  });

  it("passes interval to grouped query and prints rows", async () => {
    const rows = await cointrackerTransactionsGroup("btc", {
      interval: "month",
      quiet: false,
    });

    expect(selectCointrackerTransactionsGroupMock).toHaveBeenCalledWith(
      {
        from: dateUtc({ year: 2026, month: 1, day: 1 }),
        to: dateUtc({ year: 2026, month: 1, day: 31 }),
        assets: ["BTC"],
        excluded: [],
        types: [],
        received: [],
        sent: [],
      },
      "month",
    );
    expect(tableMock).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
  });

  it("returns zero when no csv input files are found", async () => {
    readdirMock.mockResolvedValueOnce(["notes.txt"]);

    const count = await cointrackerTransactionsRegenerate({});

    expect(count).toBe(0);
    expect(loggerWarnMock).toHaveBeenCalledTimes(1);
    expect(insertCointrackerTransactionsBatchMock).not.toHaveBeenCalled();
  });

  it("regenerates from csv files with drop flow and batched insert transaction", async () => {
    const txQueryMock = vi.fn(() => Promise.resolve(undefined));
    const releaseMock = vi.fn();
    const connectMock = vi.fn(() => Promise.resolve({ query: txQueryMock, release: releaseMock }));
    getClientMock.mockResolvedValueOnce({ connect: connectMock });
    readdirMock.mockResolvedValueOnce(["a.csv", "b.csv"]);

    const count = await cointrackerTransactionsRegenerate({ drop: true });

    expect(count).toBe(2);
    expect(dropCointrackerTransactionsTableMock).toHaveBeenCalledTimes(1);
    expect(createCointrackerTransactionsTableMock).toHaveBeenCalledTimes(1);
    expect(truncateCointrackerTransactionsTableMock).not.toHaveBeenCalled();
    expect(parseCointrackerTransactionsCsvMock).toHaveBeenCalledTimes(2);
    expect(insertCointrackerTransactionsBatchMock).toHaveBeenCalledTimes(1);
    expect(cointrackerBalancesRegenerateMock).toHaveBeenCalledWith({ drop: true, quiet: undefined });
    expect(txQueryMock).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(txQueryMock).toHaveBeenNthCalledWith(2, "COMMIT");
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });
});
