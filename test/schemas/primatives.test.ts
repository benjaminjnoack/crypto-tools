import { describe, expect, it } from "vitest";
import { expectSchemaAccepts, expectSchemaRejects } from "../helpers/schema.js";
import { NumericString, OrderIdSchema, Percent, PositiveNumericString, ProductIdSchema } from "../../src/index.js";

function toFiniteNumber(value: string): number {
  const num = Number(value);
  expect(Number.isFinite(num)).toBe(true);
  return num;
}

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
  { value: "1" },
  [],
  ["1"],
  ["1", "2"],
  () => "1",
  Symbol("num"),
  1n,
];

describe("NumericString", () => {
  it("accepts only plain numeric strings", () => {
    const valid = ["0", "-0", "1", "-1", "123", "-123", "0.0", "10.25", "-0.5", "0001"];
    expectSchemaAccepts(NumericString, valid, (parsedValue) => {
      expect(typeof parsedValue).toBe("string");
      toFiniteNumber(parsedValue);
    });
  });

  it("rejects non-string and malformed numeric values", () => {
    const invalid: unknown[] = [
      ...commonInvalidValues,
      "",
      " ",
      " 1",
      "1 ",
      "\t1",
      "\n1",
      "1\n",
      "1_000",
      "1,000",
      "1e3",
      "+1",
      ".123",
      "-.123",
      "1.",
      "1.2.3",
      "--1",
      "1-2",
      "abc",
      "123abc",
      "abc123",
      "💯",
      "1💯",
      "１２３",
    ];

    expectSchemaRejects(NumericString, invalid);
  });
});

describe("PositiveNumericString", () => {
  it("accepts positive numeric strings only", () => {
    const valid = ["1", "10", "999999", "0.1", "0.01", "1.0", "100.25"];
    expectSchemaAccepts(PositiveNumericString, valid, (parsedValue) => {
      expect(typeof parsedValue).toBe("string");
      const num = toFiniteNumber(parsedValue);
      expect(num).toBeGreaterThan(0);
    });
  });

  it("rejects zero, negative values, and malformed strings", () => {
    const invalid: unknown[] = [
      ...commonInvalidValues,
      "0",
      "-0",
      "0.0",
      "-1",
      "-0.1",
      ".123",
      "-.123",
      "01",
      "00",
      " 1",
      "1 ",
      "1e2",
      "+1",
      "abc",
      "1abc",
      "💯",
    ];

    expectSchemaRejects(PositiveNumericString, invalid);
  });
});

describe("Percent", () => {
  it("accepts numeric strings from 0 through 100 (inclusive)", () => {
    const valid = ["0", "0.0", "0.01", "1", "50", "99.99", "100", "100.0"];
    expectSchemaAccepts(Percent, valid, (parsedValue) => {
      expect(typeof parsedValue).toBe("string");
      const num = toFiniteNumber(parsedValue);
      expect(num).toBeGreaterThanOrEqual(0);
      expect(num).toBeLessThanOrEqual(100);
    });
  });

  it("rejects out-of-range, malformed, and non-string values", () => {
    const invalid: unknown[] = [
      ...commonInvalidValues,
      "-0.01",
      "-1",
      "100.0001",
      "101",
      ".5",
      " 50",
      "50 ",
      "50%",
      "abc",
      "1e2",
      "💯",
    ];

    expectSchemaRejects(Percent, invalid);
  });
});

describe("ProductIdSchema", () => {
  it("accepts only preformatted uppercase product ids ending in -USD", () => {
    const valid = ["BTC-USD", "ETH-USD", "SOL-USD", "AAVE-USD"];
    expectSchemaAccepts(ProductIdSchema, valid, (parsedValue, input) => {
      expect(parsedValue).toBe(input);
    });
  });

  it("rejects malformed product values and non-strings", () => {
    const invalid: unknown[] = [
      ...commonInvalidValues,
      "",
      " ",
      "\t",
      "\n",
      "btc-usd",
      "Btc-USD",
      "-USD",
      "BTC",
      "BTC-",
      "BTC- EUR",
      "BTC-USDT",
      "BTC-EUR",
      "BTC/USD",
      "BTC_USD",
      "BTC USD",
      "BTC--USD",
      "B.T.C",
      "1INCH-USD",
      "💰",
      "BTC💰",
      "ＢＴＣ",
      "BTC-ＵＳＤ",
      "BTC-USD!",
      "BTC-USD-EXTRA",
      "BTC\nUSD",
      "BTC\tUSD",
      "BTC\u0000USD",
    ];

    expectSchemaRejects(ProductIdSchema, invalid);
  });
});

describe("OrderIdSchema", () => {
  it("accepts valid UUID strings", () => {
    const valid = [
      "00000000-0000-0000-0000-000000000000",
      "123e4567-e89b-12d3-a456-426614174000",
      "123E4567-E89B-12D3-A456-426614174000",
    ];
    expectSchemaAccepts(OrderIdSchema, valid);
  });

  it("rejects malformed UUIDs and non-strings", () => {
    const invalid: unknown[] = [
      ...commonInvalidValues,
      "",
      " ",
      "123e4567-e89b-12d3-a456-42661417400", // short
      "123e4567-e89b-12d3-a456-4266141740000", // long
      "123e4567e89b12d3a456426614174000", // missing hyphens
      "{123e4567-e89b-12d3-a456-426614174000}",
      " 123e4567-e89b-12d3-a456-426614174000",
      "123e4567-e89b-12d3-a456-426614174000 ",
      "123e4567-e89b-12d3-a456-42661417400z",
      "gggggggg-gggg-gggg-gggg-gggggggggggg",
      "💯",
      "uuid",
    ];

    expectSchemaRejects(OrderIdSchema, invalid);
  });
});
