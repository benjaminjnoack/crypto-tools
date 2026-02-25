import http from "node:http";
import https from "node:https";
import { afterAll } from "vitest";

type RequestModule = {
  request: typeof http.request;
  get: typeof http.get;
};

function describeTarget(input: unknown, fallbackProtocol: "http" | "https" | "fetch"): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  if (typeof input === "object" && input !== null) {
    const maybe = input as {
      protocol?: unknown;
      hostname?: unknown;
      host?: unknown;
      port?: unknown;
      path?: unknown;
    };
    const protocol =
      typeof maybe.protocol === "string" && maybe.protocol.length > 0
        ? maybe.protocol
        : `${fallbackProtocol}:`;
    const host =
      typeof maybe.host === "string"
        ? maybe.host
        : typeof maybe.hostname === "string"
          ? maybe.hostname
          : "unknown-host";
    const path = typeof maybe.path === "string" ? maybe.path : "";
    const port = typeof maybe.port === "number" || typeof maybe.port === "string" ? `:${maybe.port}` : "";
    return `${protocol}//${host}${port}${path}`;
  }
  return `${fallbackProtocol}://unknown-target`;
}

function throwNetworkError(method: string, target: string): never {
  throw new Error(
    `[test-network-block] Outbound ${method} request blocked in tests: ${target}. ` +
      "Mock network interactions explicitly.",
  );
}

function patchRequestModule(moduleRef: RequestModule, protocol: "http" | "https") {
  const originalRequest = moduleRef.request;
  const originalGet = moduleRef.get;

  moduleRef.request = ((...args: Parameters<typeof http.request>) => {
    const target = describeTarget(args[0], protocol);
    return throwNetworkError(`${protocol.toUpperCase()} request`, target);
  }) as typeof http.request;

  moduleRef.get = ((...args: Parameters<typeof http.get>) => {
    const target = describeTarget(args[0], protocol);
    return throwNetworkError(`${protocol.toUpperCase()} GET`, target);
  }) as typeof http.get;

  return () => {
    moduleRef.request = originalRequest;
    moduleRef.get = originalGet;
  };
}

const restoreHttp = patchRequestModule(http as RequestModule, "http");
const restoreHttps = patchRequestModule(https as RequestModule, "https");

const originalFetch = globalThis.fetch;
if (typeof originalFetch === "function") {
  globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
    const target = describeTarget(args[0], "fetch");
    return throwNetworkError("fetch", target);
  }) as typeof fetch;
}

afterAll(() => {
  restoreHttp();
  restoreHttps();
  if (typeof originalFetch === "function") {
    globalThis.fetch = originalFetch;
  }
});
