export const COINTRACKER_TRANSACTIONS_TABLE = "cointracker_transactions";

export type CointrackerTransactionGroupInterval = "day" | "week" | "month" | "quarter" | "year";

export type CointrackerTransactionFilters = {
  from: Date;
  to: Date;
  assets?: string[];
  excluded?: string[];
  types?: string[];
  received?: string[];
  sent?: string[];
};

export const CREATE_COINTRACKER_TRANSACTIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ${COINTRACKER_TRANSACTIONS_TABLE}
  (
    transaction_id TEXT PRIMARY KEY,
    date TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL,
    received_quantity NUMERIC,
    received_currency TEXT,
    received_cost_basis NUMERIC,
    received_wallet TEXT,
    received_address TEXT,
    received_comment TEXT,
    sent_quantity NUMERIC,
    sent_currency TEXT,
    sent_cost_basis NUMERIC,
    sent_wallet TEXT,
    sent_address TEXT,
    sent_comment TEXT,
    fee_amount NUMERIC,
    fee_currency TEXT,
    fee_cost_basis NUMERIC,
    realized_return NUMERIC,
    fee_realized_return NUMERIC,
    transaction_hash TEXT
  );
`;

export const DROP_COINTRACKER_TRANSACTIONS_TABLE_SQL = `DROP TABLE IF EXISTS ${COINTRACKER_TRANSACTIONS_TABLE};`;

export const TRUNCATE_COINTRACKER_TRANSACTIONS_TABLE_SQL = `
  TRUNCATE ${COINTRACKER_TRANSACTIONS_TABLE}
  RESTART IDENTITY
  CASCADE;
`;

export function buildFilterConditions(filters: CointrackerTransactionFilters): {
  conditions: string[];
  values: Array<Date | string[]>;
} {
  const { from, to } = filters;
  const assets = filters.assets ?? [];
  const excluded = filters.excluded ?? [];
  const types = filters.types ?? [];
  const received = filters.received ?? [];
  const sent = filters.sent ?? [];

  const conditions: string[] = [];
  const values: Array<Date | string[]> = [];

  values.push(from);
  conditions.push(`t.date >= $${values.length}`);

  values.push(to);
  conditions.push(`t.date < $${values.length}`);

  if (assets.length > 0) {
    values.push(assets);
    conditions.push(
      `(t.received_currency = ANY($${values.length}::text[]) OR t.sent_currency = ANY($${values.length}::text[]))`,
    );
  }

  if (excluded.length > 0) {
    values.push(excluded);
    conditions.push(
      `NOT (t.received_currency = ANY($${values.length}::text[]) OR t.sent_currency = ANY($${values.length}::text[]))`,
    );
  }

  if (types.length > 0) {
    values.push(types);
    conditions.push(`t.type = ANY($${values.length}::text[])`);
  }

  if (received.length > 0) {
    values.push(received);
    conditions.push(`t.received_currency = ANY($${values.length}::text[])`);
  }

  if (sent.length > 0) {
    values.push(sent);
    conditions.push(`t.sent_currency = ANY($${values.length}::text[])`);
  }

  return { conditions, values };
}

export function buildSelectCointrackerTransactionsSql(includeBalances: boolean, conditions: string[]): string {
  const whereClause = conditions.length > 0 ? conditions.join(" AND ") : "TRUE";

  if (!includeBalances) {
    return `
      SELECT *
      FROM ${COINTRACKER_TRANSACTIONS_TABLE} t
      WHERE ${whereClause}
      ORDER BY t.date ASC;
    `;
  }

  return `
    SELECT
      t.*,
      (
        SELECT b.balance
        FROM cointracker_balances_ledger b
        WHERE b.cointracker_transaction_id = t.transaction_id
          AND b.currency = t.received_currency
        LIMIT 1
      ) AS received_currency_balance,
      (
        SELECT b.balance
        FROM cointracker_balances_ledger b
        WHERE b.cointracker_transaction_id = t.transaction_id
          AND b.currency = t.sent_currency
        LIMIT 1
      ) AS sent_currency_balance
    FROM ${COINTRACKER_TRANSACTIONS_TABLE} t
    WHERE ${whereClause}
    ORDER BY t.date ASC;
  `;
}

export function buildSelectCointrackerTransactionsGroupSql(
  conditions: string[],
  interval?: CointrackerTransactionGroupInterval,
): string {
  const whereClause = conditions.length > 0 ? conditions.join(" AND ") : "TRUE";

  const intervalSelection = interval ? `DATE(DATE_TRUNC('${interval}', t.date)) AS ${interval},` : "";
  const intervalGroupBy = interval ? `GROUP BY ${interval}` : "";
  const intervalOrderBy = interval ? `ORDER BY ${interval} ASC` : "";

  return `
    SELECT
      ${intervalSelection}
      COALESCE(SUM(t.received_quantity), 0) AS received,
      COALESCE(SUM(t.sent_quantity), 0) AS sent,
      COALESCE(SUM(t.fee_amount), 0) AS fees,
      COALESCE(SUM(t.realized_return), 0) AS returns,
      COALESCE(SUM(t.realized_return), 0) - COALESCE(SUM(t.fee_amount), 0) AS net_returns
    FROM ${COINTRACKER_TRANSACTIONS_TABLE} t
    WHERE ${whereClause}
    ${intervalGroupBy}
    ${intervalOrderBy};
  `;
}
