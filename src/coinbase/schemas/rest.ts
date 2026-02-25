import { z } from "zod";
import { NumericString } from "../../schemas/primitives.js";
import { AccountType, OrderSideSchema } from "./enums.js"
import { CoinbaseOrderSchema, OrderConfigurationSchema } from "./orders.js";

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
export type CoinbaseAccount = z.infer<typeof CoinbaseAccountSchema>;

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
export type CoinbasePriceBook = z.infer<typeof CoinbasePriceBookSchema>;

export const FeeTierSchema = z
  .object({
    pricing_tier: z.string(),
    taker_fee_rate: NumericString,
    maker_fee_rate: NumericString,
  })
  .loose();

export const BatchCancelResultSchema = z
  .object({
    success: z.boolean(),
    failure_reason: z.string(),
    order_id: z.uuid(),
  })
  .loose();

export const CoinbaseProductType = z.enum(["SPOT"]);

export const CoinbaseProductSchema = z
  .object({
    product_id: z.string(),
    price: NumericString,
    base_increment: NumericString,
    price_increment: NumericString,
    product_type: CoinbaseProductType,
  })
  .loose();
export type CoinbaseProduct = z.infer<typeof CoinbaseProductSchema>;

export const OrderRequestSchema = z
  .object({
    client_order_id: z.uuid(),
    product_id: z.string(),
    side: OrderSideSchema,
    order_configuration: OrderConfigurationSchema,
  })
  .strict();
export type OrderRequest = z.infer<typeof OrderRequestSchema>;

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
export type OrderHistoricalBatchResponse = z.infer<typeof OrdersHistoricalBatchResponseSchema>;

export const OrdersBatchCancelResponseSchema = z
  .object({
    results: z.array(BatchCancelResultSchema)
  });

export const TickerResponseSchema = z
  .object({
    trades: z.array(CoinbasePriceSchema),
    best_bid: NumericString,
    best_ask: NumericString,
  })
  .loose();
export type TickerResponse = z.infer<typeof TickerResponseSchema>;

export const TransactionSummaryResponseSchema = z
  .object({
    fee_tier: FeeTierSchema,
    total_balance: NumericString,
    total_fees: z.number(),
    total_volume: z.number(),
  })
  .loose();
export type TransactionSummary = z.infer<typeof TransactionSummaryResponseSchema>;
