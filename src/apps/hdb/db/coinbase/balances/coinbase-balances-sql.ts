import { DUST_THRESHOLD } from "../../../commands/shared/date-range-utils.js";

export const COINBASE_BALANCE_LEDGER_TABLE = "coinbase_balance_ledger";

export const CREATE_COINBASE_BALANCE_LEDGER_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ${COINBASE_BALANCE_LEDGER_TABLE} (
    id BIGSERIAL PRIMARY KEY,
    asset TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    balance NUMERIC NOT NULL,
    tx_id TEXT,
    notes TEXT
  );
`;

export const DROP_COINBASE_BALANCE_LEDGER_TABLE_SQL = `DROP TABLE IF EXISTS ${COINBASE_BALANCE_LEDGER_TABLE};`;

export const TRUNCATE_COINBASE_BALANCE_LEDGER_TABLE_SQL = `
  TRUNCATE ${COINBASE_BALANCE_LEDGER_TABLE}
  RESTART IDENTITY
  CASCADE;
`;

export type CoinbaseBalanceFilters = {
  assets: string[];
  from?: Date;
  to?: Date;
};

export function buildSelectCoinbaseBalanceLedgerSql(filters: CoinbaseBalanceFilters): {
  sql: string;
  values: Array<string[] | Date>;
} {
  const values: Array<string[] | Date> = [];
  const conditions: string[] = [];

  values.push(filters.assets);
  conditions.push(`asset = ANY($${values.length}::text[])`);

  if (filters.from) {
    values.push(filters.from);
    conditions.push(`timestamp >= $${values.length}`);
  }

  if (filters.to) {
    values.push(filters.to);
    conditions.push(`timestamp <= $${values.length}`);
  }

  const sql = `
    SELECT *
    FROM ${COINBASE_BALANCE_LEDGER_TABLE}
    WHERE ${conditions.join(" AND ")}
    ORDER BY timestamp ASC, id ASC;
  `;

  return { sql, values };
}

export const SELECT_COINBASE_BALANCES_AT_TIME_SQL = `
  SELECT DISTINCT ON (asset) id, asset, balance, timestamp, tx_id, notes
  FROM ${COINBASE_BALANCE_LEDGER_TABLE}
  WHERE timestamp <= $1
  ORDER BY asset, timestamp DESC, id DESC;
`;

export const TRACE_COINBASE_BALANCE_LEDGER_SQL = `
  SELECT *
  FROM ${COINBASE_BALANCE_LEDGER_TABLE}
  WHERE asset = $1
    AND timestamp >= (
      SELECT MAX(timestamp)
      FROM ${COINBASE_BALANCE_LEDGER_TABLE}
      WHERE asset = $1
        AND ABS(balance) < ${DUST_THRESHOLD}
        AND timestamp < $2
    )
    AND timestamp < $2
  ORDER BY timestamp ASC, id ASC;
`;
