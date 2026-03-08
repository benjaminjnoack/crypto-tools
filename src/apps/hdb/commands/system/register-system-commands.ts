import type { Command } from "commander";
import { addDebugOption } from "#shared/cli/option-builders";
import { runAction } from "../shared/action-runner.js";
import { handleTestAction } from "../test.js";
import { type DebugOptions, DebugOptionsSchema } from "../schemas/debug-options.js";
import { parseOptions, withAction } from "../register/register-utils.js";

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
}
