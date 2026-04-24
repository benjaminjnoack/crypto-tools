import { getClient } from "../../db-client.js";
import { logger } from "../../../../../shared/log/index.js";
import {
  buildCoinbaseTransactionsFilterConditions,
  buildSelectCoinbaseTransactionsGroupSql,
  buildSelectCoinbaseTransactionsSql,
  COINBASE_TRANSACTIONS_TABLE,
  type CoinbaseTransactionFilters,
  type CoinbaseTransactionGroupInterval,
  CREATE_COINBASE_TRANSACTIONS_TABLE_SQL,
  DROP_COINBASE_TRANSACTIONS_TABLE_SQL,
  SELECT_COINBASE_TRANSACTION_BY_ID_SQL,
  SELECT_COINBASE_TRANSACTIONS_BY_IDS_SQL,
  SELECT_COINBASE_TRANSACTIONS_DISTINCT_ASSET_SQL,
  TRUNCATE_COINBASE_TRANSACTIONS_TABLE_SQL,
} from "./coinbase-transactions-sql.js";

export type CoinbaseTransactionRow = {
  id: string;
  timestamp: Date;
  type: string;
  asset: string;
  quantity: string;
  price_currency: string;
  price_at_tx: string;
  subtotal: string | null;
  total: string;
  fee: string;
  notes: string;
  synthetic: boolean;
  manual: boolean;
  num_quantity: string;
  num_price_at_tx: string;
  num_subtotal: string | null;
  num_total: string;
  num_fee: string;
  balance?: string | null;
  [key: string]: unknown;
};

export type CoinbaseTransactionInsertRow = {
  id: string;
  timestamp: Date;
  type: string;
  asset: string;
  price_currency: string;
  notes: string;
  synthetic: boolean;
  manual: boolean;
  quantity: string;
  price_at_tx: string;
  subtotal: string;
  total: string;
  fee: string;
  num_quantity: string;
  num_price_at_tx: string;
  num_subtotal: string;
  num_total: string;
  num_fee: string;
  js_num_quantity: number;
  js_num_price_at_tx: number;
  js_num_subtotal: number;
  js_num_total: number;
  js_num_fee: number;
  int_quantity: string;
  int_price_at_tx: string;
  int_subtotal: string;
  int_total: string;
  int_fee: string;
};

export type CoinbaseTransactionGroupRow = {
  day?: string;
  week?: string;
  month?: string;
  quarter?: string;
  year?: string;
  quantity: string;
  subtotal: string;
  fee: string;
  total: string;
};

export { COINBASE_TRANSACTIONS_TABLE };

type Queryable = {
  query: (sql: string, values?: unknown[]) => Promise<unknown>;
};

const INSERT_COLUMNS: Array<keyof CoinbaseTransactionInsertRow> = [
  "id",
  "timestamp",
  "type",
  "asset",
  "price_currency",
  "notes",
  "synthetic",
  "manual",
  "quantity",
  "price_at_tx",
  "subtotal",
  "total",
  "fee",
  "num_quantity",
  "num_price_at_tx",
  "num_subtotal",
  "num_total",
  "num_fee",
  "js_num_quantity",
  "js_num_price_at_tx",
  "js_num_subtotal",
  "js_num_total",
  "js_num_fee",
  "int_quantity",
  "int_price_at_tx",
  "int_subtotal",
  "int_total",
  "int_fee",
];

export async function createCoinbaseTransactionsTable(queryable?: Queryable): Promise<void> {
  const client = queryable ?? await getClient();
  await client.query(CREATE_COINBASE_TRANSACTIONS_TABLE_SQL);
}

export async function dropCoinbaseTransactionsTable(queryable?: Queryable): Promise<void> {
  const client = queryable ?? await getClient();
  await client.query(DROP_COINBASE_TRANSACTIONS_TABLE_SQL);
}

export async function truncateCoinbaseTransactionsTable(queryable?: Queryable): Promise<void> {
  const client = queryable ?? await getClient();
  await client.query(TRUNCATE_COINBASE_TRANSACTIONS_TABLE_SQL);
}

export async function insertCoinbaseTransactions(
  row: CoinbaseTransactionInsertRow,
  rewriteExisting: boolean,
  queryable?: Queryable,
): Promise<void> {
  const client = queryable ?? await getClient();
  const values = INSERT_COLUMNS.map((column) => row[column]);
  const placeholders = INSERT_COLUMNS.map((_, index) => `$${index + 1}`).join(", ");
  const conflictClause = rewriteExisting
    ? `
      ON CONFLICT (id) DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        type = EXCLUDED.type,
        asset = EXCLUDED.asset,
        price_currency = EXCLUDED.price_currency,
        notes = EXCLUDED.notes,
        synthetic = EXCLUDED.synthetic,
        manual = EXCLUDED.manual,
        quantity = EXCLUDED.quantity,
        price_at_tx = EXCLUDED.price_at_tx,
        subtotal = EXCLUDED.subtotal,
        total = EXCLUDED.total,
        fee = EXCLUDED.fee,
        num_quantity = EXCLUDED.num_quantity,
        num_price_at_tx = EXCLUDED.num_price_at_tx,
        num_subtotal = EXCLUDED.num_subtotal,
        num_total = EXCLUDED.num_total,
        num_fee = EXCLUDED.num_fee,
        js_num_quantity = EXCLUDED.js_num_quantity,
        js_num_price_at_tx = EXCLUDED.js_num_price_at_tx,
        js_num_subtotal = EXCLUDED.js_num_subtotal,
        js_num_total = EXCLUDED.js_num_total,
        js_num_fee = EXCLUDED.js_num_fee,
        int_quantity = EXCLUDED.int_quantity,
        int_price_at_tx = EXCLUDED.int_price_at_tx,
        int_subtotal = EXCLUDED.int_subtotal,
        int_total = EXCLUDED.int_total,
        int_fee = EXCLUDED.int_fee
    `
    : "ON CONFLICT (id) DO NOTHING";

  const sql = `
    INSERT INTO ${COINBASE_TRANSACTIONS_TABLE}
    (${INSERT_COLUMNS.join(", ")})
    VALUES (${placeholders})
    ${conflictClause};
  `;
  await client.query(sql, values);
}

export async function insertCoinbaseTransactionsBatch(
  rows: CoinbaseTransactionInsertRow[],
  queryable?: Queryable,
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const values: unknown[] = [];
  const placeholders = rows.map((row, rowIndex) => {
    const start = rowIndex * INSERT_COLUMNS.length;
    values.push(...INSERT_COLUMNS.map((column) => row[column]));
    const rowPlaceholders = INSERT_COLUMNS.map((_, columnIndex) => `$${start + columnIndex + 1}`);
    return `(${rowPlaceholders.join(", ")})`;
  });

  const client = queryable ?? await getClient();
  const sql = `
    INSERT INTO ${COINBASE_TRANSACTIONS_TABLE}
    (${INSERT_COLUMNS.join(", ")})
    VALUES ${placeholders.join(", ")}
    ON CONFLICT (id) DO NOTHING;
  `;
  await client.query(sql, values);
}

export async function selectCoinbaseTransactions(
  filters: CoinbaseTransactionFilters,
  includeBalances: boolean,
  pairSynthetic: boolean,
): Promise<CoinbaseTransactionRow[]> {
  const client = await getClient();
  const { conditions, values } = buildCoinbaseTransactionsFilterConditions(filters);
  const sql = buildSelectCoinbaseTransactionsSql(conditions, includeBalances, pairSynthetic);

  const { rows } = await client.query<CoinbaseTransactionRow>(sql, values);
  logger.debug(`Selected ${rows.length} coinbase transaction rows`);
  return rows;
}

export async function selectCoinbaseTransactionsGroup(
  filters: CoinbaseTransactionFilters,
  interval?: CoinbaseTransactionGroupInterval,
): Promise<CoinbaseTransactionGroupRow[]> {
  const client = await getClient();
  const { conditions, values } = buildCoinbaseTransactionsFilterConditions(filters);
  const sql = buildSelectCoinbaseTransactionsGroupSql(conditions, interval);

  const { rows } = await client.query<CoinbaseTransactionGroupRow>(sql, values);
  logger.debug(`Selected ${rows.length} coinbase transaction group rows`);
  return rows;
}

export async function selectCoinbaseTransactionsByIds(ids: string[]): Promise<CoinbaseTransactionRow[]> {
  if (ids.length === 0) {
    return [];
  }

  const client = await getClient();
  const { rows } = await client.query<CoinbaseTransactionRow>(SELECT_COINBASE_TRANSACTIONS_BY_IDS_SQL, [ids]);
  logger.debug(`Selected ${rows.length} coinbase transaction rows by ids`);
  return rows;
}

export async function selectCoinbaseTransactionById(
  id: string,
): Promise<CoinbaseTransactionRow[]> {
  const client = await getClient();
  const { rows } = await client.query<CoinbaseTransactionRow>(SELECT_COINBASE_TRANSACTION_BY_ID_SQL, [id]);
  logger.debug(`Selected ${rows.length} coinbase transaction rows by id`);
  return rows;
}

export async function selectCoinbaseTransactionsDistinctAsset(
  from: Date,
  to: Date,
): Promise<string[]> {
  const client = await getClient();
  const { rows } = await client.query<{ asset: string }>(SELECT_COINBASE_TRANSACTIONS_DISTINCT_ASSET_SQL, [from, to]);
  return rows.map((row) => row.asset);
}
