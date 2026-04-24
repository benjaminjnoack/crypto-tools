import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { serializeJson, writeJsonFile } from "../../../../../../src/apps/hdb/commands/shared/json-output.js";

describe("hdb json output helpers", () => {
  it("serializes JSON with a trailing newline", () => {
    expect(serializeJson({ ok: true })).toBe('{\n  "ok": true\n}\n');
  });

  it("writes JSON files to resolved nested paths", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "hdb-json-output-"));
    const filePath = path.join(root, "nested", "payload.json");

    const resolved = await writeJsonFile(filePath, { ok: true });
    const content = await fs.readFile(filePath, "utf8");

    expect(resolved).toBe(filePath);
    expect(content).toBe('{\n  "ok": true\n}\n');
  });
});
