import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requestOrderCreationMock,
  requestOrderMock,
  requestOpenOrdersMock,
  requestOrderCancellationMock,
  requestOrderEditMock,
} = vi.hoisted(() => ({
  requestOrderCreationMock: vi.fn(() => Promise.resolve("order-1")),
  requestOrderMock: vi.fn(() => Promise.resolve({ order_id: "order-1" })),
  requestOpenOrdersMock: vi.fn(() => Promise.resolve([{ order_id: "order-1" }])),
  requestOrderCancellationMock: vi.fn(() => Promise.resolve(true)),
  requestOrderEditMock: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("../../../../src/shared/coinbase/rest.js", () => ({
  requestOrderCreation: requestOrderCreationMock,
  requestOrder: requestOrderMock,
  requestOpenOrders: requestOpenOrdersMock,
  requestOrderCancellation: requestOrderCancellationMock,
  requestOrderEdit: requestOrderEditMock,
}));

import { cancelOrder, createOrder, editOrder, getOpenOrders, getOrder } from "../../../../src/shared/coinbase/orders-client.js";

const VALID_UUID = "123e4567-e89b-42d3-a456-426614174000";

describe("coinbase orders-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates create/get/list/cancel/edit operations", async () => {
    await expect(createOrder({
      client_order_id: VALID_UUID,
      product_id: "BTC-USD",
      side: "BUY",
      order_configuration: {
        market_market_ioc: {
          base_size: "0.01",
        },
      },
    })).resolves.toBe("order-1");
    await expect(getOrder(VALID_UUID)).resolves.toEqual({ order_id: "order-1" });
    await expect(getOpenOrders("BTC-USD")).resolves.toEqual([{ order_id: "order-1" }]);
    await expect(cancelOrder(VALID_UUID)).resolves.toBe(true);
    await expect(editOrder(VALID_UUID, { price: "100.00", size: "1.0" })).resolves.toBe(true);

    expect(requestOrderCreationMock).toHaveBeenCalledTimes(1);
    expect(requestOrderMock).toHaveBeenCalledWith(VALID_UUID);
    expect(requestOpenOrdersMock).toHaveBeenCalledWith("BTC-USD");
    expect(requestOrderCancellationMock).toHaveBeenCalledWith(VALID_UUID);
    expect(requestOrderEditMock).toHaveBeenCalledWith(VALID_UUID, { price: "100.00", size: "1.0" });
  });
});
