import type { Command } from "commander";
import { addDebugOption } from "#shared/cli/option-builders";
import { runAction } from "../shared/action-runner.js";
import { handleTestAction } from "../test.js";
import { type DebugOptions, DebugOptionsSchema } from "../schemas/debug-options.js";
import { systemRebuildAll } from "./system-handlers.js";
import { parseOptions, withAction } from "../register/register-utils.js";
import { SystemRebuildAllOptionsSchema } from "./schemas/system-rebuild-all-options.js";

export function registerSystemCommands(program: Command) {
  const health = program
    .command("health")
    .description("Check database connectivity");

  addDebugOption(health);

  health
    .action(
      withAction(
        parseOptions(),
        async (options) => runAction(handleTestAction, options as DebugOptions, DebugOptionsSchema),
      ),
    );

  const system = program
    .command("system")
    .description("System maintenance commands");

  const rebuildAll = system
    .command("rebuild-all")
    .description("Rebuild all input-derived hdb tables sequentially from local input files");

  addDebugOption(rebuildAll);

  rebuildAll
    .option("--drop", "Drop tables and re-create before rebuilding", false)
    .option("--coinbase-transactions-input-dir <dir>", "Input directory containing Coinbase statement CSV files")
    .option("--cointracker-transactions-input-dir <dir>", "Input directory containing CoinTracker transaction CSV files")
    .option("--cointracker-gains-input-dir <dir>", "Input directory containing CoinTracker capital gains CSV files")
    .option("--quiet", "Suppress per-stage console table output", false)
    .action(
      withAction(
        parseOptions(),
        async (options) => runAction(systemRebuildAll, options, SystemRebuildAllOptionsSchema),
      ),
    );
}
