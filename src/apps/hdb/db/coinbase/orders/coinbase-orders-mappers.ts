import { ORDER_TYPES } from "../../../../../shared/coinbase/schemas/coinbase-enum-schemas.js";
import type { CoinbaseOrder } from "../../../../../shared/coinbase/schemas/coinbase-order-schemas.js";

type OrderPriceFields = {
  baseSize: string | null;
  limitPrice: string | null;
  stopPrice: string | null;
};

export type CoinbaseOrderRow = {
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

export function getRequiredString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== "string") {
    throw new Error(`insertCoinbaseOrder => order.${key} is missing or not a string`);
  }
  return value;
}

export function getOrderPriceFields(order: CoinbaseOrder): OrderPriceFields {
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

export function mapRowToCoinbaseOrder(row: CoinbaseOrderRow): CoinbaseOrder {
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
