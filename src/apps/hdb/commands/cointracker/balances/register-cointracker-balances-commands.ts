import type { Command } from "commander";
import { z } from "zod";
import { addDebugOption, addFromOption, addRangeOption, addToOption, addYearOption } from "#shared/cli/option-builders";
import { runAction, runActionWithArgument } from "../../shared/action-runner.js";
import { parseArgWithOptions, parseOptions, withAction } from "../../register/register-utils.js";
import { COINBASE_EPOCH } from "../../shared/date-range-utils.js";
import {
  cointrackerBalances,
  cointrackerBalancesRegenerate,
} from "./cointracker-balances-handlers.js";
import {
  CointrackerBalancesQueryOptionsSchema,
  CointrackerBalancesRegenerateOptionsSchema,
} from "./schemas/cointracker-balances-options.js";

const NOW = new Date().toISOString();

export function registerCointrackerBalancesCommands(cointracker: Command): void {
  const balances = cointracker.command("balances").description("CoinTracker balance ledger");

  const list = balances
    .command("list [currency]")
    .description("List records from cointracker_balances_ledger");

  addDebugOption(list);
  addFromOption(list, COINBASE_EPOCH);
  addRangeOption(list);
  addToOption(list, NOW);
  addYearOption(list, "Read balances for the specified year");

  list
    .option("--include-type", "Include transaction type from cointracker_transactions")
    .action(
      withAction(
        parseArgWithOptions(z.string().optional()),
        async (currency, options) =>
          runActionWithArgument(cointrackerBalances, currency, options, CointrackerBalancesQueryOptionsSchema),
      ),
    );

  const rebuild = balances
    .command("rebuild")
    .description("Rebuild cointracker_balances_ledger from cointracker_transactions");

  addDebugOption(rebuild);

  rebuild
    .option("--drop", "Drop table and re-create before rebuilding", false)
    .option("--yes", "Confirm destructive table rebuild", false)
    .action(
      withAction(
        parseOptions(),
        async (options) => runAction(cointrackerBalancesRegenerate, options, CointrackerBalancesRegenerateOptionsSchema),
      ),
    );
}
