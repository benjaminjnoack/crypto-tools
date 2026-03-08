// noinspection SqlNoDataSourceInspection
import { getClient } from '@db/client.js';
import { log } from '@core/logger.js';
import { ORDER_KEYS, ORDER_STATUS } from '@core/dictionary.ts';

export const COINBASE_ORDERS_TABLE = 'coinbase_orders';

export async function createCoinbaseOrdersTable() {
  const sql = `CREATE TABLE IF NOT EXISTS ${COINBASE_ORDERS_TABLE} (
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
        exchange TEXT);`;
  const client = await getClient();
  return client.query(sql);
}

export async function dropCoinbaseOrdersTable() {
  const sql = `DROP TABLE IF EXISTS ${COINBASE_ORDERS_TABLE};`;
  const client = await getClient();
  return client.query(sql);
}

/**
 *
 * @param {object} order
 * @return {Promise<void>}
 */
export async function insertCoinbaseOrder(order) {
  const client = await getClient();

  // Insert the order into the database
  const query = `
        INSERT INTO ${COINBASE_ORDERS_TABLE} (
            order_id, product_id, side, limit_price, stop_price, status,
            filled_size, filled_value, average_filled_price, base_size, completion_percentage, total_fees,
            total_value_after_fees, order_type, created_time, last_fill_time, product_type, exchange
        )
        VALUES (
                   $1, $2, $3, $4, $5, $6,
                   $7, $8, $9, $10, $11,
                   $12, $13, $14, $15, $16, $17, $18
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

  let limitPrice = null;
  let stopPrice = null;
  let baseSize = null;

  const configuration = order.order_configuration;
  if (Object.hasOwn(configuration, ORDER_KEYS.LIMIT_LIMIT_GTC)) {
    baseSize = configuration[ORDER_KEYS.LIMIT_LIMIT_GTC][ORDER_KEYS.BASE_SIZE];
    limitPrice = configuration[ORDER_KEYS.LIMIT_LIMIT_GTC][ORDER_KEYS.LIMIT_PRICE];
  } else if (Object.hasOwn(configuration, ORDER_KEYS.MARKET_MARKET_IOC)) {
    // nothing really to do for market orders
  } else if (Object.hasOwn(configuration, ORDER_KEYS.TRIGGER_BRACKET_GTC)) {
    baseSize = configuration[ORDER_KEYS.TRIGGER_BRACKET_GTC][ORDER_KEYS.BASE_SIZE];
    limitPrice = configuration[ORDER_KEYS.TRIGGER_BRACKET_GTC][ORDER_KEYS.LIMIT_PRICE];
    stopPrice = configuration[ORDER_KEYS.TRIGGER_BRACKET_GTC][ORDER_KEYS.STOP_TRIGGER_PRICE];
  } else if (Object.hasOwn(configuration, ORDER_KEYS.STOP_LIMIT)) {
    baseSize = configuration[ORDER_KEYS.STOP_LIMIT][ORDER_KEYS.BASE_SIZE];
    limitPrice = configuration[ORDER_KEYS.STOP_LIMIT][ORDER_KEYS.LIMIT_PRICE];
    stopPrice = configuration[ORDER_KEYS.STOP_LIMIT][ORDER_KEYS.STOP_PRICE];
  } else {
    console.dir(configuration);
    throw new Error(`insertOrder => unknown order_configuration`);
  }

  const values = [
    order.order_id,
    order.product_id,
    order.side,
    limitPrice,
    stopPrice,
    order.status,
    order.filled_size,
    order.filled_value,
    order['average_filled_price'],
    baseSize,
    order['completion_percentage'],
    order.total_fees,
    order.total_value_after_fees,
    order['order_type'],
    order['created_time'],
    order.last_fill_time,
    order['product_type'],
    'COINBASE',
  ];

  const { command, rowCount } = await client.query(query, values);
  log.debug(command, rowCount);
}

export async function selectCoinbaseOrder(orderId) {
  const client = await getClient();

  const query = `
        SELECT *
        FROM ${COINBASE_ORDERS_TABLE} 
        WHERE order_id = $1;
    `;

  const res = await client.query(query, [orderId]);

  if (res.rows.length === 0) {
    throw new Error('selectOrder => No order found with that ID.');
  } else {
    return res.rows[0];
  }
}

/**
 * Select order which has the first last_fill_time, and/or the last last_fill_time
 * Basically, what is the first order we have, or the most recent?
 * @param {boolean} first
 * @param {boolean} last
 * @returns {Promise<{first: null|Date, last: null|Date}>}
 */
export async function selectCoinbaseOrderByLastFillTime(first, last) {
  const response = { first: null, last: null };
  const client = await getClient();

  if (first) {
    const firstQuery = `
            SELECT last_fill_time
            FROM ${COINBASE_ORDERS_TABLE}
            WHERE status = ${ORDER_STATUS.FILLED} AND last_fill_time IS NOT NULL
            ORDER BY last_fill_time ASC
                LIMIT 1;
        `;
    const firstRes = await client.query(firstQuery);
    response.first = firstRes.rows[0]?.last_fill_time ?? null;
  }

  if (last) {
    const lastQuery = `
            SELECT last_fill_time
            FROM ${COINBASE_ORDERS_TABLE} 
            WHERE status = ${ORDER_STATUS.FILLED} AND last_fill_time IS NOT NULL
            ORDER BY last_fill_time DESC
                LIMIT 1;
        `;
    const lastRes = await client.query(lastQuery);
    response.last = lastRes.rows[0]?.last_fill_time ?? null;
  }

  return response;
}

/**
 * @param {Date} from
 * @param {Date} to
 * @param {string|null} productId
 * @param {string|null} side
 * @returns {Promise<number>}
 */
export async function selectCoinbaseOrdersSumTotalFees(from, to, productId = null, side = null) {
  const client = await getClient();

  /**
   * @type {any[]}
   */
  const values = [from, to];

  const conditions = [`created_time >= $1`, `created_time < $2`];

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
        WHERE ${conditions.join(' AND ')};
    `;

  try {
    const res = await client.query(query, values);
    const totalFees = res.rows[0].total_fees;
    return totalFees ? parseFloat(totalFees) : 0;
  } catch (err) {
    console.error('Query failed:', err.message);
    throw err;
  }
}

/**
 * TODO what does ::numeric do?
 * @param {string} productId
 * @param {Date} from
 * @param {Date} to
 * @returns {Promise<*>}
 */
export async function selectFilledCoinbaseOrders(productId, from = null, to = null) {
  const values = [];
  const conditions = [];

  values.push(ORDER_STATUS.FILLED);
  conditions.push(`status = $${values.length}`);

  values.push(productId);
  conditions.push(`product_id = $${values.length}`);

  if (from) {
    values.push(from);
    conditions.push(`created_time >= $${values.length}`);
  }

  if (to) {
    values.push(to);
    conditions.push(`created_time < $${values.length}`);
  }

  conditions.push(`last_fill_time IS NOT NULL`);
  conditions.push(`filled_size::numeric > 0`);

  const query = `
        SELECT
            order_id,
            side,
            filled_size::numeric,
            average_filled_price::numeric,
            total_fees::numeric,
            last_fill_time
        FROM ${COINBASE_ORDERS_TABLE}
        WHERE ${conditions.join(' AND ')}
        ORDER BY last_fill_time ASC;
    `;

  const client = await getClient();
  return client.query(query, values);
}

/**
 * @param {Date} from
 * @param {Date} to
 * @returns {Promise<string[]>}
 */
export async function selectCoinbaseOrdersProductsWithFills(from, to) {
  const conditions = [`status = '${ORDER_STATUS.FILLED}'`, `last_fill_time IS NOT NULL`];

  const values = [];
  if (from) {
    values.push(from);
    conditions.push(`last_fill_time >= $${values.length}`);
  }
  if (to) {
    values.push(to);
    conditions.push(`last_fill_time < $${values.length}`);
  }

  const query = `
        SELECT DISTINCT product_id
        FROM ${COINBASE_ORDERS_TABLE}
        WHERE ${conditions.join(' AND ')}
        ORDER BY product_id ASC;
    `;

  const client = await getClient();
  const res = await client.query(query, values);
  return res.rows.map((row) => row.product_id);
}
