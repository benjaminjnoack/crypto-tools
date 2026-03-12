import { describe, expect, it } from "vitest";
import { parseCoinbaseTransactionsStatementCsv } from "../../../../../../../src/apps/hdb/db/coinbase/transactions/coinbase-transactions-mappers.js";

describe("coinbase transactions mappers", () => {
  it("returns no rows for an empty csv", () => {
    expect(parseCoinbaseTransactionsStatementCsv("", "empty.csv", true, false)).toEqual([]);
  });

  it("parses legacy statement format", () => {
    const csv = [
      "ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes",
      "tx-legacy,2026-01-01T00:00:00Z,Reward Income,USDC,1,USD,$1.00,$1.00,$1.00,$0.00,Legacy row",
    ].join("\n");

    const rows = parseCoinbaseTransactionsStatementCsv(csv, "legacy.csv", true, false);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("tx-legacy");
    expect(rows[0]?.manual).toBe(false);
  });

  it("parses statement format with metadata preamble", () => {
    const csv = [
      "Transactions",
      "User,Dummy User,dummy-account-id",
      "ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes",
      "tx-preamble,2026-03-05 23:31:19 UTC,Reward Income,USDC,1,USD,$1.00,$1.00,$1.00,$0.00,Preamble row",
    ].join("\n");

    const rows = parseCoinbaseTransactionsStatementCsv(csv, "preamble.csv", true, false);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("tx-preamble");
    expect(rows[0]?.timestamp.toISOString()).toBe("2026-03-05T23:31:19.000Z");
  });

  it("accepts BOM-prefixed alias headers and preserves manual flag", () => {
    const csv = [
      "\uFEFFID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees/spread),Fees/Spread,Notes",
      "tx-bom,2026-03-05T23:31:19Z,Reward Income,USDC,1,USD,$1.00,$1.00,$1.00,$0.00,Alias row",
    ].join("\n");

    const rows = parseCoinbaseTransactionsStatementCsv(csv, "alias.csv", true, true);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("tx-bom");
    expect(rows[0]?.manual).toBe(true);
  });

  it("skips synthetic expansion when normalization is disabled", () => {
    const csv = [
      "ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes",
      "tx-no-normalize,2026-01-01T00:00:00Z,Advanced Trade Buy,BTC,0.1,USD,$50000,$5000,$5005,$5,Bought 0.1 BTC for 5000 USD on BTC-USD at 50000 USD/BTC",
    ].join("\n");

    const rows = parseCoinbaseTransactionsStatementCsv(csv, "no-normalize.csv", false, false);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("tx-no-normalize");
  });

  it("normalizes buy and sell variants into paired synthetic rows", () => {
    const csv = [
      "ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes",
      "tx-at-buy,2026-01-01T00:00:00Z,Advanced Trade Buy,BTC,0.1,USD,$50000,$5000,$5005,$5,Bought 0.1 BTC for 5000 USD on BTC-USD at 50000 USD/BTC",
      "tx-buy,2026-01-02T00:00:00Z,Buy,BTC,0.1,USD,$50000,$5000,$5005,$5,Bought 0.1 BTC for 5000 USD",
      "tx-at-sell,2026-01-03T00:00:00Z,Advanced Trade Sell,BTC,0.1,USD,$50000,$4995,$5000,$5,Sold 0.1 BTC for 5000 USD on BTC-USD at 50000 USD/BTC",
      "tx-sell,2026-01-04T00:00:00Z,Sell,BTC,0.1,USD,$50000,$4995,$5000,$5,Sold 0.1 BTC for 5000 USD",
    ].join("\n");

    const rows = parseCoinbaseTransactionsStatementCsv(csv, "normalized.csv", true, false);

    expect(rows).toHaveLength(8);
    expect(rows[1]?.id).toBe("synthetic-tx-at-buy");
    expect(rows[1]?.type).toBe("Advanced Trade Sell");
    expect(rows[1]?.asset).toBe("USD");
    expect(rows[3]?.id).toBe("synthetic-tx-buy");
    expect(rows[3]?.type).toBe("Sell");
    expect(rows[3]?.asset).toBe("USD");
    expect(rows[5]?.id).toBe("synthetic-tx-at-sell");
    expect(rows[5]?.type).toBe("Advanced Trade Buy");
    expect(rows[5]?.asset).toBe("USD");
    expect(rows[7]?.id).toBe("synthetic-tx-sell");
    expect(rows[7]?.type).toBe("Buy");
    expect(rows[7]?.asset).toBe("USD");
  });

  it("throws a descriptive format error for unsupported headers", () => {
    const csv = [
      "Transactions",
      "User,Dummy User,dummy-account-id",
      "TxId,When,Type,Coin,Qty,Currency,Price,Subtotal,Total,Fee,Description",
      "tx-1,2026-03-05 23:31:19 UTC,Reward Income,USDC,1,USD,$1.00,$1.00,$1.00,$0.00,Preamble row",
    ].join("\n");

    expect(() => parseCoinbaseTransactionsStatementCsv(csv, "unknown.csv", true, false)).toThrow(
      "Unsupported Coinbase statement CSV format",
    );
    expect(() => parseCoinbaseTransactionsStatementCsv(csv, "unknown.csv", true, false)).toThrow(
      "Missing required columns",
    );
  });

  it("reports accurate row numbers for preamble format data errors", () => {
    const csv = [
      "Transactions",
      "User,Dummy User,dummy-account-id",
      "ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes",
      "tx-preamble,not-a-date,Reward Income,USDC,1,USD,$1.00,$1.00,$1.00,$0.00,Preamble row",
    ].join("\n");

    expect(() => parseCoinbaseTransactionsStatementCsv(csv, "bad-ts.csv", true, false)).toThrow(
      "row 4: invalid timestamp not-a-date",
    );
  });

  it("throws when normalized trade notes do not match the expected shape", () => {
    const csv = [
      "ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes",
      "tx-bad,2026-01-01T00:00:00Z,Buy,BTC,0.1,USD,$50000,$5000,$5005,$5,unexpected notes",
    ].join("\n");

    expect(() => parseCoinbaseTransactionsStatementCsv(csv, "bad-notes.csv", true, false)).toThrow(
      "Cannot normalize Buy",
    );
  });

  it("throws when a numeric money-like field is empty", () => {
    const csv = [
      "ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes",
      "tx-empty,2026-01-01T00:00:00Z,Reward Income,USDC,1,USD,,$1.00,$1.00,$0.00,Empty price row",
    ].join("\n");

    expect(() => parseCoinbaseTransactionsStatementCsv(csv, "empty-price.csv", true, false)).toThrow(
      "price_at_tx is empty",
    );
  });
});
