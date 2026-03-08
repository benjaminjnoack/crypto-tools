import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CoinbaseOrder } from "../../../../src/shared/coinbase/schemas/coinbase-order-schemas.js";
import { makeOrderId } from "../../fixtures/identifiers.js";

const { loggerInfoMock } = vi.hoisted(() => ({
  loggerInfoMock: vi.fn(),
}));

vi.mock("../../../../src/shared/log/logger.js", () => ({
  logger: {
    info: loggerInfoMock,
  },
}));

import { printOrder } from "../../../../src/shared/log/orders.js";

const VALID_UUID = makeOrderId();

function baseOrder(): Omit<CoinbaseOrder, "order_type" | "order_configuration"> {
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
  };
}

describe("printOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prints market orders and skips undefined configuration fields", () => {
    const marketOrder = {
      ...baseOrder(),
      order_type: "MARKET",
      order_configuration: {
        market_market_ioc: {
          base_size: "0.01",
        },
      },
    } as CoinbaseOrder;

    printOrder(marketOrder);

    expect(loggerInfoMock).toHaveBeenCalledWith("Order:");
    expect(loggerInfoMock).toHaveBeenCalledWith("  order_configuration:");
    expect(loggerInfoMock).toHaveBeenCalledWith("    market_market_ioc:");
    expect(loggerInfoMock).toHaveBeenCalledWith("      base_size:", "0.01");
    expect(loggerInfoMock).not.toHaveBeenCalledWith("      quote_size:", undefined);
    expect(loggerInfoMock).not.toHaveBeenCalledWith("  attached_order_configuration:");
  });

  it("prints attached TP/SL fields for limit orders", () => {
    const limitOrder = {
      ...baseOrder(),
      order_type: "LIMIT",
      order_configuration: {
        limit_limit_gtc: {
          base_size: "1.0",
          limit_price: "100.00",
          post_only: true,
        },
      },
      attached_order_configuration: {
        trigger_bracket_gtc: {
          limit_price: "120.00",
          stop_trigger_price: "95.00",
        },
      },
    } as CoinbaseOrder;

    printOrder(limitOrder);

    expect(loggerInfoMock).toHaveBeenCalledWith("    limit_limit_gtc:");
    expect(loggerInfoMock).toHaveBeenCalledWith("      base_size:", "1.0");
    expect(loggerInfoMock).toHaveBeenCalledWith("      limit_price:", "100.00");
    expect(loggerInfoMock).toHaveBeenCalledWith("      post_only:", true);
    expect(loggerInfoMock).toHaveBeenCalledWith("  attached_order_configuration:");
    expect(loggerInfoMock).toHaveBeenCalledWith("    trigger_bracket_gtc:");
    expect(loggerInfoMock).toHaveBeenCalledWith("      limit_price:", "120.00");
    expect(loggerInfoMock).toHaveBeenCalledWith("      stop_trigger_price:", "95.00");
  });

  it("returns early when typed order configuration key is missing", () => {
    const malformedMarketOrder = {
      ...baseOrder(),
      order_type: "MARKET",
      order_configuration: {},
    } as unknown as CoinbaseOrder;

    printOrder(malformedMarketOrder);

    expect(loggerInfoMock).toHaveBeenCalledWith("  order_configuration:");
    expect(loggerInfoMock).toHaveBeenCalledWith("    market_market_ioc:");
    expect(loggerInfoMock).not.toHaveBeenCalledWith("      base_size:", expect.anything());
    expect(loggerInfoMock).not.toHaveBeenCalledWith("  attached_order_configuration:");
  });
});
