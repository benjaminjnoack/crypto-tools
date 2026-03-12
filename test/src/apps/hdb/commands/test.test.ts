import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClientMock, loggerInfoMock } = vi.hoisted(() => ({
  getClientMock: vi.fn(),
  loggerInfoMock: vi.fn(),
}));

vi.mock("../../../../../src/apps/hdb/db/db-client.js", () => ({
  getClient: getClientMock,
}));

vi.mock("../../../../../src/shared/log/logger.js", () => ({
  logger: {
    info: loggerInfoMock,
  },
}));

import { handleTestAction } from "../../../../../src/apps/hdb/commands/test.js";

describe("hdb test command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs an ISO string when the query returns a Date", async () => {
    const queryMock = vi.fn(() => Promise.resolve({
      rows: [{ now: new Date("2026-01-01T00:00:00.000Z") }],
    }));
    getClientMock.mockResolvedValue({ query: queryMock });

    await handleTestAction();

    expect(queryMock).toHaveBeenCalledWith("SELECT NOW() AS now");
    expect(loggerInfoMock).toHaveBeenCalledWith("2026-01-01T00:00:00.000Z");
  });

  it("logs the raw string when the query returns a string timestamp", async () => {
    getClientMock.mockResolvedValue({
      query: vi.fn(() => Promise.resolve({ rows: [{ now: "2026-01-01 00:00:00+00" }] })),
    });

    await handleTestAction();

    expect(loggerInfoMock).toHaveBeenCalledWith("2026-01-01 00:00:00+00");
  });
});
