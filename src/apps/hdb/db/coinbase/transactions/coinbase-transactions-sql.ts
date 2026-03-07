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
