import { z } from "zod";
import type { CointrackerCapitalGainInsertRow } from "./cointracker-capital-gains-repository.js";
import { parseCsvRecords } from "../../shared/csv-parsing.js";

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

function parseUtcDate(raw: string): Date {
  const slashDateMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDateMatch) {
    const month = Number.parseInt(slashDateMatch[1] ?? "", 10);
    const day = Number.parseInt(slashDateMatch[2] ?? "", 10);
    const year = Number.parseInt(slashDateMatch[3] ?? "", 10);

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error(`Invalid capital gains date: ${raw}`);
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new Error(`Invalid capital gains date: ${raw}`);
    }

    return date;
  }

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
