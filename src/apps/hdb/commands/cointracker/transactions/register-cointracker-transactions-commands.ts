import type { Command } from "commander";
import { z } from "zod";
import { addDebugOption, addFromOption, addRangeOption, addToOption, addYearOption } from "../../../../../shared/cli/option-builders.js";
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
  const transactions = cointracker.command("transactions").description("CoinTracker transactions");

  const list = transactions
    .command("list [asset]")
    .description("List transactions from cointracker_transactions");

  addDebugOption(list);
  addFromOption(list, COINBASE_EPOCH);
  addRangeOption(list);
  addToOption(list, NOW);
  addYearOption(list, "Read transactions for the specified year");

  list
    .option("--include-balances", "Include balances from cointracker_balances_ledger", false)
    .option("--quiet", "Do not print anything to the console", false)
    .option("--raw", "Print values raw from the DB", false)
    .option("--received <asset>", "Select records where received_currency is <asset>")
    .option("--sent <asset>", "Select records where sent_currency is <asset>")
    .option("--type <type>", "Filter transactions by <type> (colon-separated values)")
    .option("--exclude <assets>", "Exclude <assets> from the result set")
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

  const summary = transactions
    .command("summary [asset]")
    .description("Summarize grouped totals from cointracker_transactions");

  addDebugOption(summary);
  addFromOption(summary, COINBASE_EPOCH);
  addRangeOption(summary);
  addToOption(summary, NOW);
  addYearOption(summary, "Read transactions for the specified year");

  summary
    .option("--interval <interval>", "Group by interval (day, week, month, quarter, year)")
    .option("--quiet", "Do not print anything to the console", false)
    .option("--received <asset>", "Select records where received_currency is <asset>")
    .option("--sent <asset>", "Select records where sent_currency is <asset>")
    .option("--type <type>", "Filter transactions by <type> (colon-separated values)")
    .option("--exclude <assets>", "Exclude <assets> from the result set")
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

  const rebuild = transactions
    .command("rebuild")
    .description("Rebuild cointracker_transactions from input CSV files");

  addDebugOption(rebuild);

  rebuild
    .option("--drop", "Drop table and re-create before inserting", false)
    .option("--input-dir <dir>", "Input directory containing CoinTracker transaction CSV files")
    .action(
      withAction(
        parseOptions(),
        async (options) =>
          runAction(cointrackerTransactionsRegenerate, options, CointrackerTransactionsRegenerateOptionsSchema),
      ),
    );
}
