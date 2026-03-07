import {
  selectCointrackerTransactions,
  selectCointrackerTransactionsGroup,
} from "../../../db/cointracker/transactions/cointracker-transactions-repository.js";
import { getToAndFromDates } from "../../shared/date-range-utils.js";
import type {
  CointrackerTransactionsGroupOptions,
  CointrackerTransactionsQueryOptions,
} from "./schemas/cointracker-transactions-options.js";

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
