import { STATEMENT_COLUMNS } from '../dictionary';
import { HdbDir, writeHbdFile } from '@db/cli/hdbPaths.js';
import { log } from '@core/logger.js';

/**
 * @param {string} filename
 * @param {Transaction[]} transactions
 * @param {boolean} balance
 * @param {boolean} raw
 * @returns {Promise<number>}
 */
export async function exportCoinbaseTransactionsToCSV(
  filename,
  transactions,
  balance = false,
  raw = false,
) {
  if (transactions.length === 0) {
    log.warn(`No transactions to write to ${filename}`);
    return 0;
  }

  const statementColumns = [
    STATEMENT_COLUMNS.ID,
    STATEMENT_COLUMNS.TIMESTAMP,
    STATEMENT_COLUMNS.TYPE,
    STATEMENT_COLUMNS.ASSET,
    STATEMENT_COLUMNS.QUANTITY,
    STATEMENT_COLUMNS.PRICE_CURRENCY,
    STATEMENT_COLUMNS.PRICE_AT_TX,
    STATEMENT_COLUMNS.SUBTOTAL,
    STATEMENT_COLUMNS.TOTAL,
    STATEMENT_COLUMNS.FEE,
    STATEMENT_COLUMNS.NOTES,
  ];

  if (balance) {
    statementColumns.push('Balance');
  }

  const header = statementColumns.join(',');

  const lines = [header];

  for (const transaction of transactions) {
    const row = await transaction.toCsvRow(balance, raw);
    lines.push(row);
  }

  return writeHbdFile(HdbDir.COINBASE_TRANSACTIONS_OUTPUT, `${filename}.csv`, lines);
}
