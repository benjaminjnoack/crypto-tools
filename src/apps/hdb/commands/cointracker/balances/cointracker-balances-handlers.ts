import {
  createCointrackerBalancesTable,
  dropCointrackerBalancesTable,
  rebuildCointrackerBalancesLedger,
  selectCointrackerBalances,
  selectCointrackerLastBalance,
  truncateCointrackerBalancesTable,
} from "../../../db/cointracker/balances/cointracker-balances-repository.js";
import { getToAndFromDates } from "../../shared/date-range-utils.js";
import { type JsonObject, printJson, writeJsonFile } from "../../shared/json-output.js";
import type {
  CointrackerBalancesQueryOptions,
  CointrackerBalancesRegenerateOptions,
} from "./schemas/cointracker-balances-options.js";

function normalizeColonSeparatedUppercase(input?: string): string[] {
  if (!input) {
    return [];
  }

  return input
    .split(":")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0);
}

export async function cointrackerBalances(
  currency: string | undefined,
  options: CointrackerBalancesQueryOptions,
): Promise<Array<Record<string, unknown>>> {
  const { includeType, json, jsonFile, quiet } = options;
  const { from, to } = await getToAndFromDates(options);
  const currencies = normalizeColonSeparatedUppercase(currency);

  const rows = await selectCointrackerBalances(
    {
      currencies,
      from,
      to,
    },
    Boolean(includeType),
  );

  const payload: JsonObject = {
    rows,
    filters: {
      currencies,
      from: from.toISOString(),
      to: to.toISOString(),
    },
    meta: {
      rowCount: rows.length,
      includeType: Boolean(includeType),
    },
  };

  if (jsonFile) {
    await writeJsonFile(jsonFile, payload);
  }

  if (json || jsonFile) {
    if (!quiet) {
      printJson(payload);
    }
    return rows as Array<Record<string, unknown>>;
  }

  if (!quiet) {
    console.table(rows);
  }
  return rows as Array<Record<string, unknown>>;
}

export async function cointrackerBalancesRegenerate(
  options: CointrackerBalancesRegenerateOptions,
): Promise<number> {
  const { drop, quiet } = options;

  if (drop) {
    await dropCointrackerBalancesTable();
    await createCointrackerBalancesTable();
  } else {
    await createCointrackerBalancesTable();
    await truncateCointrackerBalancesTable();
  }

  await rebuildCointrackerBalancesLedger();

  const rows = await selectCointrackerLastBalance();
  if (!quiet) {
    console.table(rows);
  }
  return rows.length;
}
