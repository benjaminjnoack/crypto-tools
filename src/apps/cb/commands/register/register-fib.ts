import type { Command } from "commander";
import { handleFibAction } from "../fib-handlers.js";
import { FibOptionsSchema } from "../schemas/command-options.js";
import { OptionFlags, parseProductIdOptions, withAction } from "./register-utils.js";

const DEFAULT_RISK_PERCENT = (1 / 4).toFixed(2); // 1H Quarter Portion
const DEFAULT_BUFFER_PERCENT = (0.1).toFixed(3); // 0.1%

export function registerFibCommand(program: Command) {
  program
    .command("fib [product]")
    .requiredOption(OptionFlags.fib0, "Fib 0 anchor price in USD")
    .requiredOption(OptionFlags.fib1, "Fib 1 anchor price in USD")
    .option(
      OptionFlags.bufferPercent,
      "Percent to lower the stop price before sizing (0-100; default 0.100)",
      DEFAULT_BUFFER_PERCENT,
    )
    .option(
      OptionFlags.riskPercent,
      "Max account risk used for sizing (0-100; default 0.25)",
      DEFAULT_RISK_PERCENT,
    )
    .option(
      OptionFlags.noPostOnly,
      "Disable post-only behavior for the entry limit order",
    )
    .option(
      OptionFlags.allIn,
      "Size with all available USD (overrides --riskPercent)",
      false,
    )
    .option(
      OptionFlags.dryRunFlag,
      "Preview plan/payload without placing orders; uses USD total (not available) for sizing",
      false,
    )
    .description(
      "Build a fib-extension spot plan from fib0/fib1 with prompted entry and take-profit levels",
    )
    .action(withAction("fib", parseProductIdOptions(FibOptionsSchema), handleFibAction));
}
