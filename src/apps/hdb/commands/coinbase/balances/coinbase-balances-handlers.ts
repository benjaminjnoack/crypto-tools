import { requestAccounts } from "#shared/coinbase/rest";
import { logger } from "#shared/log/index";
import {
  COINBASE_BALANCE_LEDGER_TABLE,
  type CoinbaseBalanceRow,
  createCoinbaseBalanceLedgerTable,
  dropCoinbaseBalanceLedgerTable,
  insertCoinbaseBalanceLedgerBatch,
  selectCoinbaseBalanceLedger,
  selectCoinbaseBalancesAtTime,
  traceCoinbaseBalanceLedger,
  truncateCoinbaseBalanceLedgerTable,
} from "../../../db/coinbase/balances/coinbase-balances-repository.js";
import {
  type CoinbaseTransactionRow,
  selectCoinbaseTransactions,
} from "../../../db/coinbase/transactions/coinbase-transactions-repository.js";
import { getClient } from "../../../db/db-client.js";
import { COINBASE_EPOCH, DUST_THRESHOLD, getToAndFromDates } from "../../shared/date-range-utils.js";
import type {
  CoinbaseBalancesBatchOptions,
  CoinbaseBalancesQueryOptions,
  CoinbaseBalancesRegenerateOptions,
  CoinbaseBalancesTraceOptions,
} from "./schemas/coinbase-balances-options.js";

function normalizeColonSeparatedUppercase(input?: string): string[] {
  if (!input) {
    return [];
  }

  return input
    .split(":")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0);
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

function normalizeLedgerAsset(asset: string): string {
  return asset.toUpperCase() === "ETH2" ? "ETH" : asset.toUpperCase();
}

function toDisplayBalance(rawBalance: string, raw: boolean | undefined): string | number {
  if (raw) {
    return rawBalance;
  }

  const value = Number(rawBalance);
  if (!Number.isFinite(value)) {
    return rawBalance;
  }

  return Math.abs(value) < DUST_THRESHOLD ? 0 : value;
}

function toConsoleRow(row: CoinbaseBalanceRow, raw: boolean | undefined, currentBalance?: string): Record<string, unknown> {
  const tableRow: Record<string, unknown> = {
    tx_id: row.tx_id,
    timestamp: row.timestamp,
    asset: row.asset,
    balance: toDisplayBalance(row.balance, raw),
    notes: row.notes,
  };

  if (currentBalance !== undefined) {
    tableRow.current = currentBalance;
  }

  return tableRow;
}

async function getCurrentBalanceMap(remote: boolean | undefined, yes: boolean | undefined): Promise<Map<string, string>> {
  if (!remote) {
    throw new Error("Missing source: use --remote for live Coinbase balance checks.");
  }
  if (!yes) {
    throw new Error("Refusing live Coinbase requests without confirmation. Re-run with --remote --yes.");
  }

  const accounts = await requestAccounts();
  const balances = new Map<string, string>();

  for (const account of accounts) {
    const available = Number(account.available_balance.value);
    const hold = Number(account.hold.value);
    const total = available + hold;
    if (!Number.isFinite(total)) {
      continue;
    }

    balances.set(account.currency.toUpperCase(), `${total}`);
  }

  return balances;
}

function getSignedDelta(row: CoinbaseTransactionRow): { asset: string; delta: number } {
  const quantity = Number(row.num_quantity);
  if (!Number.isFinite(quantity)) {
    throw new Error(`Invalid transaction quantity for ${row.id}: ${row.num_quantity}`);
  }

  const unsigned = Math.abs(quantity);
  const asset = normalizeLedgerAsset(row.asset);

  switch (row.type) {
    case "Advanced Trade Sell":
    case "Sell":
    case "Withdrawal":
    case "Send":
      return { asset, delta: unsigned * -1 };
    case "Unwrap":
      if (asset === "ETH") {
        return { asset: "ETH", delta: unsigned };
      }
      if (asset === "CBETH") {
        return { asset: "CBETH", delta: unsigned * -1 };
      }
      throw new Error(`Unsure how to quantify delta for Unwrap of ${row.asset}`);
    default:
      return { asset, delta: unsigned };
  }
}

export async function coinbaseBalances(
  asset: string,
  options: CoinbaseBalancesQueryOptions,
): Promise<Array<Record<string, unknown>>> {
  const { current, first, last, quiet, raw, remote, yes } = options;
  const assets = normalizeColonSeparatedUppercase(asset);
  const { from, to } = current
    ? { from: new Date(COINBASE_EPOCH), to: new Date() }
    : await getToAndFromDates(options);

  const rows = await selectCoinbaseBalanceLedger({ assets, from, to });

  if (quiet) {
    return rows as Array<Record<string, unknown>>;
  }

  if (rows.length === 0) {
    logger.warn(`No balances found for ${assets.join(", ")} from ${from.toISOString()} to ${to.toISOString()}`);
    return rows as Array<Record<string, unknown>>;
  }

  const currentBalanceMap = current ? await getCurrentBalanceMap(remote, yes) : new Map<string, string>();
  const tableRows = rows.map((row) => toConsoleRow(row, raw, currentBalanceMap.get(row.asset)));
  console.table(applyFirstLastRows(tableRows, first, last));

  return rows as Array<Record<string, unknown>>;
}

export async function coinbaseBalancesBatch(
  options: CoinbaseBalancesBatchOptions,
): Promise<Array<Record<string, unknown>>> {
  const { current, quiet, raw, remote, yes } = options;
  const { to } = current ? { to: new Date() } : await getToAndFromDates(options);
  const rows = await selectCoinbaseBalancesAtTime(to);

  if (quiet) {
    return rows as Array<Record<string, unknown>>;
  }

  if (rows.length === 0) {
    logger.warn(`No balances found to ${to.toISOString()}`);
    return rows as Array<Record<string, unknown>>;
  }

  const currentBalanceMap = current ? await getCurrentBalanceMap(remote, yes) : new Map<string, string>();
  const tableRows = rows.map((row) => toConsoleRow(row, raw, currentBalanceMap.get(row.asset)));
  console.table(tableRows);

  return rows as Array<Record<string, unknown>>;
}

export async function coinbaseBalancesTrace(
  asset: string,
  options: CoinbaseBalancesTraceOptions,
): Promise<Array<Record<string, unknown>>> {
  const { quiet, raw } = options;
  const ticker = normalizeLedgerAsset(asset);
  const { to } = await getToAndFromDates(options);

  const rows = await traceCoinbaseBalanceLedger(ticker, to);

  if (quiet) {
    return rows as Array<Record<string, unknown>>;
  }

  if (rows.length === 0) {
    logger.warn(`No balances found for ${ticker} to ${to.toISOString()}`);
    return rows as Array<Record<string, unknown>>;
  }

  console.table(rows.map((row) => toConsoleRow(row, raw)));
  return rows as Array<Record<string, unknown>>;
}

export async function coinbaseBalancesRegenerate(
  options: CoinbaseBalancesRegenerateOptions,
): Promise<number> {
  const { drop, yes } = options;
  if (!yes) {
    throw new Error("Refusing to regenerate without confirmation. Re-run with --yes.");
  }

  if (drop) {
    await dropCoinbaseBalanceLedgerTable();
    await createCoinbaseBalanceLedgerTable();
  } else {
    await createCoinbaseBalanceLedgerTable();
    await truncateCoinbaseBalanceLedgerTable();
  }

  const from = new Date(COINBASE_EPOCH);
  const to = new Date();
  const transactions = await selectCoinbaseTransactions({ from, to }, false, false);

  const assets = new Set<string>();
  for (const row of transactions) {
    const normalized = normalizeLedgerAsset(row.asset);
    assets.add(normalized);
  }

  const epoch = new Date(COINBASE_EPOCH);
  const ledgerRows: CoinbaseBalanceRow[] = [...assets]
    .sort()
    .map((entryAsset) => ({
      timestamp: epoch,
      asset: entryAsset,
      balance: "0",
      tx_id: `synthetic-zero-${entryAsset}`,
      notes: `Synthetic zero balance at COINBASE_EPOCH for ${entryAsset}`,
    }));

  const runningBalances = new Map<string, number>();
  for (const tx of transactions) {
    const { asset: entryAsset, delta } = getSignedDelta(tx);
    const prev = runningBalances.get(entryAsset) ?? 0;
    const balance = prev + delta;

    if (balance < 0 && Math.abs(balance) > DUST_THRESHOLD) {
      logger.error(`NEGATIVE BALANCE: ${tx.timestamp.toISOString()} ${balance} ${entryAsset}`);
    }

    runningBalances.set(entryAsset, balance);
    ledgerRows.push({
      timestamp: tx.timestamp,
      asset: entryAsset,
      balance: `${balance}`,
      tx_id: tx.id,
      notes: tx.notes,
    });
  }

  const BATCH_SIZE = 5000;
  const pool = await getClient();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < ledgerRows.length; i += BATCH_SIZE) {
      const batch = ledgerRows.slice(i, i + BATCH_SIZE);
      await insertCoinbaseBalanceLedgerBatch(batch, client);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  logger.info(`Inserted ${ledgerRows.length} rows into ${COINBASE_BALANCE_LEDGER_TABLE}`);
  const snapshot = await selectCoinbaseBalancesAtTime(new Date());
  console.table(snapshot.map((row) => toConsoleRow(row, false)));

  return ledgerRows.length;
}
