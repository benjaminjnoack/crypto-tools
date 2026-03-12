import { z } from "zod";
import { DebugOptionsSchema } from "../../../schemas/debug-options.js";
import { DateRangeSchema } from "../../../schemas/date-range.js";
import { CoinbaseTransactionClassifierValues } from "../coinbase-transaction-classifiers.js";

const ColonSeparatedAssetStringSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[A-Za-z0-9:_-]+$/)
  .optional();

const ColonSeparatedStringSchema = z.string().trim().min(1).optional();

const ClassifierSchema = z.enum(CoinbaseTransactionClassifierValues);

const BaseTransactionQuerySchema = DebugOptionsSchema.extend({
  balance: z.boolean().optional(),
  classify: z.boolean().optional(),
  classifier: ClassifierSchema.optional(),
  exclude: ColonSeparatedAssetStringSchema,
  excludeManual: z.boolean().optional(),
  excludeSynthetic: z.boolean().optional(),
  first: z.string().regex(/^\d+$/).optional(),
  from: z.string().optional(),
  json: z.boolean().optional(),
  last: z.string().regex(/^\d+$/).optional(),
  manual: z.boolean().optional(),
  notes: z.boolean().optional(),
  notClassifier: ClassifierSchema.optional(),
  paired: z.boolean().optional(),
  quiet: z.boolean().optional(),
  range: DateRangeSchema.optional(),
  raw: z.boolean().optional(),
  synthetic: z.boolean().optional(),
  to: z.string().optional(),
  type: ColonSeparatedStringSchema,
  year: z.string().regex(/^\d{4}$/).optional(),
});

export const CoinbaseTransactionsQueryOptionsSchema = BaseTransactionQuerySchema;

export const CoinbaseTransactionsGroupIntervalSchema = z.enum([
  "day",
  "week",
  "month",
  "quarter",
  "year",
]);

export const CoinbaseTransactionsGroupOptionsSchema = BaseTransactionQuerySchema.extend({
  interval: CoinbaseTransactionsGroupIntervalSchema.optional(),
});

export const CoinbaseTransactionsIdOptionsSchema = DebugOptionsSchema.extend({
  balance: z.boolean().optional(),
  classify: z.boolean().optional(),
  json: z.boolean().optional(),
  lotId: z.string().trim().min(1).optional(),
  notes: z.boolean().optional(),
  quiet: z.boolean().optional(),
  raw: z.boolean().optional(),
});

export const CoinbaseTransactionsStatementOptionsSchema = DebugOptionsSchema.extend({
  manual: z.boolean().optional(),
  normalize: z.boolean().optional(),
});

export const CoinbaseTransactionsRegenerateOptionsSchema = DebugOptionsSchema.extend({
  drop: z.boolean().optional(),
  inputDir: z.string().trim().min(1).optional(),
  normalize: z.boolean().optional(),
  quiet: z.boolean().optional(),
});

export const CoinbaseTransactionsManualOptionsSchema = DebugOptionsSchema.extend({
  dryRun: z.boolean().optional(),
  fee: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1),
  price_currency: z.string().trim().min(1).optional(),
  price_at_tx: z.string().trim().min(1).optional(),
  quantity: z.string().trim().min(1),
  rewriteExisting: z.boolean().optional(),
  subtotal: z.string().trim().min(1).optional(),
  timestamp: z.string().trim().min(1),
  total: z.string().trim().min(1).optional(),
  type: z.string().trim().min(1),
});

export const CoinbaseTransactionsNavOptionsSchema = DebugOptionsSchema.extend({
  from: z.string().optional(),
  quiet: z.boolean().optional(),
  range: DateRangeSchema.optional(),
  remote: z.boolean().optional(),
  to: z.string().optional(),
  year: z.string().regex(/^\\d{4}$/).optional(),
});

export type CoinbaseTransactionsQueryOptions = z.infer<typeof CoinbaseTransactionsQueryOptionsSchema>;
export type CoinbaseTransactionsGroupOptions = z.infer<typeof CoinbaseTransactionsGroupOptionsSchema>;
export type CoinbaseTransactionsIdOptions = z.infer<typeof CoinbaseTransactionsIdOptionsSchema>;
export type CoinbaseTransactionsStatementOptions = z.infer<typeof CoinbaseTransactionsStatementOptionsSchema>;
export type CoinbaseTransactionsRegenerateOptions = z.infer<typeof CoinbaseTransactionsRegenerateOptionsSchema>;
export type CoinbaseTransactionsManualOptions = z.infer<typeof CoinbaseTransactionsManualOptionsSchema>;
export type CoinbaseTransactionsNavOptions = z.infer<typeof CoinbaseTransactionsNavOptionsSchema>;
