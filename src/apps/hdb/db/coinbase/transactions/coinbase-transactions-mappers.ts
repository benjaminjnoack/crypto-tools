import type { CoinbaseTransactionInsertRow } from "./coinbase-transactions-repository.js";

const STATEMENT_COLUMNS = {
  ID: "ID",
  TIMESTAMP: "Timestamp",
  TYPE: "Transaction Type",
  ASSET: "Asset",
  QUANTITY: "Quantity Transacted",
  PRICE_CURRENCY: "Price Currency",
  PRICE_AT_TX: "Price at Transaction",
  SUBTOTAL: "Subtotal",
  TOTAL: "Total (inclusive of fees and/or spread)",
  FEE: "Fees and/or Spread",
  NOTES: "Notes",
} as const;

type StatementCsvRow = Record<(typeof STATEMENT_COLUMNS)[keyof typeof STATEMENT_COLUMNS], string>;

type ParsedStatementRow = {
  id: string;
  timestamp: Date;
  type: string;
  asset: string;
  quantity: string;
  price_currency: string;
  price_at_tx: string;
  subtotal: string;
  total: string;
  fee: string;
  notes: string;
  synthetic: boolean;
  manual: boolean;
};

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

function assertHasColumns(row: Record<string, string>, source: string, rowNum: number): StatementCsvRow {
  const required = Object.values(STATEMENT_COLUMNS);
  for (const column of required) {
    if (!(column in row)) {
      throw new Error(`CSV validation failed in ${source} row ${rowNum}: missing ${column}`);
    }
  }
  return row as StatementCsvRow;
}

function parseMoneyLike(value: string, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is empty`);
  }

  return value.replace(/[$,-]/g, "");
}

function toNumberString(value: string, fieldName: string): string {
  const cleaned = parseMoneyLike(value, fieldName);
  const num = Number(cleaned);
  if (!Number.isFinite(num)) {
    throw new Error(`${fieldName} is not finite: ${value}`);
  }
  return cleaned;
}

function toScaledIntegerString(value: string): string {
  const cleaned = parseMoneyLike(value, "scaled");
  const [whole = "", frac = ""] = cleaned.split(".");
  const signlessWhole = whole.length === 0 ? "0" : whole;
  const digits = `${signlessWhole}${frac}`.replace(/^0+(?=\d)/, "");
  return digits.length === 0 ? "0" : digits;
}

function getMatchedGroup(match: RegExpMatchArray, index: number, label: string): string {
  const value = match[index];
  if (!value) {
    throw new Error(`Missing ${label} in normalized trade notes`);
  }
  return value;
}

function parseTimestamp(value: string, source: string, rowNum: number): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`CSV validation failed in ${source} row ${rowNum}: invalid timestamp ${value}`);
  }
  return date;
}

function mapStatementToInsertRow(row: ParsedStatementRow): CoinbaseTransactionInsertRow {
  return {
    id: row.id,
    timestamp: row.timestamp,
    type: row.type,
    asset: row.asset,
    price_currency: row.price_currency,
    notes: row.notes,
    synthetic: row.synthetic,
    manual: row.manual,
    quantity: row.quantity,
    price_at_tx: row.price_at_tx,
    subtotal: row.subtotal,
    total: row.total,
    fee: row.fee,
    num_quantity: toNumberString(row.quantity, "quantity"),
    num_price_at_tx: toNumberString(row.price_at_tx, "price_at_tx"),
    num_subtotal: toNumberString(row.subtotal, "subtotal"),
    num_total: toNumberString(row.total, "total"),
    num_fee: toNumberString(row.fee, "fee"),
    js_num_quantity: Number(toNumberString(row.quantity, "quantity")),
    js_num_price_at_tx: Number(toNumberString(row.price_at_tx, "price_at_tx")),
    js_num_subtotal: Number(toNumberString(row.subtotal, "subtotal")),
    js_num_total: Number(toNumberString(row.total, "total")),
    js_num_fee: Number(toNumberString(row.fee, "fee")),
    int_quantity: toScaledIntegerString(row.quantity),
    int_price_at_tx: toScaledIntegerString(row.price_at_tx),
    int_subtotal: toScaledIntegerString(row.subtotal),
    int_total: toScaledIntegerString(row.total),
    int_fee: toScaledIntegerString(row.fee),
  };
}

function normalizeTradeRow(row: ParsedStatementRow): ParsedStatementRow[] {
  const results = [row];

  const synthetic: Omit<ParsedStatementRow, "timestamp"> & { timestamp: Date } = {
    id: `synthetic-${row.id}`,
    timestamp: row.timestamp,
    type: row.type,
    asset: row.asset,
    quantity: row.quantity,
    price_currency: row.price_currency,
    price_at_tx: row.price_at_tx,
    subtotal: row.subtotal,
    total: row.total,
    fee: "$0.00",
    notes: row.notes,
    synthetic: true,
    manual: false,
  };

  let match: RegExpMatchArray | null;
  switch (row.type) {
    case "Advanced Trade Buy": {
      match = row.notes.match(/Bought (\d+(?:\.\d+)?) (\w+) for (\d+(?:\.\d+)?) (\w+) on (\w+-\w+) at (\d+(?:\.\d+)?) (\w+\/\w+)/);
      if (!match) {
        throw new Error(`Cannot normalize ${row.type}: ${row.notes}`);
      }
      const soldSize = getMatchedGroup(match, 3, "soldSize");
      const soldProduct = getMatchedGroup(match, 4, "soldProduct");
      const price = Number(getMatchedGroup(match, 6, "price"));
      synthetic.type = "Advanced Trade Sell";
      synthetic.asset = soldProduct;
      synthetic.quantity = soldSize;
      synthetic.price_currency = row.asset;
      synthetic.price_at_tx = `$${(Number(toNumberString(row.price_at_tx, "price_at_tx")) / price).toString(10)}`;
      synthetic.subtotal = `$${toNumberString(row.quantity, "quantity")}`;
      synthetic.total = `$${toNumberString(row.quantity, "quantity")}`;
      results.push(synthetic);
      break;
    }
    case "Buy": {
      match = row.notes.match(/Bought (\d+(?:\.\d+)?) (\w+) for (\d+(?:\.\d+)?) (\w+)/);
      if (!match) {
        throw new Error(`Cannot normalize ${row.type}: ${row.notes}`);
      }
      synthetic.type = "Sell";
      synthetic.asset = row.price_currency;
      synthetic.quantity = toNumberString(row.total, "total");
      synthetic.price_currency = row.asset;
      synthetic.price_at_tx = `$${(1 / Number(toNumberString(row.price_at_tx, "price_at_tx"))).toString(10)}`;
      synthetic.subtotal = `$${toNumberString(row.quantity, "quantity")}`;
      synthetic.total = `$${toNumberString(row.quantity, "quantity")}`;
      results.push(synthetic);
      break;
    }
    case "Advanced Trade Sell": {
      match = row.notes.match(/Sold (\d+(?:\.\d+)?) (\w+) for (\d+(?:\.\d+)?) (\w+) on (\w+-\w+) at (\d+(?:\.\d+)?) (\w+\/\w+)/);
      if (!match) {
        throw new Error(`Cannot normalize ${row.type}: ${row.notes}`);
      }
      const boughtSize = getMatchedGroup(match, 3, "boughtSize");
      const boughtProduct = getMatchedGroup(match, 4, "boughtProduct");
      const price = Number(getMatchedGroup(match, 6, "price"));
      synthetic.type = "Advanced Trade Buy";
      synthetic.asset = boughtProduct;
      synthetic.quantity = boughtSize;
      synthetic.price_currency = row.asset;
      synthetic.price_at_tx = `$${(Number(toNumberString(row.price_at_tx, "price_at_tx")) / price).toString(10)}`;
      synthetic.subtotal = `$${toNumberString(row.quantity, "quantity")}`;
      synthetic.total = `$${toNumberString(row.quantity, "quantity")}`;
      results.push(synthetic);
      break;
    }
    case "Sell": {
      match = row.notes.match(/Sold (\d+(?:\.\d+)?) (\w+) for (\d+(?:\.\d+)?) (\w+)/);
      if (!match) {
        throw new Error(`Cannot normalize ${row.type}: ${row.notes}`);
      }
      synthetic.type = "Buy";
      synthetic.asset = row.price_currency;
      synthetic.quantity = toNumberString(row.total, "total");
      synthetic.price_currency = row.asset;
      synthetic.price_at_tx = `$${(1 / Number(toNumberString(row.price_at_tx, "price_at_tx"))).toString(10)}`;
      synthetic.subtotal = `$${toNumberString(row.quantity, "quantity")}`;
      synthetic.total = `$${toNumberString(row.quantity, "quantity")}`;
      results.push(synthetic);
      break;
    }
    default:
      break;
  }

  return results;
}

function mapCsvRowToParsed(row: StatementCsvRow, source: string, rowNum: number, manual: boolean): ParsedStatementRow {
  return {
    id: row[STATEMENT_COLUMNS.ID],
    timestamp: parseTimestamp(row[STATEMENT_COLUMNS.TIMESTAMP], source, rowNum),
    type: row[STATEMENT_COLUMNS.TYPE],
    asset: row[STATEMENT_COLUMNS.ASSET],
    quantity: row[STATEMENT_COLUMNS.QUANTITY],
    price_currency: row[STATEMENT_COLUMNS.PRICE_CURRENCY],
    price_at_tx: row[STATEMENT_COLUMNS.PRICE_AT_TX],
    subtotal: row[STATEMENT_COLUMNS.SUBTOTAL],
    total: row[STATEMENT_COLUMNS.TOTAL],
    fee: row[STATEMENT_COLUMNS.FEE],
    notes: row[STATEMENT_COLUMNS.NOTES],
    synthetic: false,
    manual,
  };
}

export function parseCoinbaseTransactionsStatementCsv(
  csvText: string,
  source: string,
  normalize: boolean,
  manual: boolean,
): CoinbaseTransactionInsertRow[] {
  const records = parseCsvRecords(csvText, source);

  const parsedRows = records.map((record, index) => {
    const valid = assertHasColumns(record, source, index + 2);
    return mapCsvRowToParsed(valid, source, index + 2, manual);
  });

  const expanded = normalize ? parsedRows.flatMap((row) => normalizeTradeRow(row)) : parsedRows;
  return expanded.map((row) => mapStatementToInsertRow(row));
}
