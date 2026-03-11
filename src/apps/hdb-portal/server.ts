import fs from "node:fs/promises";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { endClient } from "../hdb/db/db-client.js";
import type { CoinbaseTransactionFilters } from "../hdb/db/coinbase/transactions/coinbase-transactions-sql.js";
import type {
  CointrackerCapitalGainsFilters,
  CointrackerCapitalGainsGroupFilters,
} from "../hdb/db/cointracker/capital-gains/cointracker-capital-gains-sql.js";
import { getTypesForClassifier } from "../hdb/commands/coinbase/transactions/coinbase-transaction-classifiers.js";
import {
  getCoinbaseBalances,
  getCoinbaseBalanceTrace,
  getCoinbaseLots,
  getCoinbaseLotsComparison,
  getCoinbaseTransactionGroups,
  getCoinbaseTransactions,
  getCointrackerGains,
  getCointrackerGainsGroups,
  getDashboardSummary,
  getPortalHealthSummary,
} from "./service/portal-data-service.js";
import {
  normalizeList,
  normalizeUppercaseList,
  parseBooleanParam,
  parseDateParam,
  parseDateRange,
  parseEnumParam,
} from "./service/portal-query.js";

type JsonResponse = {
  body: unknown;
  headers?: Record<string, string>;
  status: number;
  type: "json";
};

type StaticResponse = {
  body: Buffer | string;
  headers?: Record<string, string>;
  status: number;
  type: "static";
};

type PortalResponse = JsonResponse | StaticResponse;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");

const STATIC_CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function jsonResponse(status: number, body: unknown): JsonResponse {
  return {
    status,
    type: "json",
    body,
    headers: {
      "Cache-Control": "no-store",
    },
  };
}

function resolveSelectToggle(enabled?: boolean, excluded?: boolean): boolean | null {
  if (enabled) {
    return true;
  }
  if (excluded) {
    return false;
  }
  return null;
}

function buildCoinbaseTransactionFilters(params: URLSearchParams): CoinbaseTransactionFilters {
  const { from, to } = parseDateRange(params);
  const classifier = params.get("classifier");
  const notClassifier = params.get("notClassifier");

  return {
    from,
    to,
    assets: normalizeUppercaseList(params.get("asset")),
    excluded: normalizeUppercaseList(params.get("exclude")),
    types: classifier ? getTypesForClassifier(classifier) : normalizeList(params.get("type")),
    notTypes: notClassifier ? getTypesForClassifier(notClassifier) : [],
    selectManual: resolveSelectToggle(
      parseBooleanParam(params.get("manual")),
      parseBooleanParam(params.get("excludeManual")),
    ),
    selectSynthetic: resolveSelectToggle(
      parseBooleanParam(params.get("synthetic")),
      parseBooleanParam(params.get("excludeSynthetic")),
    ),
  };
}

function buildCointrackerGainsFilters(params: URLSearchParams): CointrackerCapitalGainsFilters {
  const { from, to } = parseDateRange(params);
  const assets = normalizeUppercaseList(params.get("assets"));
  const excluding = normalizeUppercaseList(params.get("exclude"));
  const cash = parseBooleanParam(params.get("cash"));
  const crypto = parseBooleanParam(params.get("crypto"));
  const received = parseDateParam(params.get("received"), "received");
  const sent = parseDateParam(params.get("sent"), "sent");

  if (cash) {
    assets.push("USD", "USDC");
  } else if (crypto) {
    excluding.push("USD", "USDC");
  }

  const filters: CointrackerCapitalGainsFilters = {
    assets: [...new Set(assets)],
    excluding: [...new Set(excluding)],
    from,
    to,
    filterZero: Boolean(parseBooleanParam(params.get("zero"))),
  };

  if (received) {
    filters.received = received;
  }
  if (sent) {
    filters.sent = sent;
  }

  return filters;
}

function buildCointrackerGainsGroupFilters(params: URLSearchParams): CointrackerCapitalGainsGroupFilters {
  const filters: CointrackerCapitalGainsGroupFilters = {
    ...buildCointrackerGainsFilters(params),
    filterBleeders: Boolean(parseBooleanParam(params.get("bleeders"))),
  };
  const type = parseEnumParam(params.get("type"), ["short", "long"] as const, "type");
  if (type) {
    filters.type = type;
  }
  return filters;
}

async function loadStaticFile(pathname: string): Promise<StaticResponse> {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const relativePath = requested.replace(/^\/+/, "");
  const resolvedPath = path.join(PUBLIC_DIR, relativePath);

  if (!resolvedPath.startsWith(PUBLIC_DIR)) {
    return { status: 403, type: "static", body: "Forbidden" };
  }

  const content = await fs.readFile(resolvedPath);
  const ext = path.extname(resolvedPath);
  const contentType = STATIC_CONTENT_TYPES[ext] ?? "application/octet-stream";

  return {
    status: 200,
    type: "static",
    body: content,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  };
}

export async function routePortalRequest(method: string, urlString: string): Promise<PortalResponse> {
  const url = new URL(urlString, "http://localhost");
  const { pathname, searchParams } = url;

  if (method !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    if (pathname === "/api/health") {
      return jsonResponse(200, await getPortalHealthSummary());
    }

    if (pathname === "/api/dashboard/summary") {
      const { from, to } = parseDateRange(searchParams);
      return jsonResponse(200, await getDashboardSummary(from, to));
    }

    if (pathname === "/api/coinbase/balances") {
      const currentSnapshot = parseBooleanParam(searchParams.get("currentSnapshot")) ?? true;
      const to = parseDateParam(searchParams.get("to"), "to") ?? new Date();
      const from = currentSnapshot ? undefined : (parseDateParam(searchParams.get("from"), "from") ?? undefined);
      const assets = normalizeUppercaseList(searchParams.get("asset"));
      const filters = from
        ? { assets, from, to, currentSnapshot }
        : { assets, to, currentSnapshot };
      return jsonResponse(200, await getCoinbaseBalances(filters));
    }

    if (pathname === "/api/coinbase/balances/trace") {
      const asset = searchParams.get("asset");
      if (!asset) {
        return jsonResponse(400, { error: "Missing required query param: asset" });
      }
      const to = parseDateParam(searchParams.get("to"), "to") ?? new Date();
      return jsonResponse(200, await getCoinbaseBalanceTrace(asset, to));
    }

    if (pathname === "/api/coinbase/transactions") {
      const filters = buildCoinbaseTransactionFilters(searchParams);
      const includeBalances = parseBooleanParam(searchParams.get("includeBalances")) ?? false;
      const paired = parseBooleanParam(searchParams.get("paired")) ?? false;
      return jsonResponse(200, await getCoinbaseTransactions(filters, { includeBalances, paired }));
    }

    if (pathname === "/api/coinbase/transactions/group") {
      const filters = buildCoinbaseTransactionFilters(searchParams);
      const interval = parseEnumParam(
        searchParams.get("interval"),
        ["day", "week", "month", "quarter", "year"] as const,
        "interval",
      );
      return jsonResponse(200, await getCoinbaseTransactionGroups(filters, interval));
    }

    if (pathname === "/api/coinbase/lots") {
      const asset = searchParams.get("asset");
      if (!asset) {
        return jsonResponse(400, { error: "Missing required query param: asset" });
      }
      const { from, to } = parseDateRange(searchParams);
      const accounting = parseEnumParam(
        searchParams.get("accounting"),
        ["FIFO", "LIFO", "HIFO"] as const,
        "accounting",
      ) ?? "FIFO";
      return jsonResponse(200, await getCoinbaseLots(asset, from, to, accounting));
    }

    if (pathname === "/api/coinbase/lots/compare") {
      const asset = searchParams.get("asset");
      if (!asset) {
        return jsonResponse(400, { error: "Missing required query param: asset" });
      }
      const { from, to } = parseDateRange(searchParams);
      return jsonResponse(200, await getCoinbaseLotsComparison(asset, from, to));
    }

    if (pathname === "/api/cointracker/gains") {
      const filters = buildCointrackerGainsFilters(searchParams);
      const orderByGains = parseBooleanParam(searchParams.get("gains")) ?? false;
      return jsonResponse(200, await getCointrackerGains(filters, orderByGains));
    }

    if (pathname === "/api/cointracker/gains/group") {
      const filters = buildCointrackerGainsGroupFilters(searchParams);
      const orderByGains = parseBooleanParam(searchParams.get("gains")) ?? false;
      return jsonResponse(200, await getCointrackerGainsGroups(filters, orderByGains));
    }

    return await loadStaticFile(pathname);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return jsonResponse(404, { error: "Not found" });
    }

    return jsonResponse(400, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

function writePortalResponse(res: ServerResponse, response: PortalResponse): void {
  if (response.type === "json") {
    const body = JSON.stringify(response.body);
    res.writeHead(response.status, {
      "Content-Type": "application/json; charset=utf-8",
      ...response.headers,
    });
    res.end(body);
    return;
  }

  res.writeHead(response.status, response.headers);
  res.end(response.body);
}

function quoteShellArg(value: string): string {
  if (/^[a-zA-Z0-9_./:@-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function maybeAppendValueFlag(parts: string[], flag: string, value: string | null): void {
  if (value && value.length > 0) {
    parts.push(flag, quoteShellArg(value));
  }
}

function maybeAppendPositional(parts: string[], value: string | null): void {
  if (value && value.length > 0) {
    parts.push(quoteShellArg(value));
  }
}

function maybeAppendBooleanFlag(parts: string[], flag: string, value: string | null): void {
  if (value === "true") {
    parts.push(flag);
  }
}

function buildDateFlags(params: URLSearchParams): string[] {
  const flags: string[] = [];
  maybeAppendValueFlag(flags, "--from", params.get("from"));
  maybeAppendValueFlag(flags, "--to", params.get("to"));
  return flags;
}

function buildCoinbaseTransactionFlags(params: URLSearchParams): string[] {
  const flags = buildDateFlags(params);
  maybeAppendValueFlag(flags, "--classifier", params.get("classifier"));
  maybeAppendValueFlag(flags, "--not-classifier", params.get("notClassifier"));
  maybeAppendBooleanFlag(flags, "--manual", params.get("manual"));
  maybeAppendBooleanFlag(flags, "--exclude-manual", params.get("excludeManual"));
  maybeAppendBooleanFlag(flags, "--synthetic", params.get("synthetic"));
  maybeAppendBooleanFlag(flags, "--exclude-synthetic", params.get("excludeSynthetic"));
  maybeAppendValueFlag(flags, "--type", params.get("type"));
  maybeAppendValueFlag(flags, "--exclude", params.get("exclude"));
  return flags;
}

function synthesizePortalCommand(pathname: string, params: URLSearchParams): string | null {
  if (pathname === "/api/health") {
    return "hdb health";
  }

  if (pathname === "/api/dashboard/summary") {
    const dateFlags = buildDateFlags(params).join(" ");
    const balances = ["hdb", "coinbase", "balances", "snapshot"];
    maybeAppendValueFlag(balances, "--to", params.get("to"));
    const txSummary = ["hdb", "coinbase", "transactions", "summary", "--interval", "month"];
    txSummary.push(...buildDateFlags(params));
    const lotsSummary = ["hdb", "coinbase", "lots", "analyze-all", "--accounting", "FIFO", "--totals"];
    lotsSummary.push(...buildDateFlags(params));
    const gainsSummary = ["hdb", "cointracker", "gains", "summary", "--gains"];
    gainsSummary.push(...buildDateFlags(params));

    return [
      `# hdb dashboard equivalent (${dateFlags || "default date range"})`,
      `  ${balances.join(" ")}`,
      `  ${txSummary.join(" ")}`,
      `  ${lotsSummary.join(" ")}`,
      `  ${gainsSummary.join(" ")}`,
    ].join("\n");
  }

  if (pathname === "/api/coinbase/balances") {
    const currentSnapshot = params.get("currentSnapshot");
    const asset = params.get("asset");
    const isSnapshot = currentSnapshot === null || currentSnapshot === "true";

    if (isSnapshot) {
      const parts = ["hdb", "coinbase", "balances", "snapshot"];
      maybeAppendValueFlag(parts, "--to", params.get("to"));
      const command = parts.join(" ");
      if (asset) {
        return `${command}  # snapshot command has no asset selector; UI asset filter=${asset}`;
      }
      return command;
    }

    const parts = ["hdb", "coinbase", "balances", "list"];
    if (asset) {
      parts.push(quoteShellArg(asset));
    } else {
      parts.push("<asset>");
    }
    parts.push(...buildDateFlags(params));
    return asset
      ? parts.join(" ")
      : `${parts.join(" ")}  # UI request omitted asset; CLI requires one`;
  }

  if (pathname === "/api/coinbase/balances/trace") {
    const asset = params.get("asset");
    if (!asset) {
      return "hdb coinbase balances trace <asset>";
    }

    const parts = ["hdb", "coinbase", "balances", "trace", quoteShellArg(asset)];
    maybeAppendValueFlag(parts, "--to", params.get("to"));
    return parts.join(" ");
  }

  if (pathname === "/api/coinbase/transactions") {
    const parts = ["hdb", "coinbase", "transactions", "list"];
    maybeAppendPositional(parts, params.get("asset"));
    parts.push(...buildCoinbaseTransactionFlags(params));
    maybeAppendBooleanFlag(parts, "--balance", params.get("includeBalances"));
    maybeAppendBooleanFlag(parts, "--paired", params.get("paired"));
    return parts.join(" ");
  }

  if (pathname === "/api/coinbase/transactions/group") {
    const parts = ["hdb", "coinbase", "transactions", "summary"];
    maybeAppendPositional(parts, params.get("asset"));
    parts.push(...buildCoinbaseTransactionFlags(params));
    maybeAppendValueFlag(parts, "--interval", params.get("interval"));
    return parts.join(" ");
  }

  if (pathname === "/api/coinbase/lots") {
    const asset = params.get("asset");
    const parts = ["hdb", "coinbase", "lots", "analyze", asset ? quoteShellArg(asset) : "<asset>"];
    parts.push(...buildDateFlags(params));
    maybeAppendValueFlag(parts, "--accounting", params.get("accounting"));
    return parts.join(" ");
  }

  if (pathname === "/api/coinbase/lots/compare") {
    const asset = params.get("asset");
    const parts = ["hdb", "coinbase", "lots", "compare", asset ? quoteShellArg(asset) : "<asset>"];
    parts.push(...buildDateFlags(params));
    return parts.join(" ");
  }

  if (pathname === "/api/cointracker/gains") {
    const parts = ["hdb", "cointracker", "gains", "list"];
    maybeAppendPositional(parts, params.get("assets"));
    parts.push(...buildDateFlags(params));
    maybeAppendBooleanFlag(parts, "--cash", params.get("cash"));
    maybeAppendBooleanFlag(parts, "--crypto", params.get("crypto"));
    maybeAppendValueFlag(parts, "--received", params.get("received"));
    maybeAppendValueFlag(parts, "--sent", params.get("sent"));
    maybeAppendValueFlag(parts, "--exclude", params.get("exclude"));
    maybeAppendBooleanFlag(parts, "--zero", params.get("zero"));
    maybeAppendBooleanFlag(parts, "--gains", params.get("gains"));
    return parts.join(" ");
  }

  if (pathname === "/api/cointracker/gains/group") {
    const parts = ["hdb", "cointracker", "gains", "summary"];
    maybeAppendPositional(parts, params.get("assets"));
    parts.push(...buildDateFlags(params));
    maybeAppendBooleanFlag(parts, "--bleeders", params.get("bleeders"));
    maybeAppendBooleanFlag(parts, "--cash", params.get("cash"));
    maybeAppendBooleanFlag(parts, "--crypto", params.get("crypto"));
    maybeAppendValueFlag(parts, "--received", params.get("received"));
    maybeAppendValueFlag(parts, "--sent", params.get("sent"));
    maybeAppendValueFlag(parts, "--exclude", params.get("exclude"));
    maybeAppendBooleanFlag(parts, "--zero", params.get("zero"));
    maybeAppendBooleanFlag(parts, "--gains", params.get("gains"));
    maybeAppendValueFlag(parts, "--type", params.get("type"));
    return parts.join(" ");
  }

  return null;
}

export function synthesizeHdbCommandForPortalRequest(urlString: string): string | null {
  try {
    const url = new URL(urlString, "http://localhost");
    return synthesizePortalCommand(url.pathname, url.searchParams);
  } catch {
    return null;
  }
}

function formatRequestUrlForLog(urlString: string): string {
  try {
    const url = new URL(urlString, "http://localhost");
    const entries = Array.from(url.searchParams.entries());
    if (entries.length === 0) {
      return url.pathname;
    }

    const renderedParams = entries.map(([key, value]) => `  ${key}: ${value}`).join("\n");
    return `${url.pathname}\n${renderedParams}`;
  } catch {
    return urlString;
  }
}

export function createPortalServer() {
  return http.createServer((req: IncomingMessage, res: ServerResponse) => {
    const method = req.method ?? "GET";
    const url = req.url ?? "/";
    console.log(`[hdb-portal] ${method} ${formatRequestUrlForLog(url)}`);
    const command = method === "GET" ? synthesizeHdbCommandForPortalRequest(url) : null;
    if (command) {
      console.log(`[hdb-portal] hdb equivalent:\n${command}`);
    }
    void routePortalRequest(method, url)
      .then((response) => {
        writePortalResponse(res, response);
      })
      .catch((error: unknown) => {
        writePortalResponse(res, jsonResponse(500, {
          error: error instanceof Error ? error.message : "Unknown error",
        }));
      });
  });
}

export async function startPortalServer(options?: { host?: string; port?: number }) {
  const host = options?.host ?? "127.0.0.1";
  const port = options?.port ?? 43110;
  const server = createPortalServer();

  await new Promise<void>((resolve) => {
    server.listen(port, host, resolve);
  });

  const shutdown = async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    await endClient();
  };

  return { host, port, server, shutdown };
}
