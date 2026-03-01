import { beforeEach, describe, expect, it, vi } from "vitest";

const envConfig = {
  HELPER_POSTGRES_DATABASE: "helper_db",
  HELPER_POSTGRES_USERNAME: "helper_user",
  HELPER_POSTGRES_PASSWORD: "helper_pw",
};

const { PoolCtorMock, loggerDebugMock } = vi.hoisted(() => ({
  PoolCtorMock: vi.fn(() => ({
    end: vi.fn(() => Promise.resolve(undefined)),
  })),
  loggerDebugMock: vi.fn(),
}));

vi.mock("pg", () => ({
  default: {
    Pool: PoolCtorMock,
  },
}));

vi.mock("../../../../../../src/shared/common/env.js", () => ({
  getEnvConfig: () => envConfig,
}));

vi.mock("../../../../../../src/shared/log/logger.js", () => ({
  logger: {
    debug: loggerDebugMock,
  },
}));

async function loadPoolModule() {
  return import("../../../../../../src/apps/hdb/db/core/pool.js");
}

describe("hdb db pool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    envConfig.HELPER_POSTGRES_DATABASE = "helper_db";
    envConfig.HELPER_POSTGRES_USERNAME = "helper_user";
    envConfig.HELPER_POSTGRES_PASSWORD = "helper_pw";
  });

  it("creates and memoizes the pool with expected config", async () => {
    const { getPool } = await loadPoolModule();
    const first = getPool();
    const second = getPool();

    expect(first).toBe(second);
    expect(PoolCtorMock).toHaveBeenCalledTimes(1);
    expect(PoolCtorMock).toHaveBeenCalledWith({
      max: 1,
      user: "helper_user",
      host: "localhost",
      database: "helper_db",
      password: "helper_pw",
    });
    expect(loggerDebugMock).toHaveBeenCalledWith("Postgres pool created.");
  });

  it("closes and clears memoized pool", async () => {
    const endMock = vi.fn(() => Promise.resolve(undefined));
    PoolCtorMock.mockImplementationOnce(() => ({ end: endMock }));
    const { getPool, endPool } = await loadPoolModule();

    getPool();
    await endPool();

    expect(endMock).toHaveBeenCalledTimes(1);
    expect(loggerDebugMock).toHaveBeenCalledWith("Postgres pool closed.");

    getPool();
    expect(PoolCtorMock).toHaveBeenCalledTimes(2);
  });

  it("no-ops endPool when pool was never created", async () => {
    const { endPool } = await loadPoolModule();
    await expect(endPool()).resolves.toBeUndefined();
    expect(loggerDebugMock).not.toHaveBeenCalledWith("Postgres pool closed.");
  });

  it("throws at import when required env vars are missing", async () => {
    envConfig.HELPER_POSTGRES_DATABASE = "";
    await expect(loadPoolModule()).rejects.toThrow("Environment is missing HELPER_POSTGRES_DATABASE");

    vi.resetModules();
    envConfig.HELPER_POSTGRES_DATABASE = "helper_db";
    envConfig.HELPER_POSTGRES_USERNAME = "";
    await expect(loadPoolModule()).rejects.toThrow("Environment is missing HELPER_POSTGRES_USERNAME");

    vi.resetModules();
    envConfig.HELPER_POSTGRES_USERNAME = "helper_user";
    envConfig.HELPER_POSTGRES_PASSWORD = "";
    await expect(loadPoolModule()).rejects.toThrow("Environment is missing HELPER_POSTGRES_PASSWORD");
  });
});
