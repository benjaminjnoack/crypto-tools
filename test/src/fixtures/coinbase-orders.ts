import type { CoinbaseOrder } from "../../../src/shared/coinbase/schemas/coinbase-order-schemas.js";
import { DEFAULT_ORDER_ID } from "./identifiers.js";

const DEFAULT_PRODUCT_ID = "BTC-USD";

type CoinbaseOrderBase = {
  order_id: string;
  product_id: string;
  side: "BUY" | "SELL";
  status: CoinbaseOrder["status"];
  completion_percentage: string;
  filled_size: string;
  average_filled_price: string;
  filled_value: string;
  total_fees: string;
  total_value_after_fees: string;
  product_type: "SPOT";
  last_fill_time: string | null;
};

type BaseOverrides = Partial<CoinbaseOrderBase>;

function baseOrder(overrides: BaseOverrides = {}): CoinbaseOrderBase {
  return {
    order_id: DEFAULT_ORDER_ID,
    product_id: DEFAULT_PRODUCT_ID,
    side: "BUY",
    status: "OPEN",
    completion_percentage: "0",
    filled_size: "0",
    average_filled_price: "0",
    filled_value: "0",
    total_fees: "0",
    total_value_after_fees: "0",
    product_type: "SPOT",
    last_fill_time: null,
    ...overrides,
  };
}

export function makeLimitOrder({
  baseSize = "1.00",
  limitPrice = "100.00",
  postOnly = true,
  attachedStopPrice,
  attachedLimitPrice,
  ...overrides
}: BaseOverrides & {
  baseSize?: string;
  limitPrice?: string;
  postOnly?: boolean;
  attachedStopPrice?: string;
  attachedLimitPrice?: string;
} = {}): CoinbaseOrder {
  const order = {
    ...baseOrder(overrides),
    order_type: "LIMIT",
    order_configuration: {
      limit_limit_gtc: {
        base_size: baseSize,
        limit_price: limitPrice,
        post_only: postOnly,
      },
    },
  } as CoinbaseOrder;

  if (attachedStopPrice || attachedLimitPrice) {
    order.attached_order_configuration = {
      trigger_bracket_gtc: {
        limit_price: attachedLimitPrice ?? limitPrice,
        stop_trigger_price: attachedStopPrice ?? limitPrice,
      },
    };
  }
  return order;
}

export function makeTpSlOrder({
  baseSize = "1.50",
  limitPrice = "120.00",
  stopTriggerPrice = "95.00",
  ...overrides
}: BaseOverrides & {
  baseSize?: string;
  limitPrice?: string;
  stopTriggerPrice?: string;
} = {}): CoinbaseOrder {
  return {
    ...baseOrder({ side: "SELL", ...overrides }),
    order_type: "TAKE_PROFIT_STOP_LOSS",
    order_configuration: {
      trigger_bracket_gtc: {
        base_size: baseSize,
        limit_price: limitPrice,
        stop_trigger_price: stopTriggerPrice,
      },
    },
  } as CoinbaseOrder;
}

export function makeMarketOrder({
  baseSize = "0.1",
  ...overrides
}: BaseOverrides & { baseSize?: string } = {}): CoinbaseOrder {
  return {
    ...baseOrder(overrides),
    order_type: "MARKET",
    order_configuration: {
      market_market_ioc: {
        base_size: baseSize,
      },
    },
  } as CoinbaseOrder;
}

export function makeBracketOrder({
  baseSize = "1.0",
  limitPrice = "110.00",
  stopTriggerPrice = "98.00",
  ...overrides
}: BaseOverrides & {
  baseSize?: string;
  limitPrice?: string;
  stopTriggerPrice?: string;
} = {}): CoinbaseOrder {
  return {
    ...baseOrder({ side: "SELL", ...overrides }),
    order_type: "BRACKET",
    order_configuration: {
      trigger_bracket_gtc: {
        base_size: baseSize,
        limit_price: limitPrice,
        stop_trigger_price: stopTriggerPrice,
      },
    },
  } as CoinbaseOrder;
}

export function makeStopLimitOrder({
  baseSize = "0.5",
  limitPrice = "101.00",
  stopPrice = "100.00",
  side = "BUY",
  ...overrides
}: BaseOverrides & {
  baseSize?: string;
  limitPrice?: string;
  stopPrice?: string;
  side?: "BUY" | "SELL";
} = {}): CoinbaseOrder {
  return {
    ...baseOrder({ side, ...overrides }),
    order_type: "STOP_LIMIT",
    order_configuration: {
      stop_limit_stop_limit_gtc: {
        base_size: baseSize,
        limit_price: limitPrice,
        stop_direction: side === "BUY" ? "STOP_DIRECTION_STOP_UP" : "STOP_DIRECTION_STOP_DOWN",
        stop_price: stopPrice,
      },
    },
  } as CoinbaseOrder;
}
