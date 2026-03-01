import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  loggerInfoMock,
  requestOpenOrdersMock,
  requestOrderMock,
  requestOrderCancellationMock,
  printOrderMock,
} = vi.hoisted(() => ({
  loggerInfoMock: vi.fn(),
  requestOpenOrdersMock: vi.fn<(productId: string | null) => Promise<Array<{ order_id: string }>>>(() => Promise.resolve([])),
  requestOrderMock: vi.fn(() => Promise.resolve({ order_id: "order-1" })),
  requestOrderCancellationMock: vi.fn(() => Promise.resolve(true)),
  printOrderMock: vi.fn(),
}));

vi.mock("../../../../../src/shared/log/logger.js", () => ({
  logger: {
    info: loggerInfoMock,
  },
}));

vi.mock("../../../../../src/shared/coinbase/rest.js", () => ({
  requestOpenOrders: requestOpenOrdersMock,
  requestOrder: requestOrderMock,
  requestOrderCancellation: requestOrderCancellationMock,
}));

vi.mock("../../../../../src/shared/log/orders.js", () => ({
  printOrder: printOrderMock,
}));

import { handleCancelAction, handleOrderAction, handleOrdersAction } from "../../../../../src/apps/cb/commands/orders.js";

describe("orders command handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and prints a single order", async () => {
    const order = { order_id: "abc-123" };
    requestOrderMock.mockResolvedValueOnce(order);

    await handleOrderAction("abc-123");

    expect(requestOrderMock).toHaveBeenCalledWith("abc-123");
    expect(printOrderMock).toHaveBeenCalledWith(order);
  });

  it("logs when there are no open orders", async () => {
    requestOpenOrdersMock.mockResolvedValueOnce([]);

    await handleOrdersAction(null);

    expect(requestOpenOrdersMock).toHaveBeenCalledWith(null);
    expect(loggerInfoMock).toHaveBeenCalledWith("No open orders found.");
    expect(printOrderMock).not.toHaveBeenCalled();
  });

  it("prints each open order with index separators", async () => {
    const openOrders = [{ order_id: "a" }, { order_id: "b" }];
    requestOpenOrdersMock.mockResolvedValueOnce(openOrders);

    await handleOrdersAction("BTC-USD");

    expect(requestOpenOrdersMock).toHaveBeenCalledWith("BTC-USD");
    expect(loggerInfoMock).toHaveBeenCalledWith("Order 1/2");
    expect(loggerInfoMock).toHaveBeenCalledWith("Order 2/2");
    expect(loggerInfoMock).toHaveBeenCalledWith("---");
    expect(printOrderMock).toHaveBeenCalledTimes(2);
    expect(printOrderMock).toHaveBeenNthCalledWith(1, openOrders[0]);
    expect(printOrderMock).toHaveBeenNthCalledWith(2, openOrders[1]);
  });

  it("cancels the requested order id", async () => {
    await handleCancelAction("cancel-me");

    expect(requestOrderCancellationMock).toHaveBeenCalledWith("cancel-me");
  });
});
