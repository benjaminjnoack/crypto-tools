import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  buildDateRangeFilename,
  resolveCointrackerCapitalGainsOutputDir,
  writeCapitalGainsCsv,
  writeCapitalGainsF8949,
  writeCapitalGainsGroupCsv,
  writeCapitalGainsGroupF8949,
} from "../../../../../../../src/apps/hdb/commands/cointracker/capital-gains/cointracker-capital-gains-export.js";

describe("cointracker capital gains export", () => {
  it("builds deterministic range filename", () => {
    const name = buildDateRangeFilename(
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-02-01T00:00:00.000Z"),
    );
    expect(name).toBe("2026-01-01_2026-02-01");
  });

  it("writes csv and f8949 exports", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hdb-cg-export-"));
    const outDir = resolveCointrackerCapitalGainsOutputDir(tempRoot);

    await writeCapitalGainsCsv(
      outDir,
      "sample",
      [{
        id: "1",
        asset_amount: "1",
        asset_name: "BTC",
        received_date: new Date("2026-01-01T00:00:00.000Z"),
        date_sold: new Date("2026-01-02T00:00:00.000Z"),
        proceeds_usd: "100",
        cost_basis_usd: "90",
        gain_usd: "10",
        type: "Short Term",
      }],
      true,
    );

    await writeCapitalGainsF8949(
      outDir,
      "sample",
      [{
        id: "1",
        asset_amount: "1",
        asset_name: "BTC",
        received_date: new Date("2026-01-01T00:00:00.000Z"),
        date_sold: new Date("2026-01-02T00:00:00.000Z"),
        proceeds_usd: "100",
        cost_basis_usd: "90",
        gain_usd: "10",
        type: "Short Term",
      }],
      true,
      true,
    );

    const csvFile = await fs.readFile(path.join(outDir, "sample.csv"), "utf8");
    const f8949File = await fs.readFile(path.join(outDir, "sample.short.f8949.csv"), "utf8");

    expect(csvFile).toContain("Asset Amount,Asset Name");
    expect(csvFile).toContain("01/01/2026");
    expect(f8949File).toContain("Description,Date Acquired");
    expect(f8949File).toContain("Totals:");
  });

  it("writes grouped csv and grouped f8949", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hdb-cg-group-export-"));
    const outDir = resolveCointrackerCapitalGainsOutputDir(tempRoot);

    const rows = [{
      group: "BTC",
      trades: "2",
      amount: "1",
      basis: "90",
      proceeds: "100",
      gains: "10",
      avg_gain: "5",
      max_gain: "8",
      max_loss: "-1",
      roi_basis: "0.11",
    }];

    await writeCapitalGainsGroupCsv(outDir, "sample", rows, true, false);
    await writeCapitalGainsGroupF8949(outDir, "sample", rows, true, true);

    const groupCsv = await fs.readFile(path.join(outDir, "sample.group.csv"), "utf8");
    const groupF8949 = await fs.readFile(path.join(outDir, "sample.group.f8949.csv"), "utf8");
    const groupF8949Page = await fs.readFile(path.join(outDir, "sample.group.pg01.f8949.csv"), "utf8");

    expect(groupCsv).toContain("Asset,Amount,Trades");
    expect(groupF8949).toContain("Description,Date Acquired");
    expect(groupF8949).toContain("Various");
    expect(groupF8949Page).toContain("Totals:");
  });
});
