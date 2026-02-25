import { describe, expect, it } from "vitest";
import { toIncrement } from "../../src/index.js";

describe("toIncrement", () => {
  it("matches documented examples", () => {
    expect(toIncrement("0.01", 123.47)).toBe("123.47");
    expect(toIncrement("0.01", 123.47999)).toBe("123.47");
    expect(toIncrement("1", 3.7)).toBe("3");
    expect(toIncrement("0.00000001", 0.1234)).toBe("0.12340000");
  });

  it('floors for supported integer increment ("1")', () => {
    expect(toIncrement("1", 34)).toBe("34");
    expect(toIncrement("1", 39.999)).toBe("39");
    expect(toIncrement("1", 10)).toBe("10");
  });

  it("formats decimal increments with fixed precision", () => {
    expect(toIncrement("0.1", 1.29)).toBe("1.2");
    expect(toIncrement("0.01", 1)).toBe("1.00");
    expect(toIncrement("0.0100", 1.237)).toBe("1.23"); // trailing zeros in increment normalize dp
  });

  it("handles floating-point representation noise near boundaries", () => {
    expect(toIncrement("0.01", 1.23)).toBe("1.23");
    expect(toIncrement("0.01", 0.3)).toBe("0.30");
    expect(toIncrement("0.01", 1.229999999999)).toBe("1.22");
  });

  it("rejects negative values for order-domain usage", () => {
    expect(() => toIncrement("1", -1.0001)).toThrow();
    expect(() => toIncrement("0.1", -0.11)).toThrow();
  });

  it("rejects invalid increment formats", () => {
    const invalidIncrements = [
      "",
      " ",
      "0",
      "-1",
      "+1",
      "2",
      "3",
      "10",
      "01",
      "00.010",
      "2.5",
      "0.05",
      "0.00120",
      "0.",
      ".1",
      "abc",
      " 0.01",
      "0.01 ",
    ];

    for (const increment of invalidIncrements) {
      expect(() => toIncrement(increment, 1)).toThrow();
    }
  });

  it("throws on non-finite values", () => {
    expect(() => toIncrement("0.01", Number.NaN)).toThrow();
    expect(() => toIncrement("0.01", Number.POSITIVE_INFINITY)).toThrow();
    expect(() => toIncrement("0.01", Number.NEGATIVE_INFINITY)).toThrow();
  });
});
