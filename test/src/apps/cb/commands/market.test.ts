import { beforeEach, describe, expect, it, vi } from "vitest";

const { placeMarketOrderMock, getProductIdMock } = vi.hoisted(() => ({
  placeMarketOrderMock: vi.fn(() => Promise.resolve(undefined)),
  getProductIdMock: vi.fn((product: string) => {
    const upper = product.toUpperCase();
    return upper.includes("-") ? upper : `${upper}-USD`;
  }),
}));

vi.mock("../../../../../src/apps/cb/service/orders.js", () => ({
  placeMarketOrder: placeMarketOrderMock,
}));

vi.mock("../../../../../src/shared/coinbase/product.js", () => ({
  getProductId: getProductIdMock,
}));

import { handleBuyAction, handleMarketAction, handleSellAction } from "../../../../../src/apps/cb/commands/market.js";

describe("market command handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps buy options and places a market buy order", async () => {
    await handleBuyAction("btc", { baseSize: "0.1", value: undefined });

    expect(placeMarketOrderMock).toHaveBeenCalledWith("BTC-USD", {
      buy: true,
      baseSize: "0.1",
      value: undefined,
    });
  });

  it("maps sell options and places a market sell order", async () => {
    await handleSellAction("eth", { baseSize: undefined, value: "250" });

    expect(placeMarketOrderMock).toHaveBeenCalledWith("ETH-USD", {
      sell: true,
      baseSize: undefined,
      value: "250",
    });
  });

  it("delegates handleMarketAction directly to placeMarketOrder", async () => {
    await handleMarketAction("sol", { buy: true, value: "100" });

    expect(placeMarketOrderMock).toHaveBeenCalledWith("SOL-USD", { buy: true, value: "100" });
  });
});
