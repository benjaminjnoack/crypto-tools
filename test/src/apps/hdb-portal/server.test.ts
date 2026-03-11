import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCoinbaseBalanceTraceMock,
  getCoinbaseBalancesMock,
  getCoinbaseLotsComparisonMock,
  getCoinbaseLotsMock,
  getCoinbaseTransactionGroupsMock,
  getCoinbaseTransactionsMock,
  getCointrackerGainsGroupsMock,
  getCointrackerGainsMock,
  getDashboardSummaryMock,
  getPortalHealthSummaryMock,
} = vi.hoisted(() => ({
  getCoinbaseBalanceTraceMock: vi.fn(),
  getCoinbaseBalancesMock: vi.fn(),
  getCoinbaseLotsComparisonMock: vi.fn(),
  getCoinbaseLotsMock: vi.fn(),
  getCoinbaseTransactionGroupsMock: vi.fn(),
  getCoinbaseTransactionsMock: vi.fn(),
  getCointrackerGainsGroupsMock: vi.fn(),
  getCointrackerGainsMock: vi.fn(),
  getDashboardSummaryMock: vi.fn(),
  getPortalHealthSummaryMock: vi.fn(),
}));

vi.mock("../../../../src/apps/hdb-portal/service/portal-data-service.js", () => ({
  getCoinbaseBalanceTrace: getCoinbaseBalanceTraceMock,
  getCoinbaseBalances: getCoinbaseBalancesMock,
  getCoinbaseLots: getCoinbaseLotsMock,
  getCoinbaseLotsComparison: getCoinbaseLotsComparisonMock,
  getCoinbaseTransactionGroups: getCoinbaseTransactionGroupsMock,
  getCoinbaseTransactions: getCoinbaseTransactionsMock,
  getCointrackerGains: getCointrackerGainsMock,
  getCointrackerGainsGroups: getCointrackerGainsGroupsMock,
  getDashboardSummary: getDashboardSummaryMock,
  getPortalHealthSummary: getPortalHealthSummaryMock,
}));

import {
  routePortalRequest,
  synthesizeHdbCommandForPortalRequest,
} from "../../../../src/apps/hdb-portal/server.js";

describe("hdb portal routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns health summary JSON", async () => {
    getPortalHealthSummaryMock.mockResolvedValueOnce({ databaseTime: "2026-03-09T00:00:00.000Z", tableCounts: {} });

    const response = await routePortalRequest("GET", "/api/health");

    expect(response.status).toBe(200);
    expect(response.type).toBe("json");
    expect(getPortalHealthSummaryMock).toHaveBeenCalledTimes(1);
  });

  it("validates required lot asset params", async () => {
    const response = await routePortalRequest("GET", "/api/coinbase/lots");

    expect(response.status).toBe(400);
    expect(response.type).toBe("json");
    if (response.type === "json") {
      expect(response.body).toEqual({ error: "Missing required query param: asset" });
    }
  });

  it("maps transaction filters to the service layer", async () => {
    getCoinbaseTransactionsMock.mockResolvedValueOnce([]);

    await routePortalRequest(
      "GET",
      "/api/coinbase/transactions?asset=btc:eth&classifier=trade_buy&manual=true&includeBalances=true&paired=true&from=2026-01-01&to=2026-02-01",
    );

    expect(getCoinbaseTransactionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        assets: ["BTC", "ETH"],
        types: ["Advanced Trade Buy", "Buy"],
        selectManual: true,
      }),
      { includeBalances: true, paired: true },
    );
  });

  it("maps gains group filters to the service layer", async () => {
    getCointrackerGainsGroupsMock.mockResolvedValueOnce({ rows: [], totals: {} });

    await routePortalRequest(
      "GET",
      "/api/cointracker/gains/group?assets=btc&crypto=true&zero=true&type=short&from=2026-01-01&to=2026-02-01",
    );

    expect(getCointrackerGainsGroupsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        assets: ["BTC"],
        excluding: ["USD", "USDC"],
        filterZero: true,
        type: "short",
      }),
      false,
    );
  });

  it("rejects non-get methods", async () => {
    const response = await routePortalRequest("POST", "/api/health");
    expect(response.status).toBe(405);
  });
});

describe("hdb portal command synthesis", () => {
  it("maps coinbase transactions request to hdb list command", () => {
    const command = synthesizeHdbCommandForPortalRequest(
      "/api/coinbase/transactions?asset=btc:eth&classifier=trade_buy&manual=true&excludeManual=true&includeBalances=true&paired=true&from=2026-01-01&to=2026-02-01",
    );

    expect(command).toBe(
      "hdb coinbase transactions list btc:eth --from 2026-01-01 --to 2026-02-01 --classifier trade_buy --manual --exclude-manual --balance --paired",
    );
  });

  it("maps cointracker grouped gains request to hdb summary command", () => {
    const command = synthesizeHdbCommandForPortalRequest(
      "/api/cointracker/gains/group?assets=btc:eth&crypto=true&zero=true&gains=true&type=short&from=2026-01-01&to=2026-02-01",
    );

    expect(command).toBe(
      "hdb cointracker gains summary btc:eth --from 2026-01-01 --to 2026-02-01 --crypto --zero --gains --type short",
    );
  });

  it("maps health to hdb health", () => {
    const command = synthesizeHdbCommandForPortalRequest("/api/health");
    expect(command).toBe("hdb health");
  });
});
