import { getSignedConfig, requestWithSchema } from "#shared/coinbase/http/http-client";
import {
  type TransactionSummary,
  TransactionSummaryResponseSchema,
} from "#shared/coinbase/schemas/coinbase-rest-schemas";

export async function requestTransactionSummary(
  productType: string = "SPOT",
): Promise<TransactionSummary> {
  const requestPath = "/api/v3/brokerage/transaction_summary";
  const q = new URLSearchParams({
    product_type: productType,
  }).toString();
  const config = await getSignedConfig("GET", requestPath, `?${q}`);
  return requestWithSchema(config, TransactionSummaryResponseSchema);
}
