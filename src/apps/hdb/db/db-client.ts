import { endPool, getPool } from "./core/postgres-pool.js";

export function getClient() {
  return Promise.resolve(getPool());
}

export async function endClient() {
  await endPool();
}
