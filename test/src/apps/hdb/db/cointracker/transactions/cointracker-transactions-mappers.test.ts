import { isoUtc } from "../../../../../fixtures/time.js";
import { describe, expect, it } from "vitest";
import { parseCointrackerTransactionsCsv } from "../../../../../../../src/apps/hdb/db/cointracker/transactions/cointracker-transactions-mappers.js";

describe("cointracker transactions mappers", () => {
  it("parses legacy csv rows into insert-ready records", () => {
    const csv = [
      "Date,Type,Transaction ID,Received Quantity,Received Currency,Received Cost Basis (USD),Received Wallet,Received Address,Received Comment,Sent Quantity,Sent Currency,Sent Cost Basis (USD),Sent Wallet,Sent Address,Sent Comment,Fee Amount,Fee Currency,Fee Cost Basis (USD),Realized Return (USD),Fee Realized Return (USD),Transaction Hash",
      "2026-01-01T00:00:00,BUY,tx-1,1,BTC,100,,,note,50000,USD,50000,,,,10,USD,10,0,0,",
    ].join("\n");

    const rows = parseCointrackerTransactionsCsv(csv, "test.csv");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.transaction_id).toBe("tx-1");
    expect(rows[0]?.date.toISOString()).toBe(isoUtc({ year: 2026, month: 1, day: 1 }));
    expect(rows[0]?.received_comment).toBe("note");
    expect(rows[0]?.transaction_hash).toBeNull();
  });

  it("parses newer csv rows with block explorer url column", () => {
    const csv = [
      "Date,Type,Transaction ID,Received Quantity,Received Currency,Received Cost Basis (USD),Received Wallet,Received Address,Received Comment,Sent Quantity,Sent Currency,Sent Cost Basis (USD),Sent Wallet,Sent Address,Sent Comment,Fee Amount,Fee Currency,Fee Cost Basis (USD),Realized Return (USD),Fee Realized Return (USD),Transaction Hash,Block Explorer URL",
      "11/18/2025 01:49:19,STAKING_REWARD,tx-2,0.00000011,AVAX,0.00,Coinbase Staked AVAX,,,,,,,,,0,USD,0,0,0,hash-1,https://example.com/tx/hash-1",
    ].join("\n");

    const rows = parseCointrackerTransactionsCsv(csv, "new.csv");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.transaction_id).toBe("tx-2");
    expect(rows[0]?.date.toISOString()).toBe(isoUtc({ year: 2025, month: 11, day: 18, hour: 1, minute: 49, second: 19 }));
    expect(rows[0]?.received_wallet).toBe("Coinbase Staked AVAX");
    expect(rows[0]?.transaction_hash).toBe("hash-1");
  });

  it("throws for malformed rows", () => {
    const csv = "Date,Type\n2026-01-01T00:00:00,BUY";

    expect(() => parseCointrackerTransactionsCsv(csv, "bad.csv")).toThrow("CSV validation failed");
  });
});
