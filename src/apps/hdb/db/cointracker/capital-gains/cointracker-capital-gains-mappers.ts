import { z } from "zod";
import type { CointrackerCapitalGainInsertRow } from "./cointracker-capital-gains-repository.js";

const CointrackerCapitalGainsCsvRowSchema = z.object({
  "Asset Amount": z.string().trim().min(1),
  "Asset Name": z.string().trim().min(1),
  "Received Date": z.string().trim().min(1),
  "Date Sold": z.string().trim().min(1),
  "Proceeds (USD)": z.string().trim().min(1),
  "Cost Basis (USD)": z.string().trim().min(1),
  "Gain (USD)": z.string().trim().min(1),
  Type: z.string().trim().min(1),
});

type CointrackerCapitalGainsCsvRow = z.infer<typeof CointrackerCapitalGainsCsvRowSchema>;

function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === undefined) {
      continue;
    }

    if (inQuotes) {
      if (char === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function parseCsvRecords(csvText: string, source: string): Array<Record<string, string>> {
  const matrix = parseCsvMatrix(csvText);
  if (matrix.length === 0) {
    return [];
  }

  const [headerRow, ...dataRows] = matrix;
  if (!headerRow || headerRow.length === 0) {
    throw new Error(`CSV missing header row: ${source}`);
  }

  const headers = headerRow.map((header, index) => {
    if (index === 0) {
      return header.replace(/^\uFEFF/, "").trim();
    }
    return header.trim();
  });

  return dataRows
    .filter((cells) => cells.some((cell) => cell.trim().length > 0))
    .map((cells) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = cells[index] ?? "";
      });
      return record;
    });
}

function parseUtcDate(raw: string): Date {
  const hasTimezone = /[Z+-]\d{0,2}:?\d{0,2}$/.test(raw);
  const hasTime = /T/.test(raw);

  let normalized = raw;
  if (!hasTime) {
    normalized = `${normalized}T00:00:00Z`;
  } else if (!hasTimezone) {
    normalized = `${normalized}Z`;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid capital gains date: ${raw}`);
  }
  return date;
}

function mapCsvRowToInsert(row: CointrackerCapitalGainsCsvRow): CointrackerCapitalGainInsertRow {
  return {
    asset_amount: row["Asset Amount"],
    asset_name: row["Asset Name"],
    received_date: parseUtcDate(row["Received Date"]),
    date_sold: parseUtcDate(row["Date Sold"]),
    proceeds_usd: row["Proceeds (USD)"],
    cost_basis_usd: row["Cost Basis (USD)"],
    gain_usd: row["Gain (USD)"],
    type: row.Type,
  };
}

export function parseCointrackerCapitalGainsCsv(
  csvText: string,
  source: string,
): CointrackerCapitalGainInsertRow[] {
  const records = parseCsvRecords(csvText, source);

  return records.map((record, index) => {
    const parsed = CointrackerCapitalGainsCsvRowSchema.safeParse(record);
    if (!parsed.success) {
      throw new Error(
        `CSV validation failed in ${source} row ${index + 2}: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`,
      );
    }

    return mapCsvRowToInsert(parsed.data);
  });
}
