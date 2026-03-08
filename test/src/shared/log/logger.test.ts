import { beforeEach, describe, expect, it, vi } from "vitest";

const envConfig = {
  HELPER_LOG_LEVEL: "info",
};

const { getEnvConfigMock } = vi.hoisted(() => ({
  getEnvConfigMock: vi.fn(() => envConfig),
}));

vi.mock("../../../../src/shared/common/env.js", () => ({
  getEnvConfig: getEnvConfigMock,
}));

import { logger } from "../../../../src/shared/log/logger.js";

describe("logger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    envConfig.HELPER_LOG_LEVEL = "info";
  });

  it("logs all levels when configured to debug", () => {
    envConfig.HELPER_LOG_LEVEL = "debug";
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logger.debug("d");
    logger.info("i");
    logger.log("l");
    logger.warn("w");
    logger.error("e");

    expect(debugSpy).toHaveBeenCalledWith("d");
    expect(infoSpy).toHaveBeenCalledWith("i");
    expect(infoSpy).toHaveBeenCalledWith("l");
    expect(warnSpy).toHaveBeenCalledWith("w");
    expect(errorSpy).toHaveBeenCalledWith("e");
  });

  it("suppresses debug when configured to info", () => {
    envConfig.HELPER_LOG_LEVEL = "info";
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith("i");
    expect(warnSpy).toHaveBeenCalledWith("w");
    expect(errorSpy).toHaveBeenCalledWith("e");
  });

  it("suppresses info/debug when configured to warn", () => {
    envConfig.HELPER_LOG_LEVEL = "warn";
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logger.debug("d");
    logger.info("i");
    logger.log("l");
    logger.warn("w");
    logger.error("e");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith("w");
    expect(errorSpy).toHaveBeenCalledWith("e");
  });

  it("suppresses everything except error when configured to error", () => {
    envConfig.HELPER_LOG_LEVEL = "error";
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith("e");
  });

  it("falls back to info level for unknown configured value", () => {
    envConfig.HELPER_LOG_LEVEL = "invalid-level";
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logger.debug("d");
    logger.info("i");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith("i");
  });
});
