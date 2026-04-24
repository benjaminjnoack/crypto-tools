import { z } from "zod";
import { DebugOptionsSchema } from "../../../schemas/debug-options.js";
import { DateRangeSchema } from "../../../schemas/date-range.js";

const ColonSeparatedAssetStringSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[A-Za-z0-9:_-]+$/)
  .optional();

export const CointrackerBalancesQueryOptionsSchema = DebugOptionsSchema.extend({
  from: z.string().optional(),
  includeType: z.boolean().optional(),
  json: z.boolean().optional(),
  jsonFile: z.string().trim().min(1).optional(),
  quiet: z.boolean().optional(),
  range: DateRangeSchema.optional(),
  to: z.string().optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
});

export const CointrackerBalancesRegenerateOptionsSchema = DebugOptionsSchema.extend({
  drop: z.boolean().optional(),
  quiet: z.boolean().optional(),
});

export const CointrackerBalancesAssetArgSchema = ColonSeparatedAssetStringSchema;

export type CointrackerBalancesQueryOptions = z.infer<typeof CointrackerBalancesQueryOptionsSchema>;
export type CointrackerBalancesRegenerateOptions = z.infer<typeof CointrackerBalancesRegenerateOptionsSchema>;
