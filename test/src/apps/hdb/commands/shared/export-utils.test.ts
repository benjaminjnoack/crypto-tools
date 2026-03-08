import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatDateIsoUtc, formatDateUsUtc, paginate, writeLines } from "../../../../../../src/apps/hdb/commands/shared/export-utils.js";

describe("hdb command export utils", () => {
  it("formats UTC dates consistently", () => {
    const date = new Date("2026-04-15T13:45:00.000Z");
    expect(formatDateIsoUtc(date)).toBe("2026-04-15");
    expect(formatDateUsUtc(date)).toBe("04/15/2026");
  });

  it("paginates items deterministically", () => {
    expect(paginate([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("writes newline-terminated files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "hdb-export-utils-"));
    const filePath = path.join(root, "nested", "file.csv");

    await writeLines(filePath, ["a,b", "1,2"]);
    const content = await fs.readFile(filePath, "utf8");

    expect(content).toBe("a,b\n1,2\n");
  });
});
