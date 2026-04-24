import { z } from "zod";
import { DebugOptionsSchema } from "../../../schemas/debug-options.js";
import { DateRangeSchema } from "../../../schemas/date-range.js";
import { OrderSideSchema } from "../../../../../../shared/coinbase/schemas/coinbase-enum-schemas.js";

export const TimeOptionsSchema = z.object({
  from: z.string().optional(),
  range: DateRangeSchema.optional(),
  to: z.string().optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
});

export const CoinbaseOrdersFeesOptionsSchema = DebugOptionsSchema
  .extend(TimeOptionsSchema.shape)
  .extend({
    side: z
      .preprocess(
        (value) => (typeof value === "string" ? value.toUpperCase() : value),
        OrderSideSchema,
      )
      .optional(),
  });
export type CoinbaseOrdersFeesOptions = z.infer<typeof CoinbaseOrdersFeesOptionsSchema>;

export const CoinbaseOrdersReadOptionsSchema = DebugOptionsSchema.extend({
  json: z.boolean().optional(),
  jsonFile: z.string().trim().min(1).optional(),
});
export type CoinbaseOrdersReadOptions = z.infer<typeof CoinbaseOrdersReadOptionsSchema>;

export const CoinbaseOrdersInsertOptionsSchema = DebugOptionsSchema.extend({
  remote: z.boolean().optional(),
});
export type CoinbaseOrdersInsertOptions = z.infer<typeof CoinbaseOrdersInsertOptionsSchema>;

export const CoinbaseOrdersUpdateOptionsSchema = DebugOptionsSchema
  .extend(TimeOptionsSchema.shape)
  .extend({
    cache: z.boolean().optional(),
    remote: z.boolean().optional(),
    rsync: z.boolean().optional(),
  })
export type CoinbaseOrdersUpdateOptions = z.infer<typeof CoinbaseOrdersUpdateOptionsSchema>;

export const CoinbaseOrdersRegenerateOptionsSchema = CoinbaseOrdersUpdateOptionsSchema.extend({
  drop: z.boolean().optional(),
});
export type CoinbaseOrdersRegenerateOptions = z.infer<typeof CoinbaseOrdersRegenerateOptionsSchema>;
