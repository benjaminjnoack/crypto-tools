import type { Command } from "commander";
import { handlePriceAction, handleProductAction } from "../products.js";
import { withValidatedProductId } from "./shared.js";

export function registerProductCommands(program: Command) {
  program
    .command("product [product]")
    .description("Fetch and display full product metadata")
    .action(withValidatedProductId("product", handleProductAction));

  program
    .command("price [product]")
    .description("Show the latest trade price with current best bid and ask")
    .action(withValidatedProductId("price", handlePriceAction));
}
