import { describe, expect, it } from "vitest";
import { parseCointrackerCapitalGainsCsv } from "../../../../../../../src/apps/hdb/db/cointracker/capital-gains/cointracker-capital-gains-mappers.js";

describe("cointracker capital gains mappers", () => {
  it("parses csv rows", () => {
    const csv = [
      "Asset Amount,Asset Name,Received Date,Date Sold,Proceeds (USD),Cost Basis (USD),Gain (USD),Type",
      "1,BTC,2026-01-01,2026-01-02,100,90,10,Short Term",
    ].join("\n");

    const rows = parseCointrackerCapitalGainsCsv(csv, "test.csv");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.asset_name).toBe("BTC");
    expect(rows[0]?.received_date.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("throws for malformed rows", () => {
    const badCsv = "Asset Amount,Asset Name\n1,BTC";
    expect(() => parseCointrackerCapitalGainsCsv(badCsv, "bad.csv")).toThrow("CSV validation failed");
  });
});
