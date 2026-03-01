import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPoolMock, endPoolMock } = vi.hoisted(() => ({
  getPoolMock: vi.fn(() => ({ query: vi.fn() })),
  endPoolMock: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock("../../../../../src/apps/hdb/db/core/pool.js", () => ({
  getPool: getPoolMock,
  endPool: endPoolMock,
}));

import { endClient, getClient } from "../../../../../src/apps/hdb/db/client.js";

describe("hdb db client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the pool via getClient", async () => {
    const pool = { query: vi.fn() };
    getPoolMock.mockReturnValueOnce(pool);

    await expect(getClient()).resolves.toBe(pool);
    expect(getPoolMock).toHaveBeenCalledTimes(1);
  });

  it("delegates endClient to endPool", async () => {
    await endClient();
    expect(endPoolMock).toHaveBeenCalledTimes(1);
  });
});
