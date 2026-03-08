export function parseCsvMatrix(text: string): string[][] {
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
      if (char === "\"") {
        const next = text[i + 1];
        if (next === "\"") {
          field += "\"";
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
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

export function parseCsvRecords(csvText: string, source: string): Array<Record<string, string>> {
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
