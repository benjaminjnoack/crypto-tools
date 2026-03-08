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
  const balances = coinbase.command("balances").description("Coinbase balance ledger operations");

  const get = balances
    .command("get <asset>")
    .alias("g")
    .description("Read ledger balances for <asset> (colon-separated values supported)");

  addDebugOption(get);
  addFromOption(get, COINBASE_EPOCH);
  addRangeOption(get);
  addToOption(get, NOW);
  addYearOption(get, "Read balances for the specified year");

  get
    .option("-c, --current", "Include current account balance check from Coinbase", false)
    .option("--first <first>", "Show only first N rows")
    .option("--last <last>", "Show only last N rows")
    .option("-q, --quiet", "Suppress console output", false)
    .option("-R, --raw", "Display raw balance values", false)
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

  const batch = balances
    .command("batch")
    .alias("b")
    .description("Show latest ledger balance for each asset");

  addDebugOption(batch);
  addFromOption(batch, COINBASE_EPOCH);
  addRangeOption(batch);
  addToOption(batch, NOW);
  addYearOption(batch, "Read balances snapshot for the specified year");

  batch
    .option("-c, --current", "Include current account balance check from Coinbase", false)
    .option("-q, --quiet", "Suppress console output", false)
    .option("-R, --raw", "Display raw balance values", false)
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
    .alias("t")
    .description("Trace balance entries for <asset> back to last dust/zero point");

  addDebugOption(trace);
  addToOption(trace, NOW);
  addYearOption(trace, "Trace balances up to the end of the specified year");

  trace
    .option("-q, --quiet", "Suppress console output", false)
    .option("-R, --raw", "Display raw balance values", false)
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

  const regenerate = balances
    .command("regenerate")
    .alias("r")
    .description("Rebuild coinbase_balance_ledger from coinbase_transactions");

  addDebugOption(regenerate);

  regenerate
    .option("-d, --drop", "Drop table and re-create before rebuilding", false)
    .option("-y, --yes", "Confirm destructive table rebuild", false)
    .action(
      withAction(
        parseOptions(),
        async (options) => runAction(coinbaseBalancesRegenerate, options, CoinbaseBalancesRegenerateOptionsSchema),
      ),
    );
}
