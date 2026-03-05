import type { Command } from "commander";

export function registerCointrackerCommands(program: Command): void {
  program.command("cointracker").description("CoinTracker commands (in progress)");
}
