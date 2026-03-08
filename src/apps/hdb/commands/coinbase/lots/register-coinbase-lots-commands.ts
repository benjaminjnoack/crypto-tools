import type { Command } from "commander";
import { z } from "zod";
import { addDebugOption, addFromOption, addRangeOption, addToOption, addYearOption } from "#shared/cli/option-builders";
import { runAction, runActionWithArgument } from "../../shared/action-runner.js";
import { parseArgWithOptions, parseOptions, withAction } from "../../register/register-utils.js";
import { COINBASE_EPOCH } from "../../shared/date-range-utils.js";
import {
  coinbaseLots,
  coinbaseLotsBatch,
  coinbaseLotsBatchCompare,
  coinbaseLotsCompare,
} from "./coinbase-lots-handlers.js";
import {
  CoinbaseLotsBatchCompareOptionsSchema,
  CoinbaseLotsBatchOptionsSchema,
  CoinbaseLotsCompareOptionsSchema,
  CoinbaseLotsQueryOptionsSchema,
} from "./schemas/coinbase-lots-options.js";

const NOW = new Date().toISOString();

export function registerCoinbaseLotsCommands(coinbase: Command): void {
  const lots = coinbase.command("lots").description("Coinbase lot accounting operations");

  const get = lots
    .command("get <asset>")
    .alias("g")
    .description("Match buy and sell lots for <asset>");

  addDebugOption(get);
  addFromOption(get, COINBASE_EPOCH);
  addRangeOption(get);
  addToOption(get, NOW);
  addYearOption(get, "Calculate lots for the specified year");

  get
    .option("-a, --accounting <accounting>", "Cost basis accounting method (FIFO, HIFO, LIFO)", "FIFO")
    .option("--all", "Include all transactions used in lot accounting", false)
    .option("-b, --balance", "Print account balance after lot accounting", false)
    .option("-B, --buy-lots", "Include buy lots", false)
    .option("-e, --csv", "Export to CSV", false)
    .option("--f8949", "Generate IRS Form 8949", false)
    .option("--notes", "Include generated notes with CSV", false)
    .option("--obfuscate", "Obfuscate Lot IDs in CSV (overrides notes)", false)
    .option("--pages", "Paginate f8949 output", false)
    .option("-q, --quiet", "Suppress console output", false)
    .option("--totals", "Print lot totals", false)
    .action(
      withAction(
        parseArgWithOptions(z.string()),
        async (asset, options) =>
          runActionWithArgument(coinbaseLots, asset, options, CoinbaseLotsQueryOptionsSchema),
      ),
    );

  const batch = lots
    .command("batch")
    .alias("b")
    .description("Run lot accounting across assets");

  addDebugOption(batch);
  addFromOption(batch, COINBASE_EPOCH);
  addRangeOption(batch);
  addToOption(batch, NOW);
  addYearOption(batch, "Calculate lots for the specified year");

  batch
    .option("-a, --accounting <accounting>", "Cost basis accounting method (FIFO, HIFO, LIFO)", "FIFO")
    .option("-b, --balance", "Print account balance after lot accounting", false)
    .option("-B, --buy-lots", "Include buy lots", false)
    .option("-c, --cash", "Calculate lots for cash (USD/USDC)", false)
    .option("-e, --csv", "Export to CSV", false)
    .option("--f8949", "Generate IRS Form 8949", false)
    .option("--notes", "Include generated notes with CSV", false)
    .option("--obfuscate", "Obfuscate Lot IDs in CSV (overrides notes)", false)
    .option("--pages", "Paginate f8949 output", false)
    .option("-q, --quiet", "Suppress console output", false)
    .option("--totals", "Print lot totals", false)
    .action(
      withAction(
        parseOptions(),
        async (options) => runAction(coinbaseLotsBatch, options, CoinbaseLotsBatchOptionsSchema),
      ),
    );

  const compare = lots
    .command("compare <asset>")
    .alias("c")
    .description("Compare FIFO/LIFO/HIFO totals for a single asset");

  addDebugOption(compare);
  addFromOption(compare, COINBASE_EPOCH);
  addRangeOption(compare);
  addToOption(compare, NOW);
  addYearOption(compare, "Compare lots for the specified year");

  compare
    .option("-q, --quiet", "Suppress console output", false)
    .action(
      withAction(
        parseArgWithOptions(z.string()),
        async (asset, options) =>
          runActionWithArgument(coinbaseLotsCompare, asset, options, CoinbaseLotsCompareOptionsSchema),
      ),
    );

  const batchCompare = lots
    .command("batch-compare")
    .alias("bc")
    .description("Compare FIFO/LIFO/HIFO totals across all assets");

  addDebugOption(batchCompare);
  addFromOption(batchCompare, COINBASE_EPOCH);
  addRangeOption(batchCompare);
  addToOption(batchCompare, NOW);
  addYearOption(batchCompare, "Compare lots for the specified year");

  batchCompare
    .option("-b, --balance", "Print account balance after lot accounting", false)
    .option("-q, --quiet", "Suppress console output", false)
    .action(
      withAction(
        parseOptions(),
        async (options) => runAction(coinbaseLotsBatchCompare, options, CoinbaseLotsBatchCompareOptionsSchema),
      ),
    );
}
