import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const {
  handleCancelActionMock,
  handleModifyActionMock,
  handleOrderActionMock,
  handleOrdersActionMock,
} = vi.hoisted(() => ({
  handleCancelActionMock: vi.fn(() => Promise.resolve(undefined)),
  handleModifyActionMock: vi.fn(() => Promise.resolve(undefined)),
  handleOrderActionMock: vi.fn(() => Promise.resolve(undefined)),
  handleOrdersActionMock: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock("../../../../../../src/apps/cb/commands/order-handlers.js", () => ({
  handleCancelAction: handleCancelActionMock,
  handleModifyAction: handleModifyActionMock,
  handleOrderAction: handleOrderActionMock,
  handleOrdersAction: handleOrdersActionMock,
}));

import { registerOrderCommands } from "../../../../../../src/apps/cb/commands/register/register-orders.js";

const VALID_UUID = "123e4567-e89b-42d3-a456-426614174000";

async function run(argv: string[]) {
  const program = new Command();
  program.exitOverride();
  registerOrderCommands(program);
  await program.parseAsync(argv, { from: "user" });
}

describe("order command topology", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("supports nested order get/list/cancel/modify commands", async () => {
    await run(["order", "get", VALID_UUID]);
    await run(["order", "list"]);
    await run(["order", "cancel", VALID_UUID]);
    await run(["order", "modify", VALID_UUID, "--limitPrice", "101.50"]);

    expect(handleOrderActionMock).toHaveBeenCalledWith(VALID_UUID);
    expect(handleOrdersActionMock).toHaveBeenCalledWith(null);
    expect(handleCancelActionMock).toHaveBeenCalledWith(VALID_UUID);
    expect(handleModifyActionMock).toHaveBeenCalledWith(VALID_UUID, { limitPrice: "101.50" });
  });

  it("rejects legacy alias forms", async () => {
    await expect(run(["order", VALID_UUID])).rejects.toThrow();
    await expect(run(["orders"])).rejects.toThrow();
    await expect(run(["open"])).rejects.toThrow();
    await expect(run(["cancel", VALID_UUID])).rejects.toThrow();
    await expect(run(["modify", VALID_UUID, "--baseSize", "1.25"])).rejects.toThrow();

    expect(handleOrderActionMock).not.toHaveBeenCalled();
    expect(handleOrdersActionMock).not.toHaveBeenCalled();
    expect(handleCancelActionMock).not.toHaveBeenCalled();
    expect(handleModifyActionMock).not.toHaveBeenCalled();
  });
});
