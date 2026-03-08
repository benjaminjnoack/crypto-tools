import { describe, expect, it } from "vitest";
import { csvEscape, serializeCsvRow } from "../../../../../../src/apps/hdb/commands/shared/csv-utils.js";

describe("hdb command csv utils", () => {
  it("escapes commas, quotes, and newlines", () => {
    expect(csvEscape("plain")).toBe("plain");
    expect(csvEscape("a,b")).toBe("\"a,b\"");
    expect(csvEscape("a\"b")).toBe("\"a\"\"b\"");
    expect(csvEscape("a\nb")).toBe("\"a\nb\"");
  });

  it("serializes nullable mixed rows", () => {
    expect(serializeCsvRow(["abc", 1, null, undefined, "a,b"])).toBe("abc,1,,,\"a,b\"");
  });
});
