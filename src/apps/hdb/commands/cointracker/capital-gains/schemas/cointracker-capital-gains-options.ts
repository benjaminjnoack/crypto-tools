import { z } from "zod";
import { DebugOptionsSchema } from "../../../schemas/debug-options.js";
import { DateRangeSchema } from "../../../schemas/date-range.js";

const ColonSeparatedAssetStringSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[A-Za-z0-9:_-]+$/)
  .optional();

const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

const BaseCapitalGainsQuerySchema = DebugOptionsSchema.extend({
  cash: z.boolean().optional(),
  crypto: z.boolean().optional(),
  exclude: ColonSeparatedAssetStringSchema,
  first: z.string().regex(/^\d+$/).optional(),
  from: z.string().optional(),
  gains: z.boolean().optional(),
  last: z.string().regex(/^\d+$/).optional(),
  quiet: z.boolean().optional(),
  range: DateRangeSchema.optional(),
  received: DateOnlySchema,
  sent: DateOnlySchema,
  to: z.string().optional(),
  totals: z.boolean().optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
  zero: z.boolean().optional(),
});

export const CointrackerCapitalGainsGetOptionsSchema = BaseCapitalGainsQuerySchema;

export const CointrackerCapitalGainsGroupOptionsSchema = BaseCapitalGainsQuerySchema.extend({
  bleeders: z.boolean().optional(),
  type: z.enum(["short", "long"]).optional(),
});

export const CointrackerCapitalGainsRegenerateOptionsSchema = DebugOptionsSchema.extend({
  drop: z.boolean().optional(),
  inputDir: z.string().trim().min(1).optional(),
  yes: z.boolean().optional(),
});

export type CointrackerCapitalGainsGetOptions = z.infer<typeof CointrackerCapitalGainsGetOptionsSchema>;
export type CointrackerCapitalGainsGroupOptions = z.infer<typeof CointrackerCapitalGainsGroupOptionsSchema>;
export type CointrackerCapitalGainsRegenerateOptions = z.infer<typeof CointrackerCapitalGainsRegenerateOptionsSchema>;
