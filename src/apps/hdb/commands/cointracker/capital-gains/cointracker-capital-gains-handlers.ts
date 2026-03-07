import fs from "node:fs/promises";
import path from "node:path";
import {
  type CointrackerCapitalGainInsertRow,
  createCointrackerCapitalGainsTable,
  dropCointrackerCapitalGainsTable,
  insertCointrackerCapitalGainsBatch,
  selectCointrackerCapitalGains,
  selectCointrackerCapitalGainsGroup,
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

export async function cointrackerCapitalGains(
  assetsArg: string | undefined,
  options: CointrackerCapitalGainsGetOptions,
): Promise<Array<Record<string, unknown>>> {
  const { cash, crypto, first, gains, last, quiet, received, sent, totals, zero } = options;
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
    console.table([totalsRow]);
  }

  return rows as Array<Record<string, unknown>>;
}

export async function cointrackerCapitalGainsGroup(
  assetsArg: string | undefined,
  options: CointrackerCapitalGainsGroupOptions,
): Promise<Array<Record<string, unknown>>> {
  const { bleeders, cash, crypto, first, gains, last, quiet, received, sent, type, zero } = options;
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
    console.table(applyFirstLastRows(rows, first, last));
  }

  return rows as Array<Record<string, unknown>>;
}

export async function cointrackerCapitalGainsRegenerate(
  options: CointrackerCapitalGainsRegenerateOptions,
): Promise<number> {
  const { drop, inputDir, yes } = options;
  if (!yes) {
    throw new Error("Refusing to regenerate without confirmation. Re-run with --yes.");
  }

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
