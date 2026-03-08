import { z } from "zod";
import type { CointrackerTransactionInsertRow } from "./cointracker-transactions-repository.js";
import { parseCsvRecords } from "../../shared/csv-parsing.js";

const CointrackerTransactionCsvRowSchema = z.object({
  Date: z.string().trim().min(1),
  Type: z.string().trim().min(1),
  "Transaction ID": z.string().trim().min(1),
  "Received Quantity": z.string(),
  "Received Currency": z.string(),
  "Received Cost Basis (USD)": z.string(),
  "Received Wallet": z.string(),
  "Received Address": z.string(),
  "Received Comment": z.string(),
  "Sent Quantity": z.string(),
  "Sent Currency": z.string(),
  "Sent Cost Basis (USD)": z.string(),
  "Sent Wallet": z.string(),
  "Sent Address": z.string(),
  "Sent Comment": z.string(),
  "Fee Amount": z.string(),
  "Fee Currency": z.string(),
  "Fee Cost Basis (USD)": z.string(),
  "Realized Return (USD)": z.string(),
  "Fee Realized Return (USD)": z.string(),
  "Transaction Hash": z.string(),
});

type CointrackerTransactionCsvRow = z.infer<typeof CointrackerTransactionCsvRowSchema>;

function cleanNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function parseDateAsUtc(dateValue: string): Date {
  const parsed = new Date(`${dateValue}Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid transaction date: ${dateValue}`);
  }
  return parsed;
}

function mapCsvRowToInsertRow(row: CointrackerTransactionCsvRow): CointrackerTransactionInsertRow {
  return {
    transaction_id: row["Transaction ID"],
    date: parseDateAsUtc(row.Date),
    type: row.Type,
    received_quantity: cleanNullable(row["Received Quantity"]),
    received_currency: cleanNullable(row["Received Currency"]),
    received_cost_basis: cleanNullable(row["Received Cost Basis (USD)"]),
    received_wallet: cleanNullable(row["Received Wallet"]),
    received_address: cleanNullable(row["Received Address"]),
    received_comment: cleanNullable(row["Received Comment"]),
    sent_quantity: cleanNullable(row["Sent Quantity"]),
    sent_currency: cleanNullable(row["Sent Currency"]),
    sent_cost_basis: cleanNullable(row["Sent Cost Basis (USD)"]),
    sent_wallet: cleanNullable(row["Sent Wallet"]),
    sent_address: cleanNullable(row["Sent Address"]),
    sent_comment: cleanNullable(row["Sent Comment"]),
    fee_amount: cleanNullable(row["Fee Amount"]),
    fee_currency: cleanNullable(row["Fee Currency"]),
    fee_cost_basis: cleanNullable(row["Fee Cost Basis (USD)"]),
    realized_return: cleanNullable(row["Realized Return (USD)"]),
    fee_realized_return: cleanNullable(row["Fee Realized Return (USD)"]),
    transaction_hash: cleanNullable(row["Transaction Hash"]),
  };
}

export function parseCointrackerTransactionsCsv(
  csvText: string,
  source: string,
): CointrackerTransactionInsertRow[] {
  const records = parseCsvRecords(csvText, source);
  return records.map((record, index) => {
    const parsed = CointrackerTransactionCsvRowSchema.safeParse(record);
    if (!parsed.success) {
      throw new Error(
        `CSV validation failed in ${source} row ${index + 2}: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`,
      );
    }
    return mapCsvRowToInsertRow(parsed.data);
  });
}
