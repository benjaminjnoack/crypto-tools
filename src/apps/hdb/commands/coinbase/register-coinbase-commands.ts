import type { Command } from "commander";
import { registerCoinbaseOrderCommands } from "./orders/register-coinbase-orders-commands.js";

export function registerCoinbaseCommands(program: Command): void {
  const coinbase = program.command("coinbase").description("Coinbase commands");
  registerCoinbaseOrderCommands(coinbase);
}
