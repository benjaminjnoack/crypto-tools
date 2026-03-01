import { describe, expect, it } from "vitest";
import { createProgram } from "../../../../src/apps/cb/cb.js";


describe("createProgram", () => {
  it("registers the core CLI commands", () => {
    const program = createProgram();
    const names = new Set(program.commands.map((command) => command.name()));

    expect(names.has("accounts")).toBe(true);
    expect(names.has("market")).toBe(true);
    expect(names.has("orders")).toBe(true);
    expect(names.has("product")).toBe(true);
  });
});
