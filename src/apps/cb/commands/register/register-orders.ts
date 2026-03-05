import type { Command } from "commander";
import {
  handleBreakEvenStopAction,
  handleCancelAction,
  handleModifyAction,
  handleOrderAction,
  handleOrdersAction,
} from "../order-handlers.js";
import { BreakEvenStopOptionsSchema, ModifyOptionsSchema } from "../schemas/command-options.js";
import {
  OptionFlags,
  parseArg,
  parseArgOptions,
  parseOptionalProduct,
  withAction,
} from "./register-utils.js";
import { OrderIdSchema } from "#shared/schemas/shared-primitives";

export function registerOrderCommands(program: Command) {
  const order = program.command("order").description("Order management commands");

  order
    .command("get <order_id>")
    .description("Fetch and display details for a single order ID")
    .action(withAction("order get", parseArg(OrderIdSchema), handleOrderAction));

  order
    .command("list [product]")
    .description("List open orders, optionally filtered to a single product")
    .action(withAction("order list", parseOptionalProduct(), handleOrdersAction));

  order
    .command("cancel <order_id>")
    .description("Cancel an open order by order ID")
    .action(withAction("order cancel", parseArg(OrderIdSchema), handleCancelAction));

  order
    .command("modify <order_id>")
    .description("Modify an open limit/bracket/TP-SL order")
    .option(OptionFlags.baseSize, "Updated base amount")
    .option(OptionFlags.breakEvenStop, "Set stop to break-even from --buyPrice (fees included)")
    .option(OptionFlags.modifyBuyPrice, "Filled entry buy price in USD (required with --breakEvenStop)")
    .option(OptionFlags.limitPrice, "Updated limit price in USD")
    .option(OptionFlags.stopPrice, "Updated stop trigger price in USD")
    .action(
      withAction(
        "order modify",
        parseArgOptions(OrderIdSchema, ModifyOptionsSchema),
        handleModifyAction,
      ),
    );

  order
    .command("breakeven <order_id>")
    .description("Move stop to fee-inclusive break-even (bracket/TP-SL orders only)")
    .requiredOption(OptionFlags.modifyBuyPrice, "Filled entry buy price in USD")
    .option(OptionFlags.limitPrice, "Updated limit price in USD")
    .action(
      withAction(
        "order breakeven",
        parseArgOptions(OrderIdSchema, BreakEvenStopOptionsSchema),
        handleBreakEvenStopAction,
      ),
    );
}
