import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  readFileMock,
  getEnvConfigMock,
  loggerDebugMock,
} = vi.hoisted(() => ({
  readFileMock: vi.fn<(path: string, encoding: string) => Promise<string>>(() => Promise.resolve("")),
  getEnvConfigMock: vi.fn<() => { HELPER_COINBASE_CREDENTIALS_PATH?: string }>(() => ({
    HELPER_COINBASE_CREDENTIALS_PATH: "/tmp/coinbase-credentials.json",
  })),
  loggerDebugMock: vi.fn(),
}));

vi.mock("node:fs", () => ({
  promises: {
    readFile: readFileMock,
  },
}));

vi.mock("../../../../src/shared/common/env.js", () => ({
  getEnvConfig: getEnvConfigMock,
}));

vi.mock("../../../../src/shared/log/logger.js", () => ({
  logger: {
    debug: loggerDebugMock,
  },
}));

async function loadModule() {
  return import("../../../../src/shared/coinbase/credentials.js");
}

describe("coinbase credentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("loads credentials from configured path and caches them in memory", async () => {
    readFileMock.mockResolvedValueOnce(JSON.stringify({
      name: "organizations/abc/apiKeys/key",
      privateKey: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
    }));

    const { getCredentials } = await loadModule();
    const first = await getCredentials();
    const second = await getCredentials();

    expect(first).toEqual(second);
    expect(readFileMock).toHaveBeenCalledTimes(1);
    expect(readFileMock).toHaveBeenCalledWith("/tmp/coinbase-credentials.json", "utf8");
    expect(loggerDebugMock).toHaveBeenCalledWith(
      "loading credentials from /tmp/coinbase-credentials.json",
    );
  });

  it("throws when credentials file is empty", async () => {
    readFileMock.mockResolvedValueOnce("");
    const { getCredentials } = await loadModule();

    await expect(getCredentials()).rejects.toThrow("Cannot load credentials.");
  });

  it("throws when credentials path is missing from environment", async () => {
    getEnvConfigMock.mockReturnValueOnce({});
    const { getCredentials } = await loadModule();

    await expect(getCredentials()).rejects.toThrow("Missing HELPER_COINBASE_CREDENTIALS_PATH in environment.");
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("throws when credentials JSON fails schema validation", async () => {
    readFileMock.mockResolvedValueOnce(JSON.stringify({ name: "only-name" }));
    const { getCredentials } = await loadModule();

    await expect(getCredentials()).rejects.toThrow();
  });
});
