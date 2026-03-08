import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildCoinbaseLotsDateRangeFilename,
  resolveCoinbaseLotsOutputDir,
  writeCoinbaseLotsCsv,
  writeCoinbaseLotsF8949,
} from "../../../../../../../src/apps/hdb/commands/coinbase/lots/coinbase-lots-export.js";
import type { CoinbaseLotRow } from "../../../../../../../src/apps/hdb/commands/coinbase/lots/coinbase-lots-engine.js";

function makeSellLot(overrides: Partial<CoinbaseLotRow> = {}): CoinbaseLotRow {
  return {
    kind: "sell",
    id: "buy-1:sell-1",
    asset: "BTC",
    buy_tx_id: "buy-1",
    sell_tx_id: "sell-1",
    acquired: new Date("2026-01-01T00:00:00.000Z"),
    sold: new Date("2026-01-20T00:00:00.000Z"),
    size: 1,
    balance: 0,
    basis: 90,
    proceeds: 100,
    gain: 10,
    term: "short",
    ...overrides,
  };
}

describe("coinbase lots export", () => {
  it("builds deterministic date-range filename", () => {
    const name = buildCoinbaseLotsDateRangeFilename(
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-02-01T00:00:00.000Z"),
    );
    expect(name).toBe("2026-01-01_2026-02-01");
  });

  it("writes csv export with obfuscated id and notes", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hdb-cb-lots-csv-"));
    const outDir = resolveCoinbaseLotsOutputDir(tempRoot);

    await writeCoinbaseLotsCsv(
      outDir,
      "sample",
      [makeSellLot()],
      { includeBalance: true, includeNotes: true, obfuscate: true },
    );

    const file = await fs.readFile(path.join(outDir, "sample.csv"), "utf8");
    expect(file).toContain("Lot ID,Asset,Date Acquired,Date Sold,Size,Cost Basis,Proceeds,Gain,Term,Balance");
    expect(file).toContain("BTC");
    expect(file).toContain("2026-01-01T00:00:00.000Z");
    expect(file).not.toContain("buy-1:sell-1");
  });

  it("writes f8949 master and paginated files", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hdb-cb-lots-f8949-"));
    const outDir = resolveCoinbaseLotsOutputDir(tempRoot);

    const lots = Array.from({ length: 15 }).map((_, index) =>
      makeSellLot({
        id: `buy-${index}:sell-${index}`,
        buy_tx_id: `buy-${index}`,
        sell_tx_id: `sell-${index}`,
      }),
    );

    await writeCoinbaseLotsF8949(outDir, "sample", lots, {
      includeTotals: true,
      includePages: true,
    });

    const master = await fs.readFile(path.join(outDir, "sample.f8949.csv"), "utf8");
    const page1 = await fs.readFile(path.join(outDir, "sample.pg01.f8949.csv"), "utf8");
    const page2 = await fs.readFile(path.join(outDir, "sample.pg02.f8949.csv"), "utf8");

    expect(master).toContain("Description,Date Acquired");
    expect(master).toContain("Totals");
    expect(page1).toContain("Totals");
    expect(page2).toContain("Totals");
  });
});
