import { getClient } from "../../hdb/db/db-client.js";
import {
  type CoinbaseBalanceRow,
  selectCoinbaseBalanceLedger,
  selectCoinbaseBalancesAtTime,
  traceCoinbaseBalanceLedger,
} from "../../hdb/db/coinbase/balances/coinbase-balances-repository.js";
import {
  type CoinbaseTransactionFilters,
  type CoinbaseTransactionGroupInterval,
} from "../../hdb/db/coinbase/transactions/coinbase-transactions-sql.js";
import {
  type CoinbaseTransactionGroupRow,
  type CoinbaseTransactionRow,
  selectCoinbaseTransactions,
  selectCoinbaseTransactionsByIds,
  selectCoinbaseTransactionsDistinctAsset,
  selectCoinbaseTransactionsGroup,
} from "../../hdb/db/coinbase/transactions/coinbase-transactions-repository.js";
import type {
  CointrackerCapitalGainsFilters,
  CointrackerCapitalGainsGroupFilters,
} from "../../hdb/db/cointracker/capital-gains/cointracker-capital-gains-sql.js";
import {
  type CointrackerCapitalGainRow,
  type CointrackerCapitalGainsGroupRow,
  type CointrackerCapitalGainsTotalsRow,
  selectCointrackerCapitalGains,
  selectCointrackerCapitalGainsGroup,
  selectCointrackerCapitalGainsTotals,
} from "../../hdb/db/cointracker/capital-gains/cointracker-capital-gains-repository.js";
import {
  type CoinbaseLotRow,
  type CoinbaseLotsAccounting,
  filterLots,
  formatLotTotals,
  getLotTotals,
  matchCoinbaseLots,
  sortLots,
} from "../../hdb/commands/coinbase/lots/coinbase-lots-engine.js";
import { DUST_THRESHOLD } from "../../hdb/commands/shared/date-range-utils.js";
import { applyLimit } from "./portal-query.js";

export type PortalHealthSummary = {
  databaseTime: string;
  tableCounts: Record<string, number>;
};

export type DashboardSummary = {
  asOf: string;
  balances: {
    rows: CoinbaseBalanceRow[];
    nonZeroAssets: number;
  };
  transactions: {
    total: number;
    byAsset: Array<{ asset: string; count: number }>;
    grouped: CoinbaseTransactionGroupRow[];
    recent: CoinbaseTransactionRow[];
  };
  lots: {
    totalLots: number;
    totals: Record<string, number | string>;
  };
  gains: {
    totals: CointrackerCapitalGainsTotalsRow;
    grouped: CointrackerCapitalGainsGroupRow[];
    recent: CointrackerCapitalGainRow[];
  };
};

function normalizeLedgerAsset(asset: string): string {
  return asset.toUpperCase() === "ETH2" ? "ETH" : asset.toUpperCase();
}

function parseNumeric(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function countByAsset(rows: CoinbaseTransactionRow[]): Array<{ asset: string; count: number }> {
  const counts = new Map<string, number>();

  for (const row of rows) {
    counts.set(row.asset, (counts.get(row.asset) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([asset, count]) => ({ asset, count }))
    .sort((a, b) => b.count - a.count || a.asset.localeCompare(b.asset));
}

async function getTableCount(table: string): Promise<number> {
  const client = await getClient();
  const result = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${table};`);
  return parseInt(result.rows[0]?.count ?? "0", 10);
}

async function getDatabaseTime(): Promise<string> {
  const client = await getClient();
  const result = await client.query<{ now: Date }>("SELECT NOW() AS now;");
  return result.rows[0]?.now.toISOString() ?? new Date().toISOString();
}

async function computeLotsForAsset(
  ticker: string,
  from: Date,
  to: Date,
  accounting: CoinbaseLotsAccounting,
): Promise<{ balance: number; lots: CoinbaseLotRow[] }> {
  const periodTransactions = await selectCoinbaseTransactions({ from, to, assets: [ticker] }, false, false);

  if (periodTransactions.length === 0) {
    return { balance: 0, lots: [] };
  }

  const firstTransaction = periodTransactions[0];
  if (!firstTransaction) {
    return { balance: 0, lots: [] };
  }

  let traceRows = await traceCoinbaseBalanceLedger(ticker, firstTransaction.timestamp);
  if (traceRows.length === 0) {
    return { balance: 0, lots: [] };
  }

  const anchorIndex = traceRows.findIndex((row) => Math.abs(Number(row.balance)) < DUST_THRESHOLD);
  if (anchorIndex >= 0) {
    traceRows = traceRows.slice(anchorIndex + 1);
  }

  const historicalIds = traceRows.map((row) => row.tx_id).filter((id) => id.length > 0);
  const historicalRows = historicalIds.length > 0
    ? await selectCoinbaseTransactionsByIds(historicalIds)
    : [];

  const allRows = [...historicalRows, ...periodTransactions]
    .filter((row) => row.asset.toUpperCase() === ticker)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  if (allRows.length === 0) {
    return { balance: 0, lots: [] };
  }

  const matched = matchCoinbaseLots(allRows, accounting, false);
  const lots = filterLots(matched.lots, from, false);
  sortLots(lots);

  return { balance: matched.balance, lots };
}

async function computeBatchLots(
  from: Date,
  to: Date,
  accounting: CoinbaseLotsAccounting,
): Promise<CoinbaseLotRow[]> {
  const assets = await selectCoinbaseTransactionsDistinctAsset(from, to);
  const rows: CoinbaseLotRow[] = [];

  for (const asset of [...new Set(assets.map(normalizeLedgerAsset))]) {
    if (asset === "USD" || asset === "USDC") {
      continue;
    }

    const computed = await computeLotsForAsset(asset, from, to, accounting);
    rows.push(...computed.lots);
  }

  sortLots(rows);
  return rows;
}

export async function getPortalHealthSummary(): Promise<PortalHealthSummary> {
  const [databaseTime, coinbaseBalances, coinbaseTransactions, coinbaseOrders, cointrackerCapitalGains] = await Promise.all([
    getDatabaseTime(),
    getTableCount("coinbase_balance_ledger"),
    getTableCount("coinbase_transactions"),
    getTableCount("coinbase_orders"),
    getTableCount("cointracker_capital_gains"),
  ]);

  return {
    databaseTime,
    tableCounts: {
      coinbase_balance_ledger: coinbaseBalances,
      coinbase_transactions: coinbaseTransactions,
      coinbase_orders: coinbaseOrders,
      cointracker_capital_gains: cointrackerCapitalGains,
    },
  };
}

export async function getDashboardSummary(from: Date, to: Date): Promise<DashboardSummary> {
  const [balances, transactions, groupedTransactions, gainsTotals, gainsGrouped, gainsRecent, lots] = await Promise.all([
    selectCoinbaseBalancesAtTime(to),
    selectCoinbaseTransactions({ from, to }, false, false),
    selectCoinbaseTransactionsGroup({ from, to }, "month"),
    selectCointrackerCapitalGainsTotals({ from, to }),
    selectCointrackerCapitalGainsGroup({ from, to }, true),
    selectCointrackerCapitalGains({ from, to }, true),
    computeBatchLots(from, to, "FIFO"),
  ]);

  return {
    asOf: to.toISOString(),
    balances: {
      rows: balances,
      nonZeroAssets: balances.filter((row) => Math.abs(parseNumeric(row.balance)) > DUST_THRESHOLD).length,
    },
    transactions: {
      total: transactions.length,
      byAsset: applyLimit(countByAsset(transactions), 10),
      grouped: groupedTransactions,
      recent: transactions.slice(-10).reverse(),
    },
    lots: {
      totalLots: lots.length,
      totals: formatLotTotals(getLotTotals(lots)),
    },
    gains: {
      totals: gainsTotals,
      grouped: applyLimit(gainsGrouped, 10),
      recent: gainsRecent.slice(-10).reverse(),
    },
  };
}

export async function getCoinbaseBalances(filters: {
  assets: string[];
  from?: Date;
  to: Date;
  currentSnapshot: boolean;
}): Promise<CoinbaseBalanceRow[]> {
  if (filters.currentSnapshot) {
    const rows = await selectCoinbaseBalancesAtTime(filters.to);
    if (filters.assets.length === 0) {
      return rows;
    }

    return rows.filter((row) => filters.assets.includes(row.asset));
  }

  return selectCoinbaseBalanceLedger(
    filters.from
      ? {
        assets: filters.assets,
        from: filters.from,
        to: filters.to,
      }
      : {
        assets: filters.assets,
        to: filters.to,
      },
  );
}

export async function getCoinbaseBalanceTrace(asset: string, to: Date): Promise<CoinbaseBalanceRow[]> {
  return traceCoinbaseBalanceLedger(normalizeLedgerAsset(asset), to);
}

export async function getCoinbaseTransactions(
  filters: CoinbaseTransactionFilters,
  options: { includeBalances: boolean; paired: boolean },
): Promise<CoinbaseTransactionRow[]> {
  return selectCoinbaseTransactions(filters, options.includeBalances, options.paired);
}

export async function getCoinbaseTransactionGroups(
  filters: CoinbaseTransactionFilters,
  interval?: CoinbaseTransactionGroupInterval,
): Promise<CoinbaseTransactionGroupRow[]> {
  return selectCoinbaseTransactionsGroup(filters, interval);
}

export async function getCoinbaseLots(
  asset: string,
  from: Date,
  to: Date,
  accounting: CoinbaseLotsAccounting,
): Promise<{ balance: number; lots: CoinbaseLotRow[]; totals: Record<string, number | string> }> {
  const ticker = normalizeLedgerAsset(asset);
  const computed = await computeLotsForAsset(ticker, from, to, accounting);

  return {
    balance: computed.balance,
    lots: computed.lots,
    totals: formatLotTotals(getLotTotals(computed.lots), ticker),
  };
}

export async function getCoinbaseLotsComparison(
  asset: string,
  from: Date,
  to: Date,
): Promise<Record<CoinbaseLotsAccounting, Record<string, number | string>>> {
  const methods: CoinbaseLotsAccounting[] = ["FIFO", "LIFO", "HIFO"];
  const result = {} as Record<CoinbaseLotsAccounting, Record<string, number | string>>;

  for (const method of methods) {
    const computed = await computeLotsForAsset(normalizeLedgerAsset(asset), from, to, method);
    result[method] = formatLotTotals(getLotTotals(computed.lots), asset.toUpperCase());
  }

  return result;
}

export async function getCointrackerGains(
  filters: CointrackerCapitalGainsFilters,
  orderByGains: boolean,
): Promise<CointrackerCapitalGainRow[]> {
  return selectCointrackerCapitalGains(filters, orderByGains);
}

export async function getCointrackerGainsGroups(
  filters: CointrackerCapitalGainsGroupFilters,
  orderByGains: boolean,
): Promise<{
  rows: CointrackerCapitalGainsGroupRow[];
  totals: CointrackerCapitalGainsTotalsRow;
}> {
  const [rows, totals] = await Promise.all([
    selectCointrackerCapitalGainsGroup(filters, orderByGains),
    selectCointrackerCapitalGainsTotals(filters),
  ]);

  return { rows, totals };
}
