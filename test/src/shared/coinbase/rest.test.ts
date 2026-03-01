import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const {
  hasSigningKeysMock,
  getSigningKeysMock,
  signUrlMock,
  delayMock,
  loggerErrorMock,
  loggerInfoMock,
} = vi.hoisted(() => ({
  hasSigningKeysMock: vi.fn(() => true),
  getSigningKeysMock: vi.fn(() => Promise.resolve(undefined)),
  signUrlMock: vi.fn(() => "signed.jwt"),
  delayMock: vi.fn(() => Promise.resolve(undefined)),
  loggerErrorMock: vi.fn(),
  loggerInfoMock: vi.fn(),
}));

vi.mock("../../../../src/shared/coinbase/signing.js", () => ({
  hasSigningKeys: hasSigningKeysMock,
  getSigningKeys: getSigningKeysMock,
  signUrl: signUrlMock,
}));

vi.mock("../../../../src/shared/common/delay.js", () => ({
  delay: delayMock,
}));

vi.mock("../../../../src/shared/log/logger.js", () => ({
  logger: {
    error: loggerErrorMock,
    info: loggerInfoMock,
  },
}));

import {
  http,
  requestBestBidAsk,
  requestCurrencyAccount,
  requestMarketTrades,
  requestOrderCancellation,
  requestOrderCreation,
  requestOrders,
  requestProduct,
  requestTransactionSummary,
  requestWithSchema,
} from "../../../../src/shared/coinbase/rest.js";

const VALID_UUID = "123e4567-e89b-42d3-a456-426614174000";

function mockHttpSequence(sequence: Array<Error | Record<string, unknown>>) {
  const requestSpy = vi.spyOn(http, "request");
  for (const item of sequence) {
    if (item instanceof Error) {
      requestSpy.mockRejectedValueOnce(item);
    } else {
      requestSpy.mockResolvedValueOnce({ data: item });
    }
  }
  return requestSpy;
}

describe("coinbase rest helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("requestWithSchema parses successful responses", async () => {
    const requestSpy = mockHttpSequence([{ value: "ok" }]);

    const result = await requestWithSchema(
      { method: "GET", url: "https://example.test" },
      z.object({ value: z.string() }),
    );

    expect(result.value).toBe("ok");
    expect(requestSpy).toHaveBeenCalledTimes(1);
    expect(delayMock).not.toHaveBeenCalled();
  });

  it("requestWithSchema retries on axios errors and then succeeds", async () => {
    const axErr = new Error("boom") as Error & {
      isAxiosError: boolean;
      response: { status: number; data: { message: string } };
    };
    axErr.isAxiosError = true;
    axErr.response = { status: 500, data: { message: "bad" } };

    const requestSpy = mockHttpSequence([axErr, { value: "ok" }]);

    const result = await requestWithSchema(
      { method: "GET", url: "https://retry.test" },
      z.object({ value: z.string() }),
      2,
    );

    expect(result.value).toBe("ok");
    expect(requestSpy).toHaveBeenCalledTimes(2);
    expect(delayMock).toHaveBeenCalledWith(1000);
  });

  it("requestWithSchema does not retry zod parse errors", async () => {
    const requestSpy = mockHttpSequence([{ value: 123 }]);

    await expect(
      requestWithSchema(
        { method: "GET", url: "https://schema.test" },
        z.object({ value: z.string() }),
        5,
      ),
    ).rejects.toBeInstanceOf(z.ZodError);

    expect(requestSpy).toHaveBeenCalledTimes(1);
    expect(delayMock).not.toHaveBeenCalled();
  });

  it("requestCurrencyAccount sums available+hold and rounds with increment", async () => {
    mockHttpSequence([{
      accounts: [
        {
          currency: "USD",
          hold: { value: "5.50" },
          available_balance: { value: "10.00" },
          type: "ACCOUNT_TYPE_FIAT",
          uuid: VALID_UUID,
        },
      ],
    }]);

    const result = await requestCurrencyAccount("USD", "0.01");

    expect(result).toEqual({
      available: "10.00",
      hold: "5.50",
      total: "15.50",
    });
  });

  it("requestCurrencyAccount throws when account currency is missing", async () => {
    mockHttpSequence([{
      accounts: [
        {
          currency: "USD",
          hold: { value: "0" },
          available_balance: { value: "1" },
          type: "ACCOUNT_TYPE_FIAT",
          uuid: VALID_UUID,
        },
      ],
    }]);

    await expect(requestCurrencyAccount("EUR")).rejects.toThrow("Could not find EUR account");
  });

  it("requestOrderCreation returns order id on success", async () => {
    mockHttpSequence([{
      success: true,
      success_response: { order_id: VALID_UUID },
    }]);

    const result = await requestOrderCreation({
      client_order_id: VALID_UUID,
      product_id: "BTC-USD",
      side: "BUY",
      order_configuration: {
        market_market_ioc: {
          base_size: "0.01",
        },
      },
    });

    expect(result).toBe(VALID_UUID);
  });

  it("requestOrderCreation throws preview failure reason", async () => {
    mockHttpSequence([{
      success: false,
      error_response: {
        preview_failure_reason: "insufficient_funds",
      },
    }]);

    await expect(
      requestOrderCreation({
        client_order_id: VALID_UUID,
        product_id: "BTC-USD",
        side: "BUY",
        order_configuration: {
          market_market_ioc: {
            base_size: "0.01",
          },
        },
      }),
    ).rejects.toThrow("insufficient_funds");
  });

  it("requestOrderCancellation handles success and failure paths", async () => {
    mockHttpSequence([{
      results: [{ order_id: VALID_UUID, success: true, failure_reason: "" }],
    }]);
    await expect(requestOrderCancellation(VALID_UUID)).resolves.toBe(true);

    mockHttpSequence([{
      results: [{ order_id: VALID_UUID, success: false, failure_reason: "ALREADY_DONE" }],
    }]);
    await expect(requestOrderCancellation(VALID_UUID)).rejects.toThrow("Cancel failed: ALREADY_DONE");

    mockHttpSequence([{
      results: [{ order_id: "223e4567-e89b-42d3-a456-426614174000", success: true, failure_reason: "" }],
    }]);
    await expect(requestOrderCancellation(VALID_UUID)).rejects.toThrow("not found in response");
  });

  it("requestOrders paginates until has_next is false", async () => {
    const requestSpy = mockHttpSequence([
      { orders: [], cursor: "abc", has_next: true },
      { orders: [], has_next: false },
    ]);

    const orders = await requestOrders("OPEN", "RETAIL_ADVANCED", "BTC-USD", "2025-01-01", "2025-01-31");

    expect(orders).toEqual([]);
    expect(requestSpy).toHaveBeenCalledTimes(2);

    const firstConfig = requestSpy.mock.calls[0]?.[0];
    const secondConfig = requestSpy.mock.calls[1]?.[0];
    expect(firstConfig?.url).toContain("order_status=OPEN");
    expect(firstConfig?.url).toContain("product_ids=BTC-USD");
    expect(secondConfig?.url).toContain("cursor=abc");
  });

  it("requestBestBidAsk returns first pricebook or throws when missing", async () => {
    mockHttpSequence([{
      pricebooks: [{ asks: [{ price: "1.1" }], bids: [{ price: "1.0" }] }],
    }]);
    await expect(requestBestBidAsk("BTC-USD")).resolves.toEqual({
      asks: [{ price: "1.1" }],
      bids: [{ price: "1.0" }],
    });

    mockHttpSequence([{ pricebooks: [] }]);
    await expect(requestBestBidAsk("BTC-USD")).rejects.toThrow("No pricebooks found");
  });

  it("requestProduct, requestMarketTrades, and requestTransactionSummary parse responses", async () => {
    mockHttpSequence([{
      product_id: "BTC-USD",
      price: "100.00",
      base_increment: "0.00000001",
      price_increment: "0.01",
      product_type: "SPOT",
    }]);
    await expect(requestProduct("BTC-USD")).resolves.toMatchObject({ product_id: "BTC-USD" });

    mockHttpSequence([{
      trades: [{ price: "100.00" }],
      best_bid: "99.50",
      best_ask: "100.50",
    }]);
    await expect(requestMarketTrades("BTC-USD", 1)).resolves.toMatchObject({ best_bid: "99.50" });

    mockHttpSequence([{
      fee_tier: {
        pricing_tier: "tier_1",
        taker_fee_rate: "0.002",
        maker_fee_rate: "0.001",
      },
      total_balance: "1000.00",
      total_fees: 12.34,
      total_volume: 5678,
    }]);
    await expect(requestTransactionSummary("SPOT")).resolves.toMatchObject({
      total_fees: 12.34,
      total_volume: 5678,
    });
  });
});
