import { beforeEach, describe, expect, it, vi } from "vitest";

const { uuidV4Mock, requestOrderCreationMock, loggerInfoMock } = vi.hoisted(() => ({
  uuidV4Mock: vi.fn(() => "00000000-0000-4000-8000-000000000001"),
  requestOrderCreationMock: vi.fn(() => Promise.resolve("order-id-123")),
  loggerInfoMock: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: uuidV4Mock,
}));

vi.mock("../../../../src/shared/coinbase/rest.js", () => ({
  requestOrderCreation: requestOrderCreationMock,
}));

vi.mock("../../../../src/shared/log/logger.js", () => ({
  logger: {
    info: loggerInfoMock,
  },
}));

import {
  createBracketOrder,
  createLimitOrder,
  createLimitTpSlOrder,
  createMarketOrder,
  createStopLimitOrder,
} from "../../../../src/shared/coinbase/order.js";

describe("order payload creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates market order payload", async () => {
    await expect(createMarketOrder("BTC-USD", "BUY", "0.01")).resolves.toBe("order-id-123");

    expect(requestOrderCreationMock).toHaveBeenCalledWith({
      client_order_id: "00000000-0000-4000-8000-000000000001",
      product_id: "BTC-USD",
      side: "BUY",
      order_configuration: {
        market_market_ioc: {
          base_size: "0.01",
        },
      },
    });
  });

  it("creates limit order payload with configurable post_only", async () => {
    await createLimitOrder("BTC-USD", "SELL", "0.5", "25000.00", false);

    expect(requestOrderCreationMock).toHaveBeenCalledWith({
      client_order_id: "00000000-0000-4000-8000-000000000001",
      product_id: "BTC-USD",
      side: "SELL",
      order_configuration: {
        limit_limit_gtc: {
          base_size: "0.5",
          limit_price: "25000.00",
          post_only: false,
        },
      },
    });
  });

  it("creates limit TP/SL order payload", async () => {
    await createLimitTpSlOrder("BTC-USD", "0.2", "20000.00", "19000.00", "22000.00", true);

    expect(requestOrderCreationMock).toHaveBeenCalledWith({
      client_order_id: "00000000-0000-4000-8000-000000000001",
      product_id: "BTC-USD",
      side: "BUY",
      order_configuration: {
        limit_limit_gtc: {
          base_size: "0.2",
          limit_price: "20000.00",
          post_only: true,
        },
      },
      attached_order_configuration: {
        trigger_bracket_gtc: {
          limit_price: "22000.00",
          stop_trigger_price: "19000.00",
        },
      },
    });
  });

  it("creates bracket order payload", async () => {
    await createBracketOrder("BTC-USD", "SELL", "1.0", "21000.00", "19999.00");

    expect(requestOrderCreationMock).toHaveBeenCalledWith({
      client_order_id: "00000000-0000-4000-8000-000000000001",
      product_id: "BTC-USD",
      side: "SELL",
      order_configuration: {
        trigger_bracket_gtc: {
          base_size: "1.0",
          limit_price: "21000.00",
          stop_trigger_price: "19999.00",
        },
      },
    });
  });

  it("creates stop-limit order payload with stop direction by side", async () => {
    await createStopLimitOrder("ETH-USD", "BUY", "2", "1800.00", "1850.00");

    expect(requestOrderCreationMock).toHaveBeenCalledWith({
      client_order_id: "00000000-0000-4000-8000-000000000001",
      product_id: "ETH-USD",
      side: "BUY",
      order_configuration: {
        stop_limit_stop_limit_gtc: {
          base_size: "2",
          limit_price: "1800.00",
          stop_direction: "STOP_DIRECTION_STOP_UP",
          stop_price: "1850.00",
        },
      },
    });
  });
});
