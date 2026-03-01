import http from "node:http";
import https from "node:https";
import { describe, expect, it } from "vitest";

describe("no-network test guard", () => {
  it("blocks http and https request APIs", () => {
    expect(() => http.request("http://example.com")).toThrow("[test-network-block]");
    expect(() => http.get("http://example.com")).toThrow("[test-network-block]");
    expect(() => https.request("https://example.com")).toThrow("[test-network-block]");
    expect(() => https.get("https://example.com")).toThrow("[test-network-block]");
  });

  it("blocks fetch", () => {
    expect(() => fetch("https://example.com")).toThrow("[test-network-block]");
  });
});
