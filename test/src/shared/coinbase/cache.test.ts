import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeOrderId } from "../../fixtures/identifiers.js";

const {
  mkdirSyncMock,
  loadJsonFromCacheMock,
  saveJsonToCacheMock,
} = vi.hoisted(() => ({
  mkdirSyncMock: vi.fn<(path: string, options?: { recursive?: boolean }) => void>(() => undefined),
  loadJsonFromCacheMock: vi.fn<(path: string) => unknown>(() => null),
  saveJsonToCacheMock: vi.fn<(path: string, data: object) => void>(() => undefined),
}));

vi.mock("node:fs", () => ({
  mkdirSync: mkdirSyncMock,
}));

vi.mock("../../../../src/shared/common/cache.js", () => ({
  cacheDir: "/tmp/helper-cache",
  loadJsonFromCache: loadJsonFromCacheMock,
  saveJsonToCache: saveJsonToCacheMock,
}));

import {
  coinbaseDir,
  coinbaseOrdersDir,
  coinbaseProductsDir,
  loadCoinbaseFromCache,
  saveCoinbaseToCache,
} from "../../../../src/shared/coinbase/cache/coinbase-cache.js";
import {
  loadProductFromCache,
  saveProductToCache,
} from "../../../../src/shared/coinbase/cache/product-cache.js";
import {
  loadOrderFromCache,
  saveOrderToCache,
} from "../../../../src/shared/coinbase/cache/order-cache.js";

const VALID_UUID = makeOrderId();

function validProduct() {
  return {
    product_id: "BTC-USD",
    price: "100.00",
    base_increment: "0.00000001",
    price_increment: "0.01",
    product_type: "SPOT",
  };
}

function validOrder() {
  return {
    order_id: VALID_UUID,
    product_id: "BTC-USD",
    side: "BUY",
    status: "OPEN",
    completion_percentage: "0",
    filled_size: "0",
    average_filled_price: "0",
    filled_value: "0",
    total_fees: "0",
    total_value_after_fees: "0",
    product_type: "SPOT",
    last_fill_time: null,
    order_type: "MARKET",
    order_configuration: {
      market_market_ioc: {
        base_size: "0.01",
      },
    },
  };
}

describe("coinbase cache helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds and initializes coinbase cache directories", () => {
    expect(coinbaseDir).toBe("/tmp/helper-cache/coinbase");
    expect(coinbaseProductsDir).toBe("/tmp/helper-cache/coinbase/products");
    expect(coinbaseOrdersDir).toBe("/tmp/helper-cache/coinbase/orders");
  });

  it("loads and saves general coinbase cache payloads", () => {
    loadJsonFromCacheMock.mockReturnValueOnce({ foo: "bar" });

    const loaded = loadCoinbaseFromCache("transaction_summary");
    saveCoinbaseToCache("transaction_summary", { ok: true });

    expect(loaded).toEqual({ foo: "bar" });
    expect(loadJsonFromCacheMock).toHaveBeenCalledWith("/tmp/helper-cache/coinbase/transaction_summary.json");
    expect(saveJsonToCacheMock).toHaveBeenCalledWith(
      "/tmp/helper-cache/coinbase/transaction_summary.json",
      { ok: true },
    );
  });

  it("loads and validates products from product cache", () => {
    loadJsonFromCacheMock.mockReturnValueOnce(validProduct());

    const product = loadProductFromCache("BTC-USD");
    expect(product).toMatchObject({ product_id: "BTC-USD" });
  });

  it("throws when product cache is missing", () => {
    loadJsonFromCacheMock.mockReturnValueOnce(null);

    expect(() => loadProductFromCache("BTC-USD")).toThrow("Cannot find product BTC-USD");
  });

  it("loads and validates orders from order cache", () => {
    loadJsonFromCacheMock.mockReturnValueOnce(validOrder());

    const order = loadOrderFromCache(VALID_UUID);
    expect(order).toMatchObject({ order_id: VALID_UUID, order_type: "MARKET" });
  });

  it("throws when order cache is missing", () => {
    loadJsonFromCacheMock.mockReturnValueOnce(null);

    expect(() => loadOrderFromCache(VALID_UUID)).toThrow(`Cannot find order ${VALID_UUID}`);
  });

  it("saves product and order cache payloads", () => {
    saveProductToCache("BTC-USD", { a: 1 });
    saveOrderToCache(VALID_UUID, { b: 2 });

    expect(saveJsonToCacheMock).toHaveBeenCalledWith("/tmp/helper-cache/coinbase/products/BTC-USD.json", { a: 1 });
    expect(saveJsonToCacheMock).toHaveBeenCalledWith(
      `/tmp/helper-cache/coinbase/orders/${VALID_UUID}.json`,
      { b: 2 },
    );
  });
});
