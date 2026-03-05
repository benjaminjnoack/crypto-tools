import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requestTransactionSummaryMock,
  loadCoinbaseFromCacheMock,
  saveCoinbaseToCacheMock,
  loggerDebugMock,
  loggerWarnMock,
  loggerInfoMock,
} = vi.hoisted(() => ({
  requestTransactionSummaryMock: vi.fn(() => Promise.resolve({
    fee_tier: {
      pricing_tier: "tier_1",
      taker_fee_rate: "0.002",
      maker_fee_rate: "0.001",
    },
    total_balance: "1000.00",
    total_fees: 12.34,
    total_volume: 5678,
  })),
  loadCoinbaseFromCacheMock: vi.fn<(name: string) => unknown>(() => null),
  saveCoinbaseToCacheMock: vi.fn(),
  loggerDebugMock: vi.fn(),
  loggerWarnMock: vi.fn(),
  loggerInfoMock: vi.fn(),
}));

vi.mock("../../../../src/shared/coinbase/rest.js", () => ({
  requestTransactionSummary: requestTransactionSummaryMock,
}));

vi.mock("../../../../src/shared/coinbase/cache/coinbase-cache.js", () => ({
  loadCoinbaseFromCache: loadCoinbaseFromCacheMock,
  saveCoinbaseToCache: saveCoinbaseToCacheMock,
}));

vi.mock("../../../../src/shared/log/logger.js", () => ({
  logger: {
    debug: loggerDebugMock,
    warn: loggerWarnMock,
    info: loggerInfoMock,
  },
}));

async function loadModule() {
  return import("../../../../src/shared/coinbase/transaction-summary-service.js");
}

describe("transaction summary caching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("loads from API and then serves in-memory cache", async () => {
    loadCoinbaseFromCacheMock.mockReturnValueOnce(null);
    const { getTransactionSummary } = await loadModule();

    const first = await getTransactionSummary();
    const second = await getTransactionSummary();

    expect(first).toEqual(second);
    expect(loadCoinbaseFromCacheMock).toHaveBeenCalledTimes(1);
    expect(requestTransactionSummaryMock).toHaveBeenCalledTimes(1);
    expect(saveCoinbaseToCacheMock).toHaveBeenCalledWith("transaction_summary", first);
    expect(loggerDebugMock).toHaveBeenCalledWith("getTransactionSummary => cached in memory");
  });

  it("uses valid disk cache without API request", async () => {
    const cached = {
      fee_tier: {
        pricing_tier: "tier_2",
        taker_fee_rate: "0.002",
        maker_fee_rate: "0.001",
      },
      total_balance: "2222.22",
      total_fees: 10.01,
      total_volume: 111,
    };
    loadCoinbaseFromCacheMock.mockReturnValueOnce(cached);
    const { getTransactionSummary } = await loadModule();

    const result = await getTransactionSummary();

    expect(result).toEqual(cached);
    expect(requestTransactionSummaryMock).not.toHaveBeenCalled();
    expect(saveCoinbaseToCacheMock).not.toHaveBeenCalled();
    expect(loggerDebugMock).toHaveBeenCalledWith("getTransactionSummary => cached on disk");
  });

  it("refreshes when disk cache is invalid", async () => {
    loadCoinbaseFromCacheMock.mockReturnValueOnce({ bad: "shape" });
    const { getTransactionSummary } = await loadModule();

    const result = await getTransactionSummary();

    expect(loggerWarnMock).toHaveBeenCalledWith("getTransactionSummary => cached data invalid, refreshing");
    expect(requestTransactionSummaryMock).toHaveBeenCalledTimes(1);
    expect(saveCoinbaseToCacheMock).toHaveBeenCalledWith("transaction_summary", result);
  });
});
