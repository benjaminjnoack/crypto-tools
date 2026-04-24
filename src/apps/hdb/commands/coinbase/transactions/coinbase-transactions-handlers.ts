import fs from "node:fs/promises";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { requestAccounts, requestProduct } from "../../../../../shared/coinbase/rest.js";
import { logger } from "../../../../../shared/log/index.js";
import { getEnvConfig } from "../../../../../shared/common/index.js";
import {
  getAbbreviatedType,
  getClassifierForType,
  getSuperclassForType,
  getTypesForClassifier,
} from "./coinbase-transaction-classifiers.js";
import {
  type CoinbaseTransactionInsertRow,
  type CoinbaseTransactionRow,
  createCoinbaseTransactionsTable,
  dropCoinbaseTransactionsTable,
  insertCoinbaseTransactions,
  insertCoinbaseTransactionsBatch,
  selectCoinbaseTransactionById,
  selectCoinbaseTransactions,
  selectCoinbaseTransactionsByIds,
  selectCoinbaseTransactionsGroup,
  truncateCoinbaseTransactionsTable,
} from "../../../db/coinbase/transactions/coinbase-transactions-repository.js";
import type { CoinbaseTransactionFilters } from "../../../db/coinbase/transactions/coinbase-transactions-sql.js";
import { parseCoinbaseTransactionsStatementCsv } from "../../../db/coinbase/transactions/coinbase-transactions-mappers.js";
import { getClient } from "../../../db/db-client.js";
import { getToAndFromDates } from "../../shared/date-range-utils.js";
import { emitJsonOutput } from "../../shared/json-output.js";
import type {
  CoinbaseTransactionsGroupOptions,
  CoinbaseTransactionsIdOptions,
  CoinbaseTransactionsManualOptions,
  CoinbaseTransactionsNavOptions,
  CoinbaseTransactionsQueryOptions,
  CoinbaseTransactionsRegenerateOptions,
  CoinbaseTransactionsStatementOptions,
} from "./schemas/coinbase-transactions-options.js";

function normalizeColonSeparatedUppercase(input?: string): string[] {
  if (!input) {
    return [];
  }

  return input
    .split(":")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0);
}

function normalizeColonSeparated(input?: string): string[] {
  if (!input) {
    return [];
  }

  return input
    .split(":")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function resolveSelectToggle(enabled?: boolean, excluded?: boolean): boolean | null {
  if (enabled) {
    return true;
  }
  if (excluded) {
    return false;
  }
  return null;
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

function formatToCents(value: number): string {
  return value.toFixed(2);
}

function parseNumber(value: string | undefined, name: string): number {
  if (typeof value !== "string") {
    throw new Error(`${name} is required`);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return parsed;
}

function toTransactionConsoleRow(
  row: CoinbaseTransactionRow,
  options: Pick<CoinbaseTransactionsQueryOptions, "notes" | "classify" | "balance">,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: row.id,
    timestamp: row.timestamp,
    asset: row.asset,
  };

  if (options.notes) {
    base.type = getAbbreviatedType(row.type);
    base.quantity = row.num_quantity;
    base.notes = row.notes;
  } else {
    if (options.classify) {
      base.class = getClassifierForType(row.type);
      base.super = getSuperclassForType(row.type);
    } else {
      base.type = row.type;
    }

    base.quantity = row.num_quantity;
    base.price = row.num_price_at_tx;
    base.total = row.num_total;
    base.fee = row.num_fee;
  }

  if (options.balance) {
    if (!("balance" in row)) {
      throw new Error(`Transaction ${row.id} => missing balance`);
    }
    base.balance = row.balance ?? null;
  }

  return base;
}

function buildTransactionFilters(
  asset: string | undefined,
  options: Pick<
    CoinbaseTransactionsQueryOptions,
    "exclude" | "classifier" | "type" | "notClassifier" | "manual" | "excludeManual" | "synthetic" | "excludeSynthetic"
  >,
  from: Date,
  to: Date,
): CoinbaseTransactionFilters {
  const types = options.classifier
    ? getTypesForClassifier(options.classifier)
    : normalizeColonSeparated(options.type);

  const notTypes = options.notClassifier
    ? getTypesForClassifier(options.notClassifier)
    : [];

  return {
    from,
    to,
    assets: normalizeColonSeparatedUppercase(asset),
    excluded: normalizeColonSeparatedUppercase(options.exclude),
    types,
    notTypes,
    selectManual: resolveSelectToggle(options.manual, options.excludeManual),
    selectSynthetic: resolveSelectToggle(options.synthetic, options.excludeSynthetic),
  };
}

async function printTransactionJson(payload: {
  rows: Array<Record<string, unknown>>;
  filters: Record<string, unknown>;
  meta: Record<string, unknown>;
  totals?: Array<Record<string, unknown>> | undefined;
}, options: {
  json?: boolean | undefined;
  jsonFile?: string | undefined;
  quiet?: boolean | undefined;
}): Promise<void> {
  await emitJsonOutput(payload, options);
}

function resolveCoinbaseTransactionsInputDir(inputDir?: string): string {
  if (inputDir) {
    return path.resolve(inputDir);
  }

  const { HELPER_HDB_ROOT_DIR } = getEnvConfig();
  if (!HELPER_HDB_ROOT_DIR) {
    throw new Error("Missing input directory. Provide --input-dir or set HELPER_HDB_ROOT_DIR.");
  }

  return path.resolve(HELPER_HDB_ROOT_DIR, "input", "coinbase-transactions");
}

async function insertCoinbaseTransactionRowsInBatches(rows: CoinbaseTransactionInsertRow[]): Promise<void> {
  const BATCH_SIZE = 2000;
  const pool = await getClient();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await insertCoinbaseTransactionsBatch(batch, client);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function coinbaseTransactions(
  asset: string | undefined,
  options: CoinbaseTransactionsQueryOptions,
): Promise<Array<Record<string, unknown>>> {
  const { balance, first, last, paired, quiet } = options;
  const { from, to } = await getToAndFromDates(options);

  const filters = buildTransactionFilters(asset, options, from, to);
  const rows = await selectCoinbaseTransactions(filters, Boolean(balance), Boolean(paired));

  if (options.json || options.jsonFile) {
    const tableRows = rows.map((row) => toTransactionConsoleRow(row, options));
    const outputRows = applyFirstLastRows(tableRows, first, last);
    await printTransactionJson({
      rows: outputRows,
      filters: {
        ...filters,
        from: filters.from.toISOString(),
        to: filters.to.toISOString(),
      },
      meta: {
        rowCount: outputRows.length,
        totalRows: rows.length,
        appliedFirst: first ?? null,
        appliedLast: last ?? null,
        includeBalances: Boolean(balance),
        includePaired: Boolean(paired),
        notes: Boolean(options.notes),
        classify: Boolean(options.classify),
      },
    }, options);
    return rows as Array<Record<string, unknown>>;
  }

  if (!quiet) {
    if (rows.length === 0) {
      logger.warn(`No transactions found from ${from.toISOString()} to ${to.toISOString()}`);
      return rows as Array<Record<string, unknown>>;
    }

    const tableRows = rows.map((row) => toTransactionConsoleRow(row, options));
    console.table(applyFirstLastRows(tableRows, first, last));
  }

  return rows as Array<Record<string, unknown>>;
}

export async function coinbaseTransactionsGroup(
  asset: string | undefined,
  options: CoinbaseTransactionsGroupOptions,
): Promise<Array<Record<string, unknown>>> {
  const { interval, quiet } = options;
  const { from, to } = await getToAndFromDates(options);

  const filters = buildTransactionFilters(asset, options, from, to);
  const rows = await selectCoinbaseTransactionsGroup(filters, interval);
  const totals = interval ? await selectCoinbaseTransactionsGroup(filters) : undefined;

  if (options.json || options.jsonFile) {
    const payload: Parameters<typeof printTransactionJson>[0] = {
      rows,
      filters: {
        ...filters,
        from: filters.from.toISOString(),
        to: filters.to.toISOString(),
        interval: interval ?? null,
      },
      meta: {
        rowCount: rows.length,
        totalsRowCount: totals?.length ?? 0,
      },
    };
    if (totals) {
      payload.totals = totals;
    }
    await printTransactionJson(payload, options);
    return rows as Array<Record<string, unknown>>;
  }

  if (!quiet) {
    console.table(rows);
    if (interval) {
      console.log("Totals:");
      console.table(totals);
    }
  }

  return rows as Array<Record<string, unknown>>;
}

export async function coinbaseTransactionsId(
  id: string | undefined,
  options: CoinbaseTransactionsIdOptions,
): Promise<Array<Record<string, unknown>>> {
  const { balance, lotId, quiet } = options;

  if (lotId) {
    throw new Error("--lot-id is not yet migrated. Use explicit transaction ID(s) for now.");
  }
  if (!id) {
    throw new Error("Must provide transaction ID(s)");
  }

  const ids = normalizeColonSeparated(id);
  const rows = await selectCoinbaseTransactionsByIds(ids);

  if (options.json || options.jsonFile) {
    const tableRows = rows.map((row) => toTransactionConsoleRow(row, { ...options, balance }));
    await printTransactionJson({
      rows: tableRows,
      filters: {
        ids,
      },
      meta: {
        rowCount: tableRows.length,
        includeBalances: Boolean(balance),
        notes: Boolean(options.notes),
        classify: Boolean(options.classify),
      },
    }, options);
    return rows as Array<Record<string, unknown>>;
  }

  if (!quiet) {
    if (rows.length === 0) {
      logger.warn(`No transactions found with ID ${id}`);
      return rows as Array<Record<string, unknown>>;
    }

    const tableRows = rows.map((row) => toTransactionConsoleRow(row, { ...options, balance }));
    console.table(tableRows);
  }

  return rows as Array<Record<string, unknown>>;
}

export async function coinbaseTransactionsStatement(
  filepath: string,
  options: CoinbaseTransactionsStatementOptions,
): Promise<number> {
  const { manual, normalize } = options;
  const fullPath = path.resolve(filepath);
  const csvText = await fs.readFile(fullPath, "utf8");
  const rows = parseCoinbaseTransactionsStatementCsv(
    csvText,
    fullPath,
    normalize !== false,
    Boolean(manual),
  );

  await insertCoinbaseTransactionRowsInBatches(rows);

  logger.info(`Imported ${rows.length} statement rows from ${fullPath}`);
  return rows.length;
}

export async function coinbaseTransactionsRegenerate(
  options: CoinbaseTransactionsRegenerateOptions,
): Promise<number> {
  const { drop, inputDir, normalize } = options;

  const resolvedInputDir = resolveCoinbaseTransactionsInputDir(inputDir);
  const fileNames = (await fs.readdir(resolvedInputDir))
    .filter((fileName) => fileName.toLowerCase().endsWith(".csv"))
    .sort();

  if (fileNames.length === 0) {
    logger.warn(`No CSV input files found in ${resolvedInputDir}`);
    return 0;
  }

  const rows: CoinbaseTransactionInsertRow[] = [];
  for (const fileName of fileNames) {
    const filePath = path.join(resolvedInputDir, fileName);
    const csvText = await fs.readFile(filePath, "utf8");
    const isManualFile = fileName.toLowerCase() === "manual.csv";
    rows.push(
      ...parseCoinbaseTransactionsStatementCsv(
        csvText,
        filePath,
        normalize !== false,
        isManualFile,
      ),
    );
  }

  if (drop) {
    await dropCoinbaseTransactionsTable();
    await createCoinbaseTransactionsTable();
  } else {
    await createCoinbaseTransactionsTable();
    await truncateCoinbaseTransactionsTable();
  }

  await insertCoinbaseTransactionRowsInBatches(rows);

  logger.info(`Inserted ${rows.length} coinbase transaction rows`);
  return rows.length;
}

export async function coinbaseTransactionsManual(
  asset: string,
  options: CoinbaseTransactionsManualOptions,
): Promise<Array<Record<string, unknown>> | undefined> {
  const {
    dryRun,
    notes,
    quantity,
    rewriteExisting,
    timestamp,
    type,
  } = options;

  const fee = options.fee ?? "0";
  const priceCurrency = options.price_currency ?? "USD";
  const priceAtTx = options.price_at_tx ?? "1";

  const numFee = parseNumber(fee, "fee");
  const numQuantity = parseNumber(quantity, "quantity");
  const numPriceAtTx = parseNumber(priceAtTx, "price_at_tx");

  const numSubtotal = options.subtotal ? parseNumber(options.subtotal, "subtotal") : numQuantity * numPriceAtTx;
  const numTotal = options.total ? parseNumber(options.total, "total") : numSubtotal + numFee;

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid timestamp format. Use ISO format");
  }

  if (getClassifierForType(type) === "unknown") {
    throw new Error(`Unknown type: ${type}`);
  }

  const row: CoinbaseTransactionInsertRow = {
    id: `manual-${uuidv4()}`,
    timestamp: date,
    type,
    asset: asset.toUpperCase(),
    price_currency: priceCurrency,
    notes: `Manual ${notes}`,
    synthetic: false,
    manual: true,
    quantity,
    price_at_tx: priceAtTx,
    subtotal: `${numSubtotal}`,
    total: `${numTotal}`,
    fee,
    num_quantity: `${numQuantity}`,
    num_price_at_tx: `${numPriceAtTx}`,
    num_subtotal: `${numSubtotal}`,
    num_total: `${numTotal}`,
    num_fee: `${numFee}`,
    js_num_quantity: numQuantity,
    js_num_price_at_tx: numPriceAtTx,
    js_num_subtotal: numSubtotal,
    js_num_total: numTotal,
    js_num_fee: numFee,
    int_quantity: `${numQuantity}`,
    int_price_at_tx: `${numPriceAtTx}`,
    int_subtotal: `${numSubtotal}`,
    int_total: `${numTotal}`,
    int_fee: `${numFee}`,
  };

  console.dir(row);
  if (dryRun) {
    return undefined;
  }

  await insertCoinbaseTransactions(row, Boolean(rewriteExisting));
  const inserted = await selectCoinbaseTransactionById(row.id);
  console.table(inserted);
  return inserted as Array<Record<string, unknown>>;
}

export async function coinbaseTransactionsNav(
  options: CoinbaseTransactionsNavOptions,
): Promise<number> {
  const { quiet, remote } = options;
  if (!remote) {
    throw new Error("Missing source: use --remote for account NAV.");
  }

  const { from, to } = await getToAndFromDates(options);

  const deposits = await selectCoinbaseTransactions(
    {
      from,
      to,
      assets: ["USD"],
      types: ["Deposit"],
    },
    false,
    false,
  );
  const withdrawals = await selectCoinbaseTransactions(
    {
      from,
      to,
      assets: ["USD"],
      types: ["Withdrawal"],
    },
    false,
    false,
  );

  const totalDeposits = deposits.reduce((sum, row) => sum + Number(row.num_quantity), 0);
  const totalWithdrawals = withdrawals.reduce((sum, row) => sum + Number(row.num_quantity), 0);
  const netCashFlow = totalDeposits - totalWithdrawals;

  const accounts = await requestAccounts();
  let cashBalance = 0;
  let cryptoValue = 0;

  for (const account of accounts) {
    const quantity = Number(account.available_balance.value) + Number(account.hold.value);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    if (account.currency === "USD" || account.currency === "USDC") {
      cashBalance += quantity;
      continue;
    }

    try {
      const product = await requestProduct(`${account.currency}-USD`);
      cryptoValue += quantity * Number(product.price);
    } catch (error) {
      logger.warn(`Skipping NAV pricing for ${account.currency}: ${(error as Error).message}`);
    }
  }

  const accountValue = cashBalance + cryptoValue;

  const [totals] = await selectCoinbaseTransactionsGroup({ from, to });
  const feesPaid = Number(totals?.fee ?? 0);

  const pnl = accountValue - netCashFlow;
  if (!quiet) {
    console.table({
      "Gross Deposits": formatToCents(totalDeposits),
      "Gross Withdrawals": formatToCents(totalWithdrawals),
      "Net Cash Flow": formatToCents(netCashFlow),
      "Cash Balance": formatToCents(cashBalance),
      "Crypto Value": formatToCents(cryptoValue),
      "Account Value": formatToCents(accountValue),
      "Fees Paid": formatToCents(feesPaid),
      PnL: formatToCents(pnl),
    });
  }

  return pnl;
}
