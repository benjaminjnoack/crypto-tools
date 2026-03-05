import { z } from "zod";
import { NumericString } from "../../schemas/shared-primitives.js";
import { ORDER_TYPES, OrderSideSchema, OrderStatusSchema, ProductTypeSchema } from "./coinbase-enum-schemas.js";
import { CoinbaseUtcDateTimeString } from "./coinbase-primitives-schemas.js";

export const LimitOrderConfigurationSchema = z
  .object({
    limit_limit_gtc: z.object({
      base_size: NumericString,
      limit_price: NumericString,
      post_only: z.boolean().default(true),
    }),
  })
  .loose();

export const MarketOrderConfigurationSchema = z
  .object({
    market_market_ioc: z
      .object({
        base_size: NumericString.optional(),
        quote_size: NumericString.optional(),
      })
      .refine((value) => value.base_size !== undefined || value.quote_size !== undefined, {
        message: "market_market_ioc requires base_size or quote_size",
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

export const TpSlAttachedOrderConfigurationSchema = z
  .object({
    trigger_bracket_gtc: z.object({
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
    side: OrderSideSchema,
    status: OrderStatusSchema,
    completion_percentage: NumericString,
    filled_size: NumericString,
    average_filled_price: NumericString,
    filled_value: NumericString,
    total_fees: NumericString,
    total_value_after_fees: NumericString,
    product_type: ProductTypeSchema,
    last_fill_time: CoinbaseUtcDateTimeString.nullable(),
  })
  .loose();

export const CoinbaseBracketOrderSchema = CoinbaseOrderBaseSchema.extend({
  order_type: z.literal(ORDER_TYPES.BRACKET),
  order_configuration: BracketOrderConfigurationSchema,
});

export const CoinbaseLimitOrderSchema = CoinbaseOrderBaseSchema.extend({
  order_type: z.literal(ORDER_TYPES.LIMIT),
  order_configuration: LimitOrderConfigurationSchema,
  attached_order_configuration: TpSlAttachedOrderConfigurationSchema.nullish()
});

export const CoinbaseStopLimitOrderSchema = CoinbaseOrderBaseSchema.extend({
  order_type: z.literal(ORDER_TYPES.STOP_LIMIT),
  order_configuration: StopLimitOrderConfigurationSchema,
});

export const CoinbaseMarketOrderSchema = CoinbaseOrderBaseSchema.extend({
  order_type: z.literal(ORDER_TYPES.MARKET),
  order_configuration: MarketOrderConfigurationSchema,
});

export const CoinbaseTpSlOrderSchema = CoinbaseOrderBaseSchema.extend({
  order_type: z.literal(ORDER_TYPES.TAKE_PROFIT_STOP_LOSS),
  order_configuration: BracketOrderConfigurationSchema,
});

export const CoinbaseOrderSchema = z.discriminatedUnion("order_type", [
  CoinbaseBracketOrderSchema,
  CoinbaseLimitOrderSchema,
  CoinbaseStopLimitOrderSchema,
  CoinbaseMarketOrderSchema,
  CoinbaseTpSlOrderSchema
]);
export type CoinbaseOrder = z.infer<typeof CoinbaseOrderSchema>;
