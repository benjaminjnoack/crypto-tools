import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeOrderId } from "../../../fixtures/identifiers.js";

const {
  placeBreakEvenStopOrderMock,
  loggerInfoMock,
  getOpenOrdersMock,
  getOrderMock,
  cancelOrderMock,
  placeModifyOrderMock,
  replaceCancelledOrderMock,
  printOrderMock,
} = vi.hoisted(() => ({
  placeBreakEvenStopOrderMock: vi.fn(() => Promise.resolve(undefined)),
  loggerInfoMock: vi.fn(),
  getOpenOrdersMock: vi.fn<(productId: string | null) => Promise<Array<{ order_id: string }>>>(() => Promise.resolve([])),
  getOrderMock: vi.fn(() => Promise.resolve({ order_id: "order-1" })),
  cancelOrderMock: vi.fn(() => Promise.resolve(true)),
  placeModifyOrderMock: vi.fn(() => Promise.resolve(undefined)),
  replaceCancelledOrderMock: vi.fn(() => Promise.resolve(undefined)),
  printOrderMock: vi.fn(),
}));

vi.mock("../../../../../src/shared/log/logger.js", () => ({
  logger: {
    info: loggerInfoMock,
  },
}));

vi.mock("../../../../../src/shared/coinbase/orders-client.js", () => ({
  getOpenOrders: getOpenOrdersMock,
  getOrder: getOrderMock,
  cancelOrder: cancelOrderMock,
}));

vi.mock("../../../../../src/shared/log/orders.js", () => ({
  printOrder: printOrderMock,
}));

vi.mock("../../../../../src/apps/cb/service/order-service.js", () => ({
  placeBreakEvenStopOrder: placeBreakEvenStopOrderMock,
  placeModifyOrder: placeModifyOrderMock,
  replaceCancelledOrder: replaceCancelledOrderMock,
}));

import {
  handleBreakEvenStopAction,
  handleCancelAction,
  handleModifyAction,
  handleOrderAction,
  handleOrdersAction,
  handleReplaceAction,
} from "../../../../../src/apps/cb/commands/order-handlers.js";

describe("orders command handlers", () => {
  const orderId = makeOrderId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and prints a single order", async () => {
    const order = { order_id: "abc-123" };
    getOrderMock.mockResolvedValueOnce(order);

    await handleOrderAction("abc-123");

    expect(getOrderMock).toHaveBeenCalledWith("abc-123");
    expect(printOrderMock).toHaveBeenCalledWith(order);
  });

  it("logs when there are no open orders", async () => {
    getOpenOrdersMock.mockResolvedValueOnce([]);

    await handleOrdersAction(null);

    expect(getOpenOrdersMock).toHaveBeenCalledWith(null);
    expect(loggerInfoMock).toHaveBeenCalledWith("No open orders found.");
    expect(printOrderMock).not.toHaveBeenCalled();
  });

  it("prints each open order with index separators", async () => {
    const openOrders = [{ order_id: "a" }, { order_id: "b" }];
    getOpenOrdersMock.mockResolvedValueOnce(openOrders);

    await handleOrdersAction("BTC-USD");

    expect(getOpenOrdersMock).toHaveBeenCalledWith("BTC-USD");
    expect(loggerInfoMock).toHaveBeenCalledWith("Order 1/2");
    expect(loggerInfoMock).toHaveBeenCalledWith("Order 2/2");
    expect(loggerInfoMock).toHaveBeenCalledWith("---");
    expect(printOrderMock).toHaveBeenCalledTimes(2);
    expect(printOrderMock).toHaveBeenNthCalledWith(1, openOrders[0]);
    expect(printOrderMock).toHaveBeenNthCalledWith(2, openOrders[1]);
  });

  it("cancels the requested order id", async () => {
    await handleCancelAction("cancel-me");

    expect(cancelOrderMock).toHaveBeenCalledWith("cancel-me");
  });

  it("delegates modify action to service", async () => {
    await handleModifyAction(orderId, { limitPrice: "101.50" });

    expect(placeModifyOrderMock).toHaveBeenCalledWith(orderId, {
      limitPrice: "101.50",
    });
  });

  it("delegates breakeven action to service", async () => {
    await handleBreakEvenStopAction(orderId, {
      buyPrice: "100",
      limitPrice: "101.50",
    });

    expect(placeBreakEvenStopOrderMock).toHaveBeenCalledWith(orderId, {
      buyPrice: "100",
      limitPrice: "101.50",
    });
  });

  it("delegates replace action to service", async () => {
    await handleReplaceAction(orderId);

    expect(replaceCancelledOrderMock).toHaveBeenCalledWith(orderId);
  });
});
