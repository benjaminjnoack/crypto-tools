import pkg, { type Pool as PgPool } from "pg";
import { getEnvConfig } from "../../../../shared/common/index.js";
import { logger } from "../../../../shared/log/index.js";

const { Pool } = pkg;
const E = getEnvConfig();

if (!E.HELPER_POSTGRES_DATABASE) {
  throw new Error("Environment is missing HELPER_POSTGRES_DATABASE");
}
if (!E.HELPER_POSTGRES_USERNAME) {
  throw new Error("Environment is missing HELPER_POSTGRES_USERNAME");
}
if (!E.HELPER_POSTGRES_PASSWORD) {
  throw new Error("Environment is missing HELPER_POSTGRES_PASSWORD");
}

let pool: PgPool | null = null;

function createPool(): PgPool {
  return new Pool({
    max: 1,
    user: E.HELPER_POSTGRES_USERNAME,
    host: "localhost",
    database: E.HELPER_POSTGRES_DATABASE,
    password: E.HELPER_POSTGRES_PASSWORD,
  });
}

export function getPool(): PgPool {
  if (!pool) {
    pool = createPool();
    logger.debug("Postgres pool created.");
  }
  return pool;
}

export async function endPool(): Promise<void> {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = null;
  logger.debug("Postgres pool closed.");
}
