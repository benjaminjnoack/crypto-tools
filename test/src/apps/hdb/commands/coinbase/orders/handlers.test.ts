import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  selectCoinbaseOrderMock,
  selectCoinbaseOrderByLastFillTimeMock,
  selectCoinbaseOrdersSumTotalFeesMock,
  insertCoinbaseOrderMock,
  getToAndFromDatesMock,
  printOrderMock,
  getProductIdMock,
  requestOrderMock,
  requestOrdersMock,
  readdirMock,
  loadOrderFromCacheMock,
  saveOrderToCacheMock,
  loggerInfoMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  selectCoinbaseOrderMock: vi.fn(() => Promise.resolve({ order_id: "id-1" })),
  selectCoinbaseOrderByLastFillTimeMock: vi.fn(() => Promise.resolve({ first: null, last: null })),
  selectCoinbaseOrdersSumTotalFeesMock: vi.fn(() => Promise.resolve(12.345)),
  insertCoinbaseOrderMock: vi.fn(() => Promise.resolve(undefined)),
  getToAndFromDatesMock: vi.fn(() => Promise.resolve({
    from: new Date("2026-01-01T00:00:00.000Z"),
    to: new Date("2026-01-31T00:00:00.000Z"),
  })),
  printOrderMock: vi.fn(),
  getProductIdMock: vi.fn((product: string) => `${product.toUpperCase()}-USD`),
  requestOrderMock: vi.fn(() => Promise.resolve({ order_id: "remote-order" })),
  requestOrdersMock: vi.fn<
    (status: string, source: string, productId: string | null, start: string, end: string) => Promise<Array<{ order_id: string }>>
  >(() => Promise.resolve([{ order_id: "o1" }, { order_id: "o2" }])),
  readdirMock: vi.fn(() => Promise.resolve([] as string[])),
  loadOrderFromCacheMock: vi.fn((orderId: string) => ({ order_id: orderId })),
  saveOrderToCacheMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    readdir: readdirMock,
  },
}));

vi.mock("../../../../../../../src/apps/hdb/db/coinbase/orders/repository.js", () => ({
  COINBASE_ORDERS_TABLE: "coinbase_orders",
  insertCoinbaseOrder: insertCoinbaseOrderMock,
  selectCoinbaseOrder: selectCoinbaseOrderMock,
  selectCoinbaseOrderByLastFillTime: selectCoinbaseOrderByLastFillTimeMock,
  selectCoinbaseOrdersSumTotalFees: selectCoinbaseOrdersSumTotalFeesMock,
}));

vi.mock("../../../../../../../src/apps/hdb/commands/shared/utils.js", () => ({
  COINBASE_EPOCH: "2024-01-01T00:00:00.000Z",
  getToAndFromDates: getToAndFromDatesMock,
}));

vi.mock("../../../../../../../src/shared/log/orders.js", () => ({
  printOrder: printOrderMock,
}));

vi.mock("../../../../../../../src/shared/coinbase/product.js", () => ({
  getProductId: getProductIdMock,
}));

vi.mock("../../../../../../../src/shared/log/logger.js", () => ({
  logger: {
    info: loggerInfoMock,
    error: loggerErrorMock,
  },
}));

vi.mock("../../../../../../../src/shared/coinbase/rest.js", () => ({
  requestOrder: requestOrderMock,
  requestOrders: requestOrdersMock,
}));

vi.mock("../../../../../../../src/shared/coinbase/cache.js", () => ({
  coinbaseOrdersDir: "/tmp/helper-cache/coinbase/orders",
  loadOrderFromCache: loadOrderFromCacheMock,
  saveOrderToCache: saveOrderToCacheMock,
}));

import {
  coinbaseOrders,
  coinbaseOrdersFees,
  coinbaseOrdersInsert,
  coinbaseOrdersUpdate,
} from "../../../../../../../src/apps/hdb/commands/coinbase/orders/handlers.js";

describe("hdb coinbase order handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and prints a single stored order", async () => {
    await coinbaseOrders("abc");
    expect(selectCoinbaseOrderMock).toHaveBeenCalledWith("abc");
    expect(printOrderMock).toHaveBeenCalledWith({ order_id: "id-1" });
  });

  it("computes fees with optional product mapping", async () => {
    await coinbaseOrdersFees("btc", { side: "BUY" } as { side?: "BUY" | "SELL" });

    expect(getProductIdMock).toHaveBeenCalledWith("btc");
    expect(selectCoinbaseOrdersSumTotalFeesMock).toHaveBeenCalledWith(
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-01-31T00:00:00.000Z"),
      "BTC-USD",
      "BUY",
    );
    expect(loggerInfoMock).toHaveBeenCalledWith("Fees: $12.35");
  });

  it("downloads one order then inserts it", async () => {
    await coinbaseOrdersInsert("remote-id");
    expect(requestOrderMock).toHaveBeenCalledWith("remote-id");
    expect(insertCoinbaseOrderMock).toHaveBeenCalledWith({ order_id: "remote-order" });
  });

  it("updates from cache source and inserts loaded orders", async () => {
    readdirMock.mockResolvedValueOnce(["a.json", "b.txt", "bad.json"]);
    loadOrderFromCacheMock
      .mockReturnValueOnce({ order_id: "a" })
      .mockImplementationOnce(() => {
        throw new Error("bad cache");
      });

    await coinbaseOrdersUpdate({ cache: true } as { cache?: boolean; rsync?: boolean });

    expect(loggerInfoMock).toHaveBeenCalledWith("Loading the orders from cache...");
    expect(loadOrderFromCacheMock).toHaveBeenCalledWith("a");
    expect(loadOrderFromCacheMock).toHaveBeenCalledWith("bad");
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
    expect(insertCoinbaseOrderMock).toHaveBeenCalledTimes(1);
    expect(insertCoinbaseOrderMock).toHaveBeenCalledWith({ order_id: "a" });
  });

  it("updates from exchange source, caches, then inserts", async () => {
    await coinbaseOrdersUpdate({ cache: false, rsync: false } as { cache?: boolean; rsync?: boolean });

    expect(requestOrdersMock).toHaveBeenCalledTimes(3);
    expect(saveOrderToCacheMock).toHaveBeenCalledTimes(6);
    expect(insertCoinbaseOrderMock).toHaveBeenCalledTimes(6);
    expect(loggerInfoMock).toHaveBeenCalledWith("Downloading orders from the exchange...");
    expect(loggerInfoMock).toHaveBeenCalledWith("Caching the orders on disk...");
  });

  it("uses rsync last-fill fallback to epoch when absent", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T12:00:00.000Z"));
    selectCoinbaseOrderByLastFillTimeMock.mockResolvedValueOnce({ first: null, last: null });

    await coinbaseOrdersUpdate({ cache: false, rsync: true } as { cache?: boolean; rsync?: boolean });

    const firstCall = requestOrdersMock.mock.calls[0];
    expect(firstCall?.[3]).toBe("2024-01-01T00:00:00.000Z");
    expect(firstCall?.[4]).toBe("2026-03-01T12:00:00.000Z");
    vi.useRealTimers();
  });
});
