import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requestProductMock,
  loadProductFromCacheMock,
  saveProductToCacheMock,
  printErrorMock,
  loggerInfoMock,
  loggerDebugMock,
  loggerWarnMock,
} = vi.hoisted(() => ({
  requestProductMock: vi.fn(() => Promise.resolve({
    product_id: "BTC-USD",
    price: "100.00",
    base_increment: "0.00000001",
    price_increment: "0.01",
    product_type: "SPOT",
  })),
  loadProductFromCacheMock: vi.fn(() => ({
    product_id: "BTC-USD",
    price: "99.00",
    base_increment: "0.00000001",
    price_increment: "0.01",
    product_type: "SPOT",
  })),
  saveProductToCacheMock: vi.fn(),
  printErrorMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  loggerDebugMock: vi.fn(),
  loggerWarnMock: vi.fn(),
}));

vi.mock("../../../../src/shared/coinbase/rest.js", () => ({
  requestProduct: requestProductMock,
}));

vi.mock("../../../../src/shared/coinbase/cache/product-cache.js", () => ({
  loadProductFromCache: loadProductFromCacheMock,
  saveProductToCache: saveProductToCacheMock,
}));

vi.mock("../../../../src/shared/log/error.js", () => ({
  printError: printErrorMock,
}));

vi.mock("../../../../src/shared/log/logger.js", () => ({
  logger: {
    info: loggerInfoMock,
    debug: loggerDebugMock,
    warn: loggerWarnMock,
  },
}));

import { getProductId, getProductInfo } from "../../../../src/shared/coinbase/product-service.js";

describe("coinbase product helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes product ids and defaults currency to USD", () => {
    expect(getProductId("btc")).toBe("BTC-USD");
    expect(getProductId("ETH-USD")).toBe("ETH-USD");
  });

  it("rejects invalid product id format", () => {
    expect(() => getProductId("btc1")).toThrow("Product must be uppercase letters followed by -USD");
  });

  it("forceUpdate fetches from API and saves cache", async () => {
    const result = await getProductInfo("BTC-USD", true);

    expect(requestProductMock).toHaveBeenCalledWith("BTC-USD");
    expect(saveProductToCacheMock).toHaveBeenCalledWith("BTC-USD", result);
    expect(loadProductFromCacheMock).not.toHaveBeenCalled();
    expect(loggerInfoMock).toHaveBeenCalledWith("getProductInfo => Force update for BTC-USD");
  });

  it("returns cached product on cache hit", async () => {
    const result = await getProductInfo("BTC-USD");

    expect(result).toMatchObject({ product_id: "BTC-USD", price: "99.00" });
    expect(loadProductFromCacheMock).toHaveBeenCalledWith("BTC-USD");
    expect(requestProductMock).not.toHaveBeenCalled();
    expect(saveProductToCacheMock).not.toHaveBeenCalled();
    expect(loggerDebugMock).toHaveBeenCalledWith("getProductInfo => Cache hit for BTC-USD");
  });

  it("fetches and caches when cache read throws", async () => {
    const cacheError = new Error("cache miss");
    loadProductFromCacheMock.mockImplementationOnce(() => {
      throw cacheError;
    });

    const result = await getProductInfo("BTC-USD");

    expect(printErrorMock).toHaveBeenCalledWith(cacheError);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      "getProductInfo => Cache miss for BTC-USD, fetching from Coinbase...",
    );
    expect(requestProductMock).toHaveBeenCalledWith("BTC-USD");
    expect(saveProductToCacheMock).toHaveBeenCalledWith("BTC-USD", result);
  });
});
