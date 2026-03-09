import { describe, expect, it } from "vitest";
import { parseCoinbaseTransactionsStatementCsv } from "../../../../../../../src/apps/hdb/db/coinbase/transactions/coinbase-transactions-mappers.js";

describe("coinbase transactions mappers", () => {
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
});
