import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getProductIdMock,
  getProductInfoMock,
  requestMarketTradesMock,
} = vi.hoisted(() => ({
  getProductIdMock: vi.fn((product: string) => {
    const upper = product.toUpperCase();
    return upper.includes("-") ? upper : `${upper}-USD`;
  }),
  getProductInfoMock: vi.fn(() => Promise.resolve({ product_id: "BTC-USD", price: "100.00" })),
  requestMarketTradesMock: vi.fn(() => Promise.resolve({
    trades: [{ price: "123.45" }],
    best_bid: "123.40",
    best_ask: "123.50",
  })),
}));

vi.mock("../../../../../src/shared/coinbase/product-service.js", () => ({
  getProductId: getProductIdMock,
  getProductInfo: getProductInfoMock,
}));

vi.mock("../../../../../src/shared/coinbase/rest.js", () => ({
  requestMarketTrades: requestMarketTradesMock,
}));

import { handlePriceAction, handleProductAction } from "../../../../../src/apps/cb/commands/product-handlers.js";

describe("products command handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prints product info for the requested product", async () => {
    const dirSpy = vi.spyOn(console, "dir").mockImplementation(() => undefined);

    await handleProductAction("btc");

    expect(getProductIdMock).toHaveBeenCalledWith("btc");
    expect(getProductInfoMock).toHaveBeenCalledWith("BTC-USD");
    expect(dirSpy).toHaveBeenCalledWith({ product_id: "BTC-USD", price: "100.00" });

    dirSpy.mockRestore();
  });

  it("prints a one-row price table using latest trade and book prices", async () => {
    const tableSpy = vi.spyOn(console, "table").mockImplementation(() => undefined);

    await handlePriceAction("eth");

    expect(getProductIdMock).toHaveBeenCalledWith("eth");
    expect(requestMarketTradesMock).toHaveBeenCalledWith("ETH-USD", 1);
    expect(tableSpy).toHaveBeenCalledWith([
      {
        Product: "ETH-USD",
        Price: "123.45",
        Bid: "123.40",
        Ask: "123.50",
      },
    ]);

    tableSpy.mockRestore();
  });

  it("prints product info as json", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await handleProductAction("btc", { json: true });

    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({
      row: { product_id: "BTC-USD", price: "100.00" },
      meta: {
        productId: "BTC-USD",
        view: "product",
      },
    }, null, 2));
    logSpy.mockRestore();
  });

  it("prints price info as json", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await handlePriceAction("eth", { json: true });

    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({
      row: {
        productId: "ETH-USD",
        price: "123.45",
        bid: "123.40",
        ask: "123.50",
      },
      meta: {
        productId: "ETH-USD",
        view: "price",
      },
    }, null, 2));
    logSpy.mockRestore();
  });

  it("throws when no trades are returned", async () => {
    requestMarketTradesMock.mockResolvedValueOnce({
      trades: [],
      best_bid: "100.00",
      best_ask: "100.10",
    });

    await expect(handlePriceAction("btc")).rejects.toThrow("Trades not found");
  });
});
