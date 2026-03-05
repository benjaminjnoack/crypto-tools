import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CoinbaseOrder } from "../../../../../../../src/shared/coinbase/schemas/orders.js";
import {
  makeLimitOrder,
  makeStopLimitOrder,
} from "../../../../../fixtures/coinbase-orders.js";

const { getClientMock, loggerDebugMock } = vi.hoisted(() => ({
  getClientMock: vi.fn(),
  loggerDebugMock: vi.fn(),
}));

vi.mock("../../../../../../../src/apps/hdb/db/client.js", () => ({
  getClient: getClientMock,
}));

vi.mock("../../../../../../../src/shared/log/logger.js", () => ({
  logger: {
    debug: loggerDebugMock,
  },
}));

const VALID_UUID = "123e4567-e89b-42d3-a456-426614174000";

async function loadRepositoryModule() {
  return import("../../../../../../../src/apps/hdb/db/coinbase/orders/repository.js");
}

describe("hdb coinbase order repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("creates table and memoizes ensureCoinbaseOrdersTableExists", async () => {
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [] }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });
    const repo = await loadRepositoryModule();

    await repo.ensureCoinbaseOrdersTableExists();
    await repo.ensureCoinbaseOrdersTableExists();

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0]?.[0]).toContain("CREATE TABLE IF NOT EXISTS coinbase_orders");
  });

  it("resets ensure state when table creation fails", async () => {
    const queryMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("create failed"))
      .mockResolvedValueOnce({ rows: [] });
    getClientMock.mockResolvedValue({ query: queryMock });
    const repo = await loadRepositoryModule();

    await expect(repo.ensureCoinbaseOrdersTableExists()).rejects.toThrow("create failed");
    await expect(repo.ensureCoinbaseOrdersTableExists()).resolves.toBeUndefined();
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it("drops table and clears memoized ensure state", async () => {
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [] }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });
    const repo = await loadRepositoryModule();

    await repo.ensureCoinbaseOrdersTableExists();
    await repo.dropCoinbaseOrdersTable();
    await repo.ensureCoinbaseOrdersTableExists();

    expect(queryMock.mock.calls[1]?.[0]).toContain("DROP TABLE IF EXISTS coinbase_orders");
    expect(queryMock).toHaveBeenCalledTimes(3);
  });

  it("inserts limit order with mapped values and logs query result", async () => {
    const queryMock = vi
      .fn<(sql: string, values?: unknown[]) => Promise<{ rows?: unknown[]; command?: string; rowCount?: number }>>()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ command: "INSERT", rowCount: 1 });
    getClientMock.mockResolvedValue({ query: queryMock });
    const repo = await loadRepositoryModule();

    await repo.insertCoinbaseOrder({
      ...makeLimitOrder({
        baseSize: "1.0",
        limitPrice: "100.00",
      }),
      created_time: "2026-01-01T00:00:00.000Z",
    } as CoinbaseOrder);

    expect(queryMock).toHaveBeenCalledTimes(2);
    const insertSql = queryMock.mock.calls[1]?.[0] as string;
    const insertValues = queryMock.mock.calls[1]?.[1] as unknown[];
    expect(insertSql).toContain("INSERT INTO coinbase_orders");
    expect(insertValues[0]).toBe(VALID_UUID);
    expect(insertValues[3]).toBe("100.00");
    expect(insertValues[4]).toBeNull();
    expect(insertValues[9]).toBe("1.0");
    expect(insertValues[17]).toBe("COINBASE");
    expect(loggerDebugMock).toHaveBeenCalledWith("INSERT", 1);
  });

  it("throws when inserting order without created_time", async () => {
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [] }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });
    const repo = await loadRepositoryModule();
    const badOrder = {
      ...makeLimitOrder({
        baseSize: "1.0",
        limitPrice: "100.00",
      }),
      created_time: "2026-01-01T00:00:00.000Z",
    } as Record<string, unknown>;
    delete badOrder.created_time;

    await expect(repo.insertCoinbaseOrder(badOrder as unknown as CoinbaseOrder)).rejects.toThrow(
      "insertCoinbaseOrder => order.created_time is missing or not a string",
    );
  });

  it("throws when inserting unknown order_type", async () => {
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [] }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });
    const repo = await loadRepositoryModule();

    const invalidOrder = {
      ...makeLimitOrder({
        baseSize: "1.0",
        limitPrice: "100.00",
      }),
      created_time: "2026-01-01T00:00:00.000Z",
      order_type: "INVALID_TYPE",
    } as unknown as CoinbaseOrder;

    await expect(repo.insertCoinbaseOrder(invalidOrder)).rejects.toThrow(
      "insertCoinbaseOrder => unknown order_type",
    );
  });

  it("selects and maps a single order row", async () => {
    const row = {
      order_id: VALID_UUID,
      product_id: "BTC-USD",
      side: "BUY",
      limit_price: "100.00",
      stop_price: null,
      status: "OPEN",
      filled_size: "0",
      filled_value: "0",
      average_filled_price: "0",
      base_size: "1.0",
      completion_percentage: "0",
      total_fees: "0",
      total_value_after_fees: "0",
      order_type: "LIMIT",
      created_time: "2026-01-01T00:00:00.000Z",
      last_fill_time: null,
      product_type: "SPOT",
      exchange: "COINBASE",
    };
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [row] }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });
    const repo = await loadRepositoryModule();

    const order = await repo.selectCoinbaseOrder(VALID_UUID);

    expect(order.order_id).toBe(VALID_UUID);
    const config = order.order_configuration as { limit_limit_gtc: { base_size: string } };
    expect(config.limit_limit_gtc.base_size).toBe("1.0");
  });

  it("throws when selecting unknown order id", async () => {
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [] }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });
    const repo = await loadRepositoryModule();

    await expect(repo.selectCoinbaseOrder(VALID_UUID)).rejects.toThrow(
      "selectCoinbaseOrder => no order found with that ID.",
    );
  });

  it("throws when selecting row with unknown order_type", async () => {
    const row = {
      order_id: VALID_UUID,
      product_id: "BTC-USD",
      side: "BUY",
      limit_price: "100.00",
      stop_price: null,
      status: "OPEN",
      filled_size: "0",
      filled_value: "0",
      average_filled_price: "0",
      base_size: "1.0",
      completion_percentage: "0",
      total_fees: "0",
      total_value_after_fees: "0",
      order_type: "INVALID_TYPE",
      created_time: "2026-01-01T00:00:00.000Z",
      last_fill_time: null,
      product_type: "SPOT",
      exchange: "COINBASE",
    };
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [row] }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });
    const repo = await loadRepositoryModule();

    await expect(repo.selectCoinbaseOrder(VALID_UUID)).rejects.toThrow(
      "selectCoinbaseOrder => unknown order_type",
    );
  });

  it("inserts stop-limit order with mapped stop and limit fields", async () => {
    const queryMock = vi
      .fn<(sql: string, values?: unknown[]) => Promise<{ rows?: unknown[]; command?: string; rowCount?: number }>>()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ command: "INSERT", rowCount: 1 });
    getClientMock.mockResolvedValue({ query: queryMock });
    const repo = await loadRepositoryModule();

    const stopLimitOrder = {
      ...makeStopLimitOrder({
        baseSize: "0.5",
        limitPrice: "101.00",
        stopPrice: "99.00",
      }),
      created_time: "2026-01-01T00:00:00.000Z",
    } as CoinbaseOrder;

    await repo.insertCoinbaseOrder(stopLimitOrder);

    const insertValues = queryMock.mock.calls[1]?.[1] as unknown[];
    expect(insertValues[3]).toBe("101.00");
    expect(insertValues[4]).toBe("99.00");
    expect(insertValues[9]).toBe("0.5");
  });

  it("maps TAKE_PROFIT_STOP_LOSS row configuration on select", async () => {
    const row = {
      order_id: VALID_UUID,
      product_id: "BTC-USD",
      side: "SELL",
      limit_price: "120.00",
      stop_price: "95.00",
      status: "FILLED",
      filled_size: "1.0",
      filled_value: "120.00",
      average_filled_price: "120.00",
      base_size: "1.0",
      completion_percentage: "100",
      total_fees: "0.12",
      total_value_after_fees: "119.88",
      order_type: "TAKE_PROFIT_STOP_LOSS",
      created_time: "2026-01-01T00:00:00.000Z",
      last_fill_time: "2026-01-01T00:10:00.000Z",
      product_type: "SPOT",
      exchange: "COINBASE",
    };
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [row] }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });
    const repo = await loadRepositoryModule();

    const order = await repo.selectCoinbaseOrder(VALID_UUID);
    const config = order.order_configuration as {
      trigger_bracket_gtc: { base_size: string; limit_price: string; stop_trigger_price: string };
    };
    expect(config.trigger_bracket_gtc.base_size).toBe("1.0");
    expect(config.trigger_bracket_gtc.limit_price).toBe("120.00");
    expect(config.trigger_bracket_gtc.stop_trigger_price).toBe("95.00");
  });

  it("maps BRACKET row configuration on select", async () => {
    const row = {
      order_id: VALID_UUID,
      product_id: "BTC-USD",
      side: "SELL",
      limit_price: "110.00",
      stop_price: "98.00",
      status: "OPEN",
      filled_size: "0",
      filled_value: "0",
      average_filled_price: "0",
      base_size: "1.0",
      completion_percentage: "0",
      total_fees: "0",
      total_value_after_fees: "0",
      order_type: "BRACKET",
      created_time: "2026-01-01T00:00:00.000Z",
      last_fill_time: null,
      product_type: "SPOT",
      exchange: "COINBASE",
    };
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [row] }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });
    const repo = await loadRepositoryModule();

    const order = await repo.selectCoinbaseOrder(VALID_UUID);
    const config = order.order_configuration as {
      trigger_bracket_gtc: { base_size: string; limit_price: string; stop_trigger_price: string };
    };
    expect(config.trigger_bracket_gtc.base_size).toBe("1.0");
    expect(config.trigger_bracket_gtc.limit_price).toBe("110.00");
    expect(config.trigger_bracket_gtc.stop_trigger_price).toBe("98.00");
  });

  it("maps STOP_LIMIT row configuration on select", async () => {
    const row = {
      order_id: VALID_UUID,
      product_id: "BTC-USD",
      side: "BUY",
      limit_price: "101.00",
      stop_price: "100.00",
      status: "OPEN",
      filled_size: "0",
      filled_value: "0",
      average_filled_price: "0",
      base_size: "0.5",
      completion_percentage: "0",
      total_fees: "0",
      total_value_after_fees: "0",
      order_type: "STOP_LIMIT",
      created_time: "2026-01-01T00:00:00.000Z",
      last_fill_time: null,
      product_type: "SPOT",
      exchange: "COINBASE",
    };
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [row] }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });
    const repo = await loadRepositoryModule();

    const order = await repo.selectCoinbaseOrder(VALID_UUID);
    const config = order.order_configuration as {
      stop_limit_stop_limit_gtc: { base_size: string; limit_price: string; stop_price: string };
    };
    expect(config.stop_limit_stop_limit_gtc.base_size).toBe("0.5");
    expect(config.stop_limit_stop_limit_gtc.limit_price).toBe("101.00");
    expect(config.stop_limit_stop_limit_gtc.stop_price).toBe("100.00");
  });

  it("returns first/last fill times according to flags", async () => {
    const firstDate = new Date("2025-01-01T00:00:00.000Z");
    const lastDate = new Date("2026-01-01T00:00:00.000Z");
    const queryMock = vi
      .fn<(sql: string, values?: unknown[]) => Promise<{ rows: Array<{ last_fill_time: Date }> }>>()
      .mockResolvedValueOnce({ rows: [{ last_fill_time: firstDate }] })
      .mockResolvedValueOnce({ rows: [{ last_fill_time: lastDate }] });
    getClientMock.mockResolvedValue({ query: queryMock });
    const repo = await loadRepositoryModule();

    const result = await repo.selectCoinbaseOrderByLastFillTime(true, true);

    expect(result).toEqual({ first: firstDate, last: lastDate });
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it("sums total fees with optional product/side filters", async () => {
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: Array<{ total_fees: string | null }> }>>(
      () => Promise.resolve({ rows: [{ total_fees: "12.34" }] }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });
    const repo = await loadRepositoryModule();

    const from = new Date("2026-01-01T00:00:00.000Z");
    const to = new Date("2026-02-01T00:00:00.000Z");
    const total = await repo.selectCoinbaseOrdersSumTotalFees(from, to, "BTC-USD", "buy");

    expect(total).toBe(12.34);
    const calls = queryMock.mock.calls as unknown[][];
    const values = calls[0]?.[1] as unknown[];
    expect(values).toEqual([from, to, "BTC-USD", "BUY"]);
    expect((calls[0]?.[0] as string)).toContain("product_id = $3");
    expect((calls[0]?.[0] as string)).toContain("side = $4");
  });

  it("returns zero fee sum when query returns null", async () => {
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: Array<{ total_fees: string | null }> }>>(
      () => Promise.resolve({ rows: [{ total_fees: null }] }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });
    const repo = await loadRepositoryModule();

    const total = await repo.selectCoinbaseOrdersSumTotalFees(new Date(), new Date());
    expect(total).toBe(0);
  });
});
