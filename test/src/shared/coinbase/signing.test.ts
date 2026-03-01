import { beforeEach, describe, expect, it, vi } from "vitest";

const { jwtSignMock, getCredentialsMock } = vi.hoisted(() => ({
  jwtSignMock: vi.fn(() => "signed-token"),
  getCredentialsMock: vi.fn(() => Promise.resolve({
    name: "organizations/abc/apiKeys/key",
    privateKey: "PRIVATE_KEY_PEM",
  })),
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: jwtSignMock,
  },
}));

vi.mock("../../../../src/shared/coinbase/credentials.js", () => ({
  getCredentials: getCredentialsMock,
}));

async function loadModule() {
  return import("../../../../src/shared/coinbase/signing.js");
}

describe("coinbase signing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useRealTimers();
  });

  it("reports missing signing keys until loaded", async () => {
    const { hasSigningKeys } = await loadModule();
    expect(hasSigningKeys()).toBe(false);
  });

  it("throws when signing is attempted before keys are loaded", async () => {
    const { signUrl } = await loadModule();
    expect(() => signUrl("GET", "/api/v3/brokerage/accounts")).toThrow(
      "signUrl => missing credentials",
    );
  });

  it("loads keys from credentials and signs with expected payload/header", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T12:34:56.000Z"));
    const nowSec = Math.floor(new Date("2026-03-01T12:34:56.000Z").getTime() / 1000);

    const { getSigningKeys, hasSigningKeys, signUrl } = await loadModule();
    await getSigningKeys();

    expect(getCredentialsMock).toHaveBeenCalledTimes(1);
    expect(hasSigningKeys()).toBe(true);

    const token = signUrl("POST", "/api/v3/brokerage/orders");
    expect(token).toBe("signed-token");
    expect(jwtSignMock).toHaveBeenCalledWith(
      {
        iss: "cdp",
        nbf: nowSec,
        exp: nowSec + 120,
        sub: "organizations/abc/apiKeys/key",
        uri: "POST api.coinbase.com/api/v3/brokerage/orders",
      },
      "PRIVATE_KEY_PEM",
      {
        header: {
          alg: "ES256",
          kid: "organizations/abc/apiKeys/key",
        },
      },
    );
  });
});
