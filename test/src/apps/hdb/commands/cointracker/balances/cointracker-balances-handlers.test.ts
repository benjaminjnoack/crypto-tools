import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { dateUtc } from "../../../../../fixtures/time.js";
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
    from: dateUtc({ year: 2026, month: 1, day: 1 }),
    to: dateUtc({ year: 2026, month: 1, day: 31 }),
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
    vi.spyOn(console, "log").mockImplementation(vi.fn());
  });

  it("selects balances and prints table", async () => {
    const rows = await cointrackerBalances("btc:eth", { includeType: true });

    expect(selectCointrackerBalancesMock).toHaveBeenCalledWith(
      {
        currencies: ["BTC", "ETH"],
        from: dateUtc({ year: 2026, month: 1, day: 1 }),
        to: dateUtc({ year: 2026, month: 1, day: 31 }),
      },
      true,
    );
    expect(tableMock).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([{ currency: "BTC", balance: "1" }]);
  });

  it("prints cointracker balances as json", async () => {
    const logSpy = vi.spyOn(console, "log");

    await cointrackerBalances("btc:eth", { includeType: true, json: true });

    expect(tableMock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]?.[0]).toContain("\"filters\"");
    expect(logSpy.mock.calls[0]?.[0]).toContain("\"includeType\": true");
  });

  it("writes cointracker balances json to disk and respects quiet", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cointracker-balances-json-"));
    const filePath = path.join(root, "balances.json");
    const logSpy = vi.spyOn(console, "log");

    await cointrackerBalances("btc", { jsonFile: filePath, quiet: true });

    const content = await fs.readFile(filePath, "utf8");
    expect(content).toContain("\"currencies\": [");
    expect(content).toContain("\"BTC\"");
    expect(logSpy).not.toHaveBeenCalled();
    expect(tableMock).not.toHaveBeenCalled();
  });

  it("rebuilds balances table with truncate flow", async () => {
    const count = await cointrackerBalancesRegenerate({ drop: false });

    expect(createCointrackerBalancesTableMock).toHaveBeenCalledTimes(1);
    expect(truncateCointrackerBalancesTableMock).toHaveBeenCalledTimes(1);
    expect(rebuildCointrackerBalancesLedgerMock).toHaveBeenCalledTimes(1);
    expect(dropCointrackerBalancesTableMock).not.toHaveBeenCalled();
    expect(tableMock).toHaveBeenCalledTimes(1);
    expect(count).toBe(1);
  });

  it("rebuilds balances table with drop flow", async () => {
    await cointrackerBalancesRegenerate({ drop: true });

    expect(dropCointrackerBalancesTableMock).toHaveBeenCalledTimes(1);
    expect(createCointrackerBalancesTableMock).toHaveBeenCalledTimes(1);
    expect(rebuildCointrackerBalancesLedgerMock).toHaveBeenCalledTimes(1);
  });
});
