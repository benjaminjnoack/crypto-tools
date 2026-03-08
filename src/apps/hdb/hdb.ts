import process from "node:process";
import { Command } from "commander";
import { registerSystemCommands } from "./commands/system/register-system-commands.js";
import { registerCoinbaseCommands } from "./commands/coinbase/register-coinbase-commands.js";
import { registerCointrackerCommands } from "./commands/cointracker/register-cointracker-commands.js";
import { getVersion } from "../../version.js";

export function createProgram(): Command {
  const version = getVersion();
  const program = new Command();

  program.name("hdb").description("Crypto accounting database CLI").version(version);

  program.on("--help", () => {
    console.log("\nFor more information about a specific command, use:");
    console.log("  hdb <command path> --help");
  });

  registerSystemCommands(program);
  registerCoinbaseCommands(program);
  registerCointrackerCommands(program);

  return program;
}

export async function main(argv = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}
