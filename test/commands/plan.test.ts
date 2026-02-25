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
  getProductInfoMock,
  getProductIdMock,
  requestCurrencyAccountMock,
  getTransactionSummaryMock,
  placeLimitTpSlOrderMock,
} = vi.hoisted(() => ({
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

vi.mock("cb-lib", () => {
  return {
    toIncrement: toIncrementForTest,
    getProductInfo: getProductInfoMock,
    getProductId: getProductIdMock,
    requestCurrencyAccount: requestCurrencyAccountMock,
    getTransactionSummary: getTransactionSummaryMock,
  };
});

vi.mock("../../src/shared/common/increment.js", () => ({
  toIncrement: toIncrementForTest,
}));
vi.mock("../../src/shared/coinbase/product.js", () => ({
  getProductInfo: getProductInfoMock,
  getProductId: getProductIdMock,
}));
vi.mock("../../src/shared/coinbase/rest.js", () => ({
  requestCurrencyAccount: requestCurrencyAccountMock,
}));
vi.mock("../../src/shared/coinbase/transaction_summary.js", () => ({
  getTransactionSummary: getTransactionSummaryMock,
}));
vi.mock("../../src/apps/cb/service/orders.js", () => ({
  placeLimitTpSlOrder: placeLimitTpSlOrderMock,
}));

import { buildTradePlan, handlePlanAction } from "../../src/apps/cb/commands/plan.js";
import type { PlanOptions } from "../../src/apps/cb/commands/schemas/options.js";

function baseInput(overrides: Partial<Parameters<typeof buildTradePlan>[0]> = {}) {
  return {
    product: "btc",
    baseIncrement: "0.00000001",
    priceIncrement: "0.01",
    buyPrice: 100,
    stopPrice: 95,
    takeProfitPrice: 120,
    bufferPercent: 0,
    riskPercent: 1,
    allIn: false,
    usdBalance: 10000,
    makerFeeRate: 0.001,
    takerFeeRate: 0.002,
    ...overrides,
  };
}

describe("buildTradePlan", () => {
  it("builds a valid risk-sized trade plan", () => {
    const result = buildTradePlan(baseInput());

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }

    expect(result.allIn).toBe(false);
    expect(result.warnings).toEqual([]);
    expect(result.buyPrice).toBe("100.00");
    expect(result.stopPrice).toBe("95.00");
    expect(result.takeProfitPrice).toBe("120.00");
    expect(result.maxRiskAmount).toBeCloseTo(100, 8);
    expect(result.actualRisk).toBeLessThanOrEqual(result.maxRiskAmount + 0.01);
    expect(result.orderOptions.limitPrice).toBe("100.00");
    expect(result.orderOptions.stopPrice).toBe("95.00");
    expect(result.orderOptions.takeProfitPrice).toBe("120.00");
    expect(parseFloat(result.orderOptions.baseSize)).toBeGreaterThan(0);
  });

  it("applies stop buffer and reports warning", () => {
    const result = buildTradePlan(baseInput({ bufferPercent: 10 }));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }

    expect(result.warnings).toEqual(["Adding 10.00% buffer to stop"]);
    expect(result.stopPrice).toBe("85.50");
  });

  it("returns failure when stop price is greater than or equal to buy price", () => {
    const result = buildTradePlan(baseInput({ stopPrice: 100 }));

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }

    expect(result.error).toContain("cannot be greater than or equal to buyPrice");
  });

  it("returns failure when take profit price is less than or equal to buy price", () => {
    const result = buildTradePlan(baseInput({ takeProfitPrice: 100 }));

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }

    expect(result.error).toContain("cannot be less than or equal to buyPrice");
  });

  it("returns failure when incremented stop price equals incremented buy price", () => {
    const result = buildTradePlan(baseInput({
      priceIncrement: "1",
      buyPrice: 100.9,
      stopPrice: 100.1,
      takeProfitPrice: 120.9,
    }));

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }

    expect(result.error).toContain("cannot be greater than or equal to buyPrice");
  });

  it("returns failure when incremented take profit equals incremented buy price", () => {
    const result = buildTradePlan(baseInput({
      priceIncrement: "1",
      buyPrice: 100.9,
      stopPrice: 99.9,
      takeProfitPrice: 100.95,
    }));

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }

    expect(result.error).toContain("cannot be less than or equal to buyPrice");
  });

  it("supports all-in sizing and can exceed requested risk cap", () => {
    const result = buildTradePlan(
      baseInput({
        allIn: true,
        riskPercent: 0.25,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }

    expect(result.allIn).toBe(true);
    expect(result.maxRiskAmount).toBeCloseTo(25, 8);
    expect(result.actualRisk).toBeGreaterThan(result.maxRiskAmount);
    expect(result.effectiveRiskPercent).toBeGreaterThan(0);
  });

  it("adjusts position to fit available USD when risk sizing would exceed balance", () => {
    const result = buildTradePlan(
      baseInput({
        usdBalance: 1000,
        buyPrice: 100,
        stopPrice: 99,
        riskPercent: 50,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }

    expect(result.adjustedForUsdBalance).toBe(true);
    expect(result.totalCostWithFee).toBeLessThanOrEqual(1000 + 1e-8);
  });
});

describe("handlePlanAction", () => {
  const baseOptions: PlanOptions = {
    buyPrice: "100",
    bufferPercent: "0.1",
    stopPrice: "95",
    takeProfitPrice: "120",
    riskPercent: "0.25",
    allIn: false,
    dryRunFlag: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not place an order in dry run mode", async () => {
    const pauseSpy = vi.spyOn(process.stdin, "pause").mockImplementation(() => process.stdin);

    await handlePlanAction("btc", { ...baseOptions, dryRunFlag: true });

    expect(placeLimitTpSlOrderMock).not.toHaveBeenCalled();
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    pauseSpy.mockRestore();
  });

  it("places a limit TP/SL order when plan succeeds in live mode", async () => {
    await handlePlanAction("btc", baseOptions);

    expect(placeLimitTpSlOrderMock).toHaveBeenCalledTimes(1);
    const firstCall = placeLimitTpSlOrderMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) {
      throw new Error("Expected placeLimitTpSlOrder to be called");
    }
    const [productId, orderOptions] = firstCall;
    expect(productId).toBe("BTC-USD");
    expect(orderOptions.limitPrice).toBe("100.00");
    expect(orderOptions.stopPrice).toBe("94.90");
    expect(orderOptions.takeProfitPrice).toBe("120.00");
    expect(orderOptions.postOnly).toBe(true);
    expect(parseFloat(orderOptions.baseSize)).toBeGreaterThan(0);
  });
});
