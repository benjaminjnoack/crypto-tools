import { describe, expect, it } from "vitest";
import { getVersion } from "../src/cb/version.js";

describe("getVersion", () => {
  it("reads a semver-like version string from package.json", () => {
    const version = getVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
