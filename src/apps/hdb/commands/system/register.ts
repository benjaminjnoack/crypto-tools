import type { Command } from "commander";
import { runAction } from "../shared/action-runner.js";
import { handleTestAction } from "../test.js";
import { type DebugOptions, DebugOptionsSchema } from "../schemas/debug-options.js";

export function registerSystemCommands(program: Command) {
  program
    .command("test")
    .description("Test connection to the database")
    .option("-D, --debug", "Enable debug logging", false)
    .action(async (options: DebugOptions) => runAction(handleTestAction, options, DebugOptionsSchema));
}
