import { afterEach, describe, expect, it, vi } from "vitest";

import { delay } from "../../../../src/shared/common/delay.js";

describe("shared common delay", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after the provided timeout without real waiting", async () => {
    vi.useFakeTimers();

    let resolved = false;
    const promise = delay(250).then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(249);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(resolved).toBe(true);
  });

  it("uses a 1000ms default timeout", async () => {
    vi.useFakeTimers();

    let resolved = false;
    const promise = delay().then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(resolved).toBe(true);
  });
});
