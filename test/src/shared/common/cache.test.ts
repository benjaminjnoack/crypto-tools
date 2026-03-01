import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  envPathsMock,
  existsSyncMock,
  readFileSyncMock,
  writeFileSyncMock,
  mkdirSyncMock,
  loggerDebugMock,
} = vi.hoisted(() => ({
  envPathsMock: vi.fn(() => ({ cache: "/tmp/helper-cache" })),
  existsSyncMock: vi.fn<(path: string) => boolean>(() => false),
  readFileSyncMock: vi.fn<(path: string, encoding: string) => string>(() => "{}"),
  writeFileSyncMock: vi.fn<(path: string, data: string) => void>(() => undefined),
  mkdirSyncMock: vi.fn<(path: string, options?: { recursive?: boolean }) => void>(() => undefined),
  loggerDebugMock: vi.fn(),
}));

vi.mock("env-paths", () => ({
  default: envPathsMock,
}));

vi.mock("node:fs", () => ({
  existsSync: existsSyncMock,
  readFileSync: readFileSyncMock,
  writeFileSync: writeFileSyncMock,
  mkdirSync: mkdirSyncMock,
}));

vi.mock("../../../../src/shared/log/logger.js", () => ({
  logger: {
    debug: loggerDebugMock,
  },
}));

import { cacheDir, loadJsonFromCache, saveJsonToCache } from "../../../../src/shared/common/cache.js";

describe("shared common cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes cacheDir from env-paths and ensures directory exists", () => {
    expect(cacheDir).toBe("/tmp/helper-cache");
  });

  it("loads and parses cached JSON on cache hit", () => {
    existsSyncMock.mockReturnValueOnce(true);
    readFileSyncMock.mockReturnValueOnce('{"foo":"bar"}');

    const result = loadJsonFromCache("/tmp/helper-cache/data.json");

    expect(result).toEqual({ foo: "bar" });
    expect(readFileSyncMock).toHaveBeenCalledWith("/tmp/helper-cache/data.json", "utf8");
    expect(loggerDebugMock).toHaveBeenCalledWith("Cache hit for /tmp/helper-cache/data.json");
  });

  it("returns null on cache miss", () => {
    existsSyncMock.mockReturnValueOnce(false);

    const result = loadJsonFromCache("/tmp/helper-cache/missing.json");

    expect(result).toBeNull();
    expect(readFileSyncMock).not.toHaveBeenCalled();
    expect(loggerDebugMock).toHaveBeenCalledWith("Cache miss for /tmp/helper-cache/missing.json");
  });

  it("saves JSON with parent directory creation", () => {
    saveJsonToCache("/tmp/helper-cache/nested/data.json", { value: 123 });

    expect(mkdirSyncMock).toHaveBeenCalledWith("/tmp/helper-cache/nested", { recursive: true });
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      "/tmp/helper-cache/nested/data.json",
      JSON.stringify({ value: 123 }, null, 2),
    );
    expect(loggerDebugMock).toHaveBeenCalledWith("Cache saved for /tmp/helper-cache/nested/data.json");
  });
});
