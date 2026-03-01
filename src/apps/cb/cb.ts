import process from "node:process";
import { Command } from "commander";
import { getVersion } from "../../version.js";
import { registerAccountsCommands } from "./commands/register/accounts.js";
import { registerLimitCommands } from "./commands/register/limit.js";
import { registerMarketCommands } from "./commands/register/market.js";
import { registerOrderCommands } from "./commands/register/orders.js";
import { registerProductCommands } from "./commands/register/products.js";
import { registerPlanCommand } from "./commands/register/plan.js";

export function createProgram(): Command {
  const version = getVersion();
  const program = new Command();

  program.name("cb").description("Coinbase command-line tool for placing orders").version(version);

  program.on("--help", () => {
    console.log("\nFor more information about a specific command, use:");
    console.log("  cb <command> --help");
    console.log("\nNote:");
    console.log("  [product] defaults to BTC when omitted.");
  });

  registerAccountsCommands(program);
  registerLimitCommands(program);
  registerMarketCommands(program);
  registerOrderCommands(program);
  registerProductCommands(program);
  registerPlanCommand(program);

  return program;
}

export async function main(argv = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}
