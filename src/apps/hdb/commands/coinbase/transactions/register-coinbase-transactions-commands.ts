import type { Command } from "commander";
import { z } from "zod";
import { addDebugOption, addFromOption, addRangeOption, addToOption, addYearOption } from "#shared/cli/option-builders";
import { runActionWithArgument } from "../../shared/action-runner.js";
import { parseArgWithOptions, withAction } from "../../register/register-utils.js";
import { COINBASE_EPOCH } from "../../shared/date-range-utils.js";
import {
  coinbaseTransactions,
  coinbaseTransactionsGroup,
  coinbaseTransactionsId,
} from "./coinbase-transactions-handlers.js";
import {
  CoinbaseTransactionsGroupOptionsSchema,
  CoinbaseTransactionsIdOptionsSchema,
  CoinbaseTransactionsQueryOptionsSchema,
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
}
