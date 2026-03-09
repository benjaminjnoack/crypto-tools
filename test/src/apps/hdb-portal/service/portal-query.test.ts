import { describe, expect, it } from "vitest";
import {
  normalizeList,
  normalizeUppercaseList,
  parseBooleanParam,
  parseDateRange,
  parseEnumParam,
} from "../../../../../src/apps/hdb-portal/service/portal-query.js";

describe("portal query helpers", () => {
  it("normalizes uppercase colon-separated values", () => {
    expect(normalizeUppercaseList(" btc : eth :BTC ")).toEqual(["BTC", "ETH"]);
  });

  it("normalizes mixed-case freeform lists", () => {
    expect(normalizeList(" buy : sell : buy ")).toEqual(["buy", "sell"]);
  });

  it("parses boolean params", () => {
    expect(parseBooleanParam("true")).toBe(true);
    expect(parseBooleanParam("false")).toBe(false);
    expect(parseBooleanParam(null)).toBeUndefined();
  });

  it("rejects invalid boolean params", () => {
    expect(() => parseBooleanParam("yes")).toThrow("Invalid boolean value");
  });

  it("parses date ranges and validates ordering", () => {
    const params = new URLSearchParams({ from: "2026-01-01", to: "2026-02-01" });
    const range = parseDateRange(params);

    expect(range.from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  it("rejects reversed date ranges", () => {
    const params = new URLSearchParams({ from: "2026-02-01", to: "2026-01-01" });
    expect(() => parseDateRange(params)).toThrow("must be before");
  });

  it("parses enum params", () => {
    expect(parseEnumParam("FIFO", ["FIFO", "LIFO"] as const, "accounting")).toBe("FIFO");
  });
});
