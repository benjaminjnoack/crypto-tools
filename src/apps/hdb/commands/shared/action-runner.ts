import type { ZodType } from "zod";
import { endClient } from "../../db/db-client.js";
import type { DebugOptions } from "../schemas/debug-options.js";
import { getEnvConfig } from "../../../../shared/common/index.js";
import { logger, printError } from "../../../../shared/log/index.js";

const E = getEnvConfig();

function setDebugEnabled(debug: boolean | undefined): void {
  if (!debug) {
    return;
  }

  E.HELPER_LOG_LEVEL = "debug";
  process.env.HELPER_LOG_LEVEL = "debug";
}

export async function runAction<TOptions extends DebugOptions>(
  handler: (options: TOptions) => Promise<unknown>,
  options: unknown,
  optionsSchema: ZodType<TOptions>,
): Promise<void> {
  try {
    const parsedOptions = optionsSchema.parse(options);
    setDebugEnabled(parsedOptions.debug);

    const res = await handler(parsedOptions);
    const { debug } = parsedOptions;
    if (debug) {
      logger.debug(res);
    }
  } catch (error: unknown) {
    printError(error);
  } finally {
    await endClient();
    process.stdin.pause();
  }
}

export async function runActionWithArgument<TArg, TOptions extends DebugOptions>(
  handler: (arg: TArg, options: TOptions) => Promise<unknown>,
  arg: TArg,
  options: unknown,
  optionsSchema: ZodType<TOptions>,
): Promise<void> {
  try {
    const parsedOptions = optionsSchema.parse(options);
    setDebugEnabled(parsedOptions.debug);

    const res = await handler(arg, parsedOptions);
    const { debug } = parsedOptions;
    if (debug) {
      logger.debug(res);
    }
  } catch (error: unknown) {
    printError(error);
  } finally {
    await endClient();
    process.stdin.pause();
  }
}
