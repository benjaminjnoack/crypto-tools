import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getToAndFromDatesMock,
  traceCoinbaseBalanceLedgerMock,
  selectCoinbaseTransactionsMock,
  selectCoinbaseTransactionsByIdsMock,
  selectCoinbaseTransactionsDistinctAssetMock,
  tableMock,
  loggerInfoMock,
  writeCoinbaseLotsCsvMock,
  writeCoinbaseLotsF8949Mock,
} = vi.hoisted(() => ({
  getToAndFromDatesMock: vi.fn(() => Promise.resolve({
    from: new Date("2026-01-01T00:00:00.000Z"),
    to: new Date("2026-02-01T00:00:00.000Z"),
  })),
  traceCoinbaseBalanceLedgerMock: vi.fn(() => Promise.resolve([
    { id: "1", asset: "BTC", timestamp: new Date("2025-12-01T00:00:00.000Z"), balance: "0", tx_id: "synthetic-zero-BTC", notes: "seed" },
    { id: "2", asset: "BTC", timestamp: new Date("2025-12-15T00:00:00.000Z"), balance: "2", tx_id: "buy-old", notes: "buy" },
  ])),
  selectCoinbaseTransactionsMock: vi.fn(() => Promise.resolve([
    {
      id: "sell-1",
      timestamp: new Date("2026-01-05T00:00:00.000Z"),
      type: "Sell",
      asset: "BTC",
      num_quantity: "1",
      num_price_at_tx: "110",
      num_fee: "1",
      notes: "sell",
    },
  ])),
  selectCoinbaseTransactionsByIdsMock: vi.fn(() => Promise.resolve([
    {
      id: "buy-old",
      timestamp: new Date("2025-12-15T00:00:00.000Z"),
      type: "Buy",
      asset: "BTC",
      num_quantity: "2",
      num_price_at_tx: "100",
      num_fee: "2",
      notes: "buy",
    },
  ])),
  selectCoinbaseTransactionsDistinctAssetMock: vi.fn(() => Promise.resolve(["BTC", "ETH2", "USDC"])),
  tableMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  writeCoinbaseLotsCsvMock: vi.fn(() => Promise.resolve(undefined)),
  writeCoinbaseLotsF8949Mock: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock("../../../../../../../src/apps/hdb/commands/shared/date-range-utils.js", () => ({
  DUST_THRESHOLD: 1e-8,
  getToAndFromDates: getToAndFromDatesMock,
}));

vi.mock("../../../../../../../src/apps/hdb/db/coinbase/balances/coinbase-balances-repository.js", () => ({
  traceCoinbaseBalanceLedger: traceCoinbaseBalanceLedgerMock,
}));

vi.mock("../../../../../../../src/apps/hdb/db/coinbase/transactions/coinbase-transactions-repository.js", () => ({
  selectCoinbaseTransactions: selectCoinbaseTransactionsMock,
  selectCoinbaseTransactionsByIds: selectCoinbaseTransactionsByIdsMock,
  selectCoinbaseTransactionsDistinctAsset: selectCoinbaseTransactionsDistinctAssetMock,
}));

vi.mock("../../../../../../../src/shared/log/logger.js", () => ({
  logger: {
    info: loggerInfoMock,
  },
}));

vi.mock("../../../../../../../src/shared/common/env.js", () => ({
  getEnvConfig: vi.fn(() => ({ HELPER_HDB_ROOT_DIR: "/tmp/hdb-root" })),
}));

vi.mock("../../../../../../../src/apps/hdb/commands/coinbase/lots/coinbase-lots-export.js", () => ({
  buildCoinbaseLotsDateRangeFilename: vi.fn(() => "2026-01-01_2026-02-01"),
  resolveCoinbaseLotsOutputDir: vi.fn(() => "/tmp/hdb-root/output/coinbase-lots"),
  writeCoinbaseLotsCsv: writeCoinbaseLotsCsvMock,
  writeCoinbaseLotsF8949: writeCoinbaseLotsF8949Mock,
}));

import {
  coinbaseLots,
  coinbaseLotsBatch,
  coinbaseLotsBatchCompare,
  coinbaseLotsCompare,
} from "../../../../../../../src/apps/hdb/commands/coinbase/lots/coinbase-lots-handlers.js";

describe("coinbase lots handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "table").mockImplementation(tableMock);
  });

  it("calculates lots for an asset and prints table", async () => {
    const lots = await coinbaseLots("btc", { quiet: false, totals: true, balance: true });

    expect(selectCoinbaseTransactionsMock).toHaveBeenCalledTimes(1);
    expect(traceCoinbaseBalanceLedgerMock).toHaveBeenCalledTimes(1);
    expect(selectCoinbaseTransactionsByIdsMock).toHaveBeenCalledWith(["buy-old"]);
    expect(tableMock).toHaveBeenCalled();
    expect(loggerInfoMock).toHaveBeenCalledWith("Remaining Balance: 1");
    expect(lots).toHaveLength(1);
  });

  it("writes csv and f8949 exports when requested", async () => {
    await coinbaseLots("btc", { csv: true, f8949: true, pages: true, totals: true, notes: true, obfuscate: true });

    expect(writeCoinbaseLotsCsvMock).toHaveBeenCalledTimes(1);
    expect(writeCoinbaseLotsCsvMock).toHaveBeenCalledWith(
      "/tmp/hdb-root/output/coinbase-lots",
      "coinbase_lots_BTC_2026-01-01_2026-02-01",
      expect.any(Array),
      {
        includeBalance: false,
        includeNotes: true,
        obfuscate: true,
      },
    );
    expect(writeCoinbaseLotsF8949Mock).toHaveBeenCalledTimes(1);
    expect(writeCoinbaseLotsF8949Mock).toHaveBeenCalledWith(
      "/tmp/hdb-root/output/coinbase-lots",
      "coinbase_lots_BTC_2026-01-01_2026-02-01",
      expect.any(Array),
      {
        includeTotals: true,
        includePages: true,
      },
    );
  });

  it("runs batch and compare variants", async () => {
    const batch = await coinbaseLotsBatch({ quiet: true });
    const compare = await coinbaseLotsCompare("btc", { quiet: true });
    const batchCompare = await coinbaseLotsBatchCompare({ quiet: true });

    expect(selectCoinbaseTransactionsDistinctAssetMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(batch.length).toBeGreaterThan(0);
    expect(compare).toHaveProperty("FIFO");
    expect(batchCompare).toHaveProperty("HIFO");
  });
});
