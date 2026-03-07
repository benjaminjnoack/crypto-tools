import fs from "node:fs/promises";
import path from "node:path";
import type {
  CointrackerCapitalGainRow,
  CointrackerCapitalGainsGroupRow,
  CointrackerCapitalGainsTotalsRow,
} from "../../../db/cointracker/capital-gains/cointracker-capital-gains-repository.js";

const F8949_ROWS_PER_PAGE = 14;

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function formatDateIso(value: Date | string): string {
  const date = toDate(value);
  return date.toISOString().slice(0, 10);
}

function formatDateUs(value: Date | string): string {
  const date = toDate(value);
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const year = `${date.getUTCFullYear()}`;
  return `${month}/${day}/${year}`;
}

function formatToCents(value: string): string {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return value;
  }
  return num.toFixed(2);
}

function stripTrailingZeros(value: string): string {
  return value.replace(/(?:\.0+|(\.\d+?)0+)$/, "$1");
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function serializeRow(values: Array<string | number | null | undefined>): string {
  return values.map((value) => csvEscape(String(value ?? ""))).join(",");
}

function buildF8949Line(
  description: string,
  acquired: string,
  sold: string,
  proceeds: string,
  basis: string,
  gain: string,
): string {
  return serializeRow([description, acquired, sold, proceeds, basis, "", "", gain]);
}

function paginate<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

function aggregateTotals(rows: CointrackerCapitalGainRow[]): CointrackerCapitalGainsTotalsRow {
  let proceeds = 0;
  let costBasis = 0;
  let gain = 0;

  for (const row of rows) {
    proceeds += Number(row.proceeds_usd);
    costBasis += Number(row.cost_basis_usd);
    gain += Number(row.gain_usd);
  }

  return {
    trades: `${rows.length}`,
    proceeds: `${proceeds}`,
    cost_basis: `${costBasis}`,
    gain: `${gain}`,
  };
}

function totalsCsvRow(totals: CointrackerCapitalGainsTotalsRow): string {
  return serializeRow([
    "Totals:",
    "",
    "",
    "",
    formatToCents(totals.proceeds),
    formatToCents(totals.cost_basis),
    formatToCents(totals.gain),
    "",
  ]);
}

function totalsF8949Row(totals: CointrackerCapitalGainsTotalsRow): string {
  return serializeRow([
    "Totals:",
    "",
    "",
    formatToCents(totals.proceeds),
    formatToCents(totals.cost_basis),
    "",
    "",
    formatToCents(totals.gain),
  ]);
}

async function writeLines(filePath: string, lines: string[]): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

export function buildDateRangeFilename(from: Date, to: Date): string {
  return `${formatDateIso(from)}_${formatDateIso(to)}`;
}

export function resolveCointrackerCapitalGainsOutputDir(rootDir: string): string {
  return path.resolve(rootDir, "output", "cointracker-capital-gains");
}

export async function writeCapitalGainsCsv(
  outputDir: string,
  filename: string,
  rows: CointrackerCapitalGainRow[],
  includeHeaders: boolean,
  totals?: CointrackerCapitalGainsTotalsRow,
): Promise<void> {
  const lines: string[] = [];
  if (includeHeaders) {
    lines.push("Asset Amount,Asset Name,Received Date,Date Sold,Proceeds (USD),Cost Basis (USD),Gain (USD),Type");
  }

  for (const row of rows) {
    lines.push(
      serializeRow([
        stripTrailingZeros(row.asset_amount),
        row.asset_name,
        formatDateUs(row.received_date),
        formatDateUs(row.date_sold),
        formatToCents(row.proceeds_usd),
        formatToCents(row.cost_basis_usd),
        formatToCents(row.gain_usd),
        row.type,
      ]),
    );
  }

  if (totals) {
    lines.push(totalsCsvRow(totals));
  }

  await writeLines(path.join(outputDir, `${filename}.csv`), lines);
}

export async function writeCapitalGainsF8949(
  outputDir: string,
  filename: string,
  rows: CointrackerCapitalGainRow[],
  includeHeaders: boolean,
  includePages: boolean,
  totals?: CointrackerCapitalGainsTotalsRow,
): Promise<void> {
  const header = "Description,Date Acquired,Date Sold,Proceeds,Cost Basis,Code,Adjustment,Gain";
  const groups: Array<{ name: string; rows: CointrackerCapitalGainRow[] }> = [
    {
      name: "short",
      rows: rows.filter((row) => row.type.toLowerCase().includes("short")),
    },
    {
      name: "long",
      rows: rows.filter((row) => row.type.toLowerCase().includes("long")),
    },
  ];

  for (const group of groups) {
    if (group.rows.length === 0) {
      continue;
    }

    const bodyLines = group.rows.map((row) =>
      buildF8949Line(
        `${stripTrailingZeros(row.asset_amount)} ${row.asset_name}`,
        formatDateUs(row.received_date),
        formatDateUs(row.date_sold),
        formatToCents(row.proceeds_usd),
        formatToCents(row.cost_basis_usd),
        formatToCents(row.gain_usd),
      ),
    );

    const totalsRow = totalsF8949Row(totals ?? aggregateTotals(group.rows));
    const masterLines = includeHeaders ? [header, ...bodyLines, totalsRow] : [...bodyLines, totalsRow];

    await writeLines(path.join(outputDir, `${filename}.${group.name}.f8949.csv`), masterLines);

    if (includePages) {
      const pages = paginate(group.rows, F8949_ROWS_PER_PAGE);
      for (const [index, pageRows] of pages.entries()) {
        const pageNum = String(index + 1).padStart(2, "0");
        const pageLines = pageRows.map((row) =>
          buildF8949Line(
            `${stripTrailingZeros(row.asset_amount)} ${row.asset_name}`,
            formatDateUs(row.received_date),
            formatDateUs(row.date_sold),
            formatToCents(row.proceeds_usd),
            formatToCents(row.cost_basis_usd),
            formatToCents(row.gain_usd),
          ),
        );
        const pageTotals = totalsF8949Row(aggregateTotals(pageRows));
        const finalPageLines = includeHeaders ? [header, ...pageLines, pageTotals] : [...pageLines, pageTotals];
        await writeLines(path.join(outputDir, `${filename}.${group.name}.pg${pageNum}.f8949.csv`), finalPageLines);
      }
    }
  }
}

export async function writeCapitalGainsGroupCsv(
  outputDir: string,
  filename: string,
  rows: CointrackerCapitalGainsGroupRow[],
  includeHeaders: boolean,
  raw: boolean,
  totals?: CointrackerCapitalGainsTotalsRow,
): Promise<void> {
  const lines: string[] = [];
  if (includeHeaders) {
    lines.push("Asset,Amount,Trades,Cost Basis,Proceeds,Gains,Average Gain,Max Gain,Max Loss,ROI Basis");
  }

  for (const row of rows) {
    lines.push(
      serializeRow([
        row.group,
        raw ? row.amount : stripTrailingZeros(row.amount),
        row.trades,
        raw ? row.basis : formatToCents(row.basis),
        raw ? row.proceeds : formatToCents(row.proceeds),
        raw ? row.gains : formatToCents(row.gains),
        raw ? row.avg_gain : formatToCents(row.avg_gain),
        raw ? row.max_gain : formatToCents(row.max_gain),
        raw ? row.max_loss : formatToCents(row.max_loss),
        raw ? row.roi_basis : formatToCents(row.roi_basis),
      ]),
    );
  }

  if (totals) {
    lines.push(totalsCsvRow(totals));
  }

  await writeLines(path.join(outputDir, `${filename}.group.csv`), lines);
}

export async function writeCapitalGainsGroupF8949(
  outputDir: string,
  filename: string,
  rows: CointrackerCapitalGainsGroupRow[],
  includeHeaders: boolean,
  totals?: CointrackerCapitalGainsTotalsRow,
): Promise<void> {
  const header = "Description,Date Acquired,Date Sold,Proceeds,Cost Basis,Code,Adjustment,Gain";
  const lines = rows.map((row) =>
    buildF8949Line(
      `${stripTrailingZeros(row.amount)} ${row.group}`,
      "Various",
      "Various",
      formatToCents(row.proceeds),
      formatToCents(row.basis),
      formatToCents(row.gains),
    ),
  );

  const totalsRow = totals ? totalsF8949Row(totals) : null;
  const final = includeHeaders
    ? totalsRow ? [header, ...lines, totalsRow] : [header, ...lines]
    : totalsRow ? [...lines, totalsRow] : lines;

  await writeLines(path.join(outputDir, `${filename}.group.f8949.csv`), final);
}
