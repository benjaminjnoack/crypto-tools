import type { Command } from "commander";
import { registerCointrackerBalancesCommands } from "./balances/register-cointracker-balances-commands.js";
import { registerCointrackerCapitalGainsCommands } from "./capital-gains/register-cointracker-capital-gains-commands.js";
import { registerCointrackerTransactionCommands } from "./transactions/register-cointracker-transactions-commands.js";

export function registerCointrackerCommands(program: Command): void {
  const cointracker = program.command("cointracker").description("CoinTracker commands");
  registerCointrackerBalancesCommands(cointracker);
  registerCointrackerCapitalGainsCommands(cointracker);
  registerCointrackerTransactionCommands(cointracker);
}
