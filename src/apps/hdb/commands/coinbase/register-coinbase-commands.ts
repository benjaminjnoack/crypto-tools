import type { Command } from "commander";
import { registerCoinbaseBalancesCommands } from "./balances/register-coinbase-balances-commands.js";
import { registerCoinbaseLotsCommands } from "./lots/register-coinbase-lots-commands.js";
import { registerCoinbaseOrderCommands } from "./orders/register-coinbase-orders-commands.js";
import { registerCoinbaseTransactionCommands } from "./transactions/register-coinbase-transactions-commands.js";

export function registerCoinbaseCommands(program: Command): void {
  const coinbase = program.command("coinbase").description("Coinbase commands");
  registerCoinbaseBalancesCommands(coinbase);
  registerCoinbaseLotsCommands(coinbase);
  registerCoinbaseOrderCommands(coinbase);
  registerCoinbaseTransactionCommands(coinbase);
}
