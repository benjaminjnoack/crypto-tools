import fs from "node:fs/promises";
import path from "node:path";
import {
  type CointrackerTransactionInsertRow,
  createCointrackerTransactionsTable,
  dropCointrackerTransactionsTable,
  insertCointrackerTransactionsBatch,
  selectCointrackerTransactions,
  selectCointrackerTransactionsGroup,
  truncateCointrackerTransactionsTable,
} from "../../../db/cointracker/transactions/cointracker-transactions-repository.js";
import { parseCointrackerTransactionsCsv } from "../../../db/cointracker/transactions/cointracker-transactions-mappers.js";
import { getClient } from "../../../db/db-client.js";
import { getToAndFromDates } from "../../shared/date-range-utils.js";
import { cointrackerBalancesRegenerate } from "../balances/cointracker-balances-handlers.js";
import type {
  CointrackerTransactionsGroupOptions,
  CointrackerTransactionsQueryOptions,
  CointrackerTransactionsRegenerateOptions,
} from "./schemas/cointracker-transactions-options.js";
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

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`cointracker transaction row missing ${field}`);
  }
  return value;
}

type TransactionConsoleRow = {
  id: string;
  date: Date;
  type: string;
  received_currency: string | null;
  received_quantity: string | null;
  sent_currency: string | null;
  sent_quantity: string | null;
  realized_return: string | null;
  fees: string | null;
  received_balance?: string | null;
  sent_balance?: string | null;
};

function toTransactionConsoleRows(
  rows: Array<Record<string, unknown>>,
  includeBalances: boolean,
): TransactionConsoleRow[] {
  return rows.map((row) => {
    const output: TransactionConsoleRow = {
      id: toRequiredString(row.transaction_id, "transaction_id"),
      date: new Date(toRequiredString(row.date, "date")),
      type: toRequiredString(row.type, "type"),
      received_currency: toOptionalString(row.received_currency),
      received_quantity: toOptionalString(row.received_quantity),
      sent_currency: toOptionalString(row.sent_currency),
      sent_quantity: toOptionalString(row.sent_quantity),
      realized_return: toOptionalString(row.realized_return),
      fees: toOptionalString(row.fee_amount),
    };

    if (includeBalances) {
      output.received_balance = toOptionalString(row.received_currency_balance);
      output.sent_balance = toOptionalString(row.sent_currency_balance);
    }

    return output;
  });
}

export async function cointrackerTransactions(
  asset: string | undefined,
  options: CointrackerTransactionsQueryOptions,
): Promise<Array<Record<string, unknown>>> {
  const { includeBalances, quiet } = options;
  const { from, to } = await getToAndFromDates(options);

  const rows = await selectCointrackerTransactions(
    {
      from,
      to,
      assets: normalizeColonSeparatedUppercase(asset),
      excluded: normalizeColonSeparatedUppercase(options.exclude),
      types: normalizeColonSeparatedUppercase(options.type),
      received: normalizeColonSeparatedUppercase(options.received),
      sent: normalizeColonSeparatedUppercase(options.sent),
    },
    Boolean(includeBalances),
  );

  if (!quiet) {
    console.table(toTransactionConsoleRows(rows, Boolean(includeBalances)));
  }

  return rows as Array<Record<string, unknown>>;
}

export async function cointrackerTransactionsGroup(
  asset: string | undefined,
  options: CointrackerTransactionsGroupOptions,
): Promise<Array<Record<string, unknown>>> {
  const { interval, quiet } = options;
  const { from, to } = await getToAndFromDates(options);

  const rows = await selectCointrackerTransactionsGroup(
    {
      from,
      to,
      assets: normalizeColonSeparatedUppercase(asset),
      excluded: normalizeColonSeparatedUppercase(options.exclude),
      types: normalizeColonSeparatedUppercase(options.type),
      received: normalizeColonSeparatedUppercase(options.received),
      sent: normalizeColonSeparatedUppercase(options.sent),
    },
    interval,
  );

  if (!quiet) {
    console.table(rows);
  }

  return rows as Array<Record<string, unknown>>;
}

function resolveCointrackerTransactionsInputDir(inputDir?: string): string {
  if (inputDir) {
    return path.resolve(inputDir);
  }

  const { HELPER_HDB_ROOT_DIR } = getEnvConfig();
  if (!HELPER_HDB_ROOT_DIR) {
    throw new Error("Missing input directory. Provide --input-dir or set HELPER_HDB_ROOT_DIR.");
  }

  return path.resolve(HELPER_HDB_ROOT_DIR, "input", "cointracker-transactions");
}

export async function cointrackerTransactionsRegenerate(
  options: CointrackerTransactionsRegenerateOptions,
): Promise<number> {
  const { drop, inputDir, quiet } = options;

  const resolvedInputDir = resolveCointrackerTransactionsInputDir(inputDir);
  const fileNames = (await fs.readdir(resolvedInputDir))
    .filter((fileName) => fileName.toLowerCase().endsWith(".csv"))
    .sort();

  if (fileNames.length === 0) {
    logger.warn(`No CSV input files found in ${resolvedInputDir}`);
    return 0;
  }

  logger.info(`Loading cointracker transaction CSVs from ${resolvedInputDir}`);
  const rows: CointrackerTransactionInsertRow[] = [];
  for (const fileName of fileNames) {
    const filePath = path.join(resolvedInputDir, fileName);
    const csvText = await fs.readFile(filePath, "utf8");
    const mappedRows = parseCointrackerTransactionsCsv(csvText, filePath);
    rows.push(...mappedRows);
  }

  if (drop) {
    logger.warn("Dropping cointracker_transactions before regenerate");
    await dropCointrackerTransactionsTable();
    await createCointrackerTransactionsTable();
  } else {
    await createCointrackerTransactionsTable();
    await truncateCointrackerTransactionsTable();
  }

  const BATCH_SIZE = 2000;
  const pool = await getClient();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await insertCointrackerTransactionsBatch(batch, client);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  logger.info(`Inserted ${rows.length} cointracker transaction rows`);
  await cointrackerBalancesRegenerate({ drop, quiet });
  return rows.length;
}
