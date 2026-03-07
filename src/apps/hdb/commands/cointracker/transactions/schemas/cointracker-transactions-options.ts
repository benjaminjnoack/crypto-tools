import { z } from "zod";
import { DebugOptionsSchema } from "../../../schemas/debug-options.js";
import { DateRangeSchema } from "../../../schemas/date-range.js";

export const CointrackerTransactionTypeValues = [
  "BUY",
  "INTEREST_PAYMENT",
  "OTHER_INCOME",
  "RECEIVE",
  "SELL",
  "SEND",
  "STAKING_REWARD",
  "TRADE",
  "TRANSFER",
] as const;

const CointrackerTransactionTypeSchema = z.enum(CointrackerTransactionTypeValues);

const ColonSeparatedAssetStringSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[A-Za-z0-9:_-]+$/)
  .optional();

const ColonSeparatedTypeStringSchema = z
  .string()
  .trim()
  .min(1)
  .optional()
  .refine((value) => {
    if (!value) {
      return true;
    }

    const tokens = value.split(":").map((token) => token.trim().toUpperCase());
    return tokens.every((token) => CointrackerTransactionTypeSchema.safeParse(token).success);
  }, "Invalid type list. Use colon-separated transaction types");

export const CointrackerTransactionsQueryOptionsSchema = DebugOptionsSchema.extend({
  exclude: ColonSeparatedAssetStringSchema,
  from: z.string().optional(),
  includeBalances: z.boolean().optional(),
  quiet: z.boolean().optional(),
  range: DateRangeSchema.optional(),
  raw: z.boolean().optional(),
  received: ColonSeparatedAssetStringSchema,
  sent: ColonSeparatedAssetStringSchema,
  to: z.string().optional(),
  type: ColonSeparatedTypeStringSchema,
  year: z.string().regex(/^\d{4}$/).optional(),
});

export const CointrackerTransactionGroupIntervalSchema = z.enum([
  "day",
  "week",
  "month",
  "quarter",
  "year",
]);

export const CointrackerTransactionsGroupOptionsSchema =
  CointrackerTransactionsQueryOptionsSchema.extend({
    interval: CointrackerTransactionGroupIntervalSchema.optional(),
  });

export type CointrackerTransactionsQueryOptions = z.infer<typeof CointrackerTransactionsQueryOptionsSchema>;
export type CointrackerTransactionsGroupOptions = z.infer<typeof CointrackerTransactionsGroupOptionsSchema>;
