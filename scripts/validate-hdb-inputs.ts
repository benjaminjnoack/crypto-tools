import fs from "node:fs/promises";
import path from "node:path";
import { parseCoinbaseTransactionsStatementCsv } from "../src/apps/hdb/db/coinbase/transactions/coinbase-transactions-mappers.js";
import { parseCointrackerCapitalGainsCsv } from "../src/apps/hdb/db/cointracker/capital-gains/cointracker-capital-gains-mappers.js";
import { parseCointrackerTransactionsCsv } from "../src/apps/hdb/db/cointracker/transactions/cointracker-transactions-mappers.js";

type ParserConfig = {
  key: "coinbase-transactions" | "cointracker-transactions" | "cointracker-capital-gains";
  relativeDir: string;
  parse: (csvText: string, filePath: string, fileName: string) => unknown[];
};

type ParseResult = {
  filePath: string;
  rowCount: number;
};

type ParseFailure = {
  filePath: string;
  message: string;
};

const parserConfigs: ParserConfig[] = [
  {
    key: "coinbase-transactions",
    relativeDir: "coinbase-transactions",
    parse: (csvText, filePath, fileName) => {
      const isManual = fileName.toLowerCase() === "manual.csv";
      return parseCoinbaseTransactionsStatementCsv(csvText, filePath, true, isManual);
    },
  },
  {
    key: "cointracker-transactions",
    relativeDir: "cointracker-transactions",
    parse: (csvText, filePath) => parseCointrackerTransactionsCsv(csvText, filePath),
  },
  {
    key: "cointracker-capital-gains",
    relativeDir: "cointracker-capital-gains",
    parse: (csvText, filePath) => parseCointrackerCapitalGainsCsv(csvText, filePath),
  },
];

function parseInputRootArg(argv: string[]): string {
  const index = argv.findIndex((arg) => arg === "--input-root");
  if (index === -1) {
    return path.resolve("data", "input");
  }

  const value = argv[index + 1];
  if (!value) {
    throw new Error("Missing value for --input-root");
  }

  return path.resolve(value);
}

async function listCsvFiles(directoryPath: string): Promise<string[]> {
  let files: string[];
  try {
    files = await fs.readdir(directoryPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  return files.filter((fileName) => fileName.toLowerCase().endsWith(".csv")).sort();
}

async function validateConfig(
  inputRoot: string,
  config: ParserConfig,
): Promise<{ successes: ParseResult[]; failures: ParseFailure[] }> {
  const dirPath = path.join(inputRoot, config.relativeDir);
  const csvFiles = await listCsvFiles(dirPath);

  if (csvFiles.length === 0) {
    console.warn(`[validate-hdb-inputs] skip ${config.key}: no CSV files found in ${dirPath}`);
    return { successes: [], failures: [] };
  }

  const successes: ParseResult[] = [];
  const failures: ParseFailure[] = [];
  for (const fileName of csvFiles) {
    const filePath = path.join(dirPath, fileName);
    try {
      const csvText = await fs.readFile(filePath, "utf8");
      const rows = config.parse(csvText, filePath, fileName);
      successes.push({ filePath, rowCount: rows.length });
    } catch (error) {
      failures.push({
        filePath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { successes, failures };
}

async function main(): Promise<void> {
  const inputRoot = parseInputRootArg(process.argv.slice(2));
  console.log(`[validate-hdb-inputs] input root: ${inputRoot}`);

  let totalRows = 0;
  let totalFiles = 0;
  const allFailures: ParseFailure[] = [];

  for (const config of parserConfigs) {
    try {
      const { successes, failures } = await validateConfig(inputRoot, config);
      for (const result of successes) {
        totalFiles += 1;
        totalRows += result.rowCount;
        console.log(`[validate-hdb-inputs] ok ${result.filePath} -> ${result.rowCount} rows`);
      }
      allFailures.push(...failures);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[validate-hdb-inputs] fail ${config.key}: ${message}`);
      process.exitCode = 1;
      return;
    }
  }

  if (allFailures.length > 0) {
    for (const failure of allFailures) {
      console.error(`[validate-hdb-inputs] fail ${failure.filePath}: ${failure.message}`);
    }
    console.error(`[validate-hdb-inputs] complete failures=${allFailures.length}`);
    process.exitCode = 1;
    return;
  }

  console.log(`[validate-hdb-inputs] complete files=${totalFiles} rows=${totalRows}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[validate-hdb-inputs] fatal: ${message}`);
  process.exitCode = 1;
});
