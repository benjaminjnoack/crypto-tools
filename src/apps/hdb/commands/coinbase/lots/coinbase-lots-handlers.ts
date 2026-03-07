import { logger } from "#shared/log/index";
import { getEnvConfig } from "#shared/common/index";
import { DUST_THRESHOLD, getToAndFromDates } from "../../shared/date-range-utils.js";
import { traceCoinbaseBalanceLedger } from "../../../db/coinbase/balances/coinbase-balances-repository.js";
import {
  selectCoinbaseTransactions,
  selectCoinbaseTransactionsByIds,
  selectCoinbaseTransactionsDistinctAsset,
} from "../../../db/coinbase/transactions/coinbase-transactions-repository.js";
import {
  type CoinbaseLotRow,
  type CoinbaseLotsAccounting,
  filterLots,
  formatLotTotals,
  getLotTotals,
  matchCoinbaseLots,
  sortLots,
  toLotTableRow,
} from "./coinbase-lots-engine.js";
import {
  buildCoinbaseLotsDateRangeFilename,
  resolveCoinbaseLotsOutputDir,
  writeCoinbaseLotsCsv,
  writeCoinbaseLotsF8949,
} from "./coinbase-lots-export.js";
import type {
  CoinbaseLotsBatchCompareOptions,
  CoinbaseLotsBatchOptions,
  CoinbaseLotsCompareOptions,
  CoinbaseLotsQueryOptions,
} from "./schemas/coinbase-lots-options.js";

function normalizeAsset(asset: string): string {
  return asset.toUpperCase() === "ETH2" ? "ETH" : asset.toUpperCase();
}

function normalizeSingleAssetArg(asset: string): string {
  const parts = asset
    .split(":")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (parts.length !== 1 || !parts[0]) {
    throw new Error("coinbaseLots => only one asset at a time");
  }

  return normalizeAsset(parts[0]);
}

function resolveAccounting(accountingRaw: string | undefined): CoinbaseLotsAccounting {
  const accounting = (accountingRaw ?? "FIFO").toUpperCase();
  if (accounting === "FIFO" || accounting === "LIFO" || accounting === "HIFO") {
    return accounting;
  }
  throw new Error(`Invalid accounting method: ${accountingRaw}`);
}

function resolveLotsOutputDir(): string {
  const { HELPER_HDB_ROOT_DIR } = getEnvConfig();
  if (!HELPER_HDB_ROOT_DIR) {
    throw new Error("Missing output directory root: set HELPER_HDB_ROOT_DIR.");
  }
  return resolveCoinbaseLotsOutputDir(HELPER_HDB_ROOT_DIR);
}

export async function coinbaseLots(
  asset: string,
  options: CoinbaseLotsQueryOptions,
): Promise<CoinbaseLotRow[]> {
  const {
    all,
    balance: showBalance,
    buyLots,
    csv,
    f8949,
    notes,
    obfuscate,
    pages,
    quiet,
    totals,
  } = options;

  const ticker = normalizeSingleAssetArg(asset);
  const accounting = resolveAccounting(options.accounting);
  const { from, to } = await getToAndFromDates(options);

  const periodTxs = await selectCoinbaseTransactions(
    { from, to, assets: [ticker] },
    false,
    false,
  );

  if (periodTxs.length === 0) {
    throw new Error(`No transactions found for ${ticker} in the selected period.`);
  }

  const firstTx = periodTxs[0];
  if (!firstTx) {
    throw new Error("Unexpected transaction selection state");
  }

  let traceRows = await traceCoinbaseBalanceLedger(ticker, firstTx.timestamp);
  if (traceRows.length === 0) {
    throw new Error(`Trace for ${ticker} returned no history - possible unanchored carryover.`);
  }

  const anchorIndex = traceRows.findIndex((row) => Math.abs(Number(row.balance)) < DUST_THRESHOLD);
  if (anchorIndex < 0) {
    throw new Error(`Trace for ${ticker} does not begin with zero balance - possible ledger gap.`);
  }

  traceRows = traceRows.slice(anchorIndex + 1);
  const txIdsToFetch = traceRows.map((row) => row.tx_id).filter((txId) => txId.length > 0);
  const historicalTxs = txIdsToFetch.length > 0 ? await selectCoinbaseTransactionsByIds(txIdsToFetch) : [];

  const byId = new Map<string, (typeof periodTxs)[number]>();
  for (const tx of [...historicalTxs, ...periodTxs]) {
    byId.set(tx.id, tx);
  }

  const matched = matchCoinbaseLots([...byId.values()], accounting, Boolean(buyLots));
  const lots = all ? matched.lots : filterLots(matched.lots, from, Boolean(buyLots));
  sortLots(lots);

  if (!quiet) {
    console.table(lots.map(toLotTableRow));

    if (totals) {
      console.table([formatLotTotals(getLotTotals(lots), ticker)]);
    }

    if (showBalance) {
      logger.info(`Remaining Balance: ${matched.balance}`);
    }
  }

  if (csv || f8949) {
    const filename = `coinbase_lots_${ticker}_${buildCoinbaseLotsDateRangeFilename(from, to)}`;
    const outDir = resolveLotsOutputDir();

    if (csv) {
      await writeCoinbaseLotsCsv(outDir, filename, lots, {
        includeBalance: Boolean(showBalance),
        includeNotes: Boolean(notes),
        obfuscate: Boolean(obfuscate),
      });
    }
    if (f8949) {
      await writeCoinbaseLotsF8949(outDir, filename, lots, {
        includeTotals: Boolean(totals),
        includePages: Boolean(pages),
      });
    }
  }

  return lots;
}

export async function coinbaseLotsBatch(
  options: CoinbaseLotsBatchOptions,
): Promise<CoinbaseLotRow[]> {
  const { cash, quiet, totals } = options;

  const { from, to } = await getToAndFromDates(options);
  const assets = await selectCoinbaseTransactionsDistinctAsset(from, to);

  const uniqueAssets = [...new Set(assets.map(normalizeAsset))];

  const rows: CoinbaseLotRow[] = [];
  for (const asset of uniqueAssets) {
    if (!cash && (asset === "USD" || asset === "USDC")) {
      continue;
    }

    const lots = await coinbaseLots(asset, {
      ...options,
      quiet: true,
      totals: false,
    });
    rows.push(...lots);
  }

  sortLots(rows);

  if (!quiet) {
    console.table(rows.map(toLotTableRow));

    if (totals) {
      console.table([formatLotTotals(getLotTotals(rows))]);
    }
  }

  return rows;
}

export async function coinbaseLotsCompare(
  asset: string,
  options: CoinbaseLotsCompareOptions,
): Promise<Record<string, Record<string, number>>> {
  const { quiet } = options;

  const methods: CoinbaseLotsAccounting[] = ["FIFO", "LIFO", "HIFO"];
  const data: Record<string, Record<string, number>> = {};
  const tableData: Record<string, Record<string, number | string>> = {};

  for (const accounting of methods) {
    const lots = await coinbaseLots(asset, {
      ...options,
      accounting,
      quiet: true,
      totals: false,
    });
    const totals = getLotTotals(lots);
    data[accounting] = totals;
    tableData[accounting] = formatLotTotals(totals);
  }

  if (!quiet) {
    console.table(tableData);
  }

  return data;
}

export async function coinbaseLotsBatchCompare(
  options: CoinbaseLotsBatchCompareOptions,
): Promise<Record<string, Record<string, number>>> {
  const { quiet } = options;

  const methods: CoinbaseLotsAccounting[] = ["FIFO", "LIFO", "HIFO"];
  const data: Record<string, Record<string, number>> = {};
  const tableData: Record<string, Record<string, number | string>> = {};

  for (const accounting of methods) {
    const lots = await coinbaseLotsBatch({
      ...options,
      accounting,
      quiet: true,
      totals: false,
    });
    const totals = getLotTotals(lots);
    data[accounting] = totals;
    tableData[accounting] = formatLotTotals(totals);
  }

  if (!quiet) {
    console.table(tableData);
  }

  return data;
}
