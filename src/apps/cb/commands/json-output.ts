import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

export type JsonObject = Record<string, unknown>;

export function serializeJson(payload: JsonObject): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function printJson(payload: JsonObject): void {
  console.log(serializeJson(payload).trimEnd());
}

export function writeJsonFile(filePath: string, payload: JsonObject): string {
  const outputPath = path.resolve(process.cwd(), filePath);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serializeJson(payload));
  return outputPath;
}

export function emitJsonOutput(
  payload: JsonObject,
  options: {
    json?: boolean | undefined;
    jsonFile?: string | undefined;
  },
): void {
  if (options.jsonFile) {
    writeJsonFile(options.jsonFile, payload);
  }

  if (options.json || options.jsonFile) {
    printJson(payload);
  }
}
