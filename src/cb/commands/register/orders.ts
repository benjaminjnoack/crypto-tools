import type { Command } from "commander";
import { handleCancelAction, handleOrderAction, handleOrdersAction } from "../orders.js";
import { withOptionalProduct, withValidatedArg } from "./shared.js";
import { OrderIdSchema } from "../../../lib/schemas/primitives.js";

export function registerOrderCommands(program: Command) {
  program
    .command("cancel <order_id>")
    .description("Cancel an open order by order ID")
    .action(withValidatedArg("cancel", OrderIdSchema, handleCancelAction));

  program
    .command("order <order_id>")
    .description("Fetch and display details for a single order ID")
    .action(withValidatedArg("order", OrderIdSchema, handleOrderAction));

  program
    .command("orders [product]")
    .alias("open")
    .description("List open orders, optionally filtered to a single product")
    .action(withOptionalProduct("orders", handleOrdersAction));
}
