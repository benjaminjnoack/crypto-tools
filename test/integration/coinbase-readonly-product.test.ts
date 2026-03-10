import { requestProduct } from "../../src/shared/coinbase/rest.js";
import { describe, expect, it } from "vitest";

const shouldRunReadonlyIntegration =
  process.env.CI_INTEGRATION_READONLY === "true" && process.env.HELPER_ALLOW_LIVE_EXCHANGE === "true";

const describeReadonlyIntegration = shouldRunReadonlyIntegration ? describe : describe.skip;

describeReadonlyIntegration("coinbase readonly integration: product", () => {
  it("fetches BTC-USD product details via read-only GET path", async () => {
    const product = await requestProduct("BTC-USD");

    expect(product.product_id).toBe("BTC-USD");
    expect(product.product_type).toBe("SPOT");
    expect(product.price).toMatch(/^\d+(\.\d+)?$/);
    expect(product.base_increment).toMatch(/^\d+(\.\d+)?$/);
    expect(product.price_increment).toMatch(/^\d+(\.\d+)?$/);
  });
});
