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
  const balances = cointracker.command("balances").description("CoinTracker balance operations");

  const get = balances
    .command("get [currency]")
    .alias("g")
    .description("Select records from cointracker_balances_ledger");

  addDebugOption(get);
  addFromOption(get, COINBASE_EPOCH);
  addRangeOption(get);
  addToOption(get, NOW);
  addYearOption(get, "Read balances for the specified year");

  get
    .option("-T, --include-type", "Select transaction type from cointracker_transactions")
    .action(
      withAction(
        parseArgWithOptions(z.string().optional()),
        async (currency, options) =>
          runActionWithArgument(cointrackerBalances, currency, options, CointrackerBalancesQueryOptionsSchema),
      ),
    );

  const regenerate = balances
    .command("regenerate")
    .alias("r")
    .description("Rebuild cointracker_balances_ledger from cointracker_transactions");

  addDebugOption(regenerate);

  regenerate
    .option("-d, --drop", "Drop table and re-create before rebuilding", false)
    .option("-y, --yes", "Confirm destructive table rebuild", false)
    .action(
      withAction(
        parseOptions(),
        async (options) => runAction(cointrackerBalancesRegenerate, options, CointrackerBalancesRegenerateOptionsSchema),
      ),
    );
}
