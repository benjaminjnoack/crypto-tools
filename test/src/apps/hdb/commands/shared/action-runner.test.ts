import { beforeEach, describe, expect, it, vi } from "vitest";
import { z, type ZodType } from "zod";

type RunnerOptions = { debug?: boolean; value: string };

const { envConfig, endClientMock, printErrorMock, loggerDebugMock, getEnvConfigMock } = vi.hoisted(() => {
  const envConfig = {
    HELPER_LOG_LEVEL: "info",
  };
  return {
    envConfig,
    endClientMock: vi.fn(() => Promise.resolve(undefined)),
    printErrorMock: vi.fn(),
    loggerDebugMock: vi.fn(),
    getEnvConfigMock: vi.fn(() => envConfig),
  };
});

vi.mock("../../../../../../src/apps/hdb/db/db-client.js", () => ({
  endClient: endClientMock,
}));

vi.mock("../../../../../../src/shared/log/error.js", () => ({
  printError: printErrorMock,
}));

vi.mock("../../../../../../src/shared/common/env.js", () => ({
  getEnvConfig: getEnvConfigMock,
}));

vi.mock("../../../../../../src/shared/log/logger.js", () => ({
  logger: {
    debug: loggerDebugMock,
  },
}));

import {
  runAction,
  runActionWithArgument,
} from "../../../../../../src/apps/hdb/commands/shared/action-runner.js";

const optionsSchema = z.object({
  debug: z.boolean().optional(),
  value: z.string(),
}) as unknown as ZodType<RunnerOptions>;

describe("hdb action runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envConfig.HELPER_LOG_LEVEL = "info";
    delete process.env.HELPER_LOG_LEVEL;
  });

  it("runs handler, enables debug, logs result, and always cleans up", async () => {
    const pauseSpy = vi.spyOn(process.stdin, "pause").mockImplementation(() => process.stdin);
    const handler = vi.fn((opts: RunnerOptions) => Promise.resolve({ ok: opts.value }));

    await runAction(handler, { debug: true, value: "x" }, optionsSchema);

    expect(handler).toHaveBeenCalledWith({ debug: true, value: "x" });
    expect(loggerDebugMock).toHaveBeenCalledWith({ ok: "x" });
    expect(envConfig.HELPER_LOG_LEVEL).toBe("debug");
    expect(process.env.HELPER_LOG_LEVEL).toBe("debug");
    expect(endClientMock).toHaveBeenCalledTimes(1);
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    pauseSpy.mockRestore();
  });

  it("prints parse errors and still executes finalizers", async () => {
    const pauseSpy = vi.spyOn(process.stdin, "pause").mockImplementation(() => process.stdin);
    const handler = vi.fn(() => Promise.resolve({ ok: true }));

    await runAction(handler, { debug: false }, optionsSchema);

    expect(handler).not.toHaveBeenCalled();
    expect(printErrorMock).toHaveBeenCalledTimes(1);
    expect(endClientMock).toHaveBeenCalledTimes(1);
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    pauseSpy.mockRestore();
  });

  it("prints handler errors and still executes finalizers", async () => {
    const pauseSpy = vi.spyOn(process.stdin, "pause").mockImplementation(() => process.stdin);
    const handler = vi.fn(() => Promise.reject(new Error("boom")));

    await runAction(handler, { value: "ok" }, optionsSchema);

    expect(printErrorMock).toHaveBeenCalledTimes(1);
    expect(endClientMock).toHaveBeenCalledTimes(1);
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    pauseSpy.mockRestore();
  });

  it("passes arg + options in runActionWithArgument and logs when debug=true", async () => {
    const pauseSpy = vi.spyOn(process.stdin, "pause").mockImplementation(() => process.stdin);
    const handler = vi.fn((arg: string, opts: RunnerOptions) => Promise.resolve(`${arg}:${opts.value}`));

    await runActionWithArgument(handler, "ARG", { debug: true, value: "V" }, optionsSchema);

    expect(handler).toHaveBeenCalledWith("ARG", { debug: true, value: "V" });
    expect(loggerDebugMock).toHaveBeenCalledWith("ARG:V");
    expect(endClientMock).toHaveBeenCalledTimes(1);
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    pauseSpy.mockRestore();
  });

  it("prints errors in runActionWithArgument and still finalizes", async () => {
    const pauseSpy = vi.spyOn(process.stdin, "pause").mockImplementation(() => process.stdin);
    const handler = vi.fn(() => Promise.reject(new Error("fail")));

    await runActionWithArgument(handler, "ARG", { value: "V" }, optionsSchema);

    expect(printErrorMock).toHaveBeenCalledTimes(1);
    expect(endClientMock).toHaveBeenCalledTimes(1);
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    pauseSpy.mockRestore();
  });
});
