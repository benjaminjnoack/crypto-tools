import { z } from "zod";
import { DebugOptionsSchema } from "../../../schemas/debug-options.js";
import { DateRangeSchema } from "../../../schemas/date-range.js";

export const CoinbaseBalancesQueryOptionsSchema = DebugOptionsSchema.extend({
  current: z.boolean().optional(),
  first: z.string().regex(/^\d+$/).optional(),
  from: z.string().optional(),
  json: z.boolean().optional(),
  jsonFile: z.string().trim().min(1).optional(),
  last: z.string().regex(/^\d+$/).optional(),
  quiet: z.boolean().optional(),
  range: DateRangeSchema.optional(),
  raw: z.boolean().optional(),
  remote: z.boolean().optional(),
  to: z.string().optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
});

export const CoinbaseBalancesBatchOptionsSchema = DebugOptionsSchema.extend({
  current: z.boolean().optional(),
  from: z.string().optional(),
  json: z.boolean().optional(),
  jsonFile: z.string().trim().min(1).optional(),
  quiet: z.boolean().optional(),
  raw: z.boolean().optional(),
  range: DateRangeSchema.optional(),
  remote: z.boolean().optional(),
  to: z.string().optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
});

export const CoinbaseBalancesTraceOptionsSchema = DebugOptionsSchema.extend({
  json: z.boolean().optional(),
  jsonFile: z.string().trim().min(1).optional(),
  quiet: z.boolean().optional(),
  raw: z.boolean().optional(),
  to: z.string().optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
});

export const CoinbaseBalancesRegenerateOptionsSchema = DebugOptionsSchema.extend({
  drop: z.boolean().optional(),
  quiet: z.boolean().optional(),
});

export type CoinbaseBalancesQueryOptions = z.infer<typeof CoinbaseBalancesQueryOptionsSchema>;
export type CoinbaseBalancesBatchOptions = z.infer<typeof CoinbaseBalancesBatchOptionsSchema>;
export type CoinbaseBalancesTraceOptions = z.infer<typeof CoinbaseBalancesTraceOptionsSchema>;
export type CoinbaseBalancesRegenerateOptions = z.infer<typeof CoinbaseBalancesRegenerateOptionsSchema>;
