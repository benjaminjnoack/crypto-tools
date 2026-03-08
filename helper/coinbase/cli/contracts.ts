import { z } from 'zod';
import { Percent, PositiveNumericString } from '@contracts/validation';

export const AccountsOptionsSchema = z
  .object({
    crypto: z.boolean().optional(),
    cash: z.boolean().optional(),
  })
  .strict();

export const AskOptionsSchema = z
  .object({
    baseSize: PositiveNumericString.optional(),
    value: PositiveNumericString.optional(),
  })
  .strict();

export const BidOptionsSchema = z
  .object({
    baseSize: PositiveNumericString.optional(),
    value: PositiveNumericString.optional(),
  })
  .strict();

export const BracketOptionsSchema = z
  .object({
    baseSize: PositiveNumericString,
    limitPrice: PositiveNumericString,
    stopPrice: PositiveNumericString,
  })
  .strict();

export const BuyOptionsSchema = z
  .object({
    baseSize: PositiveNumericString.optional(),
    value: PositiveNumericString.optional(),
  })
  .strict();

export const LimitOptionsSchema = z
  .object({
    baseSize: PositiveNumericString.optional(),
    buy: z.boolean().optional(),
    limitPrice: PositiveNumericString,
    sell: z.boolean().optional(),
    value: PositiveNumericString.optional(),
  })
  .strict()
  .refine((v) => (v.buy ? 1 : 0) + (v.sell ? 1 : 0) === 1, {
    message: 'Exactly one of --buy or --sell is required.',
    path: ['buy'],
  });

export const LimitTpSlOptionsSchema = z
  .object({
    baseSize: PositiveNumericString,
    limitPrice: PositiveNumericString,
    stopPrice: PositiveNumericString,
    takeProfitPrice: PositiveNumericString,
  })
  .strict();

export const MarketOptionsSchema = z
  .object({
    baseSize: PositiveNumericString.optional(),
    buy: z.boolean().optional(),
    sell: z.boolean().optional(),
    value: PositiveNumericString.optional(),
  })
  .strict()
  .refine((v) => (v.buy ? 1 : 0) + (v.sell ? 1 : 0) === 1, {
    message: 'Exactly one of --buy or --sell is required.',
    path: ['buy'],
  });

export const OrderIdSchema = z.uuid();

export const PlanOptionsSchema = z
  .object({
    bufferPercent: Percent,
    buyPrice: PositiveNumericString,
    dryRunFlag: z.boolean(),
    riskPercent: Percent,
    stopPrice: PositiveNumericString,
    takeProfitPrice: PositiveNumericString,
  })
  .strict();

export const ProductSchema = z
  .string()
  .trim()
  .min(1)
  .default('BTC-USD')
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z0-9]+(?:-USD)?$/.test(value), {
    message: 'Product must be TOKEN or TOKEN-USD.',
  })
  .transform((value) => (value.endsWith('-USD') ? value : `${value}-USD`));

export const ProductArgsSchema = z.object({
  product: ProductSchema.optional().default('BTC-USD'),
});

export const SellOptionsSchema = z
  .object({
    baseSize: PositiveNumericString.optional(),
    value: PositiveNumericString.optional(),
  })
  .strict();

export const StopOptionsSchema = z
  .object({
    baseSize: PositiveNumericString,
    limitPrice: PositiveNumericString,
    stopPrice: PositiveNumericString,
  })
  .strict();

export type AccountsOptions = z.infer<typeof AccountsOptionsSchema>;
export type AskOptions = z.infer<typeof AskOptionsSchema>;
export type BidOptions = z.infer<typeof BidOptionsSchema>;
export type BracketOptions = z.infer<typeof BracketOptionsSchema>;
export type BuyOptions = z.infer<typeof BuyOptionsSchema>;
export type LimitOptions = z.infer<typeof LimitOptionsSchema>;
export type LimitTpSlOptions = z.infer<typeof LimitTpSlOptionsSchema>;
export type MarketOptions = z.infer<typeof MarketOptionsSchema>;
export type PlanOptions = z.infer<typeof PlanOptionsSchema>;
export type ProductArgs = z.infer<typeof ProductArgsSchema>;
export type SellOptions = z.infer<typeof SellOptionsSchema>;
export type StopOptions = z.infer<typeof StopOptionsSchema>;
