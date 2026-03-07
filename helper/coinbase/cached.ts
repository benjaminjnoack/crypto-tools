import { requestTransactionSummary } from './http/rest';
import { loadCoinbase, saveCoinbase } from '@core/cache';
import { log } from '@core/logger.js';
import { TransactionSummaryResponseSchema, type TransactionSummary } from '@cb/http/contracts';

let TRANSACTION_SUMMARY: TransactionSummary | null = null;

export async function getTransactionSummary() {
  if (TRANSACTION_SUMMARY) {
    log.debug(`getTransactionSummary => cached in memory`);
  } else {
    TRANSACTION_SUMMARY = TransactionSummaryResponseSchema.parse(
      loadCoinbase('transaction_summary'),
    );
    if (TRANSACTION_SUMMARY) {
      log.debug(`getTransactionSummary => cached on disk`);
    } else {
      log.info(`getTransactionSummary => not found on disk`); //TODO this should have an expiration
      TRANSACTION_SUMMARY = await requestTransactionSummary();
      await saveCoinbase('transaction_summary', TRANSACTION_SUMMARY);
    }
  }

  return TRANSACTION_SUMMARY;
}
