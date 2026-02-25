import { z } from "zod";
import { LogLevelSchema } from "../../log/schemas/logger.js";

export const EnvSchema = z
  .object({
    HELPER_COINBASE_CREDENTIALS_PATH: z.string().min(1),
    HELPER_POSTGRES_DATABASE: z.string().min(1).optional(),
    HELPER_POSTGRES_USERNAME: z.string().min(1).optional(),
    HELPER_POSTGRES_PASSWORD: z.string().min(1).optional(),
    HELPER_LOG_LEVEL: LogLevelSchema.optional()
  }).loose();

export type Env = z.infer<typeof EnvSchema>;
