// src/lib/logger.ts
import pino from 'pino';
import { AsyncLocalStorage } from 'node:async_hooks';
import { env } from '@boot/env';
const E = env();

export type LogContext = {
  opId?: string;
  reqId?: string;
  [k: string]: unknown;
};
const als = new AsyncLocalStorage<LogContext>();

const isProd = process.env.NODE_ENV === 'production';

const base = pino({
  level: E.HELPER_LOG_LEVEL,
  ...(isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { singleLine: true },
        } as const,
      }),
});

// Accessor — always returns a logger bound to the current context (IDs, etc.)
export function logger() {
  const ctx = als.getStore() || {};
  return base.child(ctx);
}

// Run a function with an operation-scoped logger context
export function withOperation<T>(ctx: LogContext, fn: () => Promise<T> | T) {
  return als.run(ctx, fn);
}

// Convenience helpers
export const log = {
  debug: (obj: unknown, msg?: string) => logger().debug(obj, msg),
  info: (obj: unknown, msg?: string) => logger().info(obj, msg),
  warn: (obj: unknown, msg?: string) => logger().warn(obj, msg),
  error: (obj: unknown, msg?: string) => logger().error(obj, msg),
};
