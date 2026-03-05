import { getClient } from "../../db-client.js";
import { ORDER_STATUS } from "#shared/coinbase/schemas/coinbase-enum-schemas";
import type { CoinbaseOrder } from "#shared/coinbase/schemas/coinbase-order-schemas";
import { logger } from "#shared/log/index";
import {
  type CoinbaseOrderRow,
  getOrderPriceFields,
  getRequiredString,
  mapRowToCoinbaseOrder,
} from "./coinbase-orders-mappers.js";
import {
  buildSelectCoinbaseOrdersSumTotalFeesSql,
  buildSelectLastFillTimeSql,
  COINBASE_ORDERS_TABLE,
  CREATE_COINBASE_ORDERS_TABLE_SQL,
  DROP_COINBASE_ORDERS_TABLE_SQL,
  type LastFillTimeRow,
  SELECT_COINBASE_ORDER_SQL,
  type TotalFeesRow,
  UPSERT_COINBASE_ORDER_SQL,
} from "./coinbase-orders-sql.js";

export { COINBASE_ORDERS_TABLE };

const EXCHANGE = "COINBASE";
let coinbaseOrdersTableReady: Promise<void> | null = null;

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
  const res = await client.query(SELECT_COINBASE_ORDER_SQL, [orderId]);

  if (res.rows.length === 0) {
    throw new Error("selectCoinbaseOrder => no order found with that ID.");
  }

  return mapRowToCoinbaseOrder(res.rows[0] as CoinbaseOrderRow);
}

/**
 * Select order which has the first last_fill_time, and/or the last last_fill_time
 * Basically, what is the first order we have, or the most recent?
 */
export async function selectCoinbaseOrderByLastFillTime(
  first: boolean,
  last: boolean,
): Promise<{ first: null | Date; last: null | Date }> {
  const response: { first: Date | null; last: Date | null } = { first: null, last: null };
  const client = await getClient();

  if (first) {
    const firstRes = await client.query<LastFillTimeRow>(buildSelectLastFillTimeSql("ASC"), [ORDER_STATUS.FILLED]);
    response.first = firstRes.rows[0]?.last_fill_time ?? null;
  }

  if (last) {
    const lastRes = await client.query<LastFillTimeRow>(buildSelectLastFillTimeSql("DESC"), [ORDER_STATUS.FILLED]);
    response.last = lastRes.rows[0]?.last_fill_time ?? null;
  }

  return response;
}

export async function selectCoinbaseOrdersSumTotalFees(
  from: Date,
  to: Date,
  productId: string | null = null,
  side: string | null = null,
) {
  const client = await getClient();
  const values: Array<Date | string> = [from, to];
  const query = buildSelectCoinbaseOrdersSumTotalFeesSql(values, productId, side);

  const res = await client.query<TotalFeesRow>(query, values);
  const totalFees = res.rows[0]?.total_fees ?? null;
  return totalFees ? parseFloat(totalFees) : 0;
}
