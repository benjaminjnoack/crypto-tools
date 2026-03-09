import { beforeEach, describe, expect, it, vi } from "vitest";

type ProductInstance = {
  base_increment: string;
  price_increment: string;
};

type CurrencyAccount = {
  available: string;
  hold: string;
  total: string;
};

type TransactionSummary = {
  fee_tier: {
    pricing_tier: string;
    taker_fee_rate: string;
    maker_fee_rate: string;
  };
};

type LimitTpSlOrderOptions = {
  baseSize: string;
  limitPrice: string;
  postOnly?: boolean;
  stopPrice: string;
  takeProfitPrice: string;
};

function toIncrementForTest(increment: string, value: number): string {
  if (increment === "1") {
    return Math.floor(value).toString();
  }
  const decimalIndex = increment.indexOf(".");
  const decimals = decimalIndex >= 0 ? increment.length - decimalIndex - 1 : 0;
  const factor = 10 ** decimals;
  const floored = Math.floor(value * factor + 1e-12) / factor;
  return floored.toFixed(decimals);
}

const {
  readlineQuestionMock,
  toIncrementMock,
  getProductInfoMock,
  getProductIdMock,
  requestCurrencyAccountMock,
  getTransactionSummaryMock,
  placeLimitTpSlOrderMock,
} = vi.hoisted(() => ({
  readlineQuestionMock: vi.fn(() => ""),
  toIncrementMock: vi.fn<(increment: string, value: number) => string>((increment: string, value: number) =>
    toIncrementForTest(increment, value)),
  getProductInfoMock: vi.fn<() => Promise<ProductInstance>>(() => Promise.resolve({
    base_increment: "0.00000001",
    price_increment: "0.01",
  })),
  getProductIdMock: vi.fn<(product: string) => string>((product: string) => `${product.toUpperCase()}-USD`),
  requestCurrencyAccountMock: vi.fn<() => Promise<CurrencyAccount>>(() => Promise.resolve({
    available: "1000.00",
    hold: "0.00",
    total: "1000.00",
  })),
  getTransactionSummaryMock: vi.fn<() => Promise<TransactionSummary>>(() => Promise.resolve({
    fee_tier: {
      pricing_tier: "tier_1",
      taker_fee_rate: "0.002",
      maker_fee_rate: "0.001",
    },
  })),
  placeLimitTpSlOrderMock: vi.fn<
    (productId: string, options: LimitTpSlOrderOptions) => Promise<void>
  >(() => Promise.resolve(undefined)),
}));

vi.mock("readline-sync", () => ({
  default: {
    question: readlineQuestionMock,
  },
}));

vi.mock("../../../../../src/shared/common/increment.js", () => ({
  toIncrement: toIncrementMock,
}));
vi.mock("../../../../../src/shared/coinbase/product-service.js", () => ({
  getProductInfo: getProductInfoMock,
  getProductId: getProductIdMock,
}));
vi.mock("../../../../../src/shared/coinbase/rest.js", () => ({
  requestCurrencyAccount: requestCurrencyAccountMock,
}));
vi.mock("../../../../../src/shared/coinbase/transaction-summary-service.js", () => ({
  getTransactionSummary: getTransactionSummaryMock,
}));
vi.mock("../../../../../src/apps/cb/service/order-service.js", () => ({
  placeLimitTpSlOrder: placeLimitTpSlOrderMock,
}));

import { handleFibAction } from "../../../../../src/apps/cb/commands/fib-handlers.js";
import type { FibOptions } from "../../../../../src/apps/cb/commands/schemas/command-options.js";

function fibOptions(overrides: Partial<FibOptions> = {}): FibOptions {
  return {
    allIn: false,
    bufferPercent: "0.1",
    dryRunFlag: false,
    entry: undefined,
    floor: "100",
    ceiling: "200",
    postOnly: true,
    round: false,
    riskPercent: "1",
    takeProfit: undefined,
    ...overrides,
  };
}

describe("handleFibAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readlineQuestionMock.mockReset();
    readlineQuestionMock.mockReturnValue("");
  });

  it("uses default prompted fib levels when selections are empty", async () => {
    await handleFibAction("btc", fibOptions());

    expect(placeLimitTpSlOrderMock).toHaveBeenCalledWith("BTC-USD", expect.objectContaining({
      limitPrice: "138.20",
      stopPrice: "99.90",
      takeProfitPrice: "261.80",
      postOnly: true,
    }));
    expect(readlineQuestionMock).toHaveBeenCalledTimes(2);
  });

  it("supports prompt selection by menu index", async () => {
    readlineQuestionMock
      .mockReturnValueOnce("3")
      .mockReturnValueOnce("1");

    await handleFibAction("btc", fibOptions());

    expect(placeLimitTpSlOrderMock).toHaveBeenCalledWith("BTC-USD", expect.objectContaining({
      limitPrice: "129.50",
      takeProfitPrice: "227.20",
    }));
  });

  it("rejects fib anchors that do not represent a long setup", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await handleFibAction("btc", fibOptions({
      floor: "200",
      ceiling: "100",
    }));

    expect(placeLimitTpSlOrderMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      "handleFibAction => fib1 (100) must be greater than fib0 (200) for spot long planning.",
    );
    errorSpy.mockRestore();
  });

  it("accepts decimal and shorthand extensions from options", async () => {
    await handleFibAction("btc", fibOptions({
      entry: "382",
      takeProfit: "618",
    }));

    expect(placeLimitTpSlOrderMock).toHaveBeenCalledWith("BTC-USD", expect.objectContaining({
      limitPrice: "138.20",
      takeProfitPrice: "261.80",
    }));
    expect(readlineQuestionMock).not.toHaveBeenCalled();
  });

  it("rejects non-configured entry extensions from options", async () => {
    await expect(handleFibAction("btc", fibOptions({
      entry: "386",
    }))).rejects.toThrow('Invalid entry extension "386". Use one of the configured extensions (decimal or shorthand).');

    expect(placeLimitTpSlOrderMock).not.toHaveBeenCalled();
  });

  it("rejects non-configured take-profit extensions from options", async () => {
    await expect(handleFibAction("btc", fibOptions({
      takeProfit: "386",
    }))).rejects.toThrow('Invalid take-profit extension "386". Use one of the configured extensions (decimal or shorthand).');

    expect(placeLimitTpSlOrderMock).not.toHaveBeenCalled();
  });

  it("rounds entry up and take-profit down with contextual buckets", async () => {
    await handleFibAction("btc", fibOptions({
      floor: "90000",
      ceiling: "100000",
      entry: "382",
      takeProfit: "618",
      round: true,
    }));

    expect(placeLimitTpSlOrderMock).toHaveBeenCalledWith("BTC-USD", expect.objectContaining({
      limitPrice: "93900.00",
      takeProfitPrice: "106100.00",
    }));
  });

  it("rounds BONK using one tick buckets from price increment", async () => {
    getProductInfoMock.mockResolvedValueOnce({
      base_increment: "1",
      price_increment: "0.00000001",
    });

    await handleFibAction("bonk", fibOptions({
      floor: "0.00000500",
      ceiling: "0.00000600",
      entry: "382",
      takeProfit: "618",
      round: true,
    }));

    expect(placeLimitTpSlOrderMock).toHaveBeenCalledWith("BONK-USD", expect.objectContaining({
      limitPrice: "0.00000539",
      takeProfitPrice: "0.00000661",
    }));
  });

  it("rounds ADA with contextual 0.0005 buckets", async () => {
    getProductInfoMock.mockResolvedValueOnce({
      base_increment: "0.00000001",
      price_increment: "0.0001",
    });

    await handleFibAction("ada", fibOptions({
      floor: "0.2",
      ceiling: "0.3",
      entry: "382",
      takeProfit: "618",
      round: true,
    }));

    expect(placeLimitTpSlOrderMock).toHaveBeenCalledWith("ADA-USD", expect.objectContaining({
      limitPrice: "0.2385",
      takeProfitPrice: "0.3615",
    }));
  });

  it("rounds SOL with contextual 0.1 buckets", async () => {
    getProductInfoMock.mockResolvedValueOnce({
      base_increment: "0.00000001",
      price_increment: "0.01",
    });

    await handleFibAction("sol", fibOptions({
      floor: "70",
      ceiling: "90",
      entry: "382",
      takeProfit: "618",
      round: true,
    }));

    expect(placeLimitTpSlOrderMock).toHaveBeenCalledWith("SOL-USD", expect.objectContaining({
      limitPrice: "77.70",
      takeProfitPrice: "102.30",
    }));
  });

  it("rounds ETH with contextual 5-dollar buckets", async () => {
    getProductInfoMock.mockResolvedValueOnce({
      base_increment: "0.00000001",
      price_increment: "0.01",
    });

    await handleFibAction("eth", fibOptions({
      floor: "1800",
      ceiling: "2100",
      entry: "382",
      takeProfit: "618",
      round: true,
    }));

    expect(placeLimitTpSlOrderMock).toHaveBeenCalledWith("ETH-USD", expect.objectContaining({
      limitPrice: "1915.00",
      takeProfitPrice: "2285.00",
    }));
  });
});
