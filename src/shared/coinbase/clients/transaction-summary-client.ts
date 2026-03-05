import { getSignedConfig, requestWithSchema } from "../http/http-client.js";
import {
  type TransactionSummary,
  TransactionSummaryResponseSchema,
} from "../schemas/coinbase-rest-schemas.js";

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
