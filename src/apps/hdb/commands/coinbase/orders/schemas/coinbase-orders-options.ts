import { z } from "zod";
import { DebugOptionsSchema } from "../../../schemas/debug-options.js";
import { DateRangeSchema } from "../../../schemas/date-range.js";
import { OrderSideSchema } from "#shared/coinbase/schemas/coinbase-enum-schemas";

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

export const CoinbaseOrdersUpdateOptionsSchema = DebugOptionsSchema
  .extend({
    cache: z.boolean().optional(),
    rsync: z.boolean().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  })
export type CoinbaseOrdersUpdateOptions = z.infer<typeof CoinbaseOrdersUpdateOptionsSchema>;
