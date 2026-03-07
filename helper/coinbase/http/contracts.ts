import { z } from 'zod';
import { NumericString } from '@contracts/validation';
import { ORDER_TYPES } from '@core/dictionary';

export const AccountType = z.enum(['ACCOUNT_TYPE_CRYPTO', 'ACCOUNT_TYPE_FIAT']);
export const OrderSide = z.enum(['BUY', 'SELL']);

export const ErrorResponseSchema = z
  .object({
    preview_failure_reason: z.string(),
  })
  .loose();

export const MoneySchema = z
  .object({
    value: NumericString,
  })
  .loose();

export const SuccessResponseSchema = z
  .object({
    order_id: z.uuid(),
  })
  .loose();

export const CoinbaseAccountSchema = z
  .object({
    currency: z.string(),
    hold: MoneySchema,
    available_balance: MoneySchema,
    type: AccountType,
    uuid: z.uuid(),
  })
  .loose();

export const CoinbasePriceSchema = z
  .object({
    price: NumericString,
  })
  .loose();

export const CoinbasePriceBookSchema = z
  .object({
    asks: z.array(CoinbasePriceSchema),
    bids: z.array(CoinbasePriceSchema),
  })
  .loose();

export const FeeTierSchema = z
  .object({
    pricing_tier: z.string(),
    taker_fee_rate: NumericString,
    maker_fee_rate: NumericString,
  })
  .loose();

export const BatchCancelResultSchema = z
  .object({
    order_id: z.uuid(),
  })
  .loose();

export const CoinbaseProductType = z.enum(['SPOT']);

export const CoinbaseProductSchema = z
  .object({
    product_id: z.string(),
    price: NumericString,
    base_increment: NumericString,
    price_increment: NumericString,
    product_type: CoinbaseProductType,
  })
  .loose();

/***********************************COINBASE ORDERS*******************************/

export const LimitOrderConfigurationSchema = z
  .object({
    limit_limit_gtc: z.object({
      base_size: NumericString,
      limit_price: NumericString,
    }),
  })
  .loose();

export const MarketOrderConfigurationSchema = z
  .object({
    market_market_ioc: z.object({
      base_size: NumericString,
    }),
  })
  .loose();

export const BracketOrderConfigurationSchema = z
  .object({
    trigger_bracket_gtc: z.object({
      base_size: NumericString,
      limit_price: NumericString,
      stop_trigger_price: NumericString,
    }),
  })
  .loose();

export const StopLimitOrderConfigurationSchema = z
  .object({
    stop_limit_stop_limit_gtc: z.object({
      base_size: NumericString,
      limit_price: NumericString,
      stop_direction: z.string(),
      stop_price: NumericString,
    }),
  })
  .loose();

export const OrderConfigurationSchema = z.union([
  LimitOrderConfigurationSchema,
  MarketOrderConfigurationSchema,
  BracketOrderConfigurationSchema,
  StopLimitOrderConfigurationSchema,
]);

export const CoinbaseOrderBaseSchema = z
  .object({
    order_id: z.uuid(),
    product_id: z.string(),
    side: OrderSide,
    status: z.string(),
    completion_percentage: z.string(),
    filled_size: z.string(),
    average_filled_price: z.string(),
    filled_value: z.string(),
    total_fees: z.string(),
    total_value_after_fees: z.string(),
    product_type: z.string(),
    last_fill_time: z.string().optional(), //TODO is it always here?
  })
  .loose();
export type CoinbaseOrderBase = z.infer<typeof CoinbaseOrderBaseSchema>;

export const CoinbaseBracketOrderSchema = CoinbaseOrderBaseSchema.extend({
  order_type: z.literal(ORDER_TYPES.BRACKET),
  order_configuration: BracketOrderConfigurationSchema,
});
export type CoinbaseBracketOrder = z.infer<typeof CoinbaseBracketOrderSchema>;

export const CoinbaseLimitOrderSchema = CoinbaseOrderBaseSchema.extend({
  order_type: z.literal(ORDER_TYPES.LIMIT),
  order_configuration: LimitOrderConfigurationSchema,
});
export type CoinbaseLimitOrder = z.infer<typeof CoinbaseLimitOrderSchema>;

export const CoinbaseStopLimitOrderSchema = CoinbaseOrderBaseSchema.extend({
  order_type: z.literal(ORDER_TYPES.STOP_LIMIT),
  order_configuration: StopLimitOrderConfigurationSchema,
});
export type CoinbaseStopLimitOrder = z.infer<typeof CoinbaseStopLimitOrderSchema>;

export const CoinbaseMarketOrderSchema = CoinbaseOrderBaseSchema.extend({
  order_type: z.literal(ORDER_TYPES.MARKET),
  order_configuration: MarketOrderConfigurationSchema,
});
export type CoinbaseMarketOrder = z.infer<typeof CoinbaseMarketOrderSchema>;

export const CoinbaseOrderSchema = z.discriminatedUnion('order_type', [
  CoinbaseBracketOrderSchema,
  CoinbaseLimitOrderSchema,
  CoinbaseStopLimitOrderSchema,
  CoinbaseMarketOrderSchema,
]);
export type CoinbaseOrder = z.infer<typeof CoinbaseOrderSchema>;

/***********************************REQUEST SCHEMA*******************************/

export const OrderRequestSchema = z
  .object({
    client_order_id: z.uuid(),
    product_id: z.string(),
    side: OrderSide,
    order_configuration: OrderConfigurationSchema,
  })
  .strict();

/***********************************RESPONSE SCHEMA*******************************/

export const AccountResponseSchema = z
  .object({
    account: CoinbaseAccountSchema,
  })
  .loose();

export const AccountsResponseSchema = z
  .object({
    accounts: z.array(CoinbaseAccountSchema),
  })
  .loose();

export const BestBidAskResponseSchema = z
  .object({
    pricebooks: z.array(CoinbasePriceBookSchema),
  })
  .loose();

export const CandleSchema = z
  .object({
    start: NumericString,
    low: NumericString,
    high: NumericString,
    open: NumericString,
    close: NumericString,
    volume: NumericString,
  })
  .loose();

export const CandlesResponseSchema = z
  .object({
    candles: z.array(CandleSchema),
  })
  .loose();

export const OrderResponseSchema = z
  .object({
    success: z.boolean(),
    success_response: SuccessResponseSchema.optional(),
    error_response: ErrorResponseSchema.optional(),
  })
  .loose();

export const OrdersHistoricalResponseSchema = z
  .object({
    order: CoinbaseOrderSchema,
  })
  .loose();

export const OrdersHistoricalBatchResponseSchema = z
  .object({
    orders: z.array(CoinbaseOrderSchema),
    cursor: z.string().optional(),
  })
  .loose();

export const OrdersBatchCancelResponseSchema = z
  .object({
    success: z.boolean(),
    results: z.array(BatchCancelResultSchema).optional(),
    failure_reason: z.string().optional(),
  })
  .loose();

export const ProductsResponseSchema = z
  .object({
    products: z.array(CoinbaseProductSchema),
  })
  .loose();

export const TickerResponseSchema = z
  .object({
    trades: z.array(CoinbasePriceSchema),
    best_bid: NumericString,
    best_ask: NumericString,
  })
  .loose();

export const TransactionSummaryResponseSchema = z
  .object({
    fee_tier: FeeTierSchema,
    total_balance: NumericString,
    total_fees: z.number(),
    total_volume: z.number(),
  })
  .loose();

export type CoinbaseAccount = z.infer<typeof CoinbaseAccountSchema>;
export type CoinbaseCandle = z.infer<typeof CandleSchema>;
export type CoinbaseProduct = z.infer<typeof CoinbaseProductSchema>;
export type AccountResponse = z.infer<typeof AccountResponseSchema>;
export type AccountsResponse = z.infer<typeof AccountsResponseSchema>;
export type OrderRequest = z.infer<typeof OrderRequestSchema>;
export type OrderHistoricalBatchResponse = z.infer<typeof OrdersHistoricalBatchResponseSchema>;
export type CoinbasePriceBook = z.infer<typeof CoinbasePriceBookSchema>;
export type TickerResponse = z.infer<typeof TickerResponseSchema>;
export type TransactionSummary = z.infer<typeof TransactionSummaryResponseSchema>;
