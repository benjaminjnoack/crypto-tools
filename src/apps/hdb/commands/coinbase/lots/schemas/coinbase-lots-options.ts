import { z } from "zod";
import { DebugOptionsSchema } from "../../../schemas/debug-options.js";
import { DateRangeSchema } from "../../../schemas/date-range.js";

const AccountingSchema = z.string().trim().min(1).optional();

export const CoinbaseLotsQueryOptionsSchema = DebugOptionsSchema.extend({
  accounting: AccountingSchema,
  all: z.boolean().optional(),
  balance: z.boolean().optional(),
  buyLots: z.boolean().optional(),
  cash: z.boolean().optional(),
  csv: z.boolean().optional(),
  f8949: z.boolean().optional(),
  from: z.string().optional(),
  notes: z.boolean().optional(),
  obfuscate: z.boolean().optional(),
  pages: z.boolean().optional(),
  quiet: z.boolean().optional(),
  range: DateRangeSchema.optional(),
  to: z.string().optional(),
  totals: z.boolean().optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
});

export const CoinbaseLotsBatchOptionsSchema = CoinbaseLotsQueryOptionsSchema;

export const CoinbaseLotsCompareOptionsSchema = DebugOptionsSchema.extend({
  from: z.string().optional(),
  quiet: z.boolean().optional(),
  range: DateRangeSchema.optional(),
  to: z.string().optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
});

export const CoinbaseLotsBatchCompareOptionsSchema = CoinbaseLotsCompareOptionsSchema.extend({
  balance: z.boolean().optional(),
});

export type CoinbaseLotsQueryOptions = z.infer<typeof CoinbaseLotsQueryOptionsSchema>;
export type CoinbaseLotsBatchOptions = z.infer<typeof CoinbaseLotsBatchOptionsSchema>;
export type CoinbaseLotsCompareOptions = z.infer<typeof CoinbaseLotsCompareOptionsSchema>;
export type CoinbaseLotsBatchCompareOptions = z.infer<typeof CoinbaseLotsBatchCompareOptionsSchema>;
