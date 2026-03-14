import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CoinbaseOrder } from "../../../../../src/shared/coinbase/schemas/coinbase-order-schemas.js";
import {
  makeBracketOrder,
  makeLimitOrder,
  makeStopLimitOrder,
  makeTpSlOrder,
} from "../../../fixtures/coinbase-orders.js";
import { makeOrderId } from "../../../fixtures/identifiers.js";

const {
  readlineQuestionMock,
  getProductInfoMock,
  getTransactionSummaryMock,
  requestBestBidAskMock,
  requestAccountsMock,
  toIncrementMock,
  createMarketOrderMock,
  createLimitOrderMock,
  createLimitTpSlOrderMock,
  createBracketOrderMock,
  createStopLimitOrderMock,
  getOrderMock,
  editOrderMock,
} = vi.hoisted(() => ({
  readlineQuestionMock: vi.fn(() => "yes"),
  getProductInfoMock: vi.fn(() => Promise.resolve({
    base_increment: "0.00000001",
    price_increment: "0.01",
    price: "100.00",
  })),
  getTransactionSummaryMock: vi.fn(() => Promise.resolve({
    fee_tier: {
      maker_fee_rate: "0.001",
      taker_fee_rate: "0.002",
      pricing_tier: "tier_1",
    },
  })),
  requestBestBidAskMock: vi.fn(() => Promise.resolve({
    asks: [{ price: "101.00" }],
    bids: [{ price: "100.50" }],
  })),
  requestAccountsMock: vi.fn(() => Promise.resolve([
    {
      currency: "BTC",
      available_balance: { value: "2.0" },
      hold: { value: "0" },
      type: "ACCOUNT_TYPE_CRYPTO",
      uuid: "11111111-1111-4111-8111-111111111111",
    },
  ])),
  toIncrementMock: vi.fn((increment: string, value: number) => {
    const decimals = increment.includes(".") ? increment.split(".")[1]?.length ?? 0 : 0;
    const factor = 10 ** decimals;
    const floored = Math.floor(value * factor + 1e-12) / factor;
    return floored.toFixed(decimals);
  }),
  createMarketOrderMock: vi.fn(() => Promise.resolve("mkt-1")),
  createLimitOrderMock: vi.fn(() => Promise.resolve("lim-1")),
  createLimitTpSlOrderMock: vi.fn(() => Promise.resolve("tpsl-1")),
  createBracketOrderMock: vi.fn(() => Promise.resolve("bracket-1")),
  createStopLimitOrderMock: vi.fn(() => Promise.resolve("stop-1")),
  getOrderMock: vi.fn<(orderId: string) => Promise<CoinbaseOrder>>(() => Promise.resolve(makeLimitOrder())),
  editOrderMock: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("readline-sync", () => ({
  default: {
    question: readlineQuestionMock,
  },
}));

vi.mock("chalk", () => ({
  default: {
    green: (value: string) => value,
    red: (value: string) => value,
  },
}));

vi.mock("../../../../../src/shared/coinbase/product-service.js", () => ({
  getProductInfo: getProductInfoMock,
}));
vi.mock("../../../../../src/shared/coinbase/transaction-summary-service.js", () => ({
  getTransactionSummary: getTransactionSummaryMock,
}));
vi.mock("../../../../../src/shared/coinbase/rest.js", () => ({
  requestAccounts: requestAccountsMock,
  requestBestBidAsk: requestBestBidAskMock,
  requestMarketTrades: vi.fn(),
}));

vi.mock("../../../../../src/shared/common/increment.js", () => ({
  toIncrement: toIncrementMock,
}));

vi.mock("../../../../../src/shared/coinbase/order-payloads.js", () => ({
  createMarketOrder: createMarketOrderMock,
  createLimitOrder: createLimitOrderMock,
  createLimitTpSlOrder: createLimitTpSlOrderMock,
  createBracketOrder: createBracketOrderMock,
  createStopLimitOrder: createStopLimitOrderMock,
}));

vi.mock("../../../../../src/shared/coinbase/orders-client.js", () => ({
  getOrder: getOrderMock,
  editOrder: editOrderMock,
}));

import {
  placeBracketOrder,
  placeBreakEvenStopOrder,
  placeLimitOrder,
  placeLimitTpSlOrder,
  placeMarketOrder,
  placeModifyOrder,
  placeStopLimitOrder,
  replaceCancelledSellOrder,
} from "../../../../../src/apps/cb/service/order-service.js";

const orderId = (offset = 0) => makeOrderId(offset);

describe("cb service orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("places a market buy order from baseSize when confirmed", async () => {
    await placeMarketOrder("BTC-USD", { buy: true, baseSize: "0.5" });

    expect(getProductInfoMock).toHaveBeenCalledWith("BTC-USD", true);
    expect(createMarketOrderMock).toHaveBeenCalledWith("BTC-USD", "BUY", "0.50000000");
  });

  it("does not place market order when prompt is declined", async () => {
    readlineQuestionMock.mockReturnValueOnce("no");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await placeMarketOrder("BTC-USD", { sell: true, value: "250" });

    expect(createMarketOrderMock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("Action canceled.");
    logSpy.mockRestore();
  });

  it("validates market order side and sizing requirements", async () => {
    await expect(placeMarketOrder("BTC-USD", { value: "100" })).rejects.toThrow(
      "You must specify either --buy or --sell.",
    );
    await expect(placeMarketOrder("BTC-USD", { buy: true })).rejects.toThrow(
      "You must specify either --baseSize or --value.",
    );
  });

  it("places a limit order and defaults postOnly to true", async () => {
    await placeLimitOrder("BTC-USD", { buy: true, limitPrice: "101", value: "1000" });

    expect(getProductInfoMock).toHaveBeenCalledWith("BTC-USD");
    expect(createLimitOrderMock).toHaveBeenCalledWith("BTC-USD", "BUY", "9.90099009", "101.00", true);
  });

  it("places limit TP/SL when confirmed and validates base size", async () => {
    await placeLimitTpSlOrder("BTC-USD", {
      baseSize: "0.25",
      limitPrice: "100",
      stopPrice: "95",
      takeProfitPrice: "120",
    });

    expect(createLimitTpSlOrderMock).toHaveBeenCalledWith(
      "BTC-USD",
      "0.25",
      "100",
      "95",
      "120",
      true,
    );

    await expect(placeLimitTpSlOrder("BTC-USD", {
      baseSize: "0",
      limitPrice: "100",
      stopPrice: "95",
      takeProfitPrice: "120",
    })).rejects.toThrow("Invalid base size or value provided.");
  });

  it("places bracket order and validates stop < limit", async () => {
    await placeBracketOrder("BTC-USD", {
      baseSize: "1",
      limitPrice: "110",
      stopPrice: "95",
    });

    expect(createBracketOrderMock).toHaveBeenCalledWith("BTC-USD", "SELL", "1.00000000", "110.00", "95.00");

    await expect(placeBracketOrder("BTC-USD", {
      baseSize: "1",
      limitPrice: "90",
      stopPrice: "95",
    })).rejects.toThrow("Stop price must be less than limit price");
  });

  it("places stop-limit order and defaults limit price to 1% below stop", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await placeStopLimitOrder("BTC-USD", {
      baseSize: "2",
      stopPrice: "100",
    } as unknown as Parameters<typeof placeStopLimitOrder>[1]);

    expect(logSpy).toHaveBeenCalledWith("WARNING: Defaulting limit price to 1% below stop price");
    expect(createStopLimitOrderMock).toHaveBeenCalledWith(
      "BTC-USD",
      "SELL",
      "2.00000000",
      "99.00",
      "100.00",
    );
    logSpy.mockRestore();
  });

  it("validates explicit stop-limit prices", async () => {
    await expect(placeStopLimitOrder("BTC-USD", {
      baseSize: "1",
      stopPrice: "100",
      limitPrice: "100",
    })).rejects.toThrow("Limit price must be less than stop price");
  });

  it("modifies directly when all fields are provided", async () => {
    getOrderMock.mockResolvedValueOnce(makeStopLimitOrder({
      order_id: orderId(),
      baseSize: "1.00",
      limitPrice: "100.00",
      stopPrice: "98.00",
    }));

    await placeModifyOrder(orderId(), {
      baseSize: "1.1",
      limitPrice: "101.00",
      stopPrice: "99.00",
    });

    expect(getOrderMock).toHaveBeenCalledWith(orderId());
    expect(editOrderMock).toHaveBeenCalledWith(orderId(), {
      price: "101.00",
      size: "1.1",
      stop_price: "99.00",
    });
  });

  it("cancels modify update when prompt is declined", async () => {
    readlineQuestionMock.mockReturnValueOnce("no");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    getOrderMock.mockResolvedValueOnce(makeStopLimitOrder({
      order_id: orderId(13),
      baseSize: "1.00",
      limitPrice: "100.00",
      stopPrice: "98.00",
    }));

    await placeModifyOrder(orderId(13), {
      baseSize: "1.1",
      limitPrice: "101.00",
      stopPrice: "99.00",
    });

    expect(logSpy).toHaveBeenCalledWith("\nOrder Change Summary:");
    expect(logSpy).toHaveBeenCalledWith("Action canceled.");
    expect(editOrderMock).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("modifies only the provided base size", async () => {
    getOrderMock.mockResolvedValueOnce(makeLimitOrder());

    await placeModifyOrder(orderId(), { baseSize: "2.00" });

    expect(getOrderMock).toHaveBeenCalledWith(orderId());
    expect(editOrderMock).toHaveBeenCalledWith(orderId(), {
      price: "100.00",
      size: "2.00",
    });
  });

  it("modifies only the provided limit price", async () => {
    getOrderMock.mockResolvedValueOnce(makeTpSlOrder({
      order_id: orderId(1),
    }));

    await placeModifyOrder(orderId(1), { limitPrice: "121.00" });

    expect(getOrderMock).toHaveBeenCalledWith(orderId(1));
    expect(editOrderMock).toHaveBeenCalledWith(orderId(1), {
      price: "121.00",
      size: "1.50",
    });
  });

  it("modifies stop price for stop-limit orders", async () => {
    getOrderMock.mockResolvedValueOnce(makeStopLimitOrder({
      order_id: orderId(2),
    }));

    await placeModifyOrder(orderId(2), { stopPrice: "95.00" });

    expect(getOrderMock).toHaveBeenCalledWith(orderId(2));
    expect(editOrderMock).toHaveBeenCalledWith(orderId(2), {
      price: "101.00",
      size: "0.5",
      stop_price: "95.00",
    });
  });

  it("modifies filled-buy bracket orders (base size + take-profit + stop)", async () => {
    getOrderMock.mockResolvedValueOnce(makeBracketOrder({
      order_id: orderId(10),
      baseSize: "0.06571451",
      limitPrice: "78941.6",
      stopTriggerPrice: "64943.37",
    }));

    await placeModifyOrder(orderId(10), {
      baseSize: "0.07000000",
      takeProfitPrice: "79000.00",
      stopPrice: "65000.00",
    });

    expect(editOrderMock).toHaveBeenCalledWith(orderId(10), {
      price: "79000.00",
      size: "0.07000000",
      stop_price: "65000.00",
    });
  });

  it("supports takeProfitPrice alias for bracket modify", async () => {
    getOrderMock.mockResolvedValueOnce(makeBracketOrder({
      order_id: orderId(11),
      baseSize: "0.06571451",
      limitPrice: "78941.6",
      stopTriggerPrice: "64943.37",
    }));

    await placeModifyOrder(orderId(11), {
      takeProfitPrice: "79100.00",
    });

    expect(editOrderMock).toHaveBeenCalledWith(orderId(11), {
      price: "79100.00",
      size: "0.06571451",
    });
  });

  it("rejects conflicting limit/takeProfit prices for bracket modify", async () => {
    getOrderMock.mockResolvedValueOnce(makeBracketOrder({
      order_id: orderId(12),
      baseSize: "0.06571451",
      limitPrice: "78941.6",
      stopTriggerPrice: "64943.37",
    }));

    await expect(placeModifyOrder(orderId(12), {
      limitPrice: "79000.00",
      takeProfitPrice: "79100.00",
    })).rejects.toThrow("For bracket/TP-SL orders, pass only one of --limitPrice or --takeProfitPrice.");
  });

  it("modifies attached TP/SL on limit orders", async () => {
    getOrderMock.mockResolvedValueOnce(makeLimitOrder({
      order_id: orderId(2),
      limitPrice: "100.00",
      baseSize: "1.00",
      attachedLimitPrice: "120.00",
      attachedStopPrice: "95.00",
    }));

    await placeModifyOrder(orderId(2), {
      takeProfitPrice: "123.00",
      stopPrice: "97.00",
    });

    expect(getOrderMock).toHaveBeenCalledWith(orderId(2));
    expect(editOrderMock).toHaveBeenCalledWith(orderId(2), {
      price: "100.00",
      size: "1.00",
      attached_order_configuration: {
        trigger_bracket_gtc: {
          limit_price: "123.00",
          stop_trigger_price: "97.00",
        },
      },
    });
  });

  it("rejects TP/SL updates when limit order has no attached TP/SL", async () => {
    getOrderMock.mockResolvedValueOnce(makeLimitOrder({
      order_id: orderId(6),
    }));

    await expect(placeModifyOrder(orderId(6), {
      takeProfitPrice: "123.00",
    })).rejects.toThrow("This limit order has no attached TP/SL configuration to modify.");
  });

  it("modifies bracket-like orders via dedicated breakeven command", async () => {
    getOrderMock.mockResolvedValueOnce(makeTpSlOrder({
      order_id: orderId(4),
      product_id: "BTC-USD",
    }));

    await placeBreakEvenStopOrder(orderId(4), {
      buyPrice: "100",
      limitPrice: "122.00",
    });

    expect(editOrderMock).toHaveBeenCalledWith(orderId(4), {
      price: "122.00",
      size: "1.50",
      stop_price: "100.31",
    });
  });

  it("modifies bracket-like orders with breakeven stop only", async () => {
    getOrderMock.mockResolvedValueOnce(makeTpSlOrder({
      order_id: orderId(3),
      product_id: "BTC-USD",
    }));

    await placeBreakEvenStopOrder(orderId(3), {
      buyPrice: "100",
    });

    expect(getTransactionSummaryMock).toHaveBeenCalledTimes(1);
    expect(getProductInfoMock).toHaveBeenCalledWith("BTC-USD");
    expect(requestBestBidAskMock).toHaveBeenCalledWith("BTC-USD");
    expect(editOrderMock).toHaveBeenCalledWith(orderId(3), {
      price: "120.00",
      size: "1.50",
      stop_price: "100.31",
    });
  });

  it("rejects breakeven update when current price is at or below computed stop", async () => {
    getOrderMock.mockResolvedValueOnce(makeTpSlOrder({
      order_id: orderId(8),
      product_id: "BTC-USD",
    }));
    requestBestBidAskMock.mockResolvedValueOnce({
      asks: [{ price: "100.31" }],
      bids: [{ price: "100.30" }],
    });

    await expect(placeBreakEvenStopOrder(orderId(8), {
      buyPrice: "100",
    })).rejects.toThrow("Cannot set break-even stop: current price");
    expect(editOrderMock).not.toHaveBeenCalled();
  });

  it("cancels breakeven update when prompt is declined", async () => {
    readlineQuestionMock.mockReturnValueOnce("no");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    getOrderMock.mockResolvedValueOnce(makeTpSlOrder({
      order_id: orderId(9),
      product_id: "BTC-USD",
    }));
    requestBestBidAskMock.mockResolvedValueOnce({
      asks: [{ price: "101.00" }],
      bids: [{ price: "100.50" }],
    });

    await placeBreakEvenStopOrder(orderId(9), {
      buyPrice: "100",
    });

    expect(logSpy).toHaveBeenCalledWith("\nOrder Change Summary:");
    expect(logSpy).toHaveBeenCalledWith("Action canceled.");
    expect(editOrderMock).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("rejects dedicated breakeven for non-bracket orders", async () => {
    getOrderMock.mockResolvedValueOnce(makeLimitOrder({
      order_id: orderId(5),
      product_id: "BTC-USD",
    }));

    await expect(placeBreakEvenStopOrder(orderId(5), {
      buyPrice: "100",
    })).rejects.toThrow("Break-even stop is only supported for BRACKET and TAKE_PROFIT_STOP_LOSS orders.");
  });

  it("replaces a cancelled sell limit order when funds are available", async () => {
    getOrderMock.mockResolvedValueOnce(makeLimitOrder({
      order_id: orderId(20),
      product_id: "BTC-USD",
      side: "SELL",
      status: "CANCELLED",
      baseSize: "0.75",
      limitPrice: "105.00",
      postOnly: false,
    }));

    await replaceCancelledSellOrder(orderId(20));

    expect(requestAccountsMock).toHaveBeenCalledTimes(1);
    expect(createLimitOrderMock).toHaveBeenCalledWith("BTC-USD", "SELL", "0.75", "105.00", false);
  });

  it("replaces a cancelled sell stop-limit order when funds are available", async () => {
    getOrderMock.mockResolvedValueOnce(makeStopLimitOrder({
      order_id: orderId(21),
      product_id: "BTC-USD",
      side: "SELL",
      status: "CANCELLED",
      baseSize: "0.5",
      limitPrice: "99.00",
      stopPrice: "100.00",
    }));

    await replaceCancelledSellOrder(orderId(21));

    expect(createStopLimitOrderMock).toHaveBeenCalledWith("BTC-USD", "SELL", "0.5", "99.00", "100.00");
  });

  it("replaces cancelled sell bracket-like orders via bracket creation", async () => {
    getOrderMock.mockResolvedValueOnce(makeTpSlOrder({
      order_id: orderId(22),
      product_id: "BTC-USD",
      status: "CANCELLED",
      baseSize: "1.50",
      limitPrice: "120.00",
      stopTriggerPrice: "95.00",
    }));

    await replaceCancelledSellOrder(orderId(22));

    expect(createBracketOrderMock).toHaveBeenCalledWith("BTC-USD", "SELL", "1.50", "120.00", "95.00");
  });

  it("rejects replacing orders that are not cancelled", async () => {
    getOrderMock.mockResolvedValueOnce(makeLimitOrder({
      order_id: orderId(23),
      side: "SELL",
      status: "OPEN",
    }));

    await expect(replaceCancelledSellOrder(orderId(23))).rejects.toThrow(
      `Order ${orderId(23)} must be CANCELLED before it can be replaced.`,
    );
  });

  it("rejects replacing orders that are not sell orders", async () => {
    getOrderMock.mockResolvedValueOnce(makeLimitOrder({
      order_id: orderId(24),
      side: "BUY",
      status: "CANCELLED",
    }));

    await expect(replaceCancelledSellOrder(orderId(24))).rejects.toThrow(
      `Order ${orderId(24)} must be a SELL order before it can be replaced.`,
    );
  });

  it("rejects replacement when available balance is insufficient", async () => {
    getOrderMock.mockResolvedValueOnce(makeBracketOrder({
      order_id: orderId(25),
      product_id: "BTC-USD",
      status: "CANCELLED",
      baseSize: "3.00",
    }));

    await expect(replaceCancelledSellOrder(orderId(25))).rejects.toThrow(
      `Insufficient available BTC balance to replace order ${orderId(25)}: need 3.00, have 2.0.`,
    );
  });

  it("cancels replacement when prompt is declined", async () => {
    readlineQuestionMock.mockReturnValueOnce("no");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    getOrderMock.mockResolvedValueOnce(makeLimitOrder({
      order_id: orderId(26),
      product_id: "BTC-USD",
      side: "SELL",
      status: "CANCELLED",
      baseSize: "0.1",
      limitPrice: "110.00",
    }));

    await replaceCancelledSellOrder(orderId(26));

    expect(logSpy).toHaveBeenCalledWith("\nOrder Change Summary:");
    expect(logSpy).toHaveBeenCalledWith("Action canceled.");
    expect(createLimitOrderMock).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
