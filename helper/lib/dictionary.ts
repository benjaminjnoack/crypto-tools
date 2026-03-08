// src/lib/dictionary.ts

/** Channels exposed by the WS/API surface */
export const CHANNEL_NAMES = {
  level2: 'level2',
  user: 'user',
  tickers: 'ticker',
  ticker_batch: 'ticker_batch',
  status: 'status',
  market_trades: 'market_trades',
  candles: 'candles',
  heartbeats: 'heartbeats',
  subscriptions: 'subscriptions',
} as const;
export type ChannelName = (typeof CHANNEL_NAMES)[keyof typeof CHANNEL_NAMES];

/** Order event names */
export const ORDER_EVENT_NAMES = {
  STATUS_CHANGE: 'status_changed',
} as const;
export type OrderEventName = (typeof ORDER_EVENT_NAMES)[keyof typeof ORDER_EVENT_NAMES];

/** Order status values as seen in your domain */
export const ORDER_STATUS = {
  PENDING: 'PENDING',
  OPEN: 'OPEN',
  FILLED: 'FILLED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED',
  UNKNOWN: 'UNKNOWN_ORDER_STATUS',
  QUEUED: 'QUEUED',
  CANCEL_QUEUED: 'CANCEL_QUEUED',
} as const;
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

/** Keys used in order payloads/records */
export const ORDER_KEYS = {
  AVERAGE_FILLED_PRICE: 'average_filled_price',
  AVG_PRICE: 'avg_price',
  BASE_SIZE: 'base_size',
  COMPLETION_PERCENTAGE: 'completion_percentage',
  CUMULATIVE_QUANTITY: 'cumulative_quantity',
  FILLED_SIZE: 'filled_size',
  FILLED_VALUE: 'filled_value',
  LAST_FILL_TIME: 'last_fill_time',
  LIMIT_LIMIT_GTC: 'limit_limit_gtc',
  LIMIT_PRICE: 'limit_price',
  MARKET_MARKET_IOC: 'market_market_ioc',
  ORDER_CONFIGURATION: 'order_configuration',
  ORDER_ID: 'order_id',
  PRODUCT_ID: 'product_id',
  SIDE: 'side',
  STATUS: 'status',
  STOP_LIMIT: 'stop_limit_stop_limit_gtc',
  STOP_PRICE: 'stop_price',
  STOP_TRIGGER_PRICE: 'stop_trigger_price',
  TOTAL_FEES: 'total_fees',
  TOTAL_VALUE_AFTER_FEES: 'total_value_after_fees',
  TRIGGER_BRACKET_GTC: 'trigger_bracket_gtc',
  TRIGGER_STATUS: 'trigger_status',
} as const;
export type OrderKey = (typeof ORDER_KEYS)[keyof typeof ORDER_KEYS];

/** Canonical side values */
export const ORDER_VALUES = {
  SIDE_BUY: 'BUY',
  SIDE_SELL: 'SELL',
} as const;
export type OrderSideValue = (typeof ORDER_VALUES)[keyof typeof ORDER_VALUES];

/** Public-facing order sides (already exported in your JS) */
export const ORDER_SIDE = {
  BUY: 'BUY',
  SELL: 'SELL',
} as const;
export type OrderSide = (typeof ORDER_SIDE)[keyof typeof ORDER_SIDE];

/** Order types */
export const ORDER_TYPES = {
  UNKNOWN: 'UNKNOWN_ORDER_TYPE',
  MARKET: 'MARKET',
  LIMIT: 'LIMIT',
  STOP: 'STOP',
  STOP_LIMIT: 'STOP_LIMIT',
  BRACKET: 'BRACKET',
} as const;
export type OrderType = (typeof ORDER_TYPES)[keyof typeof ORDER_TYPES];

/** Position keys (reuse literals from ORDER_KEYS where appropriate) */
export const POSITION_KEYS = {
  BASE_SIZE: ORDER_KEYS.BASE_SIZE,
  BUY: 'buy',
  BUY_PRICE: 'buy_price',
  BOUGHT: 'bought',
  CANCELLED: 'canceled',
  CLASS: 'class',
  CLOSE_DATE: 'close_date',
  COMPLETE: 'complete',
  CURRENT_PRICE: 'current_price',
  EXECUTING: 'executing',
  LIMIT: 'limit',
  LIMIT_PRICE: ORDER_KEYS.LIMIT_PRICE,
  LOG: 'log',
  NAME: 'name',
  OPEN_DATE: 'open_date',
  ORDER_ID: ORDER_KEYS.ORDER_ID,
  PERCENT_COMPLETE: 'percent_complete',
  PNL: 'PnL',
  PRODUCT_ID: ORDER_KEYS.PRODUCT_ID,
  RISK: 'risk',
  SELL: 'sell',
  SHAVES: 'shaves',
  SOLD: 'sold',
  STOP: 'stop',
  STATUS: ORDER_KEYS.STATUS,
  STOP_PRICE: ORDER_KEYS.STOP_PRICE,
  STOP_TRIGGER_PRICE: ORDER_KEYS.STOP_TRIGGER_PRICE,
  TARGET_PRICE: 'target_price',
  TRAIL: 'trail',
  UUID: 'uuid',
  VALUE: 'value',
} as const;
export type PositionKey = (typeof POSITION_KEYS)[keyof typeof POSITION_KEYS];

export interface OrderConfig {
  order_id: string;
  base_size: string;
  uuid: string;
  status: string;
  filled_size: string;
  filled_value: string;
  average_filled_price: string;
  kind: 'LimitBuy' | 'BracketSell' | 'Market';
}

export enum OrderKind {
  LimitBuy = 'LimitBuy',
  BracketSell = 'BracketSell',
  Market = 'Market',
}

export interface LimitBuyOrderConfig extends OrderConfig {
  kind: OrderKind.LimitBuy;
  limit_price: string;
}

export interface BracketSellOrderConfig extends OrderConfig {
  kind: OrderKind.BracketSell;
  limit_price: string;
  stop_price: string;
}

export interface MarketOrderConfig extends OrderConfig {
  kind: OrderKind.Market;
}

export type AnyOrderConfig = LimitBuyOrderConfig | BracketSellOrderConfig | MarketOrderConfig;

export interface PositionJSON {
  // Added by Position.toJSON
  name: string;
  status: string;
  product_id: string;
  open_date: string;
  buy: {
    limit_limit_gtc: Array<LimitBuyOrderConfig>;
  };
  sell: {
    trigger_bracket_gtc: Array<BracketSellOrderConfig>;
    market_market_ioc: Array<MarketOrderConfig>;
  };
  log: Array<string>;
  executing: boolean;
  complete: boolean;
  cancelled: boolean;
  trail: Array<string>;
  close_date: string;
  // Added by Position.getState
  current_price: string;
  PnL: string;
  percent_complete: string;
}

/** Position status lifecycle */
export const POSITION_STATUS = {
  UNKNOWN: 'UNKNOWN',
  PREPPED: 'PREPPED',
  BUYING: 'BUYING',
  BOUGHT: 'BOUGHT',
  SELLING: 'SELLING',
  SOLD: 'SOLD',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;
export type PositionStatus = (typeof POSITION_STATUS)[keyof typeof POSITION_STATUS];

/* ---------- runtime type guards (defend boundaries) ---------- */

export function isOrderStatus(x: unknown): x is OrderStatus {
  return Object.values(ORDER_STATUS).includes(x as OrderStatus);
}
export function isOrderType(x: unknown): x is OrderType {
  return Object.values(ORDER_TYPES).includes(x as OrderType);
}
export function isOrderSide(x: unknown): x is OrderSide {
  return Object.values(ORDER_SIDE).includes(x as OrderSide);
}
export function isChannelName(x: unknown): x is ChannelName {
  return Object.values(CHANNEL_NAMES).includes(x as ChannelName);
}
