import { COINBASE_EPOCH } from "../../../commands/shared/date-range-utils.js";

export const COINTRACKER_BALANCES_TABLE = "cointracker_balances_ledger";
export const COINTRACKER_TRANSACTIONS_TABLE = "cointracker_transactions";

export const CREATE_COINTRACKER_BALANCES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ${COINTRACKER_BALANCES_TABLE}
  (
    id BIGSERIAL PRIMARY KEY,
    currency TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    balance NUMERIC NOT NULL,
    cointracker_transaction_id TEXT NOT NULL,
    received_quantity NUMERIC,
    sent_quantity NUMERIC
  );
`;

export const DROP_COINTRACKER_BALANCES_TABLE_SQL = `DROP TABLE IF EXISTS ${COINTRACKER_BALANCES_TABLE};`;

export const TRUNCATE_COINTRACKER_BALANCES_TABLE_SQL = `
  TRUNCATE ${COINTRACKER_BALANCES_TABLE}
  RESTART IDENTITY
  CASCADE;
`;

export type CointrackerBalancesFilters = {
  currencies?: string[];
  from?: Date;
  to?: Date;
};

export function buildSelectCointrackerBalancesSql(
  filters: CointrackerBalancesFilters,
  includeType: boolean,
): { sql: string; values: Array<Date | string[]> } {
  const values: Array<Date | string[]> = [];
  const conditions: string[] = [];

  if (filters.currencies && filters.currencies.length > 0) {
    values.push(filters.currencies);
    conditions.push(`b.currency = ANY($${values.length}::text[])`);
  }

  if (filters.from) {
    values.push(filters.from);
    conditions.push(`b.date >= $${values.length}`);
  }

  if (filters.to) {
    values.push(filters.to);
    conditions.push(`b.date < $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const columns = ["b.*"];
  const joins: string[] = [];
  if (includeType) {
    columns.push("t.type");
    joins.push(`LEFT JOIN ${COINTRACKER_TRANSACTIONS_TABLE} t ON b.cointracker_transaction_id = t.transaction_id`);
  }

  const sql = `
    SELECT ${columns.join(", ")}
    FROM ${COINTRACKER_BALANCES_TABLE} b
    ${joins.join("\n")}
    ${whereClause}
    ORDER BY b.date ASC, b.id ASC;
  `;

  return { sql, values };
}

export const SELECT_COINTRACKER_LAST_BALANCE_SQL = `
  SELECT DISTINCT ON (currency)
    currency, id, cointracker_transaction_id, date, balance
  FROM ${COINTRACKER_BALANCES_TABLE}
  ORDER BY currency, date DESC, id DESC;
`;

export const REBUILD_COINTRACKER_BALANCES_LEDGER_SQL = `
  INSERT INTO ${COINTRACKER_BALANCES_TABLE}
  (currency, date, balance, cointracker_transaction_id, received_quantity, sent_quantity)
  WITH movements AS (
    SELECT
      t.received_currency AS currency,
      t.date,
      t.transaction_id AS cointracker_transaction_id,
      COALESCE(t.received_quantity, 0)::numeric AS delta,
      t.received_quantity::numeric AS received_quantity,
      0::numeric AS sent_quantity,
      0 AS row_order
    FROM ${COINTRACKER_TRANSACTIONS_TABLE} t
    WHERE t.received_currency IS NOT NULL

    UNION ALL

    SELECT
      t.sent_currency AS currency,
      t.date,
      t.transaction_id AS cointracker_transaction_id,
      (0::numeric - COALESCE(t.sent_quantity, 0)::numeric) AS delta,
      0::numeric AS received_quantity,
      t.sent_quantity::numeric AS sent_quantity,
      1 AS row_order
    FROM ${COINTRACKER_TRANSACTIONS_TABLE} t
    WHERE t.sent_currency IS NOT NULL

    UNION ALL

    SELECT
      t.fee_currency AS currency,
      t.date,
      t.transaction_id AS cointracker_transaction_id,
      (0::numeric - COALESCE(t.fee_amount, 0)::numeric) AS delta,
      0::numeric AS received_quantity,
      0::numeric AS sent_quantity,
      2 AS row_order
    FROM ${COINTRACKER_TRANSACTIONS_TABLE} t
    WHERE t.fee_currency IS NOT NULL
      AND t.fee_amount IS NOT NULL
      AND t.fee_amount::numeric > 0
  ),
  seeded AS (
    SELECT
      c.currency,
      $1::timestamptz AS date,
      'coinbase_epoch_zero'::text AS cointracker_transaction_id,
      0::numeric AS delta,
      0::numeric AS received_quantity,
      0::numeric AS sent_quantity,
      -1 AS row_order
    FROM (SELECT DISTINCT currency FROM movements) c
  ),
  all_rows AS (
    SELECT * FROM seeded
    UNION ALL
    SELECT * FROM movements
  )
  SELECT
    currency,
    date,
    SUM(delta) OVER (
      PARTITION BY currency
      ORDER BY date ASC, row_order ASC, cointracker_transaction_id ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS balance,
    cointracker_transaction_id,
    received_quantity,
    sent_quantity
  FROM all_rows
  ORDER BY date ASC, row_order ASC, cointracker_transaction_id ASC;
`;

export function getCoinbaseEpochDate(): Date {
  return new Date(COINBASE_EPOCH);
}
