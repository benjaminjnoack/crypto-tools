import type { Command } from "commander";
import { z } from "zod";
import { addDebugOption, addFromOption, addRangeOption, addToOption, addYearOption } from "#shared/cli/option-builders";
import { runAction, runActionWithArgument } from "../../shared/action-runner.js";
import { parseArgWithOptions, parseOptions, withAction } from "../../register/register-utils.js";
import { COINBASE_EPOCH } from "../../shared/date-range-utils.js";
import {
  coinbaseBalances,
  coinbaseBalancesBatch,
  coinbaseBalancesRegenerate,
  coinbaseBalancesTrace,
} from "./coinbase-balances-handlers.js";
import {
  CoinbaseBalancesBatchOptionsSchema,
  CoinbaseBalancesQueryOptionsSchema,
  CoinbaseBalancesRegenerateOptionsSchema,
  CoinbaseBalancesTraceOptionsSchema,
} from "./schemas/coinbase-balances-options.js";

const NOW = new Date().toISOString();

export function registerCoinbaseBalancesCommands(coinbase: Command): void {
  const balances = coinbase.command("balances").description("Coinbase balance ledger");

  const list = balances
    .command("list <asset>")
    .description("List ledger balance entries for one or more assets (colon-separated)");

  addDebugOption(list);
  addFromOption(list, COINBASE_EPOCH);
  addRangeOption(list);
  addToOption(list, NOW);
  addYearOption(list, "Read balances for the specified year");

  list
    .option("--current", "Include current account balance check from Coinbase", false)
    .option("--first <first>", "Show only first N rows")
    .option("--last <last>", "Show only last N rows")
    .option("--quiet", "Suppress console output", false)
    .option("--raw", "Display raw balance values", false)
    .option("--remote", "Allow live Coinbase account requests", false)
    .option("--yes", "Confirm live Coinbase requests", false)
    .action(
      withAction(
        parseArgWithOptions(z.string()),
        async (asset, options) =>
          runActionWithArgument(
            coinbaseBalances,
            asset,
            options,
            CoinbaseBalancesQueryOptionsSchema,
          ),
      ),
    );

  const snapshot = balances
    .command("snapshot")
    .description("Show latest ledger balance snapshot for all assets");

  addDebugOption(snapshot);
  addFromOption(snapshot, COINBASE_EPOCH);
  addRangeOption(snapshot);
  addToOption(snapshot, NOW);
  addYearOption(snapshot, "Read balances snapshot for the specified year");

  snapshot
    .option("--current", "Include current account balance check from Coinbase", false)
    .option("--quiet", "Suppress console output", false)
    .option("--raw", "Display raw balance values", false)
    .option("--remote", "Allow live Coinbase account requests", false)
    .option("--yes", "Confirm live Coinbase requests", false)
    .action(
      withAction(
        parseOptions(),
        async (options) => runAction(coinbaseBalancesBatch, options, CoinbaseBalancesBatchOptionsSchema),
      ),
    );

  const trace = balances
    .command("trace <asset>")
    .description("Trace balance entries for an asset to last dust/zero point");

  addDebugOption(trace);
  addToOption(trace, NOW);
  addYearOption(trace, "Trace balances up to the end of the specified year");

  trace
    .option("--quiet", "Suppress console output", false)
    .option("--raw", "Display raw balance values", false)
    .action(
      withAction(
        parseArgWithOptions(z.string()),
        async (asset, options) =>
          runActionWithArgument(
            coinbaseBalancesTrace,
            asset,
            options,
            CoinbaseBalancesTraceOptionsSchema,
          ),
      ),
    );

  const rebuild = balances
    .command("rebuild")
    .description("Rebuild coinbase_balance_ledger from coinbase_transactions");

  addDebugOption(rebuild);

  rebuild
    .option("--drop", "Drop table and re-create before rebuilding", false)
    .option("--yes", "Confirm destructive table rebuild", false)
    .action(
      withAction(
        parseOptions(),
        async (options) => runAction(coinbaseBalancesRegenerate, options, CoinbaseBalancesRegenerateOptionsSchema),
      ),
    );
}
