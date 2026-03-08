import { describe, expect, it } from "vitest";

import { createProgram, main } from "../../../../src/apps/hdb/hdb.js";
import { getVersion } from "../../../../src/version.js";

describe("createProgram", () => {
  it("creates a CLI program with expected core metadata", () => {
    const program = createProgram();
    expect(program.name()).toBe("hdb");
    expect(program.description()).toContain("Crypto accounting");
  });

  it("prints help output", async () => {
    const program = createProgram();
    let output = "";

    program.configureOutput({
      writeOut: (str) => {
        output += str;
      },
      writeErr: (str) => {
        output += str;
      },
    });
    program.exitOverride();

    await expect(program.parseAsync(["node", "hdb", "--help"])).rejects.toMatchObject({
      code: "commander.helpDisplayed",
    });
    expect(output).toContain("Usage:");
    expect(output).toContain("hdb");
  });

  it("prints version output", async () => {
    const program = createProgram();
    let output = "";

    program.configureOutput({
      writeOut: (str) => {
        output += str;
      },
      writeErr: (str) => {
        output += str;
      },
    });
    program.exitOverride();

    await expect(program.parseAsync(["node", "hdb", "--version"])).rejects.toMatchObject({
      code: "commander.version",
    });
    expect(output).toContain(getVersion());
  });
});

describe("main", () => {
  it("shows help and exits when run without args", async () => {
    await expect(main(["node", "hdb"])).rejects.toThrow('process.exit unexpectedly called with "1"');
  });
});
