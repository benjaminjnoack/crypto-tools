import {
  createCointrackerBalancesTable,
  dropCointrackerBalancesTable,
  rebuildCointrackerBalancesLedger,
  selectCointrackerBalances,
  selectCointrackerLastBalance,
  truncateCointrackerBalancesTable,
} from "../../../db/cointracker/balances/cointracker-balances-repository.js";
import { getToAndFromDates } from "../../shared/date-range-utils.js";
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
  const { includeType } = options;
  const { from, to } = await getToAndFromDates(options);

  const rows = await selectCointrackerBalances(
    {
      currencies: normalizeColonSeparatedUppercase(currency),
      from,
      to,
    },
    Boolean(includeType),
  );

  console.table(rows);
  return rows as Array<Record<string, unknown>>;
}

export async function cointrackerBalancesRegenerate(
  options: CointrackerBalancesRegenerateOptions,
): Promise<number> {
  const { drop, yes } = options;
  if (!yes) {
    throw new Error("Refusing to regenerate without confirmation. Re-run with --yes.");
  }

  if (drop) {
    await dropCointrackerBalancesTable();
    await createCointrackerBalancesTable();
  } else {
    await createCointrackerBalancesTable();
    await truncateCointrackerBalancesTable();
  }

  await rebuildCointrackerBalancesLedger();

  const rows = await selectCointrackerLastBalance();
  console.table(rows);
  return rows.length;
}
