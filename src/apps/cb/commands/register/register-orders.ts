import type { Command } from "commander";
import {
  handleBreakEvenStopAction,
  handleCancelAction,
  handleModifyAction,
  handleOrderAction,
  handleOrdersAction,
  handleReplaceAction,
} from "../order-handlers.js";
import { BreakEvenStopOptionsSchema, InspectOptionsSchema, ModifyOptionsSchema } from "../schemas/command-options.js";
import {
  OptionFlags,
  parseArg,
  parseArgOptions,
  parseOptionalArg,
  parseOptionalProductOptions,
  withAction,
} from "./register-utils.js";
import { OrderIdSchema } from "../../../../shared/schemas/shared-primitives.js";

export function registerOrderCommands(program: Command) {
  program
    .command("orders [product]")
    .description("List open orders, optionally filtered to a single product")
    .option("--json", "Print machine-readable JSON output", false)
    .option("--json-file <path>", "Write machine-readable JSON output to <path>")
    .action(withAction("orders", parseOptionalProductOptions(InspectOptionsSchema), handleOrdersAction));

  const order = program.command("order").description("Order management commands");

  order
    .command("get <order_id>")
    .description("Fetch and display details for a single order ID")
    .option("--json", "Print machine-readable JSON output", false)
    .option("--json-file <path>", "Write machine-readable JSON output to <path>")
    .action(withAction("order get", parseArgOptions(OrderIdSchema, InspectOptionsSchema), handleOrderAction));

  order
    .command("list [product]")
    .description("List open orders, optionally filtered to a single product")
    .option("--json", "Print machine-readable JSON output", false)
    .option("--json-file <path>", "Write machine-readable JSON output to <path>")
    .action(withAction("order list", parseOptionalProductOptions(InspectOptionsSchema), handleOrdersAction));

  order
    .command("cancel [order_id]")
    .description("Cancel an open order by order ID, or the only open order if no ID is given")
    .action(withAction("order cancel", parseOptionalArg(OrderIdSchema), handleCancelAction));

  order
    .command("replace <order_id>")
    .description("Re-place a cancelled priced order with the same prices when funds are available")
    .action(withAction("order replace", parseArg(OrderIdSchema), handleReplaceAction));

  order
    .command("modify <order_id>")
    .description("Modify an existing limit/stop-limit/bracket/TP-SL order")
    .option(OptionFlags.baseSize, "Updated base amount")
    .option(OptionFlags.limitPrice, "Updated limit price in USD")
    .option(OptionFlags.stopPrice, "Updated stop trigger price in USD")
    .option(OptionFlags.takeProfitPrice, "Updated take-profit price in USD")
    .action(
      withAction(
        "order modify",
        parseArgOptions(OrderIdSchema, ModifyOptionsSchema),
        handleModifyAction,
      ),
    );

  order
    .command("breakeven <order_id>")
    .alias("break")
    .description("Move stop to fee-inclusive break-even (bracket/TP-SL orders only)")
    .requiredOption(OptionFlags.buyPrice, "Filled entry buy price in USD")
    .option(OptionFlags.limitPrice, "Updated limit price in USD")
    .action(
      withAction(
        "order breakeven",
        parseArgOptions(OrderIdSchema, BreakEvenStopOptionsSchema),
        handleBreakEvenStopAction,
      ),
    );
}
