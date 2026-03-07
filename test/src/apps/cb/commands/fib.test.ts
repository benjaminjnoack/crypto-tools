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
    fib0: "100",
    fib1: "200",
    postOnly: true,
    riskPercent: "1",
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
      .mockReturnValueOnce("2")
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
      fib0: "200",
      fib1: "100",
    }));

    expect(placeLimitTpSlOrderMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      "handleFibAction => fib1 (100) must be greater than fib0 (200) for spot long planning.",
    );
    errorSpy.mockRestore();
  });
});
