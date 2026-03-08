import type { Command } from "commander";
import { z } from "zod";
import { addDebugOption, addFromOption, addRangeOption, addToOption, addYearOption } from "#shared/cli/option-builders";
import { runAction, runActionWithArgument } from "../../shared/action-runner.js";
import { parseArgWithOptions, parseOptions, withAction } from "../../register/register-utils.js";
import { COINBASE_EPOCH } from "../../shared/date-range-utils.js";
import {
  coinbaseTransactions,
  coinbaseTransactionsGroup,
  coinbaseTransactionsId,
  coinbaseTransactionsManual,
  coinbaseTransactionsNav,
  coinbaseTransactionsRegenerate,
  coinbaseTransactionsStatement,
} from "./coinbase-transactions-handlers.js";
import {
  CoinbaseTransactionsGroupOptionsSchema,
  CoinbaseTransactionsIdOptionsSchema,
  CoinbaseTransactionsManualOptionsSchema,
  CoinbaseTransactionsNavOptionsSchema,
  CoinbaseTransactionsQueryOptionsSchema,
  CoinbaseTransactionsRegenerateOptionsSchema,
  CoinbaseTransactionsStatementOptionsSchema,
} from "./schemas/coinbase-transactions-options.js";

const NOW = new Date().toISOString();

export function registerCoinbaseTransactionCommands(coinbase: Command): void {
  const transactions = coinbase.command("transactions").description("Coinbase transactions");

  const list = transactions
    .command("list [asset]")
    .description("List transaction rows from coinbase_transactions");

  addDebugOption(list);
  addFromOption(list, COINBASE_EPOCH);
  addRangeOption(list);
  addToOption(list, NOW);
  addYearOption(list, "Read transactions for the specified year");

  list
    .option("--balance", "Include balances from coinbase_balance_ledger", false)
    .option("--classifier <classifier>", "Filter by classifier")
    .option("--manual", "Select manual transactions", false)
    .option("--exclude-manual", "Exclude manual transactions", false)
    .option("--not-classifier <classifier>", "Exclude classifier")
    .option("--paired", "Include paired synthetic records", false)
    .option("--synthetic", "Select synthetic transactions", false)
    .option("--exclude-synthetic", "Exclude synthetic transactions", false)
    .option("--type <type>", "Filter by type (colon-separated values)")
    .option("--exclude <assets>", "Exclude assets (colon-separated values)")
    .option("--classify", "Show classifier columns", false)
    .option("--first <first>", "Show only first N rows")
    .option("--last <last>", "Show only last N rows")
    .option("--notes", "Show abbreviated type + notes", false)
    .option("--raw", "Reserved compatibility flag", false)
    .option("--quiet", "Suppress console output", false)
    .action(
      withAction(
        parseArgWithOptions(z.string().optional()),
        async (asset, options) =>
          runActionWithArgument(
            coinbaseTransactions,
            asset,
            options,
            CoinbaseTransactionsQueryOptionsSchema,
          ),
      ),
    );

  const summary = transactions
    .command("summary [asset]")
    .description("Summarize transaction totals from coinbase_transactions");

  addDebugOption(summary);
  addFromOption(summary, COINBASE_EPOCH);
  addRangeOption(summary);
  addToOption(summary, NOW);
  addYearOption(summary, "Read grouped transactions for the specified year");

  summary
    .option("--classifier <classifier>", "Filter by classifier")
    .option("--interval <interval>", "Group by interval (day, week, month, quarter, year)")
    .option("--manual", "Select manual transactions", false)
    .option("--exclude-manual", "Exclude manual transactions", false)
    .option("--synthetic", "Select synthetic transactions", false)
    .option("--exclude-synthetic", "Exclude synthetic transactions", false)
    .option("--type <type>", "Filter by type (colon-separated values)")
    .option("--exclude <assets>", "Exclude assets (colon-separated values)")
    .option("--raw", "Reserved compatibility flag", false)
    .option("--quiet", "Suppress console output", false)
    .action(
      withAction(
        parseArgWithOptions(z.string().optional()),
        async (asset, options) =>
          runActionWithArgument(
            coinbaseTransactionsGroup,
            asset,
            options,
            CoinbaseTransactionsGroupOptionsSchema,
          ),
      ),
    );

  const show = transactions
    .command("show [id]")
    .description("Show transaction rows by ID (colon-separated values supported)");

  addDebugOption(show);

  show
    .option("--balance", "Include balances from coinbase_balance_ledger", false)
    .option("--lot-id <lotId>", "Legacy lot-id selector (not yet migrated)")
    .option("--classify", "Show classifier columns", false)
    .option("--notes", "Show abbreviated type + notes", false)
    .option("--raw", "Reserved compatibility flag", false)
    .option("--quiet", "Suppress console output", false)
    .action(
      withAction(
        parseArgWithOptions(z.string().optional()),
        async (txId, options) =>
          runActionWithArgument(
            coinbaseTransactionsId,
            txId,
            options,
            CoinbaseTransactionsIdOptionsSchema,
          ),
      ),
    );

  const addManual = transactions
    .command("add-manual <asset>")
    .description("Insert a manual transaction row into coinbase_transactions");

  addDebugOption(addManual);

  addManual
    .option("--dry-run", "Validate and preview row without inserting", false)
    .option("--fee <fee>", "Transaction fee", "0")
    .requiredOption("--notes <notes>", "Evidence or notes for the manual transaction")
    .requiredOption("--quantity <quantity>", "Transaction quantity")
    .option("--price_currency <price_currency>", "Price currency", "USD")
    .option("--price_at_tx <price_at_tx>", "Price at transaction time", "1")
    .option("--rewrite-existing", "Overwrite existing rows with same ID", false)
    .option("--subtotal <subtotal>", "Subtotal amount (defaults to quantity * price_at_tx)")
    .requiredOption("--timestamp <date>", "Transaction timestamp in ISO format")
    .option("--total <total>", "Total amount (defaults to subtotal + fee)")
    .requiredOption("--type <type>", "Transaction type")
    .action(
      withAction(
        parseArgWithOptions(z.string()),
        async (asset, options) =>
          runActionWithArgument(
            coinbaseTransactionsManual,
            asset,
            options,
            CoinbaseTransactionsManualOptionsSchema,
          ),
      ),
    );

  const importStatement = transactions
    .command("import-statement <filepath>")
    .description("Import Coinbase statement CSV into coinbase_transactions");

  addDebugOption(importStatement);

  importStatement
    .option("--manual", "Treat imported rows as manual transactions", false)
    .option("--normalize", "Normalize trade rows into synthetic pairs", true)
    .action(
      withAction(
        parseArgWithOptions(z.string()),
        async (filepath, options) =>
          runActionWithArgument(
            coinbaseTransactionsStatement,
            filepath,
            options,
            CoinbaseTransactionsStatementOptionsSchema,
          ),
      ),
    );

  const rebuild = transactions
    .command("rebuild")
    .description("Rebuild coinbase_transactions from statement CSV input files");

  addDebugOption(rebuild);

  rebuild
    .option("--drop", "Drop table and re-create before repopulating", false)
    .option("--input-dir <dir>", "Input directory containing statement CSV files")
    .option("--normalize", "Normalize trade rows into synthetic pairs", true)
    .option("--yes", "Confirm destructive table rebuild", false)
    .action(
      withAction(
        parseOptions(),
        async (options) =>
          runAction(coinbaseTransactionsRegenerate, options, CoinbaseTransactionsRegenerateOptionsSchema),
      ),
    );

  const nav = transactions
    .command("analyze-nav")
    .description("Compute account NAV and cash-flow PnL");

  addDebugOption(nav);
  addFromOption(nav, COINBASE_EPOCH);
  addRangeOption(nav);
  addToOption(nav, NOW);
  addYearOption(nav, "Calculate NAV over the specified year");

  nav
    .option("--quiet", "Suppress console output", false)
    .option("--remote", "Allow live Coinbase account and price requests", false)
    .option("--yes", "Confirm live Coinbase requests", false)
    .action(
      withAction(
        parseOptions(),
        async (options) => runAction(coinbaseTransactionsNav, options, CoinbaseTransactionsNavOptionsSchema),
      ),
    );
}
