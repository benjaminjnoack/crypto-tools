import type { Command } from "commander";
import {
  AskOptionsSchema,
  BidOptionsSchema,
  BracketOptionsSchema,
  LimitOptionsSchema,
  StopOptionsSchema,
} from "../schemas/options.js";

import {
  handleAskAction,
  handleBidAction,
  handleBracketAction,
  handleLimitAction,
  handleMaxAction,
  handleStopAction,
} from "../limit.js";

import {
  OptionFlags,
  withValidatedProductId,
  withValidatedProductIdOptions,
} from "./shared.js";

export function registerLimitCommands(program: Command) {
  program
    .command("ask [product]")
    .description("Fetch the current best ask and place a sell limit order at that price")
    .option(
      OptionFlags.baseSize,
      "Base amount to sell (positive number; required unless --value is provided)",
    )
    .option(
      OptionFlags.value,
      "Notional USD value to sell (positive number; required unless --baseSize is provided)",
    )
    .option(
      OptionFlags.noPostOnly,
      "Disable post-only behavior (allow taking liquidity)",
    )
    .action(withValidatedProductIdOptions("ask", AskOptionsSchema, handleAskAction));

  program
    .command("bid [product]")
    .description("Fetch the current best bid and place a buy limit order at that price")
    .option(
      OptionFlags.baseSize,
      "Base amount to buy (positive number; required unless --value is provided)",
    )
    .option(
      OptionFlags.value,
      "Notional USD value to buy (positive number; required unless --baseSize is provided)",
    )
    .option(
      OptionFlags.noPostOnly,
      "Disable post-only behavior (allow taking liquidity)",
    )
    .action(withValidatedProductIdOptions("bid", BidOptionsSchema, handleBidAction));

  program
    .command("bracket [product]")
    .description("Place a bracket order with linked limit and stop legs")
    .requiredOption(OptionFlags.baseSize, "Base amount to sell (positive number)")
    .requiredOption(OptionFlags.limitPrice, "Take-profit limit price in USD (positive number)")
    .requiredOption(
      OptionFlags.stopPrice,
      "Stop trigger price in USD (positive number; must be below --limitPrice)",
    )
    .action(
      withValidatedProductIdOptions("bracket", BracketOptionsSchema, handleBracketAction),
    );

  program
    .command("limit [product]")
    .description("Place a limit order with explicit side and size/value")
    .option(
      OptionFlags.baseSize,
      "Base amount to buy/sell (positive number; required unless --value is provided)",
    )
    .option(OptionFlags.buy, "Set side to buy (exactly one of --buy/--sell is required)", false)
    .option(OptionFlags.limitPrice, "Limit price in USD (positive number; required)")
    .option(
      OptionFlags.noPostOnly,
      "Disable post-only behavior (allow taking liquidity)",
    )
    .option(OptionFlags.sell, "Set side to sell (exactly one of --buy/--sell is required)", false)
    .option(
      OptionFlags.value,
      "Notional USD value to buy/sell (positive number; required unless --baseSize is provided)",
    )
    .action(withValidatedProductIdOptions("limit", LimitOptionsSchema, handleLimitAction));

  program
    .command("max [product]")
    .description(
      "Use available USD (rounded down to $500) to place a max-size buy limit near the best bid",
    )
    .action(withValidatedProductId("max", handleMaxAction));

  program
    .command("stop [product]")
    .description("Place a stop-limit order with stop trigger and limit price")
    .option(OptionFlags.baseSize, "Base amount to sell (positive number; required)")
    .option(
      OptionFlags.limitPrice,
      "Execution limit price in USD after trigger (positive number; required)",
    )
    .option(
      OptionFlags.stopPrice,
      "Stop trigger price in USD (positive number; required and above --limitPrice)",
    )
    .action(withValidatedProductIdOptions("stop", StopOptionsSchema, handleStopAction));
}
