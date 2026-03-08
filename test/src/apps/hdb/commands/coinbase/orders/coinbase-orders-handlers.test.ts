import { dateUtc, isoUtc } from "../../../../../fixtures/time.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  selectCoinbaseOrderMock,
  selectCoinbaseOrderByLastFillTimeMock,
  selectCoinbaseOrdersSumTotalFeesMock,
  createCoinbaseOrdersTableMock,
  dropCoinbaseOrdersTableMock,
  insertCoinbaseOrderMock,
  truncateCoinbaseOrdersTableMock,
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
  loggerWarnMock,
} = vi.hoisted(() => ({
  selectCoinbaseOrderMock: vi.fn(() => Promise.resolve({ order_id: "id-1" })),
  selectCoinbaseOrderByLastFillTimeMock: vi.fn(() => Promise.resolve({ first: null, last: null })),
  selectCoinbaseOrdersSumTotalFeesMock: vi.fn(() => Promise.resolve(12.345)),
  createCoinbaseOrdersTableMock: vi.fn(() => Promise.resolve(undefined)),
  dropCoinbaseOrdersTableMock: vi.fn(() => Promise.resolve(undefined)),
  insertCoinbaseOrderMock: vi.fn(() => Promise.resolve(undefined)),
  truncateCoinbaseOrdersTableMock: vi.fn(() => Promise.resolve(undefined)),
  getToAndFromDatesMock: vi.fn(() => Promise.resolve({
    from: dateUtc({ year: 2026, month: 1, day: 1 }),
    to: dateUtc({ year: 2026, month: 1, day: 31 }),
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
  loggerWarnMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    readdir: readdirMock,
  },
}));

vi.mock("../../../../../../../src/apps/hdb/db/coinbase/orders/coinbase-orders-repository.js", () => ({
  COINBASE_ORDERS_TABLE: "coinbase_orders",
  createCoinbaseOrdersTable: createCoinbaseOrdersTableMock,
  dropCoinbaseOrdersTable: dropCoinbaseOrdersTableMock,
  insertCoinbaseOrder: insertCoinbaseOrderMock,
  selectCoinbaseOrder: selectCoinbaseOrderMock,
  selectCoinbaseOrderByLastFillTime: selectCoinbaseOrderByLastFillTimeMock,
  selectCoinbaseOrdersSumTotalFees: selectCoinbaseOrdersSumTotalFeesMock,
  truncateCoinbaseOrdersTable: truncateCoinbaseOrdersTableMock,
}));

vi.mock("../../../../../../../src/apps/hdb/commands/shared/date-range-utils.js", () => ({
  COINBASE_EPOCH: isoUtc({ year: 2024, month: 1, day: 1 }),
  getToAndFromDates: getToAndFromDatesMock,
}));

vi.mock("../../../../../../../src/shared/log/orders.js", () => ({
  printOrder: printOrderMock,
}));

vi.mock("../../../../../../../src/shared/coinbase/product-service.js", () => ({
  getProductId: getProductIdMock,
}));

vi.mock("../../../../../../../src/shared/log/logger.js", () => ({
  logger: {
    info: loggerInfoMock,
    error: loggerErrorMock,
    warn: loggerWarnMock,
  },
}));

vi.mock("../../../../../../../src/shared/coinbase/rest.js", () => ({
  requestOrder: requestOrderMock,
  requestOrders: requestOrdersMock,
}));

vi.mock("../../../../../../../src/shared/coinbase/cache/coinbase-cache.js", () => ({
  coinbaseOrdersDir: "/tmp/helper-cache/coinbase/orders",
}));

vi.mock("../../../../../../../src/shared/coinbase/cache/order-cache.js", () => ({
  loadOrderFromCache: loadOrderFromCacheMock,
  saveOrderToCache: saveOrderToCacheMock,
}));

import {
  coinbaseOrders,
  coinbaseOrdersFees,
  coinbaseOrdersInsert,
  coinbaseOrdersObject,
  coinbaseOrdersRegenerate,
  coinbaseOrdersUpdate,
} from "../../../../../../../src/apps/hdb/commands/coinbase/orders/coinbase-orders-handlers.js";

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
      dateUtc({ year: 2026, month: 1, day: 1 }),
      dateUtc({ year: 2026, month: 1, day: 31 }),
      "BTC-USD",
      "BUY",
    );
    expect(loggerInfoMock).toHaveBeenCalledWith("Fees: $12.35");
  });

  it("prints reconstructed order object", async () => {
    const dirMock = vi.spyOn(console, "dir").mockImplementation(() => undefined);
    const value = await coinbaseOrdersObject("abc");
    expect(selectCoinbaseOrderMock).toHaveBeenCalledWith("abc");
    expect(dirMock).toHaveBeenCalledTimes(1);
    expect(value).toEqual({ order_id: "id-1" });
  });

  it("downloads one order then inserts it", async () => {
    await coinbaseOrdersInsert("remote-id", { remote: true, yes: true });
    expect(requestOrderMock).toHaveBeenCalledWith("remote-id");
    expect(insertCoinbaseOrderMock).toHaveBeenCalledWith({ order_id: "remote-order" });
  });

  it("refuses live insert without --remote --yes", async () => {
    await expect(coinbaseOrdersInsert("remote-id", {})).rejects.toThrow(
      "Missing source: use --remote for live Coinbase requests.",
    );
    await expect(coinbaseOrdersInsert("remote-id", { remote: true })).rejects.toThrow(
      "Refusing live Coinbase request without confirmation. Re-run with --remote --yes.",
    );
  });

  it("updates from cache source and inserts loaded orders", async () => {
    readdirMock.mockResolvedValueOnce(["a.json", "b.txt", "bad.json"]);
    loadOrderFromCacheMock
      .mockReturnValueOnce({ order_id: "a" })
      .mockImplementationOnce(() => {
        throw new Error("bad cache");
      });

    await coinbaseOrdersUpdate({ cache: true } as { cache?: boolean; remote?: boolean; rsync?: boolean });

    expect(loggerInfoMock).toHaveBeenCalledWith("Loading the orders from cache...");
    expect(loadOrderFromCacheMock).toHaveBeenCalledWith("a");
    expect(loadOrderFromCacheMock).toHaveBeenCalledWith("bad");
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
    expect(insertCoinbaseOrderMock).toHaveBeenCalledTimes(1);
    expect(insertCoinbaseOrderMock).toHaveBeenCalledWith({ order_id: "a" });
  });

  it("updates from exchange source, caches, then inserts", async () => {
    await coinbaseOrdersUpdate({ remote: true, yes: true, rsync: false } as { cache?: boolean; remote?: boolean; yes?: boolean; rsync?: boolean });

    expect(requestOrdersMock).toHaveBeenCalledTimes(3);
    expect(saveOrderToCacheMock).toHaveBeenCalledTimes(6);
    expect(insertCoinbaseOrderMock).toHaveBeenCalledTimes(2);
    expect(loggerInfoMock).toHaveBeenCalledWith("Downloading orders from the exchange...");
    expect(loggerInfoMock).toHaveBeenCalledWith("Caching the orders on disk...");
  });

  it("uses rsync last-fill fallback to epoch when absent", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(dateUtc({ year: 2026, month: 3, day: 1, hour: 12 }));
    selectCoinbaseOrderByLastFillTimeMock.mockResolvedValueOnce({ first: null, last: null });

    await coinbaseOrdersUpdate({ remote: true, yes: true, rsync: true } as { cache?: boolean; remote?: boolean; yes?: boolean; rsync?: boolean });

    const firstCall = requestOrdersMock.mock.calls[0];
    expect(firstCall?.[3]).toBe(isoUtc({ year: 2024, month: 1, day: 1 }));
    expect(firstCall?.[4]).toBe(isoUtc({ year: 2026, month: 3, day: 1, hour: 12 }));
    vi.useRealTimers();
  });

  it("requires explicit source for update and confirms remote mode", async () => {
    await expect(coinbaseOrdersUpdate({})).rejects.toThrow(
      "Missing source: select either --cache or --remote.",
    );
    await expect(coinbaseOrdersUpdate({ cache: true, remote: true })).rejects.toThrow(
      "Invalid source: use either --cache or --remote, not both.",
    );
    await expect(coinbaseOrdersUpdate({ remote: true })).rejects.toThrow(
      "Refusing live Coinbase requests without confirmation. Re-run with --remote --yes.",
    );
  });

  it("regenerates with truncate flow and delegates to update", async () => {
    await coinbaseOrdersRegenerate({ cache: true, yes: true, drop: false });

    expect(createCoinbaseOrdersTableMock).toHaveBeenCalledTimes(1);
    expect(truncateCoinbaseOrdersTableMock).toHaveBeenCalledTimes(1);
    expect(dropCoinbaseOrdersTableMock).not.toHaveBeenCalled();
    expect(insertCoinbaseOrderMock).toHaveBeenCalledTimes(0);
  });

  it("regenerates with drop flow", async () => {
    await coinbaseOrdersRegenerate({ cache: true, yes: true, drop: true });
    expect(dropCoinbaseOrdersTableMock).toHaveBeenCalledTimes(1);
    expect(createCoinbaseOrdersTableMock).toHaveBeenCalledTimes(1);
    expect(truncateCoinbaseOrdersTableMock).not.toHaveBeenCalled();
  });

  it("refuses regenerate without --yes", async () => {
    await expect(coinbaseOrdersRegenerate({ cache: true, yes: false })).rejects.toThrow(
      "Refusing to regenerate without confirmation. Re-run with --yes.",
    );
  });

  it("deduplicates orders by order_id before insert", async () => {
    requestOrdersMock.mockResolvedValueOnce([{ order_id: "o1" }, { order_id: "o1" }, { order_id: "o2" }]);
    requestOrdersMock.mockResolvedValueOnce([{ order_id: "o2" }]);
    requestOrdersMock.mockResolvedValueOnce([{ order_id: "o3" }]);

    await coinbaseOrdersUpdate({ remote: true, yes: true } as { remote?: boolean; yes?: boolean });

    expect(insertCoinbaseOrderMock).toHaveBeenCalledTimes(3);
    expect(insertCoinbaseOrderMock).toHaveBeenNthCalledWith(1, { order_id: "o1" });
    expect(insertCoinbaseOrderMock).toHaveBeenNthCalledWith(2, { order_id: "o2" });
    expect(insertCoinbaseOrderMock).toHaveBeenNthCalledWith(3, { order_id: "o3" });
  });
});
