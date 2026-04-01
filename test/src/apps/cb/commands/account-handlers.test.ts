import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeEntityUuid } from "../../../fixtures/identifiers.js";

const {
  requestAccountsMock,
  requestCurrencyAccountMock,
  getProductInfoMock,
  getTransactionSummaryMock,
  toIncrementMock,
  writeFileSyncMock,
  cwdMock,
} = vi.hoisted(() => ({
  requestAccountsMock: vi.fn<() => Promise<Array<{
    currency: string;
    hold: { value: string };
    available_balance: { value: string };
    type: "ACCOUNT_TYPE_CRYPTO" | "ACCOUNT_TYPE_FIAT";
    uuid: string;
  }>>>(() => Promise.resolve([])),
  requestCurrencyAccountMock: vi.fn(() => Promise.resolve({
    available: "1000.00",
    hold: "50.00",
    total: "1050.00",
  })),
  getProductInfoMock: vi.fn(() => Promise.resolve({
    price: "100.00",
    base_increment: "0.00000001",
    price_increment: "0.01",
  })),
  getTransactionSummaryMock: vi.fn(() => Promise.resolve({
    fee_tier: {
      pricing_tier: "tier_1",
      taker_fee_rate: "0.002",
      maker_fee_rate: "0.001",
    },
    total_balance: "1234.56",
    total_volume: 10000,
    total_fees: 123.45,
  })),
  toIncrementMock: vi.fn((increment: string, value: number) => {
    const decimals = increment.includes(".") ? increment.split(".")[1]?.length ?? 0 : 0;
    return value.toFixed(decimals);
  }),
  writeFileSyncMock: vi.fn(),
  cwdMock: vi.fn(() => "/mock-cwd"),
}));

vi.mock("node:fs", () => ({
  writeFileSync: writeFileSyncMock,
}));

vi.mock("node:process", () => ({
  default: {
    cwd: cwdMock,
  },
}));

vi.mock("../../../../../src/shared/coinbase/rest.js", () => ({
  requestAccounts: requestAccountsMock,
  requestCurrencyAccount: requestCurrencyAccountMock,
}));

vi.mock("../../../../../src/shared/coinbase/product-service.js", () => ({
  getProductInfo: getProductInfoMock,
}));

vi.mock("../../../../../src/shared/coinbase/transaction-summary-service.js", () => ({
  getTransactionSummary: getTransactionSummaryMock,
}));

vi.mock("../../../../../src/shared/common/increment.js", () => ({
  toIncrement: toIncrementMock,
}));

import {
  handleAccountsAction,
  handleBalanceAction,
  handleCashAction,
  handleFeesAction,
} from "../../../../../src/apps/cb/commands/account-handlers.js";

const btcAccount = {
  currency: "BTC",
  hold: { value: "0.1" },
  available_balance: { value: "0.2" },
  type: "ACCOUNT_TYPE_CRYPTO",
  uuid: makeEntityUuid(1),
} as const;

const usdAccount = {
  currency: "USD",
  hold: { value: "10" },
  available_balance: { value: "40" },
  type: "ACCOUNT_TYPE_FIAT",
  uuid: makeEntityUuid(2),
} as const;

describe("accounts command handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders product-specific valuation table", async () => {
    requestAccountsMock.mockResolvedValueOnce([btcAccount, usdAccount]);
    const tableSpy = vi.spyOn(console, "table").mockImplementation(() => undefined);

    await handleAccountsAction("BTC-USD", {});

    expect(getProductInfoMock).toHaveBeenCalledWith("BTC-USD");
    expect(tableSpy).toHaveBeenCalledTimes(1);
    expect(tableSpy.mock.calls[0]?.[0]).toEqual([
      {
        Currency: "BTC",
        Price: "100.00",
        Hold: "0.1 ($10.00)",
        Available: "0.2 ($20.00)",
      },
    ]);
    tableSpy.mockRestore();
  });

  it("filters crypto accounts and zero balances in non-product mode", async () => {
    requestAccountsMock.mockResolvedValueOnce([
      btcAccount,
      {
        currency: "ETH",
        hold: { value: "0" },
        available_balance: { value: "0" },
        type: "ACCOUNT_TYPE_CRYPTO",
        uuid: makeEntityUuid(3),
      },
      usdAccount,
    ]);
    const tableSpy = vi.spyOn(console, "table").mockImplementation(() => undefined);

    await handleAccountsAction(null, { crypto: true });

    expect(getProductInfoMock).toHaveBeenCalledWith("BTC-USD", false, { tryFetchOnce: true });
    expect(tableSpy.mock.calls[0]?.[0]).toEqual([
      {
        Currency: "BTC",
        Hold: "0.10000000",
        Available: "0.20000000",
      },
    ]);
    tableSpy.mockRestore();
  });

  it("delegates cash shortcut to accounts with cash flag", async () => {
    requestAccountsMock.mockResolvedValueOnce([btcAccount, usdAccount]);
    const tableSpy = vi.spyOn(console, "table").mockImplementation(() => undefined);

    await handleCashAction();

    expect(tableSpy.mock.calls[0]?.[0]).toEqual([
      {
        Currency: "USD",
        Hold: "10.00",
        Available: "40.00",
      },
    ]);
    tableSpy.mockRestore();
  });

  it("shows raw hold and available sizes without increment-based rounding", async () => {
    requestAccountsMock.mockResolvedValueOnce([
      {
        currency: "SOL",
        hold: { value: "1.2345" },
        available_balance: { value: "10.2" },
        type: "ACCOUNT_TYPE_CRYPTO",
        uuid: makeEntityUuid(12),
      },
    ]);
    getProductInfoMock.mockResolvedValueOnce({
      price: "100.00",
      price_increment: "0.01",
      base_increment: "0.001",
    });
    const tableSpy = vi.spyOn(console, "table").mockImplementation(() => undefined);

    await handleAccountsAction(null, { raw: true });

    expect(getProductInfoMock).toHaveBeenCalledWith("SOL-USD", false, { tryFetchOnce: true });
    expect(toIncrementMock).not.toHaveBeenCalled();
    expect(tableSpy.mock.calls[0]?.[0]).toEqual([
      {
        Currency: "SOL",
        Hold: "1.2345",
        Available: "10.2",
      },
    ]);
    tableSpy.mockRestore();
  });

  it("writes all filtered accounts to default json file", async () => {
    requestAccountsMock.mockResolvedValueOnce([
      btcAccount,
      {
        currency: "ETH",
        hold: { value: "0" },
        available_balance: { value: "0" },
        type: "ACCOUNT_TYPE_CRYPTO",
        uuid: makeEntityUuid(13),
      },
      usdAccount,
    ]);
    const tableSpy = vi.spyOn(console, "table").mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await handleAccountsAction(null, { crypto: true, json: true });

    expect(writeFileSyncMock).toHaveBeenCalledWith(
      "/mock-cwd/accounts.json",
      `${JSON.stringify([
        {
          currency: "BTC",
          type: "ACCOUNT_TYPE_CRYPTO",
          hold: "0.10000000",
          available: "0.20000000",
        },
        {
          currency: "ETH",
          type: "ACCOUNT_TYPE_CRYPTO",
          hold: "0.00000000",
          available: "0.00000000",
        },
      ], null, 2)}\n`,
    );
    expect(logSpy).toHaveBeenCalledWith("Wrote accounts JSON to /mock-cwd/accounts.json");
    expect(tableSpy.mock.calls[0]?.[0]).toEqual([
      {
        Currency: "BTC",
        Hold: "0.10000000",
        Available: "0.20000000",
      },
    ]);
    tableSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("writes raw balances to a provided json filepath", async () => {
    requestAccountsMock.mockResolvedValueOnce([
      {
        currency: "SOL",
        hold: { value: "1.2345" },
        available_balance: { value: "10.2" },
        type: "ACCOUNT_TYPE_CRYPTO",
        uuid: makeEntityUuid(14),
      },
      usdAccount,
    ]);
    getProductInfoMock.mockResolvedValueOnce({
      price: "100.00",
      price_increment: "0.01",
      base_increment: "0.001",
    });
    const tableSpy = vi.spyOn(console, "table").mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await handleAccountsAction(null, { json: "snapshots/accounts.json", raw: true });

    expect(writeFileSyncMock).toHaveBeenCalledWith(
      "/mock-cwd/snapshots/accounts.json",
      `${JSON.stringify([
        {
          currency: "SOL",
          type: "ACCOUNT_TYPE_CRYPTO",
          hold: "1.2345",
          available: "10.2",
        },
        {
          currency: "USD",
          type: "ACCOUNT_TYPE_FIAT",
          hold: "10",
          available: "40",
        },
      ], null, 2)}\n`,
    );
    expect(logSpy).toHaveBeenCalledWith("Wrote accounts JSON to /mock-cwd/snapshots/accounts.json");
    expect(tableSpy.mock.calls[0]?.[0]).toEqual([
      {
        Currency: "SOL",
        Hold: "1.2345",
        Available: "10.2",
      },
      {
        Currency: "USD",
        Hold: "10",
        Available: "40",
      },
    ]);
    tableSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("adds value column and forces current price refresh when value mode is enabled", async () => {
    requestAccountsMock.mockResolvedValueOnce([btcAccount]);
    getProductInfoMock.mockResolvedValueOnce({
      price: "95.00",
      price_increment: "0.01",
      base_increment: "0.00000001",
    });
    getProductInfoMock.mockResolvedValueOnce({
      price: "100.00",
      price_increment: "0.01",
      base_increment: "0.001",
    });
    const tableSpy = vi.spyOn(console, "table").mockImplementation(() => undefined);

    await handleAccountsAction(null, { crypto: true, value: true });

    expect(getProductInfoMock).toHaveBeenNthCalledWith(1, "BTC-USD", false, { tryFetchOnce: true });
    expect(getProductInfoMock).toHaveBeenNthCalledWith(2, "BTC-USD", true);
    expect(tableSpy.mock.calls[0]?.[0]).toEqual([
      {
        Currency: "BTC",
        Hold: "0.100",
        Available: "0.200",
        Value: "$30.00",
      },
    ]);
    tableSpy.mockRestore();
  });

  it("uses fiat increment fallback for USDC when no cached product exists", async () => {
    requestAccountsMock.mockResolvedValueOnce([
      {
        currency: "USDC",
        hold: { value: "1.5" },
        available_balance: { value: "10" },
        type: "ACCOUNT_TYPE_CRYPTO",
        uuid: makeEntityUuid(9),
      },
    ]);
    const tableSpy = vi.spyOn(console, "table").mockImplementation(() => undefined);

    await handleAccountsAction(null, {});

    expect(getProductInfoMock).not.toHaveBeenCalled();
    expect(tableSpy.mock.calls[0]?.[0]).toEqual([
      {
        Currency: "USDC",
        Hold: "1.50",
        Available: "10.00",
      },
    ]);
    tableSpy.mockRestore();
  });

  it("falls back to USDC-quoted product increment when USD-quoted lookup fails", async () => {
    requestAccountsMock.mockResolvedValueOnce([
      {
        currency: "SOL",
        hold: { value: "1.2345" },
        available_balance: { value: "10.2" },
        type: "ACCOUNT_TYPE_CRYPTO",
        uuid: makeEntityUuid(10),
      },
    ]);
    getProductInfoMock.mockRejectedValueOnce(new Error("cache miss"));
    getProductInfoMock.mockResolvedValueOnce({
      price: "100.00",
      price_increment: "0.01",
      base_increment: "0.001",
    });
    const tableSpy = vi.spyOn(console, "table").mockImplementation(() => undefined);

    await handleAccountsAction(null, {});

    expect(getProductInfoMock).toHaveBeenNthCalledWith(1, "SOL-USD", false, { tryFetchOnce: true });
    expect(getProductInfoMock).toHaveBeenNthCalledWith(2, "SOL-USDC", false, { tryFetchOnce: true });
    expect(tableSpy.mock.calls[0]?.[0]).toEqual([
      {
        Currency: "SOL",
        Hold: "1.234",
        Available: "10.200",
      },
    ]);
    tableSpy.mockRestore();
  });

  it("shows N/A value when no supported product can be resolved", async () => {
    requestAccountsMock.mockResolvedValueOnce([
      {
        currency: "MOBILE",
        hold: { value: "5" },
        available_balance: { value: "10" },
        type: "ACCOUNT_TYPE_CRYPTO",
        uuid: makeEntityUuid(11),
      },
    ]);
    getProductInfoMock.mockRejectedValueOnce(new Error("not supported"));
    getProductInfoMock.mockRejectedValueOnce(new Error("not supported"));
    const tableSpy = vi.spyOn(console, "table").mockImplementation(() => undefined);

    await handleAccountsAction(null, { value: true });

    expect(getProductInfoMock).toHaveBeenNthCalledWith(1, "MOBILE-USD", false, { tryFetchOnce: true });
    expect(getProductInfoMock).toHaveBeenNthCalledWith(2, "MOBILE-USDC", false, { tryFetchOnce: true });
    expect(tableSpy.mock.calls[0]?.[0]).toEqual([
      {
        Currency: "MOBILE",
        Hold: "5.00000000",
        Available: "10.00000000",
        Value: "N/A",
      },
    ]);
    tableSpy.mockRestore();
  });

  it("prints usd balance values", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await handleBalanceAction();

    expect(requestCurrencyAccountMock).toHaveBeenCalledWith("USD", "0.01");
    expect(logSpy).toHaveBeenCalledWith("USD ($)");
    expect(logSpy).toHaveBeenCalledWith("Available: $1000.00");
    expect(logSpy).toHaveBeenCalledWith("Hold: $50.00");
    expect(logSpy).toHaveBeenCalledWith("Total: $1050.00");
    logSpy.mockRestore();
  });

  it("prints transaction summary fee information", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await handleFeesAction();

    expect(getTransactionSummaryMock).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("Transaction Summary:");
    expect(logSpy).toHaveBeenCalledWith("  Pricing Tier: tier_1");
    expect(logSpy).toHaveBeenCalledWith("  Taker Fee Rate: 0.002");
    expect(logSpy).toHaveBeenCalledWith("  Maker Fee Rate: 0.001");
    expect(logSpy).toHaveBeenCalledWith("  Total fees: 123.45");
    logSpy.mockRestore();
  });
});
