import { z } from "zod";
import { DebugOptionsSchema } from "../../schemas/debug-options.js";

export const SystemRebuildAllOptionsSchema = DebugOptionsSchema.extend({
  coinbaseTransactionsInputDir: z.string().trim().min(1).optional(),
  cointrackerGainsInputDir: z.string().trim().min(1).optional(),
  cointrackerTransactionsInputDir: z.string().trim().min(1).optional(),
  drop: z.boolean().optional(),
  quiet: z.boolean().optional(),
});

export type SystemRebuildAllOptions = z.infer<typeof SystemRebuildAllOptionsSchema>;
