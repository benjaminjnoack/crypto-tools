import type { Command } from "commander";
import {
  BuyOptionsSchema,
  MarketOptionsSchema,
  SellOptionsSchema,
} from "../schemas/command-options.js";
import { handleBuyAction, handleMarketAction, handleSellAction } from "../market-handlers.js";
import { OptionFlags, parseProductIdOptions, withAction } from "./register-utils.js";

export function registerMarketCommands(program: Command) {
  program
    .command("buy [product]")
    .description("Place a market buy order by base size or USD value")
    .option(
      OptionFlags.baseSize,
      "Base amount to buy (positive number; required unless --value is provided)",
    )
    .option(
      OptionFlags.value,
      "Notional USD value to buy (positive number; required unless --baseSize is provided)",
    )
    .action(withAction("buy", parseProductIdOptions(BuyOptionsSchema), handleBuyAction));

  program
    .command("market [product]")
    .description("Place a market order; choose side with --buy or --sell and provide size/value")
    .option(OptionFlags.buy, "Set side to buy (exactly one of --buy/--sell is required)")
    .option(OptionFlags.sell, "Set side to sell (exactly one of --buy/--sell is required)")
    .option(
      OptionFlags.baseSize,
      "Base amount to buy/sell (positive number; required unless --value is provided)",
    )
    .option(
      OptionFlags.value,
      "Notional USD value to buy/sell (positive number; required unless --baseSize is provided)",
    )
    .action(withAction("market", parseProductIdOptions(MarketOptionsSchema), handleMarketAction));

  program
    .command("sell [product]")
    .description("Place a market sell order by base size or USD value")
    .option(
      OptionFlags.baseSize,
      "Base amount to sell (positive number; required unless --value is provided)",
    )
    .option(
      OptionFlags.value,
      "Notional USD value to sell (positive number; required unless --baseSize is provided)",
    )
    .action(withAction("sell", parseProductIdOptions(SellOptionsSchema), handleSellAction));
}
