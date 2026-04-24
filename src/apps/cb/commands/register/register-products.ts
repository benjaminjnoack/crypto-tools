import type { Command } from "commander";
import { InspectOptionsSchema } from "../schemas/command-options.js";
import { handlePriceAction, handleProductAction } from "../product-handlers.js";
import { parseProductIdOptions, withAction } from "./register-utils.js";

export function registerProductCommands(program: Command) {
  program
    .command("product [product]")
    .description("Fetch and display full product metadata")
    .option("--json", "Print machine-readable JSON output", false)
    .option("--json-file <path>", "Write machine-readable JSON output to <path>")
    .action(withAction("product", parseProductIdOptions(InspectOptionsSchema), handleProductAction));

  program
    .command("price [product]")
    .description("Show the latest trade price with current best bid and ask")
    .option("--json", "Print machine-readable JSON output", false)
    .option("--json-file <path>", "Write machine-readable JSON output to <path>")
    .action(withAction("price", parseProductIdOptions(InspectOptionsSchema), handlePriceAction));
}
