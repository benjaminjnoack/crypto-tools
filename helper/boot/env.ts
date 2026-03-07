// ESM-only. Loads .env deterministically (not from process.cwd), parses once with Zod,
// and returns a cached, typed Env object thereafter.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

/* ------------------------- Zod schema (centralized) ------------------------ */
const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    // --- Core ---
    // DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    // -- Email ---
    HELPER_GMAIL_USER: z.string().min(1, 'HELPER_GMAIL_USER missing'),
    HELPER_GMAIL_PASS: z.string().min(19, 'HELPER_GMAIL_PASS missing'),
    HELPER_ADMIN_EMAIL: z.string().min(1, 'HELPER_ADMIN_EMAIL missing'),

    // --- Coinbase  ---
    HELPER_COINBASE_CREDENTIALS_PATH: z.string().min(1, 'HELPER_COINBASE_CREDENTIALS_PATH missing'),

    // --- Helper Data Base ---
    HELPER_HDB_ROOT_DIR: z.string().min(1, 'HELPER_HDB_ROOT_DIR missing'),

    // --- HTTP server (only if used) ---
    HELPER_PORT: z.coerce.number().int().min(1).max(65535).default(3000),

    // Optional flags (safe defaults)
    HELPER_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    // --- Optional feature flag ---
    HELPER_WATCHDOG: z
      .string()
      .optional()
      .transform((val) => val?.toLowerCase() === 'true') // convert to boolean
      .default(false),

    HELPER_UNDER_SYSTEMCTL: z
      .string()
      .optional()
      .transform((val) => val?.toLowerCase() === 'true') // convert to boolean
      .default(false),
  })
  .loose(); // allow extra vars without failing

export type Env = z.infer<typeof EnvSchema>;

/* ------------------------------ find-up utils ------------------------------ */
function findUp(startDir: string, fileNames: string[]): string | null {
  let dir = startDir;
  const root = path.parse(startDir).root;
  // Walk up until root looking for any of fileNames
  while (true) {
    for (const name of fileNames) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) return p;
    }
    if (dir === root) return null;
    dir = path.dirname(dir);
  }
}

/* ---------------------------- dotenv initialization ------------------------ */
/**
 * Load .env files using a deterministic base (this file's location),
 * not the shell's current working directory.
 *
 * Priority:
 *   1) explicitPath (argument) or process.env.HELPER_ENV_PATH
 *   2) nearest .env.local found by walking up from this file
 *   3) nearest .env found by walking up from this file
 */
function loadDotenv(explicitPath?: string) {
  // Idempotent guard: if we've already loaded, don't double-merge
  if (process.env.HELPER_ENV_LOADED === '1') return;

  const here = path.dirname(fileURLToPath(import.meta.url));
  const overridePath = explicitPath || process.env.HELPER_ENV_PATH;

  if (overridePath && fs.existsSync(overridePath)) {
    dotenv.config({ path: overridePath });
  } else {
    const envLocal = findUp(here, ['.env.local']);
    if (envLocal) dotenv.config({ path: envLocal });

    const env = findUp(here, ['.env']);
    if (env) dotenv.config({ path: env });
  }

  process.env.HELPER_ENV_LOADED = '1';
}

/* ---------------------------- cached env singleton ------------------------- */
let CACHED_ENV: Env | null = null;

/**
 * Prime the environment loader early in a process (e.g., at CLI entry).
 * Safe to call multiple times.
 */
export function primeEnv(explicitPath?: string) {
  if (!CACHED_ENV) {
    loadDotenv(explicitPath);
    CACHED_ENV = EnvSchema.parse(process.env);
  }
}

/**
 * Access the typed Env. If not yet primed, loads + parses now (lazy).
 * After the first call, returns the same object.
 */
export function env(): Env {
  if (!CACHED_ENV) {
    loadDotenv();
    CACHED_ENV = EnvSchema.parse(process.env);
  }
  return CACHED_ENV;
}

// Convenience default export if you prefer `import env from ...`
export default env;
