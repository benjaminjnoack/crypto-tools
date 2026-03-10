import { LOG_LEVELS, type LogLevel } from "./schemas/logger.js";
import { getEnvConfig } from "../common/env.js";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function getConfiguredLevel(): LogLevel {
  const configured = getEnvConfig().HELPER_LOG_LEVEL;
  if (configured === LOG_LEVELS.debug || configured === LOG_LEVELS.info || configured === LOG_LEVELS.warn || configured === LOG_LEVELS.error) {
    return configured;
  }
  return LOG_LEVELS.info;
}

function isEnabled(level: LogLevel): boolean {
  const configuredLevel = getConfiguredLevel();
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[configuredLevel];
}

export const logger = {
  debug: (...args: unknown[]): void => {
    if (isEnabled(LOG_LEVELS.debug)) {
      console.debug(...args);
    }
  },
  info: (...args: unknown[]): void => {
    if (isEnabled(LOG_LEVELS.info)) {
      console.info(...args);
    }
  },
  log: (...args: unknown[]): void => {
    if (isEnabled(LOG_LEVELS.info)) {
      console.info(...args);
    }
  },
  warn: (...args: unknown[]): void => {
    if (isEnabled(LOG_LEVELS.warn)) {
      console.warn(...args);
    }
  },
  error: (...args: unknown[]): void => {
    if (isEnabled(LOG_LEVELS.error)) {
      console.error(...args);
    }
  },
};
