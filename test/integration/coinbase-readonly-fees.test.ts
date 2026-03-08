import { requestTransactionSummary } from "#shared/coinbase/rest";
import { describe, expect, it } from "vitest";

const shouldRunReadonlyIntegration =
  process.env.CI_INTEGRATION_READONLY === "true" && process.env.HELPER_ALLOW_LIVE_EXCHANGE === "true";

const describeReadonlyIntegration = shouldRunReadonlyIntegration ? describe : describe.skip;

describeReadonlyIntegration("coinbase readonly integration: fees", () => {
  it("fetches transaction summary via read-only GET path", async () => {
    const summary = await requestTransactionSummary("SPOT");

    expect(summary.fee_tier.pricing_tier.length).toBeGreaterThan(0);
    expect(summary.fee_tier.taker_fee_rate).toMatch(/^\d+(\.\d+)?$/);
    expect(summary.fee_tier.maker_fee_rate).toMatch(/^\d+(\.\d+)?$/);

    expect(Number.isFinite(summary.total_fees)).toBe(true);
    expect(summary.total_fees).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(summary.total_volume)).toBe(true);
    expect(summary.total_volume).toBeGreaterThanOrEqual(0);
  });
});
