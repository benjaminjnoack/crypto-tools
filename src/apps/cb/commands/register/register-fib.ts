import type { Command } from "commander";
import { handleFibAction } from "../fib-handlers.js";
import { FibOptionsSchema } from "../schemas/command-options.js";
import { OptionFlags, parseProductIdOptions, withAction } from "./register-utils.js";

const DEFAULT_RISK_PERCENT = (1 / 4).toFixed(2); // 1H Quarter Portion
const DEFAULT_BUFFER_PERCENT = (0.1).toFixed(3); // 0.1%

export function registerFibCommand(program: Command) {
  program
    .command("fib [product]")
    .requiredOption(OptionFlags.floor, "Fib floor/0 anchor price in USD")
    .requiredOption(OptionFlags.ceiling, "Fib ceiling/1 anchor price in USD")
    .option(
      OptionFlags.fibEntry,
      "Entry extension (for example: 0.382 or shorthand 382)",
    )
    .option(
      OptionFlags.fibTakeProfit,
      "Take-profit extension (for example: 1.618 or shorthand 618)",
    )
    .option(
      OptionFlags.fibRound,
      "Round entry up and take-profit down with contextual price buckets",
      false,
    )
    .option(
      OptionFlags.bufferPercent,
      "Percent to lower the stop price before sizing (0-100; default 0.100)",
      DEFAULT_BUFFER_PERCENT,
    )
    .option(
      "--riskPercent <riskPercent>",
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
      "Build a fib-extension spot plan from floor/ceiling anchors with prompted or provided entry and take-profit levels",
    )
    .action(withAction("fib", parseProductIdOptions(FibOptionsSchema), handleFibAction));
}
