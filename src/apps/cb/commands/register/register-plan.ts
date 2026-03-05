import { handlePlanAction } from "../plan-handlers.js";
import { type Command } from "commander";
import { OptionFlags, parseProductIdOptions, withAction } from "./register-utils.js";
import { PlanOptionsSchema } from "../schemas/command-options.js";

const DEFAULT_RISK_PERCENT = (1 / 4).toFixed(2); // 1H Quarter Portion
const DEFAULT_BUFFER_PERCENT = (0.1).toFixed(3); // 0.1%

export function registerPlanCommand(program: Command) {
  program
    .command("plan [product]")
    .option(OptionFlags.buyPrice, "Entry price in USD (positive number; required)")
    .option(
      OptionFlags.bufferPercent,
      "Percent to lower the stop price before sizing (0-100; default 0.100)",
      DEFAULT_BUFFER_PERCENT,
    )
    .option(OptionFlags.stopPrice, "Initial stop-loss price in USD (positive number; required)")
    .option(
      OptionFlags.takeProfitPrice,
      "Take-profit price in USD (positive number; required)",
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
      "Size and review a trade plan, then place a limit entry with attached take-profit and stop-loss orders",
    )
    .action(withAction("plan", parseProductIdOptions(PlanOptionsSchema), handlePlanAction));
}
