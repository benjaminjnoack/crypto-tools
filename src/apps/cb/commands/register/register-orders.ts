import type { Command } from "commander";
import {
  handleCancelAction,
  handleModifyAction,
  handleOrderAction,
  handleOrdersAction,
} from "../order-handlers.js";
import { ModifyOptionsSchema } from "../schemas/command-options.js";
import {
  OptionFlags,
  parseArg,
  parseArgOptions,
  parseOptionalProduct,
  withAction,
} from "./register-utils.js";
import { OrderIdSchema } from "../../../../shared/schemas/shared-primitives.js";

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
    .option(OptionFlags.limitPrice, "Updated limit price in USD")
    .option(OptionFlags.stopPrice, "Updated stop trigger price in USD")
    .action(
      withAction(
        "order modify",
        parseArgOptions(OrderIdSchema, ModifyOptionsSchema),
        handleModifyAction,
      ),
    );
}
