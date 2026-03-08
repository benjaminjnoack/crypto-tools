import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClientMock, loggerDebugMock } = vi.hoisted(() => ({
  getClientMock: vi.fn(),
  loggerDebugMock: vi.fn(),
}));

vi.mock("../../../../../../../src/apps/hdb/db/db-client.js", () => ({
  getClient: getClientMock,
}));

vi.mock("../../../../../../../src/shared/log/logger.js", () => ({
  logger: {
    debug: loggerDebugMock,
  },
}));

import {
  createCointrackerBalancesTable,
  dropCointrackerBalancesTable,
  rebuildCointrackerBalancesLedger,
  selectCointrackerBalances,
  selectCointrackerLastBalance,
  truncateCointrackerBalancesTable,
} from "../../../../../../../src/apps/hdb/db/cointracker/balances/cointracker-balances-repository.js";

describe("cointracker balances repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs lifecycle and rebuild queries", async () => {
    const queryMock = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>(
      () => Promise.resolve({ rows: [] }),
    );
    getClientMock.mockResolvedValue({ query: queryMock });

    await createCointrackerBalancesTable();
    await truncateCointrackerBalancesTable();
    await rebuildCointrackerBalancesLedger();
    await dropCointrackerBalancesTable();

    expect(queryMock).toHaveBeenCalledTimes(4);
    expect(queryMock.mock.calls[2]?.[0]).toContain("INSERT INTO cointracker_balances_ledger");
  });

  it("selects balances and last balances", async () => {
    const queryMock = vi
      .fn<(sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>>()
      .mockResolvedValueOnce({ rows: [{ currency: "BTC" }] })
      .mockResolvedValueOnce({ rows: [{ currency: "ETH", balance: "1" }] });
    getClientMock.mockResolvedValue({ query: queryMock });

    const balances = await selectCointrackerBalances({ currencies: ["BTC"] }, true);
    const last = await selectCointrackerLastBalance();

    expect(balances).toEqual([{ currency: "BTC" }]);
    expect(last).toEqual([{ currency: "ETH", balance: "1" }]);
    expect(loggerDebugMock).toHaveBeenCalledTimes(2);
  });
});
