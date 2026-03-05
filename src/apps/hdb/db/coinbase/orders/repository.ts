import { getClient } from "../../client.js";
import { ORDER_STATUS, ORDER_TYPES } from "#shared/coinbase/schemas/coinbase-enum-schemas";
import type { CoinbaseOrder } from "#shared/coinbase/schemas/coinbase-order-schemas";
import { logger } from "#shared/log/index";
export const COINBASE_ORDERS_TABLE = "coinbase_orders";

const EXCHANGE = "COINBASE";
let coinbaseOrdersTableReady: Promise<void> | null = null;

const CREATE_COINBASE_ORDERS_TABLE_SQL = `
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

const DROP_COINBASE_ORDERS_TABLE_SQL = `DROP TABLE IF EXISTS ${COINBASE_ORDERS_TABLE};`;

const UPSERT_COINBASE_ORDER_SQL = `
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

type OrderPriceFields = {
  baseSize: string | null;
  limitPrice: string | null;
  stopPrice: string | null;
};

type CoinbaseOrderRow = {
  order_id: string;
  product_id: string;
  side: CoinbaseOrder["side"];
  limit_price: string | null;
  stop_price: string | null;
  status: CoinbaseOrder["status"] | null;
  filled_size: string | null;
  filled_value: string | null;
  average_filled_price: string | null;
  base_size: string | null;
  completion_percentage: string | null;
  total_fees: string | null;
  total_value_after_fees: string | null;
  order_type: CoinbaseOrder["order_type"];
  created_time: string;
  last_fill_time: string | null;
  product_type: string | null;
  exchange: string | null;
};

type LastFillTimeRow = {
  last_fill_time: Date | null;
};

type TotalFeesRow = {
  total_fees: string | null;
};

function getRequiredString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== "string") {
    throw new Error(`insertCoinbaseOrder => order.${key} is missing or not a string`);
  }
  return value;
}

function getOrderPriceFields(order: CoinbaseOrder): OrderPriceFields {
  switch (order.order_type) {
    case ORDER_TYPES.LIMIT: {
      const config = order.order_configuration.limit_limit_gtc;
      return {
        baseSize: config.base_size,
        limitPrice: config.limit_price,
        stopPrice: null,
      };
    }
    case ORDER_TYPES.MARKET: {
      return {
        baseSize: null,
        limitPrice: null,
        stopPrice: null,
      };
    }
    case ORDER_TYPES.BRACKET: {
      const config = order.order_configuration.trigger_bracket_gtc;
      return {
        baseSize: config.base_size,
        limitPrice: config.limit_price,
        stopPrice: config.stop_trigger_price,
      };
    }
    case ORDER_TYPES.STOP_LIMIT: {
      const config = order.order_configuration.stop_limit_stop_limit_gtc;
      return {
        baseSize: config.base_size,
        limitPrice: config.limit_price,
        stopPrice: config.stop_price,
      };
    }
    case ORDER_TYPES.TAKE_PROFIT_STOP_LOSS: {
      const config = order.order_configuration.trigger_bracket_gtc;
      return {
        baseSize: config.base_size,
        limitPrice: config.limit_price,
        stopPrice: config.stop_trigger_price,
      };
    }
    default: {
      throw new Error("insertCoinbaseOrder => unknown order_type");
    }
  }
}

function getOrderConfigurationFromRow(row: CoinbaseOrderRow): CoinbaseOrder["order_configuration"] {
  switch (row.order_type) {
    case ORDER_TYPES.LIMIT:
      return {
        limit_limit_gtc: {
          base_size: row.base_size,
          limit_price: row.limit_price,
        },
      } as CoinbaseOrder["order_configuration"];
    case ORDER_TYPES.MARKET:
      return {} as CoinbaseOrder["order_configuration"];
    case ORDER_TYPES.BRACKET:
      return {
        trigger_bracket_gtc: {
          base_size: row.base_size,
          limit_price: row.limit_price,
          stop_trigger_price: row.stop_price,
        },
      } as CoinbaseOrder["order_configuration"];
    case ORDER_TYPES.TAKE_PROFIT_STOP_LOSS:
      return {
        trigger_bracket_gtc: {
          base_size: row.base_size,
          limit_price: row.limit_price,
          stop_trigger_price: row.stop_price,
        },
      } as CoinbaseOrder["order_configuration"];
    case ORDER_TYPES.STOP_LIMIT:
      return {
        stop_limit_stop_limit_gtc: {
          base_size: row.base_size,
          limit_price: row.limit_price,
          stop_price: row.stop_price,
        },
      } as CoinbaseOrder["order_configuration"];
    default:
      throw new Error("selectCoinbaseOrder => unknown order_type");
  }
}

function mapRowToCoinbaseOrder(row: CoinbaseOrderRow): CoinbaseOrder {
  return {
    order_id: row.order_id,
    product_id: row.product_id,
    side: row.side,
    status: row.status,
    filled_size: row.filled_size,
    filled_value: row.filled_value,
    average_filled_price: row.average_filled_price,
    completion_percentage: row.completion_percentage,
    total_fees: row.total_fees,
    total_value_after_fees: row.total_value_after_fees,
    order_type: row.order_type,
    order_configuration: getOrderConfigurationFromRow(row),
    created_time: row.created_time,
    last_fill_time: row.last_fill_time,
    product_type: row.product_type,
  } as CoinbaseOrder;
}

export async function createCoinbaseOrdersTable() {
  const client = await getClient();
  return client.query(CREATE_COINBASE_ORDERS_TABLE_SQL);
}

export async function ensureCoinbaseOrdersTableExists(): Promise<void> {
  if (!coinbaseOrdersTableReady) {
    coinbaseOrdersTableReady = createCoinbaseOrdersTable()
      .then(() => undefined)
      .catch((error: unknown) => {
        coinbaseOrdersTableReady = null;
        throw error;
      });
  }

  await coinbaseOrdersTableReady;
}

export async function dropCoinbaseOrdersTable() {
  const client = await getClient();
  coinbaseOrdersTableReady = null;
  return client.query(DROP_COINBASE_ORDERS_TABLE_SQL);
}

export async function insertCoinbaseOrder(order: CoinbaseOrder): Promise<void> {
  await ensureCoinbaseOrdersTableExists();
  const client = await getClient();

  const { baseSize, limitPrice, stopPrice } = getOrderPriceFields(order);
  const createdTime = getRequiredString(order as Record<string, unknown>, "created_time");

  const values = [
    order.order_id,
    order.product_id,
    order.side,
    limitPrice,
    stopPrice,
    order.status,
    order.filled_size,
    order.filled_value,
    order.average_filled_price,
    baseSize,
    order.completion_percentage,
    order.total_fees,
    order.total_value_after_fees,
    order.order_type,
    createdTime,
    order.last_fill_time,
    order.product_type,
    EXCHANGE,
  ];

  const { command, rowCount } = await client.query(UPSERT_COINBASE_ORDER_SQL, values);
  logger.debug(command, rowCount);
}

export async function selectCoinbaseOrder(orderId: string): Promise<CoinbaseOrder> {
  const client = await getClient();

  const query = `
        SELECT *
        FROM ${COINBASE_ORDERS_TABLE}
        WHERE order_id = $1;
    `;

  const res = await client.query(query, [orderId]);

  if (res.rows.length === 0) {
    throw new Error("selectCoinbaseOrder => no order found with that ID.");
  }

  return mapRowToCoinbaseOrder(res.rows[0] as CoinbaseOrderRow);
}

/**
 * Select order which has the first last_fill_time, and/or the last last_fill_time
 * Basically, what is the first order we have, or the most recent?
 */
export async function selectCoinbaseOrderByLastFillTime(first: boolean, last: boolean): Promise<{first: null | Date, last: null | Date}> {
  const response: { first: Date | null; last: Date | null } = { first: null, last: null };
  const client = await getClient();

  if (first) {
    const firstQuery = `
            SELECT last_fill_time
            FROM ${COINBASE_ORDERS_TABLE}
            WHERE status = $1 AND last_fill_time IS NOT NULL
            ORDER BY last_fill_time ASC
                LIMIT 1;
        `;
    const firstRes = await client.query<LastFillTimeRow>(firstQuery, [ORDER_STATUS.FILLED]);
    response.first = firstRes.rows[0]?.last_fill_time ?? null;
  }

  if (last) {
    const lastQuery = `
            SELECT last_fill_time
            FROM ${COINBASE_ORDERS_TABLE}
            WHERE status = $1 AND last_fill_time IS NOT NULL
            ORDER BY last_fill_time DESC
                LIMIT 1;
        `;
    const lastRes = await client.query<LastFillTimeRow>(lastQuery, [ORDER_STATUS.FILLED]);
    response.last = lastRes.rows[0]?.last_fill_time ?? null;
  }

  return response;
}

export async function selectCoinbaseOrdersSumTotalFees(from: Date, to: Date, productId: string | null = null, side: string | null = null) {
  const client = await getClient();

  const values: Array<Date | string> = [from, to];

  const conditions = ["created_time >= $1", "created_time < $2"];

  if (productId) {
    values.push(productId);
    conditions.push(`product_id = $${values.length}`);
  }

  if (side) {
    values.push(side.toUpperCase());
    conditions.push(`side = $${values.length}`);
  }

  const query = `
        SELECT SUM(total_fees::numeric) AS total_fees
        FROM ${COINBASE_ORDERS_TABLE}
        WHERE ${conditions.join(" AND ")};
    `;

  const res = await client.query<TotalFeesRow>(query, values);
  const totalFees = res.rows[0]?.total_fees ?? null;
  return totalFees ? parseFloat(totalFees) : 0;
}
