import { z } from "zod";

export const DebugOptionsSchema = z.object({
  debug: z.boolean().optional(),
});

export type DebugOptions = z.infer<typeof DebugOptionsSchema>;
