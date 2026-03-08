import fs from "node:fs/promises";
import path from "node:path";

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDateIsoUtc(value: Date | string): string {
  return toDate(value).toISOString().slice(0, 10);
}

export function formatDateUsUtc(value: Date | string): string {
  const date = toDate(value);
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const year = `${date.getUTCFullYear()}`;
  return `${month}/${day}/${year}`;
}

export function paginate<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

export async function writeLines(filePath: string, lines: string[]): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}
