import { expect } from "vitest";
import type { ZodType } from "zod";

function formatValue(value: unknown): string {
  if (typeof value === "string") {return JSON.stringify(value);}
  if (typeof value === "symbol") {return value.toString();}
  if (typeof value === "function") {return "[Function]";}
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function expectSchemaAccepts<TOutput>(
  schema: ZodType<TOutput>,
  values: unknown[],
  extraAssertion?: (parsedValue: TOutput, input: unknown) => void,
): void {
  for (const value of values) {
    const parsed = schema.safeParse(value);
    expect(parsed.success).toBe(true);
    if (parsed.success && extraAssertion) {
      extraAssertion(parsed.data, value);
    }
  }
}

export function expectSchemaRejects(schema: ZodType, values: unknown[]): void {
  for (const value of values) {
    const parsed = schema.safeParse(value);
    if (parsed.success) {
      throw new Error(`Expected schema to reject value: ${formatValue(value)}`);
    }
    expect(parsed.success).toBe(false);
  }
}
