import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  coinbaseBalancesRegenerateMock,
  coinbaseTransactionsRegenerateMock,
  cointrackerCapitalGainsRegenerateMock,
  cointrackerTransactionsRegenerateMock,
  loggerInfoMock,
  tableMock,
} = vi.hoisted(() => ({
  coinbaseBalancesRegenerateMock: vi.fn(() => Promise.resolve(3)),
  coinbaseTransactionsRegenerateMock: vi.fn(() => Promise.resolve(10)),
  cointrackerCapitalGainsRegenerateMock: vi.fn(() => Promise.resolve(5)),
  cointrackerTransactionsRegenerateMock: vi.fn(() => Promise.resolve(7)),
  loggerInfoMock: vi.fn(),
  tableMock: vi.fn(),
}));

vi.mock("../../../../../../src/apps/hdb/commands/coinbase/balances/coinbase-balances-handlers.js", () => ({
  coinbaseBalancesRegenerate: coinbaseBalancesRegenerateMock,
}));

vi.mock("../../../../../../src/apps/hdb/commands/coinbase/transactions/coinbase-transactions-handlers.js", () => ({
  coinbaseTransactionsRegenerate: coinbaseTransactionsRegenerateMock,
}));

vi.mock("../../../../../../src/apps/hdb/commands/cointracker/capital-gains/cointracker-capital-gains-handlers.js", () => ({
  cointrackerCapitalGainsRegenerate: cointrackerCapitalGainsRegenerateMock,
}));

vi.mock("../../../../../../src/apps/hdb/commands/cointracker/transactions/cointracker-transactions-handlers.js", () => ({
  cointrackerTransactionsRegenerate: cointrackerTransactionsRegenerateMock,
}));

vi.mock("../../../../../../src/shared/log/logger.js", () => ({
  logger: {
    info: loggerInfoMock,
  },
}));

import { systemRebuildAll } from "../../../../../../src/apps/hdb/commands/system/system-handlers.js";

describe("system rebuild-all handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "table").mockImplementation(tableMock);
  });

  it("runs all stages in order and prints a summary", async () => {
    const summary = await systemRebuildAll({
      drop: true,
      coinbaseTransactionsInputDir: "/tmp/cb",
      cointrackerTransactionsInputDir: "/tmp/ct-tx",
      cointrackerGainsInputDir: "/tmp/ct-gains",
    });

    expect(coinbaseTransactionsRegenerateMock).toHaveBeenCalledWith({
      drop: true,
      inputDir: "/tmp/cb",
      normalize: true,
      quiet: undefined,
    });
    expect(coinbaseBalancesRegenerateMock).toHaveBeenCalledWith({
      drop: true,
      quiet: undefined,
    });
    expect(cointrackerTransactionsRegenerateMock).toHaveBeenCalledWith({
      drop: true,
      inputDir: "/tmp/ct-tx",
      quiet: undefined,
    });
    expect(cointrackerCapitalGainsRegenerateMock).toHaveBeenCalledWith({
      drop: true,
      inputDir: "/tmp/ct-gains",
      quiet: undefined,
    });
    expect(summary.map((row) => row.stage)).toEqual([
      "coinbase transactions",
      "coinbase balances",
      "cointracker transactions",
      "cointracker capital gains",
    ]);
    expect(tableMock).toHaveBeenCalledTimes(1);
  });

  it("stops on first stage failure", async () => {
    cointrackerTransactionsRegenerateMock.mockRejectedValueOnce(new Error("boom"));

    await expect(systemRebuildAll({ quiet: true })).rejects.toThrow("boom");

    expect(coinbaseTransactionsRegenerateMock).toHaveBeenCalledTimes(1);
    expect(coinbaseBalancesRegenerateMock).toHaveBeenCalledTimes(1);
    expect(cointrackerTransactionsRegenerateMock).toHaveBeenCalledTimes(1);
    expect(cointrackerCapitalGainsRegenerateMock).not.toHaveBeenCalled();
    expect(tableMock).not.toHaveBeenCalled();
  });
});
