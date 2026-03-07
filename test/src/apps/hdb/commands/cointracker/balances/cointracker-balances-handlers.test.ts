import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getToAndFromDatesMock,
  createCointrackerBalancesTableMock,
  dropCointrackerBalancesTableMock,
  rebuildCointrackerBalancesLedgerMock,
  selectCointrackerBalancesMock,
  selectCointrackerLastBalanceMock,
  truncateCointrackerBalancesTableMock,
  tableMock,
} = vi.hoisted(() => ({
  getToAndFromDatesMock: vi.fn(() => Promise.resolve({
    from: new Date("2026-01-01T00:00:00.000Z"),
    to: new Date("2026-01-31T00:00:00.000Z"),
  })),
  createCointrackerBalancesTableMock: vi.fn(() => Promise.resolve(undefined)),
  dropCointrackerBalancesTableMock: vi.fn(() => Promise.resolve(undefined)),
  rebuildCointrackerBalancesLedgerMock: vi.fn(() => Promise.resolve(undefined)),
  selectCointrackerBalancesMock: vi.fn(() => Promise.resolve([{ currency: "BTC", balance: "1" }])),
  selectCointrackerLastBalanceMock: vi.fn(() => Promise.resolve([{ currency: "BTC", balance: "2" }])),
  truncateCointrackerBalancesTableMock: vi.fn(() => Promise.resolve(undefined)),
  tableMock: vi.fn(),
}));

vi.mock("../../../../../../../src/apps/hdb/commands/shared/date-range-utils.js", () => ({
  getToAndFromDates: getToAndFromDatesMock,
}));

vi.mock("../../../../../../../src/apps/hdb/db/cointracker/balances/cointracker-balances-repository.js", () => ({
  createCointrackerBalancesTable: createCointrackerBalancesTableMock,
  dropCointrackerBalancesTable: dropCointrackerBalancesTableMock,
  rebuildCointrackerBalancesLedger: rebuildCointrackerBalancesLedgerMock,
  selectCointrackerBalances: selectCointrackerBalancesMock,
  selectCointrackerLastBalance: selectCointrackerLastBalanceMock,
  truncateCointrackerBalancesTable: truncateCointrackerBalancesTableMock,
}));

import {
  cointrackerBalances,
  cointrackerBalancesRegenerate,
} from "../../../../../../../src/apps/hdb/commands/cointracker/balances/cointracker-balances-handlers.js";

describe("cointracker balances handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "table").mockImplementation(tableMock);
  });

  it("selects balances and prints table", async () => {
    const rows = await cointrackerBalances("btc:eth", { includeType: true });

    expect(selectCointrackerBalancesMock).toHaveBeenCalledWith(
      {
        currencies: ["BTC", "ETH"],
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-01-31T00:00:00.000Z"),
      },
      true,
    );
    expect(tableMock).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([{ currency: "BTC", balance: "1" }]);
  });

  it("refuses regenerate without --yes", async () => {
    await expect(cointrackerBalancesRegenerate({ yes: false })).rejects.toThrow(
      "Refusing to regenerate without confirmation. Re-run with --yes.",
    );
  });

  it("rebuilds balances table with truncate flow", async () => {
    const count = await cointrackerBalancesRegenerate({ yes: true, drop: false });

    expect(createCointrackerBalancesTableMock).toHaveBeenCalledTimes(1);
    expect(truncateCointrackerBalancesTableMock).toHaveBeenCalledTimes(1);
    expect(rebuildCointrackerBalancesLedgerMock).toHaveBeenCalledTimes(1);
    expect(dropCointrackerBalancesTableMock).not.toHaveBeenCalled();
    expect(tableMock).toHaveBeenCalledTimes(1);
    expect(count).toBe(1);
  });

  it("rebuilds balances table with drop flow", async () => {
    await cointrackerBalancesRegenerate({ yes: true, drop: true });

    expect(dropCointrackerBalancesTableMock).toHaveBeenCalledTimes(1);
    expect(createCointrackerBalancesTableMock).toHaveBeenCalledTimes(1);
    expect(rebuildCointrackerBalancesLedgerMock).toHaveBeenCalledTimes(1);
  });
});
