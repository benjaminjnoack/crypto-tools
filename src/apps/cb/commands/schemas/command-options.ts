import { z } from "zod";
import { Percent, PositiveNumericString } from "#shared/schemas/shared-primitives";

export const AccountsOptionsSchema = z
  .object({
    crypto: z.boolean().optional(),
    cash: z.boolean().optional(),
  })
  .strict();
export type AccountsOptions = z.infer<typeof AccountsOptionsSchema>;

export const AskOptionsSchema = z
  .object({
    baseSize: PositiveNumericString.optional(),
    postOnly: z.boolean().optional(),
    value: PositiveNumericString.optional(),
  })
  .strict();
export type AskOptions = z.infer<typeof AskOptionsSchema>;

export const BidOptionsSchema = z
  .object({
    baseSize: PositiveNumericString.optional(),
    postOnly: z.boolean().optional(),
    value: PositiveNumericString.optional(),
  })
  .strict();
export type BidOptions = z.infer<typeof BidOptionsSchema>;

export const BracketOptionsSchema = z
  .object({
    baseSize: PositiveNumericString,
    limitPrice: PositiveNumericString,
    stopPrice: PositiveNumericString,
  })
  .strict();
export type BracketOptions = z.infer<typeof BracketOptionsSchema>;

export const BuyOptionsSchema = z
  .object({
    baseSize: PositiveNumericString.optional(),
    value: PositiveNumericString.optional(),
  })
  .strict();
export type BuyOptions = z.infer<typeof BuyOptionsSchema>;

export const LimitOptionsSchema = z
  .object({
    baseSize: PositiveNumericString.optional(),
    buy: z.boolean().optional(),
    limitPrice: PositiveNumericString,
    postOnly: z.boolean().optional(),
    sell: z.boolean().optional(),
    value: PositiveNumericString.optional(),
  })
  .strict()
  .refine((v) => (v.buy ? 1 : 0) + (v.sell ? 1 : 0) === 1, {
    message: "Exactly one of --buy or --sell is required.",
    path: ["buy"],
  });
export type LimitOptions = z.infer<typeof LimitOptionsSchema>;

export const LimitTpSlOptionsSchema = z
  .object({
    baseSize: PositiveNumericString,
    limitPrice: PositiveNumericString,
    postOnly: z.boolean().optional(),
    stopPrice: PositiveNumericString,
    takeProfitPrice: PositiveNumericString,
  })
  .strict();
export type LimitTpSlOptions = z.infer<typeof LimitTpSlOptionsSchema>;

export const MarketOptionsSchema = z
  .object({
    baseSize: PositiveNumericString.optional(),
    buy: z.boolean().optional(),
    sell: z.boolean().optional(),
    value: PositiveNumericString.optional(),
  })
  .strict()
  .refine((v) => (v.buy ? 1 : 0) + (v.sell ? 1 : 0) === 1, {
    message: "Exactly one of --buy or --sell is required.",
    path: ["buy"],
  });
export type MarketOptions = z.infer<typeof MarketOptionsSchema>;

export const ModifyOptionsSchema = z
  .object({
    baseSize: PositiveNumericString.optional(),
    limitPrice: PositiveNumericString.optional(),
    stopPrice: PositiveNumericString.optional(),
    takeProfitPrice: PositiveNumericString.optional(),
  })
  .strict()
  .refine((v) => Boolean(v.baseSize ?? v.limitPrice ?? v.stopPrice ?? v.takeProfitPrice), {
    message: "At least one of --baseSize, --limitPrice, --stopPrice, or --takeProfitPrice is required.",
    path: ["baseSize"],
  });
export type ModifyOptions = z.infer<typeof ModifyOptionsSchema>;

export const BreakEvenStopOptionsSchema = z
  .object({
    buyPrice: PositiveNumericString,
    limitPrice: PositiveNumericString.optional(),
  })
  .strict();
export type BreakEvenStopOptions = z.infer<typeof BreakEvenStopOptionsSchema>;


export const PlanOptionsSchema = z
  .object({
    allIn: z.boolean(),
    bufferPercent: Percent,
    buyPrice: PositiveNumericString,
    dryRunFlag: z.boolean(),
    postOnly: z.boolean().optional(),
    riskPercent: Percent,
    stopPrice: PositiveNumericString,
    takeProfitPrice: PositiveNumericString,
  })
  .strict();
export type PlanOptions = z.infer<typeof PlanOptionsSchema>;

export const FibOptionsSchema = z
  .object({
    allIn: z.boolean(),
    bufferPercent: Percent,
    ceiling: PositiveNumericString,
    dryRunFlag: z.boolean(),
    floor: PositiveNumericString,
    postOnly: z.boolean().optional(),
    riskPercent: Percent,
  })
  .strict();
export type FibOptions = z.infer<typeof FibOptionsSchema>;

export const SellOptionsSchema = z
  .object({
    baseSize: PositiveNumericString.optional(),
    value: PositiveNumericString.optional(),
  })
  .strict();
export type SellOptions = z.infer<typeof SellOptionsSchema>;

export const StopOptionsSchema = z
  .object({
    baseSize: PositiveNumericString,
    limitPrice: PositiveNumericString,
    stopPrice: PositiveNumericString,
  })
  .strict();
export type StopOptions = z.infer<typeof StopOptionsSchema>;
