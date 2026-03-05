import type { Command } from "commander";
import { OptionFlags } from "#shared/cli/option-flags";

export function addDebugOption(command: Command, description = "Enable debug logging", defaultValue = false): Command {
  return command.option(OptionFlags.debug, description, defaultValue);
}

export function addFromOption(command: Command, defaultValue: string, description = "Start date (inclusive, ISO format)"): Command {
  return command.option(OptionFlags.from, description, defaultValue);
}

export function addToOption(command: Command, defaultValue: string, description = "End date (exclusive, ISO format)"): Command {
  return command.option(OptionFlags.to, description, defaultValue);
}

export function addRangeOption(command: Command, description = "Shortcut range: week | month | quarter | year | all"): Command {
  return command.option(OptionFlags.range, description);
}

export function addYearOption(command: Command, description = "Select data for a specific year"): Command {
  return command.option(OptionFlags.year, description);
}

export function addCacheOption(command: Command, description = "Use only cached orders"): Command {
  return command.option(OptionFlags.cache, description);
}

export function addRsyncOption(command: Command, description: string, defaultValue = false): Command {
  return command.option(OptionFlags.rsync, description, defaultValue);
}
