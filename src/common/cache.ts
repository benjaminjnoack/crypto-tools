import path from "node:path";
import envPaths from "env-paths";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { logger } from "../log/logger.js";

const paths = envPaths("helper");
export const cacheDir = paths.cache;
mkdirSync(cacheDir, { recursive: true });

export function loadJsonFromCache(cachePath: string): unknown {
  if (existsSync(cachePath)) {
    logger.debug(`Cache hit for ${cachePath}`);
    return JSON.parse(readFileSync(cachePath, "utf8"));
  }
  logger.debug(`Cache miss for ${cachePath}`);
  return null; // Cache miss
}

export function saveJsonToCache(cachePath: string, data: object): void {
  mkdirSync(path.dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(data, null, 2));
  logger.debug(`Cache saved for ${cachePath}`);
}


