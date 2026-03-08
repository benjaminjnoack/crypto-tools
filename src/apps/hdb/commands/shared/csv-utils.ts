export function csvEscape(value: string): string {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

export function serializeCsvRow(values: Array<string | number | null | undefined>): string {
  return values.map((value) => csvEscape(String(value ?? ""))).join(",");
}
