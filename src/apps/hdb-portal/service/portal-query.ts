import { COINBASE_EPOCH, parseAsUtc } from "../../hdb/commands/shared/date-range-utils.js";

export type PortalDateRange = {
  from: Date;
  to: Date;
};

export function normalizeUppercaseList(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return [...new Set(
    value
      .split(":")
      .map((part) => part.trim().toUpperCase())
      .filter((part) => part.length > 0),
  )];
}

export function normalizeList(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return [...new Set(
    value
      .split(":")
      .map((part) => part.trim())
      .filter((part) => part.length > 0),
  )];
}

export function parseBooleanParam(value: string | null): boolean | undefined {
  if (value === null) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`Invalid boolean value: ${value}`);
}

export function parseDateParam(value: string | null, name: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = parseAsUtc(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${name} date: ${value}`);
  }

  return parsed;
}

export function parseDateRange(
  params: URLSearchParams,
  defaults?: {
    from?: Date;
    to?: Date;
  },
): PortalDateRange {
  const from = parseDateParam(params.get("from"), "from") ?? defaults?.from ?? new Date(COINBASE_EPOCH);
  const to = parseDateParam(params.get("to"), "to") ?? defaults?.to ?? new Date();

  if (from.getTime() >= to.getTime()) {
    throw new Error(`Invalid date range: from ${from.toISOString()} must be before to ${to.toISOString()}`);
  }

  return { from, to };
}

export function parseEnumParam<T extends string>(
  value: string | null,
  allowed: readonly T[],
  name: string,
): T | undefined {
  if (value === null) {
    return undefined;
  }

  if ((allowed as readonly string[]).includes(value)) {
    return value as T;
  }

  throw new Error(`Invalid ${name}: ${value}`);
}

export function parsePositiveIntParam(value: string | null, name: string, fallback: number): number {
  if (value === null) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`Invalid ${name}: ${value}`);
  }

  return parsed;
}

export function applyLimit<T>(rows: T[], limit: number): T[] {
  return rows.slice(0, limit);
}
