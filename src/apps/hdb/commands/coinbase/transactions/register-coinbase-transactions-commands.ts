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
  const transactions = coinbase.command("transactions").description("Coinbase transaction operations");

  const get = transactions
    .command("get [asset]")
    .alias("g")
    .description("Select transaction rows from coinbase_transactions");

  addDebugOption(get);
  addFromOption(get, COINBASE_EPOCH);
  addRangeOption(get);
  addToOption(get, NOW);
  addYearOption(get, "Read transactions for the specified year");

  get
    .option("-b, --balance", "Include balances from coinbase_balance_ledger", false)
    .option("-c, --classifier <classifier>", "Filter by classifier")
    .option("-m, --manual", "Select manual transactions", false)
    .option("-M, --exclude-manual", "Exclude manual transactions", false)
    .option("-N, --not-classifier <classifier>", "Exclude classifier")
    .option("-p, --paired", "Include paired synthetic records", false)
    .option("-s, --synthetic", "Select synthetic transactions", false)
    .option("-S, --exclude-synthetic", "Exclude synthetic transactions", false)
    .option("-T, --type <type>", "Filter by type (colon-separated values)")
    .option("-x, --exclude <assets>", "Exclude assets (colon-separated values)")
    .option("-C, --classify", "Show classifier columns", false)
    .option("-F, --first <first>", "Show only first N rows")
    .option("-L, --last <last>", "Show only last N rows")
    .option("-n, --notes", "Show abbreviated type + notes", false)
    .option("-R, --raw", "Reserved compatibility flag", false)
    .option("-q, --quiet", "Suppress console output", false)
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

  const group = transactions
    .command("group [asset]")
    .alias("grp")
    .description("Group transaction sums from coinbase_transactions");

  addDebugOption(group);
  addFromOption(group, COINBASE_EPOCH);
  addRangeOption(group);
  addToOption(group, NOW);
  addYearOption(group, "Read grouped transactions for the specified year");

  group
    .option("-c, --classifier <classifier>", "Filter by classifier")
    .option(
      "-i, --interval <interval>",
      "Group by interval (day, week, month, quarter, year)",
    )
    .option("-m, --manual", "Select manual transactions", false)
    .option("-M, --exclude-manual", "Exclude manual transactions", false)
    .option("-s, --synthetic", "Select synthetic transactions", false)
    .option("-S, --exclude-synthetic", "Exclude synthetic transactions", false)
    .option("-T, --type <type>", "Filter by type (colon-separated values)")
    .option("-x, --exclude <assets>", "Exclude assets (colon-separated values)")
    .option("-R, --raw", "Reserved compatibility flag", false)
    .option("-q, --quiet", "Suppress console output", false)
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

  const id = transactions
    .command("id [id]")
    .description("Select transaction rows by ID (colon-separated values supported)");

  addDebugOption(id);

  id
    .option("-b, --balance", "Include balances from coinbase_balance_ledger", false)
    .option("-l, --lot-id <lotId>", "Legacy lot-id selector (not yet migrated)")
    .option("-C, --classify", "Show classifier columns", false)
    .option("-n, --notes", "Show abbreviated type + notes", false)
    .option("-R, --raw", "Reserved compatibility flag", false)
    .option("-q, --quiet", "Suppress console output", false)
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

  const manual = transactions
    .command("manual <asset>")
    .alias("m")
    .description("Insert a manual transaction row into coinbase_transactions");

  addDebugOption(manual);

  manual
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

  const statement = transactions
    .command("statement <filepath>")
    .alias("st")
    .description("Import Coinbase statement CSV into coinbase_transactions");

  addDebugOption(statement);

  statement
    .option("-m, --manual", "Treat imported rows as manual transactions", false)
    .option("-n, --normalize", "Normalize trade rows into synthetic pairs", true)
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

  const regenerate = transactions
    .command("regenerate")
    .alias("r")
    .description("Rebuild coinbase_transactions from statement CSV input files");

  addDebugOption(regenerate);

  regenerate
    .option("-d, --drop", "Drop table and re-create before repopulating", false)
    .option("--input-dir <dir>", "Input directory containing statement CSV files")
    .option("-n, --normalize", "Normalize trade rows into synthetic pairs", true)
    .option("-y, --yes", "Confirm destructive table rebuild", false)
    .action(
      withAction(
        parseOptions(),
        async (options) =>
          runAction(coinbaseTransactionsRegenerate, options, CoinbaseTransactionsRegenerateOptionsSchema),
      ),
    );

  const nav = transactions
    .command("nav")
    .description("Compute account NAV and cash-flow PnL");

  addDebugOption(nav);
  addFromOption(nav, COINBASE_EPOCH);
  addRangeOption(nav);
  addToOption(nav, NOW);
  addYearOption(nav, "Calculate NAV over the specified year");

  nav
    .option("-q, --quiet", "Suppress console output", false)
    .option("--remote", "Allow live Coinbase account and price requests", false)
    .option("--yes", "Confirm live Coinbase requests", false)
    .action(
      withAction(
        parseOptions(),
        async (options) => runAction(coinbaseTransactionsNav, options, CoinbaseTransactionsNavOptionsSchema),
      ),
    );
}
