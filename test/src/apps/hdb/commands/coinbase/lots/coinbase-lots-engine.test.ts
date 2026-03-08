import { dateUtc } from "../../../../../fixtures/time.js";
import { describe, expect, it } from "vitest";
import {
  filterLots,
  formatLotTotals,
  getLotTotals,
  matchCoinbaseLots,
  sortLots,
} from "../../../../../../../src/apps/hdb/commands/coinbase/lots/coinbase-lots-engine.js";
import type { CoinbaseTransactionRow } from "../../../../../../../src/apps/hdb/db/coinbase/transactions/coinbase-transactions-repository.js";

function tx(partial: Partial<CoinbaseTransactionRow>): CoinbaseTransactionRow {
  return {
    id: "tx",
    timestamp: dateUtc({ year: 2026, month: 1, day: 1 }),
    type: "Buy",
    asset: "BTC",
    quantity: "1",
    price_currency: "USD",
    price_at_tx: "100",
    subtotal: "100",
    total: "100",
    fee: "0",
    notes: "",
    synthetic: false,
    manual: false,
    num_quantity: "1",
    num_price_at_tx: "100",
    num_subtotal: "100",
    num_total: "100",
    num_fee: "0",
    ...partial,
  };
}

describe("coinbase lots engine", () => {
  it("matches sells with FIFO and allocates fees proportionally", () => {
    const rows = [
      tx({
        id: "buy-1",
        timestamp: dateUtc({ year: 2026, month: 1, day: 1 }),
        type: "Buy",
        num_quantity: "2",
        num_price_at_tx: "100",
        num_fee: "2",
      }),
      tx({
        id: "sell-1",
        timestamp: dateUtc({ year: 2026, month: 1, day: 10 }),
        type: "Sell",
        num_quantity: "1",
        num_price_at_tx: "110",
        num_fee: "1",
      }),
    ];

    const result = matchCoinbaseLots(rows, "FIFO", false);
    expect(result.balance).toBeCloseTo(1, 8);
    expect(result.lots).toHaveLength(1);
    expect(result.lots[0]?.basis).toBeCloseTo(101, 8);
    expect(result.lots[0]?.proceeds).toBeCloseTo(109, 8);
    expect(result.lots[0]?.gain).toBeCloseTo(8, 8);
    expect(result.lots[0]?.term).toBe("short");
  });

  it("normalizes ETH2 asset to ETH", () => {
    const result = matchCoinbaseLots([
      tx({ id: "buy-eth2", type: "Buy", asset: "ETH2", num_quantity: "1", num_price_at_tx: "2000" }),
      tx({ id: "sell-eth", type: "Sell", asset: "ETH", num_quantity: "1", num_price_at_tx: "2100" }),
    ], "FIFO", false);

    expect(result.lots[0]?.asset).toBe("ETH");
  });

  it("filters and sorts lots and formats totals", () => {
    const result = matchCoinbaseLots([
      tx({ id: "buy-1", timestamp: dateUtc({ year: 2024, month: 1, day: 1 }), type: "Buy", num_quantity: "1", num_price_at_tx: "100" }),
      tx({ id: "sell-1", timestamp: dateUtc({ year: 2025, month: 3, day: 1 }), type: "Sell", num_quantity: "1", num_price_at_tx: "130" }),
    ], "FIFO", true);

    const filtered = filterLots(result.lots, dateUtc({ year: 2025, month: 1, day: 1 }), true);
    sortLots(filtered);

    const totals = getLotTotals(filtered);
    expect(totals.totalCostBasis).toBeGreaterThan(0);
    expect(formatLotTotals(totals, "BTC")).toMatchObject({ asset: "BTC" });
  });
});
