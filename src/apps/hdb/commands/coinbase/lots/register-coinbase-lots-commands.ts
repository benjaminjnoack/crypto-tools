import type { Command } from "commander";
import { z } from "zod";
import { addDebugOption, addFromOption, addRangeOption, addToOption, addYearOption } from "../../../../../shared/cli/option-builders.js";
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
  const lots = coinbase.command("lots").description("Coinbase lot accounting");

  const analyze = lots
    .command("analyze <asset>")
    .description("Run lot matching for one asset");

  addDebugOption(analyze);
  addFromOption(analyze, COINBASE_EPOCH);
  addRangeOption(analyze);
  addToOption(analyze, NOW);
  addYearOption(analyze, "Calculate lots for the specified year");

  analyze
    .option("--accounting <accounting>", "Cost basis accounting method (FIFO, HIFO, LIFO)", "FIFO")
    .option("--all", "Include all transactions used in lot accounting", false)
    .option("--balance", "Print account balance after lot accounting", false)
    .option("--buy-lots", "Include buy lots", false)
    .option("--csv", "Export to CSV", false)
    .option("--f8949", "Generate IRS Form 8949", false)
    .option("--notes", "Include generated notes with CSV", false)
    .option("--obfuscate", "Obfuscate lot IDs in CSV (overrides notes)", false)
    .option("--pages", "Paginate f8949 output", false)
    .option("--quiet", "Suppress console output", false)
    .option("--totals", "Print lot totals", false)
    .action(
      withAction(
        parseArgWithOptions(z.string()),
        async (asset, options) =>
          runActionWithArgument(coinbaseLots, asset, options, CoinbaseLotsQueryOptionsSchema),
      ),
    );

  const analyzeAll = lots
    .command("analyze-all")
    .description("Run lot matching across all assets");

  addDebugOption(analyzeAll);
  addFromOption(analyzeAll, COINBASE_EPOCH);
  addRangeOption(analyzeAll);
  addToOption(analyzeAll, NOW);
  addYearOption(analyzeAll, "Calculate lots for the specified year");

  analyzeAll
    .option("--accounting <accounting>", "Cost basis accounting method (FIFO, HIFO, LIFO)", "FIFO")
    .option("--balance", "Print account balance after lot accounting", false)
    .option("--buy-lots", "Include buy lots", false)
    .option("--cash", "Calculate lots for cash assets (USD/USDC)", false)
    .option("--csv", "Export to CSV", false)
    .option("--f8949", "Generate IRS Form 8949", false)
    .option("--notes", "Include generated notes with CSV", false)
    .option("--obfuscate", "Obfuscate lot IDs in CSV (overrides notes)", false)
    .option("--pages", "Paginate f8949 output", false)
    .option("--quiet", "Suppress console output", false)
    .option("--totals", "Print lot totals", false)
    .action(
      withAction(
        parseOptions(),
        async (options) => runAction(coinbaseLotsBatch, options, CoinbaseLotsBatchOptionsSchema),
      ),
    );

  const compare = lots
    .command("compare <asset>")
    .description("Compare FIFO/LIFO/HIFO totals for one asset");

  addDebugOption(compare);
  addFromOption(compare, COINBASE_EPOCH);
  addRangeOption(compare);
  addToOption(compare, NOW);
  addYearOption(compare, "Compare lots for the specified year");

  compare
    .option("--quiet", "Suppress console output", false)
    .action(
      withAction(
        parseArgWithOptions(z.string()),
        async (asset, options) =>
          runActionWithArgument(coinbaseLotsCompare, asset, options, CoinbaseLotsCompareOptionsSchema),
      ),
    );

  const compareAll = lots
    .command("compare-all")
    .description("Compare FIFO/LIFO/HIFO totals across all assets");

  addDebugOption(compareAll);
  addFromOption(compareAll, COINBASE_EPOCH);
  addRangeOption(compareAll);
  addToOption(compareAll, NOW);
  addYearOption(compareAll, "Compare lots for the specified year");

  compareAll
    .option("--balance", "Print account balance after lot accounting", false)
    .option("--quiet", "Suppress console output", false)
    .action(
      withAction(
        parseOptions(),
        async (options) => runAction(coinbaseLotsBatchCompare, options, CoinbaseLotsBatchCompareOptionsSchema),
      ),
    );
}
