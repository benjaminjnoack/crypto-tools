import fs from "node:fs/promises";
import path from "node:path";

export type JsonObject = Record<string, unknown>;

export function serializeJson(payload: JsonObject): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function printJson(payload: JsonObject): void {
  console.log(serializeJson(payload).trimEnd());
}

export async function writeJsonFile(filePath: string, payload: JsonObject): Promise<string> {
  const resolvedPath = path.resolve(filePath);
  await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.writeFile(resolvedPath, serializeJson(payload), "utf8");
  return resolvedPath;
}

export function assertNoJsonWithFileExport(
  json: boolean | undefined,
  ...exports: Array<boolean | undefined>
): void {
  if (json && exports.some(Boolean)) {
    throw new Error("Invalid output mode: --json cannot be combined with file export flags.");
  }
}
