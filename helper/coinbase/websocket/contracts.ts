import { z } from 'zod';
import { CHANNEL_NAMES } from '@core/dictionary';
import { NumericString } from '@contracts/validation';

export const Channel = z.enum([
  CHANNEL_NAMES.heartbeats,
  CHANNEL_NAMES.user,
  CHANNEL_NAMES.ticker_batch,
  CHANNEL_NAMES.subscriptions,
]);

export const TickerSchema = z.object({
  product_id: z.string(),
  price: NumericString,
});
export type Ticker = z.infer<typeof TickerSchema>;

export const TickerBatchEventSchema = z.object({
  tickers: z.array(TickerSchema),
});

export const TickerBatchEventsSchema = z.array(TickerBatchEventSchema);
export type TickerBatchEvents = z.infer<typeof TickerBatchEventsSchema>;

export const CoinbaseWebsocketOrderSchema = z
  .object({
    avg_price: NumericString,
    cancel_reason: z.string(),
    client_order_id: z.uuid(),
    completion_percentage: NumericString,
    contract_expiry_type: z.string(),
    cumulative_quantity: NumericString,
    filled_value: NumericString,
    leaves_quantity: NumericString,
    limit_price: NumericString,
    number_of_fills: NumericString,
    order_id: z.uuid(),
    order_side: z.enum(['BUY', 'SELL']),
    order_type: z.string(),
    outstanding_hold_amount: NumericString,
    post_only: z.enum(['true', 'false']),
    product_id: z.string(),
    product_type: z.string(),
    reject_Reason: z.string(),
    retail_portfolio_id: z.uuid(),
    risk_managed_by: z.string(),
    status: z.string(),
    stop_price: z.union([NumericString, z.literal('')]),
    time_in_force: z.string(),
    total_fees: NumericString,
    total_value_after_fees: NumericString,
    trigger_status: z.string(),
    creation_time: z.string(),
    end_time: z.string(),
    start_time: z.string(),
  })
  .loose();
export type CoinbaseWebsocketOrder = z.infer<typeof CoinbaseWebsocketOrderSchema>;

export const UserEventSchema = z
  .object({
    orders: z.array(CoinbaseWebsocketOrderSchema),
  })
  .loose();

export const UserEventsSchema = z.array(UserEventSchema);
export type UserEvents = z.infer<typeof UserEventsSchema>;

export const WebSocketDataSchema = z.object({
  sequence_num: z.number(),
  channel: Channel,
  events: z.any().optional(),
});
export type WebSocketData = z.infer<typeof WebSocketDataSchema>;
