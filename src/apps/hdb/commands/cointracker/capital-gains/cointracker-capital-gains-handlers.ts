import fs from "node:fs/promises";
import path from "node:path";
import {
  type CointrackerCapitalGainInsertRow,
  createCointrackerCapitalGainsTable,
  dropCointrackerCapitalGainsTable,
  insertCointrackerCapitalGainsBatch,
  selectCointrackerCapitalGains,
  selectCointrackerCapitalGainsGroup,
  selectCointrackerCapitalGainsGroupTotals,
  selectCointrackerCapitalGainsTotals,
  selectCointrackerCapitalGainsUsdcBuckets,
  selectCointrackerCapitalGainsUsdcInterval,
  truncateCointrackerCapitalGainsTable,
} from "../../../db/cointracker/capital-gains/cointracker-capital-gains-repository.js";
import type {
  CointrackerCapitalGainsFilters,
  CointrackerCapitalGainsGroupFilters,
  CointrackerUsdcInterval,
} from "../../../db/cointracker/capital-gains/cointracker-capital-gains-sql.js";
import { parseCointrackerCapitalGainsCsv } from "../../../db/cointracker/capital-gains/cointracker-capital-gains-mappers.js";
import { getToAndFromDates, parseAsUtc } from "../../shared/date-range-utils.js";
import type {
  CointrackerCapitalGainsGetOptions,
  CointrackerCapitalGainsGroupOptions,
  CointrackerCapitalGainsRegenerateOptions,
  CointrackerCapitalGainsUsdcOptions,
} from "./schemas/cointracker-capital-gains-options.js";
import {
  buildCointrackerCapitalGainsDateRangeFilename,
  resolveCointrackerCapitalGainsOutputDir,
  writeCapitalGainsCsv,
  writeCapitalGainsF8949,
  writeCapitalGainsGroupCsv,
  writeCapitalGainsGroupF8949,
} from "./cointracker-capital-gains-export.js";
import { getEnvConfig } from "#shared/common/index";
import { logger } from "#shared/log/index";

function normalizeColonSeparatedUppercase(input?: string): string[] {
  if (!input) {
    return [];
  }

  return input
    .split(":")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0);
}

function applyAssetMode(
  assets: string[],
  excluding: string[],
  cash: boolean | undefined,
  crypto: boolean | undefined,
): { assets: string[]; excluding: string[] } {
  const nextAssets = [...assets];
  const nextExcluding = [...excluding];

  if (cash) {
    nextAssets.push("USD", "USDC");
  } else if (crypto) {
    nextExcluding.push("USD", "USDC");
  }

  return { assets: [...new Set(nextAssets)], excluding: [...new Set(nextExcluding)] };
}

function applyFirstLastRows<T>(rows: T[], first?: string, last?: string): T[] {
  if (first) {
    return rows.slice(0, Number.parseInt(first, 10));
  }

  if (last) {
    const count = Number.parseInt(last, 10);
    return rows.slice(count * -1);
  }

  return rows;
}

function formatToCents(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return parsed.toFixed(2);
}

function stripTrailingZeros(value: string): string {
  return value.replace(/(?:\.0+|(\.\d+?)0+)$/, "$1");
}

function formatTotalsForDisplay(
  totals: { trades: string; cost_basis: string; proceeds: string; gain: string },
  raw: boolean | undefined,
): { trades: string; cost_basis: string; proceeds: string; gain: string } {
  if (raw) {
    return totals;
  }

  return {
    trades: totals.trades,
    cost_basis: formatToCents(totals.cost_basis),
    proceeds: formatToCents(totals.proceeds),
    gain: formatToCents(totals.gain),
  };
}

function formatGroupRowsForDisplay(
  rows: Array<Record<string, string>>,
  raw: boolean | undefined,
): Array<Record<string, string>> {
  if (raw) {
    return rows;
  }

  return rows.map((row) => ({
    ...row,
    amount: stripTrailingZeros(row.amount ?? ""),
    basis: formatToCents(row.basis ?? ""),
    proceeds: formatToCents(row.proceeds ?? ""),
    gains: formatToCents(row.gains ?? ""),
    avg_gain: formatToCents(row.avg_gain ?? ""),
    max_gain: formatToCents(row.max_gain ?? ""),
    max_loss: formatToCents(row.max_loss ?? ""),
    roi_basis: formatToCents(row.roi_basis ?? ""),
  }));
}

function resolveCapitalGainsInputDir(inputDir?: string): string {
  if (inputDir) {
    return path.resolve(inputDir);
  }

  const { HELPER_HDB_ROOT_DIR } = getEnvConfig();
  if (!HELPER_HDB_ROOT_DIR) {
    throw new Error("Missing input directory. Provide --input-dir or set HELPER_HDB_ROOT_DIR.");
  }

  return path.resolve(HELPER_HDB_ROOT_DIR, "input", "cointracker-capital-gains");
}

function resolveCapitalGainsOutputDir(): string {
  const { HELPER_HDB_ROOT_DIR } = getEnvConfig();
  if (!HELPER_HDB_ROOT_DIR) {
    throw new Error("Missing output directory root: set HELPER_HDB_ROOT_DIR.");
  }

  return resolveCointrackerCapitalGainsOutputDir(HELPER_HDB_ROOT_DIR);
}

export async function cointrackerCapitalGains(
  assetsArg: string | undefined,
  options: CointrackerCapitalGainsGetOptions,
): Promise<Array<Record<string, unknown>>> {
  const { cash, crypto, csv, f8949, first, gains, headers, last, pages, quiet, raw, received, sent, totals, zero } = options;
  const { from, to } = await getToAndFromDates(options);

  const baseAssets = normalizeColonSeparatedUppercase(assetsArg);
  const baseExcluding = normalizeColonSeparatedUppercase(options.exclude);
  const { assets, excluding } = applyAssetMode(baseAssets, baseExcluding, cash, crypto);
  const filters: CointrackerCapitalGainsFilters = {
    assets,
    excluding,
    from,
    to,
    filterZero: Boolean(zero),
  };

  if (received) {
    filters.received = parseAsUtc(received);
  }
  if (sent) {
    filters.sent = parseAsUtc(sent);
  }

  const rows = await selectCointrackerCapitalGains(
    filters,
    Boolean(gains),
  );

  if (!quiet) {
    console.table(applyFirstLastRows(rows, first, last));
  }

  if (totals) {
    const totalsRow = await selectCointrackerCapitalGainsTotals({ assets, excluding, from, to });
    console.table([formatTotalsForDisplay(totalsRow, raw)]);

    if (csv || f8949) {
      const filename = buildCointrackerCapitalGainsDateRangeFilename(from, to);
      const outDir = resolveCapitalGainsOutputDir();
      if (csv) {
        await writeCapitalGainsCsv(outDir, filename, rows, true, totalsRow);
      }
      if (f8949) {
        await writeCapitalGainsF8949(outDir, filename, rows, Boolean(headers), Boolean(pages), totalsRow);
      }
    }
  } else if (csv || f8949) {
    const filename = buildCointrackerCapitalGainsDateRangeFilename(from, to);
    const outDir = resolveCapitalGainsOutputDir();
    if (csv) {
      await writeCapitalGainsCsv(outDir, filename, rows, true);
    }
    if (f8949) {
      await writeCapitalGainsF8949(outDir, filename, rows, Boolean(headers), Boolean(pages));
    }
  }

  return rows as Array<Record<string, unknown>>;
}

export async function cointrackerCapitalGainsGroup(
  assetsArg: string | undefined,
  options: CointrackerCapitalGainsGroupOptions,
): Promise<Array<Record<string, unknown>>> {
  const {
    bleeders,
    cash,
    crypto,
    csv,
    f8949,
    first,
    gains,
    headers,
    last,
    pages,
    quiet,
    raw,
    received,
    sent,
    totals,
    type,
    zero,
  } = options;
  const { from, to } = await getToAndFromDates(options);

  const baseAssets = normalizeColonSeparatedUppercase(assetsArg);
  const baseExcluding = normalizeColonSeparatedUppercase(options.exclude);
  const { assets, excluding } = applyAssetMode(baseAssets, baseExcluding, cash, crypto);
  const filters: CointrackerCapitalGainsGroupFilters = {
    assets,
    excluding,
    from,
    to,
    filterZero: Boolean(zero),
    filterBleeders: Boolean(bleeders),
  };

  if (type) {
    filters.type = type;
  }
  if (received) {
    filters.received = parseAsUtc(received);
  }
  if (sent) {
    filters.sent = parseAsUtc(sent);
  }

  const rows = await selectCointrackerCapitalGainsGroup(
    filters,
    Boolean(gains),
  );

  if (!quiet) {
    const formattedRows = formatGroupRowsForDisplay(
      rows as unknown as Array<Record<string, string>>,
      raw,
    );
    console.table(applyFirstLastRows(formattedRows, first, last));
  }

  const totalsRow = totals ? await selectCointrackerCapitalGainsGroupTotals(filters) : undefined;
  if (totalsRow) {
    console.table([formatTotalsForDisplay(totalsRow, raw)]);
  }

  if (type && (csv || f8949)) {
    logger.warn("CSV/F8949 export with --type is not supported for grouped gains");
  } else if (csv || f8949) {
    const filename = buildCointrackerCapitalGainsDateRangeFilename(from, to);
    const outDir = resolveCapitalGainsOutputDir();
    if (csv) {
      await writeCapitalGainsGroupCsv(outDir, filename, rows, Boolean(headers), Boolean(raw), totalsRow);
    }
    if (f8949) {
      await writeCapitalGainsGroupF8949(
        outDir,
        filename,
        rows,
        Boolean(headers),
        Boolean(pages),
        totalsRow,
      );
    }
  }

  return rows as Array<Record<string, unknown>>;
}

export async function cointrackerCapitalGainsRegenerate(
  options: CointrackerCapitalGainsRegenerateOptions,
): Promise<number> {
  const { drop, inputDir } = options;

  const resolvedInputDir = resolveCapitalGainsInputDir(inputDir);
  const fileNames = (await fs.readdir(resolvedInputDir))
    .filter((fileName) => fileName.toLowerCase().endsWith(".csv"))
    .sort();

  if (fileNames.length === 0) {
    logger.warn(`No CSV input files found in ${resolvedInputDir}`);
    return 0;
  }

  const rows: CointrackerCapitalGainInsertRow[] = [];
  for (const fileName of fileNames) {
    const filePath = path.join(resolvedInputDir, fileName);
    const csvText = await fs.readFile(filePath, "utf8");
    rows.push(...parseCointrackerCapitalGainsCsv(csvText, filePath));
  }

  if (drop) {
    await dropCointrackerCapitalGainsTable();
    await createCointrackerCapitalGainsTable();
  } else {
    await createCointrackerCapitalGainsTable();
    await truncateCointrackerCapitalGainsTable();
  }

  const inserted = await insertCointrackerCapitalGainsBatch(rows);
  logger.info(`Inserted ${inserted} cointracker capital gains rows`);
  return inserted;
}

export async function cointrackerCapitalGainsUsdc(
  options: CointrackerCapitalGainsUsdcOptions,
): Promise<Array<Record<string, unknown>>> {
  const { buckets, interval } = options;

  if (buckets) {
    const rows = await selectCointrackerCapitalGainsUsdcBuckets();
    console.table(rows);
    return rows as Array<Record<string, unknown>>;
  }

  if (interval) {
    const rows = await selectCointrackerCapitalGainsUsdcInterval(interval as CointrackerUsdcInterval);
    console.table(rows);

    const yearly = await selectCointrackerCapitalGainsUsdcInterval("year");
    console.table(yearly);
    return rows as Array<Record<string, unknown>>;
  }

  throw new Error("Missing instructions: use --buckets or --interval");
}
