type JsonObject = Record<string, unknown>;

export function printJson(payload: JsonObject): void {
  console.log(JSON.stringify(payload, null, 2));
}

export function assertNoJsonWithFileExport(
  json: boolean | undefined,
  ...exports: Array<boolean | undefined>
): void {
  if (json && exports.some(Boolean)) {
    throw new Error("Invalid output mode: --json cannot be combined with file export flags.");
  }
}
