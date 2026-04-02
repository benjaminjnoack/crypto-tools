import { describe, expect, it } from "vitest";
import {
  buildBracketOrderValues,
  buildBreakEvenStopPrice,
  buildLimitOrderValues,
  buildMarketOrderValues,
  buildModifyOrderValues,
  buildStopLimitOrderValues,
  getModifiableOrderValues,
} from "../../../../../src/apps/cb/service/order-builders.js";
import { makeTpSlOrder } from "../../../fixtures/coinbase-orders.js";

describe("cb order builders", () => {
  it("builds market values from notional value", () => {
    const values = buildMarketOrderValues({ buy: true, value: "250" }, "100.00", "0.00000001");
    expect(values).toEqual({
      side: "BUY",
      baseSize: "2.50000000",
      orderValue: "250.00",
    });
  });

  it("builds limit values and defaults postOnly", () => {
    const values = buildLimitOrderValues(
      { buy: true, limitPrice: "101", value: "1000" },
      "0.00000001",
      "0.01",
    );
    expect(values).toEqual({
      side: "BUY",
      postOnly: true,
      baseSize: "9.90099009",
      limitPrice: "101.00",
      orderValue: "1000.00",
    });
  });

  it("builds bracket and stop-limit values", () => {
    const bracket = buildBracketOrderValues(
      { baseSize: "1", limitPrice: "110", stopPrice: "95" },
      "0.00000001",
      "0.01",
    );
    expect(bracket.confirmationPrice).toBe("110.00/95.00");
    expect(bracket.confirmationValue).toBe("110.00/95.00");

    const stop = buildStopLimitOrderValues(
      { baseSize: "2", stopPrice: "100" } as unknown as Parameters<typeof buildStopLimitOrderValues>[0],
      "0.00000001",
      "0.01",
    );
    expect(stop.defaultedLimitPrice).toBe(true);
    expect(stop.limitPrice).toBe("99.00");
    expect(stop.confirmationPrice).toBe("100.00/99.00");
  });

  it("extracts and merges modify values from existing order", () => {
    const existing = getModifiableOrderValues(makeTpSlOrder());

    expect(buildModifyOrderValues({ limitPrice: "121.00" }, existing)).toEqual({
      baseSize: "1.50",
      limitPrice: "121.00",
      stopPrice: "95.00",
    });
  });

  it("calculates break-even stop price including fees", () => {
    const stopPrice = buildBreakEvenStopPrice("100", 0.001, 0.002, "0.01");
    expect(stopPrice).toBe("100.31");
  });
});
