import fs from 'node:fs';
import { parse } from 'csv-parse';
import path from 'node:path';
import { log } from '@core/logger.js';
import StatementRow from '../../StatementRow.js';
import { normalizeTradeRow } from '../../normalize.js';
import { getClient } from '@db/client.js';
import { insertCoinbaseTransactionsBatch } from '../queries.js';

/**
 *
 * @param {string} filePath
 * @param {boolean} normalize
 * @param {boolean} manual
 * @returns {Promise<StatementRow[]>}
 */
export async function parseStatementCSV(filePath, normalize, manual) {
  const fullPath = path.resolve(filePath);
  if (manual) {
    log.info(`Importing ${fullPath} as MANUAL`);
  } else {
    log.info(`Importing ${fullPath}`);
  }
  const parser = fs.createReadStream(fullPath).pipe(parse({ columns: true }));

  /**
   * @type {StatementRow[]}
   */
  const rows = [];
  for await (const parsed of parser) {
    const row = new StatementRow(parsed, false, manual);

    if (normalize) {
      rows.push(...normalizeTradeRow(row));
    } else {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * @param {StatementRow[]} rows
 * @param {number} BATCH_SIZE
 * @returns {Promise<void>}
 */
export async function batchInsertStatementRows(rows, BATCH_SIZE = 2000) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await insertCoinbaseTransactionsBatch(batch);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}
