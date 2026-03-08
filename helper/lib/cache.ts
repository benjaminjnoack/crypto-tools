import path from 'node:path';
import envPaths from 'env-paths';
import process from 'node:process';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { log } from '@core/logger.js';
import fs from 'fs/promises';
import {
  type CoinbaseOrder,
  CoinbaseOrderSchema,
  type CoinbaseProduct,
  CoinbaseProductSchema,
} from '@cb/http/contracts';

const paths = envPaths('helper');
export const cacheDir = paths.cache;

// Ensure cache directory exists
mkdirSync(cacheDir, { recursive: true });

export const ORDERS = 'orders';
const CLOSED = 'closed';
const CANCELLED = 'cancelled';
const PRODUCTS = 'products';
const POSITIONS = 'positions';
const COINBASE = 'coinbase';
const LOTS = 'lots';

export const LOTS_DIR = path.join(cacheDir, LOTS);
const POSITIONS_DIR = path.join(cacheDir, POSITIONS);

export function checkEnvironment() {
  let stats = statSync(cacheDir);
  if (!stats.isDirectory()) {
    log.error(`Error: '${cacheDir}' is not a directory.`);
    process.exit(1);
  }

  const subDirs = [ORDERS, CLOSED, CANCELLED, PRODUCTS, POSITIONS, COINBASE, LOTS];

  subDirs.forEach((subDir) => {
    const dir = path.join(cacheDir, subDir);
    try {
      stats = statSync(dir);
      if (!stats.isDirectory()) {
        log.warn(`Error: '${dir}' is not a directory.`);
        process.exit(1);
      }
    } catch (error) {
      if (error instanceof Error) {
        log.warn(error.message);
      } else {
        log.warn(error);
      }
      mkdirSync(dir);
    }
  });
}

export function loadJsonFromCache(cachePath: string): object | null {
  if (existsSync(cachePath)) {
    log.debug(`Cache hit for ${cachePath}`);
    return JSON.parse(readFileSync(cachePath, 'utf8'));
  }
  log.debug(`Cache miss for ${cachePath}`);
  return null; // Cache miss
}

function saveJsonToCache(cachePath: string, data: object) {
  writeFileSync(cachePath, JSON.stringify(data, null, 2));
  log.debug(`Cache saved for ${cachePath}`);
}

export function loadCoinbase(name: string) {
  const cachePath = path.join(cacheDir, COINBASE, `${name}.json`);
  return loadJsonFromCache(cachePath);
}

/**
 * @throws {Error} if productId is not found
 */
export function loadProduct(productId: string): CoinbaseProduct {
  const cachePath = path.join(cacheDir, PRODUCTS, `${productId}.json`);
  const cache = loadJsonFromCache(cachePath);
  if (!cache) {
    throw new Error(`Cannot find product ${productId}`);
  }
  return CoinbaseProductSchema.parse(cache);
}

/**
 * @throws {Error} if orderId is not found
 */
export function loadOrderFromCache(orderId: string): CoinbaseOrder {
  const cachePath = path.join(cacheDir, ORDERS, `${orderId}.json`);
  const cache = loadJsonFromCache(cachePath);
  if (!cache) {
    throw new Error(`Cannot find order ${orderId}`);
  }
  return CoinbaseOrderSchema.parse(cache);
}

export function loadPosition(positionName: string): object | null {
  const cachePath = path.join(cacheDir, POSITIONS, `${positionName}.json`);
  return loadJsonFromCache(cachePath);
}

export async function deletePosition(positionName: string): Promise<void> {
  const cachePath = path.join(cacheDir, POSITIONS, `${positionName}.json`);
  await fs.rm(cachePath, { force: true });
  log.debug(`Deleted ${cachePath}`);
}

/**
 * the special e is NodeJS.ErrnoException return type tells the compiler:
 * “If this function returns true, then you can treat e as a NodeJS.ErrnoException from here on.”
 */
function isNodeErrno(e: unknown): e is NodeJS.ErrnoException {
  return e instanceof Error && 'code' in e;
}

export async function saveCoinbase(
  name: string,
  data: object,
  checkExpiration: boolean = true,
): Promise<void | null> {
  const cachePath = path.join(cacheDir, COINBASE, `${name}.json`);

  if (checkExpiration) {
    try {
      const stats = await fs.stat(cachePath);
      const now = Date.now();
      const mtime = stats.mtimeMs;
      const twentyFourHours = 24 * 60 * 60 * 1000;

      if (now - mtime > twentyFourHours) {
        log.warn(`saveCoinbase => ${name} is more than 24 hours old`);
        return null;
      }
    } catch (err) {
      if (err instanceof Error) {
        if (isNodeErrno(err) && err.code !== 'ENOENT') {
          throw err; // rethrow unexpected errors
        }
      }
      // If the file doesn't exist, we treat it as not expired
    }
  }

  return saveJsonToCache(cachePath, data);
}

export async function saveProduct(productId: string, data: object): Promise<void> {
  const cachePath = path.join(cacheDir, PRODUCTS, `${productId}.json`);
  return saveJsonToCache(cachePath, data);
}

export async function saveOrder(orderId: string, data: object): Promise<void> {
  const cachePath = path.join(cacheDir, ORDERS, `${orderId}.json`);
  return saveJsonToCache(cachePath, data);
}

/**
 * Retrieves the list of position file names
 */
export function getPositionFileNames(): string[] {
  const files = readdirSync(POSITIONS_DIR);
  return files
    .filter((file) => path.extname(file).toLowerCase() === '.json')
    .map((file) => path.join(POSITIONS_DIR, file));
}

export function savePosition(
  positionName: string,
  data: object,
  closed: boolean = false,
  cancelled: boolean = false,
): void {
  let cachePath;
  if (closed) {
    cachePath = path.join(cacheDir, CLOSED, `${positionName}.json`);
  } else if (cancelled) {
    cachePath = path.join(cacheDir, CANCELLED, `${positionName}.json`);
  } else {
    cachePath = path.join(cacheDir, POSITIONS, `${positionName}.json`);
  }
  return saveJsonToCache(cachePath, data);
}
