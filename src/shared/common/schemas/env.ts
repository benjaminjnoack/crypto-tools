import { z } from "zod";
import { LogLevelSchema } from "#shared/log/schemas/logger";

export const EnvSchema = z
  .object({
    HELPER_COINBASE_CREDENTIALS_PATH: z.string().min(1),
    HELPER_ALLOW_LIVE_EXCHANGE: z.enum(["true", "false"]).optional(),
    HELPER_HDB_ROOT_DIR: z.string().min(1).optional(),
    HELPER_POSTGRES_DATABASE: z.string().min(1).optional(),
    HELPER_POSTGRES_USERNAME: z.string().min(1).optional(),
    HELPER_POSTGRES_PASSWORD: z.string().min(1).optional(),
    HELPER_LOG_LEVEL: LogLevelSchema.optional()
  }).loose();

export type Env = z.infer<typeof EnvSchema>;
