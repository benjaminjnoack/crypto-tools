import { describe, expect, it } from "vitest";
import { parseCointrackerTransactionsCsv } from "../../../../../../../src/apps/hdb/db/cointracker/transactions/cointracker-transactions-mappers.js";

describe("cointracker transactions mappers", () => {
  it("parses csv rows into insert-ready records", () => {
    const csv = [
      "Date,Type,Transaction ID,Received Quantity,Received Currency,Received Cost Basis (USD),Received Wallet,Received Address,Received Comment,Sent Quantity,Sent Currency,Sent Cost Basis (USD),Sent Wallet,Sent Address,Sent Comment,Fee Amount,Fee Currency,Fee Cost Basis (USD),Realized Return (USD),Fee Realized Return (USD),Transaction Hash",
      "2026-01-01T00:00:00,BUY,tx-1,1,BTC,100,,,note,50000,USD,50000,,,,10,USD,10,0,0,",
    ].join("\n");

    const rows = parseCointrackerTransactionsCsv(csv, "test.csv");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.transaction_id).toBe("tx-1");
    expect(rows[0]?.date.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(rows[0]?.received_comment).toBe("note");
    expect(rows[0]?.transaction_hash).toBeNull();
  });

  it("throws for malformed rows", () => {
    const csv = "Date,Type\n2026-01-01T00:00:00,BUY";

    expect(() => parseCointrackerTransactionsCsv(csv, "bad.csv")).toThrow("CSV validation failed");
  });
});
