import { log } from '@core/logger.js';
import { COINTRACKER_TABLE } from '../../../dictionary.js';
import { promptYesNo } from '@cli/utils.js';
import { getHdbPath, HdbDir } from '@db/cli/hdbPaths.js';
import promises from 'node:fs/promises';
import path from 'node:path';
import fs from 'node:fs';
import { parse } from 'csv-parse';
import TransactionRow from '../../TransactionRow.js';
import {
  createCointrackerTransactionsTable,
  dropCointrackerTransactionsTable,
  insertCointrackerTransactionsBatch,
  selectCointrackerTransactions,
  selectCointrackerTransactionsGroup,
  truncateCointrackerTransactionsTable,
} from '../queries.js';
import { getClient } from '@db/client.js';
import { getAssets, getToAndFromDates, getTypes } from '@db/cli/utils.js';
import { cointrackerBalancesRegenerate } from '../../../balances/db/cli/actions.js';

/**
 * @param {string} asset
 * @param {options}options
 * @returns {Promise<CointrackerTransaction[]>}
 */
export async function cointrackerTransactions(asset, options) {
  const assets = getAssets(asset);
  const { to, from } = await getToAndFromDates(options);
  let { exclude, includeBalances, quiet, raw, received, sent, type } = options;
  const excluded = getAssets(exclude);

  const types = getTypes(type);
  received = getAssets(received);
  sent = getAssets(sent);

  const rows = await selectCointrackerTransactions(
    from,
    to,
    assets,
    excluded,
    types,
    received,
    sent,
    includeBalances,
  );

  if (!quiet) {
    const tableRows = [];
    for (const row of rows) {
      const tableRow = await row.toTableRow(raw);
      tableRows.push(tableRow);
    }
    console.table(tableRows);
  }

  return rows;
}

/**
 * @param {string} asset
 * @param {object} options
 * @returns {Promise<*[]>}
 */
export async function cointrackerTransactionsGroup(asset, options) {
  const assets = getAssets(asset);
  const { to, from } = await getToAndFromDates(options);
  let { exclude, interval, quiet, received, sent, type } = options;
  const excluded = getAssets(exclude);

  const types = getTypes(type);
  received = getAssets(received);
  sent = getAssets(sent);

  const rows = await selectCointrackerTransactionsGroup(
    from,
    to,
    interval,
    assets,
    excluded,
    types,
    received,
    sent,
  );
  if (!quiet) {
    console.table(rows);
  }
  return rows;
}

/**
 * @param {object} options
 * @returns {Promise<number>}
 */
export async function cointrackerTransactionsRegenerate(options) {
  const { drop, yes } = options;
  if (yes) {
    log.warn(`Re-generating ${COINTRACKER_TABLE.TRANSACTIONS}...`);
  } else {
    const answer = await promptYesNo(
      `Do you want to regenerate ${COINTRACKER_TABLE.TRANSACTIONS}?`,
      1,
    );
    if (answer) {
      log.warn(`Re-generating ${COINTRACKER_TABLE.TRANSACTIONS}...`);
    } else {
      log.info('Aborting.');
      return 0;
    }
  }

  const dir = getHdbPath(HdbDir.COINTRACKER_TRANSACTIONS_INPUT);
  const files = await promises.readdir(dir);
  if (files.length === 0) {
    // Check for input files before blowing away the DB table
    log.warn(`No input files found in ${dir}`);
    return 0;
  }

  if (drop) {
    log.warn(`Dropping the ${COINTRACKER_TABLE.TRANSACTIONS} table...`);
    await dropCointrackerTransactionsTable();

    log.warn(`Creating the ${COINTRACKER_TABLE.TRANSACTIONS} table...`);
    await createCointrackerTransactionsTable();
  } else {
    log.warn(`Truncating the ${COINTRACKER_TABLE.TRANSACTIONS} table...`);
    await truncateCointrackerTransactionsTable();
  }

  /**
   * @type {TransactionRow[]}
   */
  const transactionRows = [];

  for (const file of files) {
    const filepath = path.resolve(dir, file);
    const parser = fs.createReadStream(filepath).pipe(parse({ columns: true }));
    for await (const parsed of parser) {
      transactionRows.push(new TransactionRow(parsed));
    }
  }

  const BATCH_SIZE = 2000;
  const client = await getClient();
  try {
    await client.query('BEGIN');

    for (let i = 0; i < transactionRows.length; i += BATCH_SIZE) {
      const batch = transactionRows.slice(i, i + BATCH_SIZE);
      await insertCointrackerTransactionsBatch(batch);
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }

  await cointrackerBalancesRegenerate(options);

  return transactionRows.length;
}
