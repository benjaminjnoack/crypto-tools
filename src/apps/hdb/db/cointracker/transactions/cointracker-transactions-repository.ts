import { getClient } from "../../db-client.js";
import { logger } from "#shared/log/index";
import {
  buildFilterConditions,
  buildSelectCointrackerTransactionsGroupSql,
  buildSelectCointrackerTransactionsSql,
  COINTRACKER_TRANSACTIONS_TABLE,
  type CointrackerTransactionFilters,
  type CointrackerTransactionGroupInterval,
  CREATE_COINTRACKER_TRANSACTIONS_TABLE_SQL,
  DROP_COINTRACKER_TRANSACTIONS_TABLE_SQL,
  TRUNCATE_COINTRACKER_TRANSACTIONS_TABLE_SQL,
} from "./cointracker-transactions-sql.js";

export type CointrackerTransactionRow = {
  transaction_id: string;
  date: Date;
  type: string;
  received_quantity: string | null;
  received_currency: string | null;
  sent_quantity: string | null;
  sent_currency: string | null;
  fee_amount: string | null;
  realized_return: string | null;
  [key: string]: unknown;
};

export type CointrackerTransactionGroupRow = {
  day?: string;
  week?: string;
  month?: string;
  quarter?: string;
  year?: string;
  received: string;
  sent: string;
  fees: string;
  returns: string;
  net_returns: string;
};

export type CointrackerTransactionInsertRow = {
  transaction_id: string;
  date: Date;
  type: string;
  received_quantity: string | null;
  received_currency: string | null;
  received_cost_basis: string | null;
  received_wallet: string | null;
  received_address: string | null;
  received_comment: string | null;
  sent_quantity: string | null;
  sent_currency: string | null;
  sent_cost_basis: string | null;
  sent_wallet: string | null;
  sent_address: string | null;
  sent_comment: string | null;
  fee_amount: string | null;
  fee_currency: string | null;
  fee_cost_basis: string | null;
  realized_return: string | null;
  fee_realized_return: string | null;
  transaction_hash: string | null;
};

type Queryable = {
  query: (sql: string, values?: Array<Date | string | null>) => Promise<unknown>;
};

const INSERT_COLUMNS: Array<keyof CointrackerTransactionInsertRow> = [
  "transaction_id",
  "date",
  "type",
  "received_quantity",
  "received_currency",
  "received_cost_basis",
  "received_wallet",
  "received_address",
  "received_comment",
  "sent_quantity",
  "sent_currency",
  "sent_cost_basis",
  "sent_wallet",
  "sent_address",
  "sent_comment",
  "fee_amount",
  "fee_currency",
  "fee_cost_basis",
  "realized_return",
  "fee_realized_return",
  "transaction_hash",
];

export { COINTRACKER_TRANSACTIONS_TABLE };

export async function createCointrackerTransactionsTable(queryable?: Queryable): Promise<void> {
  const client = queryable ?? await getClient();
  await client.query(CREATE_COINTRACKER_TRANSACTIONS_TABLE_SQL);
}

export async function dropCointrackerTransactionsTable(queryable?: Queryable): Promise<void> {
  const client = queryable ?? await getClient();
  await client.query(DROP_COINTRACKER_TRANSACTIONS_TABLE_SQL);
}

export async function truncateCointrackerTransactionsTable(queryable?: Queryable): Promise<void> {
  const client = queryable ?? await getClient();
  await client.query(TRUNCATE_COINTRACKER_TRANSACTIONS_TABLE_SQL);
}

export async function insertCointrackerTransactionsBatch(
  rows: CointrackerTransactionInsertRow[],
  queryable?: Queryable,
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const values: Array<Date | string | null> = [];
  const placeholders = rows.map((row, rowIndex) => {
    const start = rowIndex * INSERT_COLUMNS.length;
    const rowValues = INSERT_COLUMNS.map((column) => row[column]);
    values.push(...rowValues);

    const rowPlaceholders = INSERT_COLUMNS.map((_, columnIndex) => `$${start + columnIndex + 1}`);
    return `(${rowPlaceholders.join(", ")})`;
  });

  const client = queryable ?? await getClient();
  const sql = `
    INSERT INTO ${COINTRACKER_TRANSACTIONS_TABLE}
    (${INSERT_COLUMNS.join(", ")})
    VALUES ${placeholders.join(", ")};
  `;
  await client.query(sql, values);
}

export async function selectCointrackerTransactions(
  filters: CointrackerTransactionFilters,
  includeBalances: boolean,
): Promise<CointrackerTransactionRow[]> {
  const client = await getClient();
  const { conditions, values } = buildFilterConditions(filters);
  const sql = buildSelectCointrackerTransactionsSql(includeBalances, conditions);

  const { rows } = await client.query<CointrackerTransactionRow>(sql, values);
  logger.debug(`Selected ${rows.length} cointracker transaction rows`);
  return rows;
}

export async function selectCointrackerTransactionsGroup(
  filters: CointrackerTransactionFilters,
  interval?: CointrackerTransactionGroupInterval,
): Promise<CointrackerTransactionGroupRow[]> {
  const client = await getClient();
  const { conditions, values } = buildFilterConditions(filters);
  const sql = buildSelectCointrackerTransactionsGroupSql(conditions, interval);

  const { rows } = await client.query<CointrackerTransactionGroupRow>(sql, values);
  logger.debug(`Selected ${rows.length} cointracker transaction group rows`);
  return rows;
}
