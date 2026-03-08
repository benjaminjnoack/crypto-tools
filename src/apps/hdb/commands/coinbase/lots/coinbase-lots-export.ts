import crypto from "node:crypto";
import path from "node:path";
import type { CoinbaseLotRow } from "./coinbase-lots-engine.js";
import { serializeCsvRow } from "../../shared/csv-utils.js";
import { formatDateIsoUtc, formatDateUsUtc, paginate, writeLines } from "../../shared/export-utils.js";

const F8949_ROWS_PER_PAGE = 14;

function formatToCents(value: number): string {
  return value.toFixed(2);
}

function obfuscateLotId(lot: CoinbaseLotRow): string {
  const source = `${lot.buy_tx_id}:${lot.sell_tx_id ?? ""}`;
  return crypto.createHash("sha256").update(source).digest("hex").slice(0, 24).toUpperCase();
}

function lotNotes(lot: CoinbaseLotRow): string {
  const bought = `Bought ${lot.size} ${lot.asset} on ${lot.acquired.toISOString()} for $${formatToCents(lot.basis)}`;
  if (lot.sell_tx_id) {
    const gainLoss = lot.gain >= 0 ? "profit" : "loss";
    return `${bought} (${lot.buy_tx_id}) and sold on ${lot.sold?.toISOString()} for $${formatToCents(lot.proceeds)} (${lot.sell_tx_id}) resulting in a ${gainLoss} of $${formatToCents(Math.abs(lot.gain))}.`;
  }
  return `${bought} (${lot.buy_tx_id}).`;
}

export function buildCoinbaseLotsDateRangeFilename(from: Date, to: Date): string {
  return `${formatDateIsoUtc(from)}_${formatDateIsoUtc(to)}`;
}

export function resolveCoinbaseLotsOutputDir(rootDir: string): string {
  return path.resolve(rootDir, "output", "coinbase-lots");
}

export async function writeCoinbaseLotsCsv(
  outputDir: string,
  filename: string,
  lots: CoinbaseLotRow[],
  options: {
    includeBalance: boolean;
    includeNotes: boolean;
    obfuscate: boolean;
  },
): Promise<void> {
  if (lots.length === 0) {
    throw new Error(`No transactions to write to ${filename}`);
  }

  const columns = [
    "Lot ID",
    "Asset",
    "Date Acquired",
    "Date Sold",
    "Size",
    "Cost Basis",
    "Proceeds",
    "Gain",
    "Term",
  ];

  if (options.includeBalance) {
    columns.push("Balance");
  }

  if (!options.obfuscate && options.includeNotes) {
    columns.push("Notes");
  }

  const lines: string[] = [columns.join(",")];
  for (const lot of lots) {
    const row: Array<string | number> = [
      options.obfuscate ? obfuscateLotId(lot) : lot.id,
      lot.asset,
      lot.acquired.toISOString(),
      lot.sold ? lot.sold.toISOString() : "",
      lot.size,
      lot.basis,
      lot.proceeds,
      lot.gain,
      lot.term,
    ];

    if (options.includeBalance) {
      row.push(lot.balance);
    }
    if (!options.obfuscate && options.includeNotes) {
      row.push(lotNotes(lot));
    }

    lines.push(serializeCsvRow(row));
  }

  await writeLines(path.join(outputDir, `${filename}.csv`), lines);
}

export async function writeCoinbaseLotsF8949(
  outputDir: string,
  filename: string,
  lots: CoinbaseLotRow[],
  options: {
    includeTotals: boolean;
    includePages: boolean;
  },
): Promise<void> {
  const header = "Description,Date Acquired,Date Sold,Proceeds,Cost Basis,Code,Adjustment,Gain";

  const body = lots
    .filter((lot) => lot.kind === "sell")
    .map((lot) => serializeCsvRow([
      `${lot.size} ${lot.asset}`,
      formatDateUsUtc(lot.acquired),
      lot.sold ? formatDateUsUtc(lot.sold) : "",
      formatToCents(lot.proceeds),
      formatToCents(lot.basis),
      "",
      "",
      lot.gain >= 0 ? formatToCents(lot.gain) : `(${formatToCents(Math.abs(lot.gain))})`,
    ]));

  const totals = lots
    .filter((lot) => lot.kind === "sell")
    .reduce((acc, lot) => ({
      proceeds: acc.proceeds + lot.proceeds,
      basis: acc.basis + lot.basis,
      gain: acc.gain + lot.gain,
    }), { proceeds: 0, basis: 0, gain: 0 });

  const lines = [header, ...body];
  if (options.includeTotals) {
    lines.push(serializeCsvRow([
      "Totals",
      "",
      "",
      formatToCents(totals.proceeds),
      formatToCents(totals.basis),
      "",
      "",
      formatToCents(totals.gain),
    ]));
  }

  await writeLines(path.join(outputDir, `${filename}.f8949.csv`), lines);

  if (!options.includePages) {
    return;
  }

  const pages = paginate(body, F8949_ROWS_PER_PAGE);
  for (const [index, page] of pages.entries()) {
    const pageNum = String(index + 1).padStart(2, "0");

    const pageLots = lots
      .filter((lot) => lot.kind === "sell")
      .slice(index * F8949_ROWS_PER_PAGE, (index + 1) * F8949_ROWS_PER_PAGE);

    const pageTotals = pageLots.reduce((acc, lot) => ({
      proceeds: acc.proceeds + lot.proceeds,
      basis: acc.basis + lot.basis,
      gain: acc.gain + lot.gain,
    }), { proceeds: 0, basis: 0, gain: 0 });

    const pageLines = [header, ...page];
    if (options.includeTotals) {
      pageLines.push(serializeCsvRow([
        "Totals",
        "",
        "",
        formatToCents(pageTotals.proceeds),
        formatToCents(pageTotals.basis),
        "",
        "",
        formatToCents(pageTotals.gain),
      ]));
    }

    await writeLines(path.join(outputDir, `${filename}.pg${pageNum}.f8949.csv`), pageLines);
  }
}
