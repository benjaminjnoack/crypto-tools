import { getSignedConfig, requestWithSchema } from "../../src/shared/coinbase/http/http-client.js";
import { requestAccounts } from "../../src/shared/coinbase/rest.js";
import { OrdersHistoricalBatchResponseSchema } from "../../src/shared/coinbase/schemas/coinbase-rest-schemas.js";
import { describe, expect, it } from "vitest";

const shouldRunReadonlyIntegration =
  process.env.CI_INTEGRATION_READONLY === "true" && process.env.HELPER_ALLOW_LIVE_EXCHANGE === "true";

const describeReadonlyIntegration = shouldRunReadonlyIntegration ? describe : describe.skip;

describeReadonlyIntegration("coinbase readonly integration: orders and accounts", () => {
  it("lists one page of orders", async () => {
    const limit = 25;
    const query = new URLSearchParams({
      order_status: "OPEN",
      limit: String(limit),
    }).toString();

    const config = await getSignedConfig("GET", "/api/v3/brokerage/orders/historical/batch", `?${query}`);
    const response = await requestWithSchema(config, OrdersHistoricalBatchResponseSchema);

    expect(Array.isArray(response.orders)).toBe(true);
    expect(response.orders.length).toBeLessThanOrEqual(limit);
  });

  it("fetches account list", async () => {
    const accounts = await requestAccounts();

    expect(Array.isArray(accounts)).toBe(true);
    if (accounts.length > 0) {
      const first = accounts[0];
      expect(first?.currency.length).toBeGreaterThan(0);
      expect(first?.available_balance.value).toMatch(/^\d+(\.\d+)?$/);
      expect(first?.hold.value).toMatch(/^\d+(\.\d+)?$/);
    }
  });
});
