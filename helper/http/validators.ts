// validators.ts (or http/util.ts)
import { safeNumber } from '@core/validation';
import { IncomingMessage } from 'node:http';

export function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Throws is req['method'] does not equal method
 */
export function isCorrectMethod(req: IncomingMessage, method: string, resource: string): void {
  if (req.method !== method) {
    throw new Error(`cannot handle ${req.method ?? 'UNKNOWN'} ${resource} request`);
  }
}

/**
 * Get a required string property from an unknown object.
 * Throws a descriptive Error if the object/prop is missing or not a string.
 */
export function getRequiredString(obj: unknown, key: string, ctx = 'request'): string {
  if (!isRecord(obj)) {
    throw new Error(`${ctx}: body must be an object`);
  }
  if (!Object.hasOwn(obj, key)) {
    throw new Error(`${ctx}: missing "${key}"`);
  }
  const v = obj[key];
  if (typeof v !== 'string') {
    throw new Error(`${ctx}: "${key}" must be a string`);
  }
  return v;
}
/**
 * Type guard: if it returns, `obj` is refined to have a string at `K`
 */
export function assertHasStringProp<T extends Record<string, unknown>, K extends string>(
  obj: T,
  key: K,
): asserts obj is T & Record<K, string> {
  if (!Object.hasOwn(obj, key)) throw new Error(`request body missing ${key}`);
  if (typeof obj[key] !== 'string') throw new Error(`${key} must be a string`);
}

export function checkNumericalProperty(body: unknown, key: string): string {
  if (!isRecord(body)) {
    throw new Error('request body must be an object');
  }
  if (!Object.hasOwn(body, key)) {
    throw new Error(`request body missing ${key}`);
  }

  const value = body[key];
  if (typeof value !== 'string') {
    throw new Error(`${key} must be a string`);
  }

  safeNumber(value, 'checkNumericalProperty => body[key]');
  return value;
}
