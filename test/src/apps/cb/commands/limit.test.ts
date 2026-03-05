import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  placeBracketOrderMock,
  placeLimitOrderMock,
  placeModifyOrderMock,
  placeStopLimitOrderMock,
  getProductIdMock,
  getProductInfoMock,
  requestBestBidAskMock,
  requestCurrencyAccountMock,
  toIncrementMock,
} = vi.hoisted(() => ({
  placeBracketOrderMock: vi.fn(() => Promise.resolve(undefined)),
  placeLimitOrderMock: vi.fn(() => Promise.resolve(undefined)),
  placeModifyOrderMock: vi.fn(() => Promise.resolve(undefined)),
  placeStopLimitOrderMock: vi.fn(() => Promise.resolve(undefined)),
  getProductIdMock: vi.fn((product: string) => {
    const upper = product.toUpperCase();
    return upper.includes("-") ? upper : `${upper}-USD`;
  }),
  getProductInfoMock: vi.fn(() => Promise.resolve({
    price_increment: "0.01",
  })),
  requestBestBidAskMock: vi.fn(() => Promise.resolve({
    asks: [{ price: "101.25" }],
    bids: [{ price: "101.00" }],
  })),
  requestCurrencyAccountMock: vi.fn(() => Promise.resolve({
    available: "1234.56",
    hold: "0.00",
    total: "1234.56",
  })),
  toIncrementMock: vi.fn((increment: string, value: number) => {
    const decimals = increment.includes(".") ? increment.split(".")[1]?.length ?? 0 : 0;
    return value.toFixed(decimals);
  }),
}));

vi.mock("../../../../../src/apps/cb/service/orders.js", () => ({
  placeBracketOrder: placeBracketOrderMock,
  placeLimitOrder: placeLimitOrderMock,
  placeModifyOrder: placeModifyOrderMock,
  placeStopLimitOrder: placeStopLimitOrderMock,
}));

vi.mock("../../../../../src/shared/coinbase/product.js", () => ({
  getProductId: getProductIdMock,
  getProductInfo: getProductInfoMock,
}));

vi.mock("../../../../../src/shared/coinbase/rest.js", () => ({
  requestBestBidAsk: requestBestBidAskMock,
  requestCurrencyAccount: requestCurrencyAccountMock,
}));

vi.mock("../../../../../src/shared/common/increment.js", () => ({
  toIncrement: toIncrementMock,
}));

import {
  handleAskAction,
  handleBidAction,
  handleBracketAction,
  handleLimitAction,
  handleMaxAction,
  handleModifyAction,
  handleStopAction,
} from "../../../../../src/apps/cb/commands/limit.js";

describe("limit command handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds ask-based sell limit options from best ask", async () => {
    await handleAskAction("btc", { baseSize: "0.2", postOnly: false });

    expect(placeLimitOrderMock).toHaveBeenCalledWith("BTC-USD", {
      baseSize: "0.2",
      limitPrice: "101.25",
      postOnly: false,
      sell: true,
      value: undefined,
    });
  });

  it("throws when ask book is empty", async () => {
    requestBestBidAskMock.mockResolvedValueOnce({ asks: [], bids: [{ price: "1" }] });
    await expect(handleAskAction("btc", { baseSize: "0.1" })).rejects.toThrow("No asking prices were found");
  });

  it("builds bid-based buy limit options from best bid", async () => {
    await handleBidAction("eth", { value: "100", postOnly: true });

    expect(placeLimitOrderMock).toHaveBeenCalledWith("ETH-USD", {
      baseSize: undefined,
      limitPrice: "101.00",
      buy: true,
      postOnly: true,
      value: "100",
    });
  });

  it("throws when bid book is empty", async () => {
    requestBestBidAskMock.mockResolvedValueOnce({ asks: [{ price: "1" }], bids: [] });
    await expect(handleBidAction("btc", { baseSize: "0.1" })).rejects.toThrow("No bidding prices were found.");
  });

  it("delegates bracket, limit, and stop handlers", async () => {
    await handleBracketAction("sol", { baseSize: "1", limitPrice: "200", stopPrice: "190" });
    await handleLimitAction("sol", { buy: true, limitPrice: "200", value: "1000" });
    await handleStopAction("sol", { baseSize: "1", limitPrice: "190", stopPrice: "200" });

    expect(placeBracketOrderMock).toHaveBeenCalledWith("SOL-USD", {
      baseSize: "1",
      limitPrice: "200",
      stopPrice: "190",
    });
    expect(placeLimitOrderMock).toHaveBeenCalledWith("SOL-USD", {
      buy: true,
      limitPrice: "200",
      value: "1000",
    });
    expect(placeStopLimitOrderMock).toHaveBeenCalledWith("SOL-USD", {
      baseSize: "1",
      limitPrice: "190",
      stopPrice: "200",
    });
  });

  it("delegates modify handler", async () => {
    await handleModifyAction("123e4567-e89b-42d3-a456-426614174000", {
      limitPrice: "101.50",
    });

    expect(placeModifyOrderMock).toHaveBeenCalledWith("123e4567-e89b-42d3-a456-426614174000", {
      limitPrice: "101.50",
    });
  });

  it("builds max order from bid + increment and rounds usd to nearest 500", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await handleMaxAction("btc");

    expect(getProductInfoMock).toHaveBeenCalledWith("BTC-USD");
    expect(requestCurrencyAccountMock).toHaveBeenCalledWith("USD", "0.01");
    expect(placeLimitOrderMock).toHaveBeenCalledWith("BTC-USD", {
      buy: true,
      limitPrice: "101.01",
      value: "1000.00",
    });
    expect(logSpy).toHaveBeenCalledWith("Bid price: 101.00");
    expect(logSpy).toHaveBeenCalledWith("Price Increment: 0.01");
    expect(logSpy).toHaveBeenCalledWith("Limit: 101.01");
    expect(logSpy).toHaveBeenCalledWith("USD balance: 1000.00");
    logSpy.mockRestore();
  });
});
