import { requestTransactionSummary } from "./rest.js";
import { loadCoinbaseFromCache, saveCoinbaseToCache } from "./cache/coinbase-cache.js";
import { type TransactionSummary, TransactionSummaryResponseSchema } from "./schemas/coinbase-rest-schemas.js";
import { logger } from "#shared/log/logger";

let TRANSACTION_SUMMARY: TransactionSummary | null = null;

export async function getTransactionSummary(): Promise<TransactionSummary> {
  if (TRANSACTION_SUMMARY) {
    logger.debug("getTransactionSummary => cached in memory");
  } else {
    const cached = loadCoinbaseFromCache("transaction_summary");

    if (cached) {
      try {
        TRANSACTION_SUMMARY = TransactionSummaryResponseSchema.parse(cached);
        logger.debug("getTransactionSummary => cached on disk");
      } catch (err) {
        logger.warn("getTransactionSummary => cached data invalid, refreshing");
        logger.debug(err);
      }
    } else {
      logger.info("getTransactionSummary => not found on disk");
    }

    if (!TRANSACTION_SUMMARY) {
      TRANSACTION_SUMMARY = await requestTransactionSummary();
      saveCoinbaseToCache("transaction_summary", TRANSACTION_SUMMARY);
    }
  }

  return TRANSACTION_SUMMARY;
}
