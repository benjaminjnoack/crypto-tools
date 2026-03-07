import {
  getAbbreviatedType,
  getClassifierForType,
  getSuperclassForType,
  getTypesForClassifier,
} from "./coinbase-transaction-classifiers.js";
import {
  type CoinbaseTransactionRow,
  selectCoinbaseTransactions,
  selectCoinbaseTransactionsByIds,
  selectCoinbaseTransactionsGroup,
} from "../../../db/coinbase/transactions/coinbase-transactions-repository.js";
import type {
  CoinbaseTransactionFilters,
} from "../../../db/coinbase/transactions/coinbase-transactions-sql.js";
import { getToAndFromDates } from "../../shared/date-range-utils.js";
import type {
  CoinbaseTransactionsGroupOptions,
  CoinbaseTransactionsIdOptions,
  CoinbaseTransactionsQueryOptions,
} from "./schemas/coinbase-transactions-options.js";
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

export async function coinbaseTransactions(
  asset: string | undefined,
  options: CoinbaseTransactionsQueryOptions,
): Promise<Array<Record<string, unknown>>> {
  const { balance, first, last, paired, quiet } = options;
  const { from, to } = await getToAndFromDates(options);

  const filters = buildTransactionFilters(asset, options, from, to);
  const rows = await selectCoinbaseTransactions(filters, Boolean(balance), Boolean(paired));

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

  if (!quiet) {
    console.table(rows);
    if (interval) {
      console.log("Totals:");
      const totals = await selectCoinbaseTransactionsGroup(filters);
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
