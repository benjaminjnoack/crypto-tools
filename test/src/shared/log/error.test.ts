import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { loggerErrorMock } = vi.hoisted(() => ({
  loggerErrorMock: vi.fn(),
}));

vi.mock("../../../../src/shared/log/logger.js", () => ({
  logger: {
    error: loggerErrorMock,
  },
}));

import { printError } from "../../../../src/shared/log/error.js";

describe("printError", () => {
  it("formats zod errors", () => {
    const schema = z.object({ amount: z.number().positive() });
    let err: unknown;
    try {
      schema.parse({ amount: -1 });
    } catch (e) {
      err = e;
    }

    printError(err);

    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
    expect(loggerErrorMock.mock.calls[0]?.[0]).toBeTypeOf("object");
  });

  it("prints Error.message for standard errors", () => {
    printError(new Error("boom"));

    expect(loggerErrorMock).toHaveBeenCalledWith("boom");
  });

  it("prints unknown values directly", () => {
    printError("plain-value");

    expect(loggerErrorMock).toHaveBeenCalledWith("plain-value");
  });
});
