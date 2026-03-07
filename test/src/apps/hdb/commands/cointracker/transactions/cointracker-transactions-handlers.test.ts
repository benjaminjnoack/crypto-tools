import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getToAndFromDatesMock,
  selectCointrackerTransactionsMock,
  selectCointrackerTransactionsGroupMock,
  tableMock,
} = vi.hoisted(() => ({
  getToAndFromDatesMock: vi.fn(() => Promise.resolve({
    from: new Date("2026-01-01T00:00:00.000Z"),
    to: new Date("2026-01-31T00:00:00.000Z"),
  })),
  selectCointrackerTransactionsMock: vi.fn(() => Promise.resolve([{ transaction_id: "tx-1", date: "2026-01-02T00:00:00.000Z", type: "BUY", received_currency: "BTC", received_quantity: "1", sent_currency: "USD", sent_quantity: "50000", fee_amount: "10", realized_return: "0" }])),
  selectCointrackerTransactionsGroupMock: vi.fn(() => Promise.resolve([{ month: "2026-01-01", received: "1", sent: "2", fees: "3", returns: "4", net_returns: "1" }])),
  tableMock: vi.fn(),
}));

vi.mock("../../../../../../../src/apps/hdb/commands/shared/date-range-utils.js", () => ({
  getToAndFromDates: getToAndFromDatesMock,
}));

vi.mock("../../../../../../../src/apps/hdb/db/cointracker/transactions/cointracker-transactions-repository.js", () => ({
  selectCointrackerTransactions: selectCointrackerTransactionsMock,
  selectCointrackerTransactionsGroup: selectCointrackerTransactionsGroupMock,
}));

import {
  cointrackerTransactions,
  cointrackerTransactionsGroup,
} from "../../../../../../../src/apps/hdb/commands/cointracker/transactions/cointracker-transactions-handlers.js";

describe("cointracker transaction handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "table").mockImplementation(tableMock);
  });

  it("normalizes filters and prints transaction rows", async () => {
    const rows = await cointrackerTransactions("btc:eth", {
      exclude: "usdc",
      includeBalances: true,
      quiet: false,
      received: "btc",
      sent: "usd",
      type: "buy:sell",
    });

    expect(getToAndFromDatesMock).toHaveBeenCalled();
    expect(selectCointrackerTransactionsMock).toHaveBeenCalledWith(
      {
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-01-31T00:00:00.000Z"),
        assets: ["BTC", "ETH"],
        excluded: ["USDC"],
        types: ["BUY", "SELL"],
        received: ["BTC"],
        sent: ["USD"],
      },
      true,
    );
    expect(tableMock).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
  });

  it("suppresses output when quiet=true", async () => {
    await cointrackerTransactions(undefined, { quiet: true });
    expect(tableMock).not.toHaveBeenCalled();
  });

  it("passes interval to grouped query and prints rows", async () => {
    const rows = await cointrackerTransactionsGroup("btc", {
      interval: "month",
      quiet: false,
    });

    expect(selectCointrackerTransactionsGroupMock).toHaveBeenCalledWith(
      {
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-01-31T00:00:00.000Z"),
        assets: ["BTC"],
        excluded: [],
        types: [],
        received: [],
        sent: [],
      },
      "month",
    );
    expect(tableMock).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
  });
});
