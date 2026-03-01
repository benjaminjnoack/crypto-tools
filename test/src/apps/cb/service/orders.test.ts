import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  readlineQuestionMock,
  getProductInfoMock,
  toIncrementMock,
  createMarketOrderMock,
  createLimitOrderMock,
  createLimitTpSlOrderMock,
  createBracketOrderMock,
  createStopLimitOrderMock,
} = vi.hoisted(() => ({
  readlineQuestionMock: vi.fn(() => "yes"),
  getProductInfoMock: vi.fn(() => Promise.resolve({
    base_increment: "0.00000001",
    price_increment: "0.01",
    price: "100.00",
  })),
  toIncrementMock: vi.fn((increment: string, value: number) => {
    const decimals = increment.includes(".") ? increment.split(".")[1]?.length ?? 0 : 0;
    const factor = 10 ** decimals;
    const floored = Math.floor(value * factor + 1e-12) / factor;
    return floored.toFixed(decimals);
  }),
  createMarketOrderMock: vi.fn(() => Promise.resolve("mkt-1")),
  createLimitOrderMock: vi.fn(() => Promise.resolve("lim-1")),
  createLimitTpSlOrderMock: vi.fn(() => Promise.resolve("tpsl-1")),
  createBracketOrderMock: vi.fn(() => Promise.resolve("bracket-1")),
  createStopLimitOrderMock: vi.fn(() => Promise.resolve("stop-1")),
}));

vi.mock("readline-sync", () => ({
  default: {
    question: readlineQuestionMock,
  },
}));

vi.mock("chalk", () => ({
  default: {
    green: (value: string) => value,
    red: (value: string) => value,
  },
}));

vi.mock("../../../../../src/shared/coinbase/product.js", () => ({
  getProductInfo: getProductInfoMock,
}));

vi.mock("../../../../../src/shared/common/increment.js", () => ({
  toIncrement: toIncrementMock,
}));

vi.mock("../../../../../src/shared/coinbase/order.js", () => ({
  createMarketOrder: createMarketOrderMock,
  createLimitOrder: createLimitOrderMock,
  createLimitTpSlOrder: createLimitTpSlOrderMock,
  createBracketOrder: createBracketOrderMock,
  createStopLimitOrder: createStopLimitOrderMock,
}));

import {
  placeBracketOrder,
  placeLimitOrder,
  placeLimitTpSlOrder,
  placeMarketOrder,
  placeStopLimitOrder,
} from "../../../../../src/apps/cb/service/orders.js";

describe("cb service orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("places a market buy order from baseSize when confirmed", async () => {
    await placeMarketOrder("BTC-USD", { buy: true, baseSize: "0.5" });

    expect(getProductInfoMock).toHaveBeenCalledWith("BTC-USD", true);
    expect(createMarketOrderMock).toHaveBeenCalledWith("BTC-USD", "BUY", "0.50000000");
  });

  it("does not place market order when prompt is declined", async () => {
    readlineQuestionMock.mockReturnValueOnce("no");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await placeMarketOrder("BTC-USD", { sell: true, value: "250" });

    expect(createMarketOrderMock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("Action canceled.");
    logSpy.mockRestore();
  });

  it("validates market order side and sizing requirements", async () => {
    await expect(placeMarketOrder("BTC-USD", { value: "100" })).rejects.toThrow(
      "You must specify either --buy or --sell.",
    );
    await expect(placeMarketOrder("BTC-USD", { buy: true })).rejects.toThrow(
      "You must specify either --baseSize or --value.",
    );
  });

  it("places a limit order and defaults postOnly to true", async () => {
    await placeLimitOrder("BTC-USD", { buy: true, limitPrice: "101", value: "1000" });

    expect(getProductInfoMock).toHaveBeenCalledWith("BTC-USD");
    expect(createLimitOrderMock).toHaveBeenCalledWith("BTC-USD", "BUY", "9.90099009", "101.00", true);
  });

  it("places limit TP/SL when confirmed and validates base size", async () => {
    await placeLimitTpSlOrder("BTC-USD", {
      baseSize: "0.25",
      limitPrice: "100",
      stopPrice: "95",
      takeProfitPrice: "120",
    });

    expect(createLimitTpSlOrderMock).toHaveBeenCalledWith(
      "BTC-USD",
      "0.25",
      "100",
      "95",
      "120",
      true,
    );

    await expect(placeLimitTpSlOrder("BTC-USD", {
      baseSize: "0",
      limitPrice: "100",
      stopPrice: "95",
      takeProfitPrice: "120",
    })).rejects.toThrow("Invalid base size or value provided.");
  });

  it("places bracket order and validates stop < limit", async () => {
    await placeBracketOrder("BTC-USD", {
      baseSize: "1",
      limitPrice: "110",
      stopPrice: "95",
    });

    expect(createBracketOrderMock).toHaveBeenCalledWith("BTC-USD", "SELL", "1.00000000", "110.00", "95.00");

    await expect(placeBracketOrder("BTC-USD", {
      baseSize: "1",
      limitPrice: "90",
      stopPrice: "95",
    })).rejects.toThrow("Stop price must be less than limit price");
  });

  it("places stop-limit order and defaults limit price to 1% below stop", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await placeStopLimitOrder("BTC-USD", {
      baseSize: "2",
      stopPrice: "100",
    } as unknown as Parameters<typeof placeStopLimitOrder>[1]);

    expect(logSpy).toHaveBeenCalledWith("WARNING: Defaulting limit price to 1% below stop price");
    expect(createStopLimitOrderMock).toHaveBeenCalledWith(
      "BTC-USD",
      "SELL",
      "2.00000000",
      "99.00",
      "100.00",
    );
    logSpy.mockRestore();
  });

  it("validates explicit stop-limit prices", async () => {
    await expect(placeStopLimitOrder("BTC-USD", {
      baseSize: "1",
      stopPrice: "100",
      limitPrice: "100",
    })).rejects.toThrow("Limit price must be less than stop price");
  });
});
