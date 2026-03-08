export const COINBASE_ORDERS_TABLE = "coinbase_orders";

export const CREATE_COINBASE_ORDERS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ${COINBASE_ORDERS_TABLE} (
    order_id UUID PRIMARY KEY,
    product_id TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
    limit_price TEXT,
    stop_price TEXT,
    status TEXT,
    filled_size TEXT,
    filled_value TEXT,
    average_filled_price TEXT,
    base_size TEXT,
    completion_percentage TEXT,
    total_fees TEXT,
    total_value_after_fees TEXT,
    order_type TEXT NOT NULL,
    created_time TIMESTAMPTZ NOT NULL,
    last_fill_time TIMESTAMPTZ,
    product_type TEXT,
    exchange TEXT
  );
`;

export const DROP_COINBASE_ORDERS_TABLE_SQL = `DROP TABLE IF EXISTS ${COINBASE_ORDERS_TABLE};`;
export const TRUNCATE_COINBASE_ORDERS_TABLE_SQL = `
  TRUNCATE ${COINBASE_ORDERS_TABLE}
  RESTART IDENTITY
  CASCADE;
`;

export const UPSERT_COINBASE_ORDER_SQL = `
  INSERT INTO ${COINBASE_ORDERS_TABLE} (
    order_id,
    product_id,
    side,
    limit_price,
    stop_price,
    status,
    filled_size,
    filled_value,
    average_filled_price,
    base_size,
    completion_percentage,
    total_fees,
    total_value_after_fees,
    order_type,
    created_time,
    last_fill_time,
    product_type,
    exchange
  )
  VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    $12,
    $13,
    $14,
    $15,
    $16,
    $17,
    $18
  )
  ON CONFLICT (order_id) DO UPDATE SET
    product_id = EXCLUDED.product_id,
    side = EXCLUDED.side,
    limit_price = EXCLUDED.limit_price,
    stop_price = EXCLUDED.stop_price,
    status = EXCLUDED.status,
    filled_size = EXCLUDED.filled_size,
    filled_value = EXCLUDED.filled_value,
    average_filled_price = EXCLUDED.average_filled_price,
    base_size = EXCLUDED.base_size,
    completion_percentage = EXCLUDED.completion_percentage,
    total_fees = EXCLUDED.total_fees,
    total_value_after_fees = EXCLUDED.total_value_after_fees,
    order_type = EXCLUDED.order_type,
    created_time = EXCLUDED.created_time,
    last_fill_time = EXCLUDED.last_fill_time,
    product_type = EXCLUDED.product_type,
    exchange = EXCLUDED.exchange;
`;

export const SELECT_COINBASE_ORDER_SQL = `
  SELECT *
  FROM ${COINBASE_ORDERS_TABLE}
  WHERE order_id = $1;
`;

export type LastFillTimeRow = {
  last_fill_time: Date | null;
};

export type TotalFeesRow = {
  total_fees: string | null;
};

export function buildSelectLastFillTimeSql(direction: "ASC" | "DESC"): string {
  return `
    SELECT last_fill_time
    FROM ${COINBASE_ORDERS_TABLE}
    WHERE status = $1 AND last_fill_time IS NOT NULL
    ORDER BY last_fill_time ${direction}
    LIMIT 1;
  `;
}

export function buildSelectCoinbaseOrdersSumTotalFeesSql(
  values: Array<Date | string>,
  productId: string | null,
  side: string | null,
): string {
  const conditions = ["created_time >= $1", "created_time < $2"];

  if (productId) {
    values.push(productId);
    conditions.push(`product_id = $${values.length}`);
  }

  if (side) {
    values.push(side.toUpperCase());
    conditions.push(`side = $${values.length}`);
  }

  return `
    SELECT SUM(total_fees::numeric) AS total_fees
    FROM ${COINBASE_ORDERS_TABLE}
    WHERE ${conditions.join(" AND ")};
  `;
}
