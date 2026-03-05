import { describe, expect, it } from "vitest";
import { expectSchemaAccepts, expectSchemaRejects } from "../../../../helpers/schema.js";
import {
  CoinbaseUtcDateTimePattern,
  CoinbaseUtcDateTimeString,
} from "../../../../../src/shared/coinbase/schemas/coinbase-primitives-schemas.js";

const commonInvalidValues: unknown[] = [
  null,
  undefined,
  true,
  false,
  0,
  1.23,
  NaN,
  Infinity,
  -Infinity,
  {},
  { value: "2026-01-23T14:07:59Z" },
  [],
  ["2026-01-23T14:07:59Z"],
  () => "2026-01-23T14:07:59Z",
  Symbol("dt"),
  1n,
];

describe("CoinbaseUtcDateTimePattern", () => {
  it("matches valid UTC ISO timestamps with optional fractional seconds", () => {
    const valid = [
      "2026-01-23T14:07:59Z",
      "2026-01-23T14:07:59.1Z",
      "2026-01-23T14:07:59.12Z",
      "2026-01-23T14:07:59.123456Z",
      "2026-12-31T23:59:59.999999999Z",
      "2024-02-29T00:00:00Z",
      "2000-02-29T12:30:45.000001Z",
      "1900-02-29T08:15:30Z", // shape-valid, calendar-invalid (covered by schema test)
      "2026-04-31T10:15:30Z", // shape-valid, calendar-invalid (covered by schema test)
    ];

    for (const value of valid) {
      expect(CoinbaseUtcDateTimePattern.test(value)).toBe(true);
    }
  });

  it("does not match malformed timestamp shapes", () => {
    const invalid = [
      "",
      " ",
      "2026-01-23",
      "2026-01-23T14:07:59",
      "2026-01-23 14:07:59Z",
      "2026-1-23T14:07:59Z",
      "2026-01-3T14:07:59Z",
      "2026-01-23T4:07:59Z",
      "2026-01-23T14:7:59Z",
      "2026-01-23T14:07:9Z",
      "2026-01-23T14:07:59.Z",
      "2026-01-23T14:07:59.123",
      "2026-01-23T14:07:59+00:00",
      "2026-01-23T14:07:59-00:00",
      "2026-01-23T14:07:59z",
      "2026-01-23T14:07:59.123456z",
      "2026-01-23T14:07:59.1234567+00:00",
      "2026-00-23T14:07:59Z",
      "2026-13-23T14:07:59Z",
      "2026-01-00T14:07:59Z",
      "2026-01-32T14:07:59Z",
      "2026-01-23T24:00:00Z",
      "2026-01-23T14:60:00Z",
      "2026-01-23T14:07:60Z",
      "2026-01-23T14:07:78Z",
      "\t2026-01-23T14:07:59Z",
      "2026-01-23T14:07:59Z\n",
    ];

    for (const value of invalid) {
      expect(CoinbaseUtcDateTimePattern.test(value)).toBe(false);
    }
  });
});

describe("CoinbaseUtcDateTimeString", () => {
  it("accepts valid UTC ISO timestamps and preserves the original string", () => {
    const valid = [
      "2026-01-23T14:07:59Z",
      "2026-01-23T14:07:59.123456Z",
      "2024-02-29T00:00:00.000001Z", // leap year
      "2000-02-29T23:59:59.999999999Z", // leap year divisible by 400
      "2400-02-29T12:34:56Z", // leap year divisible by 400
      "1970-01-01T00:00:00Z",
      "9999-12-31T23:59:59.9Z",
    ];

    expectSchemaAccepts(CoinbaseUtcDateTimeString, valid, (parsedValue, input) => {
      expect(parsedValue).toBe(input);
    });
  });

  it("rejects non-string values", () => {
    expectSchemaRejects(CoinbaseUtcDateTimeString, commonInvalidValues);
  });

  it("rejects malformed shapes and non-UTC suffixes", () => {
    const invalid: unknown[] = [
      "",
      " ",
      "2026-01-23",
      "2026-01-23T14:07:59",
      "2026-01-23 14:07:59Z",
      "2026-01-23T14:07:59+00:00",
      "2026-01-23T14:07:59-07:00",
      "2026-01-23T14:07:59z",
      "2026-01-23T14:07:59.123456+00:00",
      "2026-01-23T14:07:59.123456",
      "2026-01-23T14:07:59.Z",
      "2026-01-23T14:07:59..123Z",
      "2026-01-23T14:07:59.123_456Z",
      "2026-1-23T14:07:59Z",
      "2026-01-3T14:07:59Z",
      "2026-01-23T4:07:59Z",
      "2026-01-23T14:7:59Z",
      "2026-01-23T14:07:9Z",
      "\n2026-01-23T14:07:59Z",
      "2026-01-23T14:07:59Z ",
    ];

    expectSchemaRejects(CoinbaseUtcDateTimeString, invalid);
  });

  it("rejects out-of-range month/day/time values", () => {
    const invalid: unknown[] = [
      "2026-00-23T14:07:59Z",
      "2026-13-23T14:07:59Z",
      "2026-01-00T14:07:59Z",
      "2026-01-32T14:07:59Z",
      "2026-01-23T24:00:00Z",
      "2026-01-23T14:60:00Z",
      "2026-01-23T14:07:60Z",
      "2026-01-23T14:07:78Z",
    ];

    expectSchemaRejects(CoinbaseUtcDateTimeString, invalid);
  });

  it("rejects calendar-invalid dates, including leap-year edge cases", () => {
    const invalid: unknown[] = [
      "2026-02-29T00:00:00Z", // not a leap year
      "1900-02-29T00:00:00Z", // divisible by 100 but not 400
      "2026-02-30T00:00:00Z",
      "2026-04-31T12:00:00Z",
      "2026-06-31T12:00:00Z",
      "2026-09-31T12:00:00Z",
      "2026-11-31T12:00:00Z",
    ];

    expectSchemaRejects(CoinbaseUtcDateTimeString, invalid);
  });

  it("supports nullable usage for order fields", () => {
    const schema = CoinbaseUtcDateTimeString.nullable();
    expect(schema.parse(null)).toBeNull();
    expect(schema.parse("2026-01-23T14:07:59.123456Z")).toBe("2026-01-23T14:07:59.123456Z");
  });
});
