import process from "node:process";
import { Command } from "commander";
import { getVersion } from "../../version.js";
import { registerAccountsCommands } from "./commands/register/register-accounts.js";
import { registerLimitCommands } from "./commands/register/register-limit.js";
import { registerMarketCommands } from "./commands/register/register-market.js";
import { registerOrderCommands } from "./commands/register/register-orders.js";
import { registerProductCommands } from "./commands/register/register-products.js";
import { registerPlanCommand } from "./commands/register/register-plan.js";
import { registerFibCommand } from "./commands/register/register-fib.js";

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
  registerFibCommand(program);

  return program;
}

export async function main(argv = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}
