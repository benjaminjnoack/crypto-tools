import type { Command } from "commander";
import { registerCointrackerTransactionCommands } from "./transactions/register-cointracker-transactions-commands.js";

export function registerCointrackerCommands(program: Command): void {
  const cointracker = program.command("cointracker").description("CoinTracker commands");
  registerCointrackerTransactionCommands(cointracker);
}
