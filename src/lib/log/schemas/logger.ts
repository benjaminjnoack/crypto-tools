import z from "zod";

export const LogLevelSchema = z.enum([
  "debug",
  "info",
  "warn",
  "error",
]);
export type LogLevel = z.infer<typeof LogLevelSchema>;
export const LOG_LEVELS = LogLevelSchema.enum;
