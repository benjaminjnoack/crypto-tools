export const COINBASE_TRANSACTIONS_TABLE = "coinbase_transactions";

export type CoinbaseTransactionGroupInterval = "day" | "week" | "month" | "quarter" | "year";

export type CoinbaseTransactionFilters = {
  from: Date;
  to: Date;
  assets?: string[];
  excluded?: string[];
  types?: string[];
  notTypes?: string[];
  selectManual?: boolean | null;
  selectSynthetic?: boolean | null;
};

export const CREATE_COINBASE_TRANSACTIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ${COINBASE_TRANSACTIONS_TABLE} (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL,
    asset TEXT NOT NULL,
    price_currency TEXT NOT NULL,
    notes TEXT DEFAULT '',
    synthetic BOOLEAN DEFAULT FALSE,
    manual BOOLEAN DEFAULT FALSE,
    quantity TEXT NOT NULL,
    price_at_tx TEXT NOT NULL,
    subtotal TEXT NOT NULL,
    total TEXT NOT NULL,
    fee TEXT NOT NULL,
    num_quantity NUMERIC NOT NULL,
    num_price_at_tx NUMERIC NOT NULL,
    num_subtotal NUMERIC,
    num_total NUMERIC NOT NULL,
    num_fee NUMERIC NOT NULL,
    js_num_quantity DOUBLE PRECISION NOT NULL,
    js_num_price_at_tx DOUBLE PRECISION NOT NULL,
    js_num_subtotal DOUBLE PRECISION,
    js_num_total DOUBLE PRECISION NOT NULL,
    js_num_fee DOUBLE PRECISION NOT NULL,
    int_quantity NUMERIC NOT NULL,
    int_price_at_tx NUMERIC NOT NULL,
    int_subtotal NUMERIC,
    int_total NUMERIC NOT NULL,
    int_fee NUMERIC NOT NULL
  );
`;

export const DROP_COINBASE_TRANSACTIONS_TABLE_SQL = `DROP TABLE IF EXISTS ${COINBASE_TRANSACTIONS_TABLE};`;

export const TRUNCATE_COINBASE_TRANSACTIONS_TABLE_SQL = `
  TRUNCATE ${COINBASE_TRANSACTIONS_TABLE}
  RESTART IDENTITY
  CASCADE;
`;

export function buildCoinbaseTransactionsFilterConditions(filters: CoinbaseTransactionFilters): {
  conditions: string[];
  values: Array<Date | string[]>;
} {
  const { from, to } = filters;
  const assets = filters.assets ?? [];
  const excluded = filters.excluded ?? [];
  const types = filters.types ?? [];
  const notTypes = filters.notTypes ?? [];

  const conditions: string[] = ["t.timestamp IS NOT NULL"];
  const values: Array<Date | string[]> = [];

  values.push(from);
  conditions.push(`t.timestamp >= $${values.length}`);

  values.push(to);
  conditions.push(`t.timestamp < $${values.length}`);

  if (assets.length > 0) {
    values.push(assets);
    conditions.push(`t.asset = ANY($${values.length}::text[])`);
  }

  if (excluded.length > 0) {
    values.push(excluded);
    conditions.push(`NOT (t.asset = ANY($${values.length}::text[]))`);
  }

  if (types.length > 0) {
    values.push(types);
    conditions.push(`t.type = ANY($${values.length}::text[])`);
  }

  if (notTypes.length > 0) {
    values.push(notTypes);
    conditions.push(`NOT (t.type = ANY($${values.length}::text[]))`);
  }

  if (filters.selectManual === true) {
    conditions.push("t.manual = true");
  } else if (filters.selectManual === false) {
    conditions.push("t.manual = false");
  }

  if (filters.selectSynthetic === true) {
    conditions.push("t.synthetic = true");
  } else if (filters.selectSynthetic === false) {
    conditions.push("t.synthetic = false");
  }

  return { conditions, values };
}

export function buildSelectCoinbaseTransactionsSql(
  conditions: string[],
  includeBalances: boolean,
  pairSynthetic: boolean,
): string {
  const whereClause = conditions.length > 0 ? conditions.join(" AND ") : "TRUE";

  if (pairSynthetic) {
    return `
      WITH filtered AS (
        SELECT *
        FROM ${COINBASE_TRANSACTIONS_TABLE} t
        WHERE ${whereClause}
      ),
      synthetic_ids AS (
        SELECT id AS synthetic_id,
          regexp_replace(id, '^synthetic-', '') AS real_id
        FROM filtered
        WHERE id LIKE 'synthetic-%'
      ),
      full_ids AS (
        SELECT synthetic_id AS id FROM synthetic_ids
        UNION
        SELECT real_id AS id FROM synthetic_ids
        UNION
        SELECT id FROM filtered
      )
      SELECT ${includeBalances ? "t.*, b.balance" : "t.*"}
      FROM ${COINBASE_TRANSACTIONS_TABLE} t
      ${includeBalances ? "LEFT JOIN coinbase_balance_ledger b ON t.id = b.tx_id" : ""}
      JOIN full_ids f ON t.id = f.id
      ORDER BY t.timestamp ASC;
    `;
  }

  if (includeBalances) {
    return `
      SELECT t.*, b.balance
      FROM ${COINBASE_TRANSACTIONS_TABLE} t
      LEFT JOIN coinbase_balance_ledger b ON t.id = b.tx_id
      WHERE ${whereClause}
      ORDER BY t.timestamp ASC;
    `;
  }

  return `
    SELECT *
    FROM ${COINBASE_TRANSACTIONS_TABLE} t
    WHERE ${whereClause}
    ORDER BY t.timestamp ASC;
  `;
}

export function buildSelectCoinbaseTransactionsGroupSql(
  conditions: string[],
  interval?: CoinbaseTransactionGroupInterval,
): string {
  const whereClause = conditions.length > 0 ? conditions.join(" AND ") : "TRUE";

  const intervalSelection = interval ? `DATE(DATE_TRUNC('${interval}', t.timestamp)) AS ${interval},` : "";
  const intervalGroupBy = interval ? `GROUP BY ${interval}` : "";
  const intervalOrderBy = interval ? `ORDER BY ${interval} ASC` : "";

  return `
    SELECT
      ${intervalSelection}
      SUM(t.num_quantity) AS quantity,
      SUM(t.num_subtotal) AS subtotal,
      SUM(t.num_fee) AS fee,
      SUM(t.num_total) AS total
    FROM ${COINBASE_TRANSACTIONS_TABLE} t
    WHERE ${whereClause}
    ${intervalGroupBy}
    ${intervalOrderBy};
  `;
}

export const SELECT_COINBASE_TRANSACTIONS_BY_IDS_SQL = `
  SELECT *
  FROM ${COINBASE_TRANSACTIONS_TABLE}
  WHERE id = ANY($1::text[])
  ORDER BY timestamp ASC;
`;

export const SELECT_COINBASE_TRANSACTION_BY_ID_SQL = `
  SELECT *
  FROM ${COINBASE_TRANSACTIONS_TABLE}
  WHERE id = $1
  ORDER BY timestamp ASC;
`;

export const SELECT_COINBASE_TRANSACTIONS_DISTINCT_ASSET_SQL = `
  SELECT DISTINCT asset
  FROM ${COINBASE_TRANSACTIONS_TABLE}
  WHERE timestamp >= $1
    AND timestamp < $2
  ORDER BY asset ASC;
`;
