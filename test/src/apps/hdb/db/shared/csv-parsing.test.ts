import { describe, expect, it } from "vitest";
import { parseCsvMatrix, parseCsvRecords } from "../../../../../../src/apps/hdb/db/shared/csv-parsing.js";

describe("hdb csv parsing", () => {
  it("parses quoted fields, escaped quotes, and embedded newlines", () => {
    const csv = [
      "a,b,c",
      "\"x,y\",\"he said \"\"hi\"\"\",\"line1",
      "line2\"",
    ].join("\n");

    const matrix = parseCsvMatrix(csv);
    expect(matrix).toEqual([
      ["a", "b", "c"],
      ["x,y", "he said \"hi\"", "line1\nline2"],
    ]);
  });

  it("parses records with BOM-trimmed headers and skips blank rows", () => {
    const csv = ["\uFEFFcol_a,col_b", "1,2", "", "3,4"].join("\n");
    expect(parseCsvRecords(csv, "test.csv")).toEqual([
      { col_a: "1", col_b: "2" },
      { col_a: "3", col_b: "4" },
    ]);
  });

  it("returns empty records for empty input", () => {
    expect(parseCsvRecords("", "empty.csv")).toEqual([]);
  });
});
