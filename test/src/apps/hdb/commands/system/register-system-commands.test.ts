import { describe, expect, it } from "vitest";
import { Command } from "commander";
import { registerSystemCommands } from "../../../../../../src/apps/hdb/commands/system/register-system-commands.js";

describe("register system commands", () => {
  it("registers root health and nested rebuild-all commands", () => {
    const program = new Command();
    registerSystemCommands(program);

    expect(program.commands.find((command) => command.name() === "health")).toBeDefined();

    const system = program.commands.find((command) => command.name() === "system");
    expect(system).toBeDefined();
    expect(system?.commands.find((command) => command.name() === "rebuild-all")).toBeDefined();
  });
});
