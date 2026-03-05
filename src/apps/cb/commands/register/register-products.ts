import type { Command } from "commander";
import { handlePriceAction, handleProductAction } from "../product-handlers.js";
import { parseProductId, withAction } from "./register-utils.js";

export function registerProductCommands(program: Command) {
  program
    .command("product [product]")
    .description("Fetch and display full product metadata")
    .action(withAction("product", parseProductId(), handleProductAction));

  program
    .command("price [product]")
    .description("Show the latest trade price with current best bid and ask")
    .action(withAction("price", parseProductId(), handlePriceAction));
}
