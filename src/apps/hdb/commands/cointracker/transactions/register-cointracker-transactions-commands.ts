import type { Command } from "commander";
import { z } from "zod";
import { addDebugOption, addFromOption, addRangeOption, addToOption, addYearOption } from "#shared/cli/option-builders";
import { runAction, runActionWithArgument } from "../../shared/action-runner.js";
import { parseArgWithOptions, parseOptions, withAction } from "../../register/register-utils.js";
import { COINBASE_EPOCH } from "../../shared/date-range-utils.js";
import {
  cointrackerTransactions,
  cointrackerTransactionsGroup,
  cointrackerTransactionsRegenerate,
} from "./cointracker-transactions-handlers.js";
import {
  CointrackerTransactionsGroupOptionsSchema,
  CointrackerTransactionsQueryOptionsSchema,
  CointrackerTransactionsRegenerateOptionsSchema,
} from "./schemas/cointracker-transactions-options.js";

const NOW = new Date().toISOString();

export function registerCointrackerTransactionCommands(cointracker: Command): void {
  const transactions = cointracker.command("transactions").description("CoinTracker transaction operations");

  const get = transactions
    .command("get [asset]")
    .alias("g")
    .description("Select transactions from cointracker_transactions");

  addDebugOption(get);
  addFromOption(get, COINBASE_EPOCH);
  addRangeOption(get);
  addToOption(get, NOW);
  addYearOption(get, "Read transactions for the specified year");

  get
    .option("-b, --include-balances", "Include balances from cointracker_balances_ledger", false)
    .option("-q, --quiet", "Do not print anything to the console", false)
    .option("--raw", "Print values raw from the DB", false)
    .option("-R, --received <asset>", "Select records where received_currency is <asset>")
    .option("-S, --sent <asset>", "Select records where sent_currency is <asset>")
    .option("-T, --type <type>", "Filter transactions by <type> (colon-separated values)")
    .option("-x, --exclude <assets>", "Exclude <assets> from the result set")
    .action(
      withAction(
        parseArgWithOptions(z.string().optional()),
        async (asset, options) =>
          runActionWithArgument(
            cointrackerTransactions,
            asset,
            options,
            CointrackerTransactionsQueryOptionsSchema,
          ),
      ),
    );

  const group = transactions
    .command("group [asset]")
    .alias("grp")
    .description("Calculate grouped totals from cointracker_transactions");

  addDebugOption(group);
  addFromOption(group, COINBASE_EPOCH);
  addRangeOption(group);
  addToOption(group, NOW);
  addYearOption(group, "Read transactions for the specified year");

  group
    .option(
      "-i, --interval <interval>",
      "Group transactions by <interval> (day, week, month, quarter, or year)",
    )
    .option("-q, --quiet", "Do not print anything to the console", false)
    .option("-R, --received <asset>", "Select records where received_currency is <asset>")
    .option("-S, --sent <asset>", "Select records where sent_currency is <asset>")
    .option("-T, --type <type>", "Filter transactions by <type> (colon-separated values)")
    .option("-x, --exclude <assets>", "Exclude <assets> from the result set")
    .action(
      withAction(
        parseArgWithOptions(z.string().optional()),
        async (asset, options) =>
          runActionWithArgument(
            cointrackerTransactionsGroup,
            asset,
            options,
            CointrackerTransactionsGroupOptionsSchema,
          ),
      ),
    );

  const regenerate = transactions
    .command("regenerate")
    .alias("r")
    .description("Rebuild cointracker_transactions from input CSV files");

  addDebugOption(regenerate);

  regenerate
    .option("-d, --drop", "Drop table and re-create before inserting", false)
    .option("--input-dir <dir>", "Input directory containing CoinTracker transaction CSV files")
    .option("-y, --yes", "Confirm destructive table rebuild", false)
    .action(
      withAction(
        parseOptions(),
        async (options) =>
          runAction(cointrackerTransactionsRegenerate, options, CointrackerTransactionsRegenerateOptionsSchema),
      ),
    );
}
