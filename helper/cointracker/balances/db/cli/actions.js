import { promptYesNo } from '@cli/utils.js';
import Big from 'big.js';
import { log } from '@core/logger.js';
import {
  createCointrackerBalancesTable,
  dropCointrackerBalancesTable,
  insertCointrackerBalancesBatch,
  selectCointrackerBalances,
  selectCointrackerLastBalance,
  truncateCointrackerBalancesTable,
} from '../queries.js';
import { selectCointrackerTransactions } from '../../../transactions/db/queries.js';
import { getAssets, getToAndFromDates } from '@db/cli/utils.js';
import { COINBASE_EPOCH } from '@cb/dictionary';
import { getClient } from '@db/client.js';

/**
 * @param {string} currency
 * @param {object} options
 * @returns {Promise<void>}
 */
export async function cointrackerBalances(currency, options) {
  const currencies = getAssets(currency);
  const { from, to } = await getToAndFromDates(options);
  const { includeType } = options;
  const rows = await selectCointrackerBalances(currencies, from, to, includeType);
  console.table(rows);
}

/**
 * @param {object}options
 * @returns {Promise<void>}
 */
export async function cointrackerBalancesRegenerate(options) {
  const { drop, yes } = options;

  if (yes) {
    log.info(`Regenerating cointracker balances ledger...`);
  } else {
    const answer = await promptYesNo('Do you want to regenerate cointracker balances ledger?', 1);
    if (answer) {
      log.info(`Regenerating cointracker balances ledger...`);
    } else {
      log.warn('Aborting.');
      return;
    }
  }

  if (drop) {
    log.warn(`Dropping cointracker balances ledger...`);
    await dropCointrackerBalancesTable();
    log.info('Creating cointracker balances ledger...');
    await createCointrackerBalancesTable();
  } else {
    log.warn(`Truncating cointracker balances ledger...`);
    await truncateCointrackerBalancesTable();
  }

  /**
   * TODO
   *  may need to normalize assets ETH, ETH2, cbETH, but lets just roll with what they have first
   *  query
   *  look through history
   */

  const { from, to } = await getToAndFromDates({});
  const transactions = await selectCointrackerTransactions(from, to);

  const ledger = [];

  /**
   * @type {Map<string, Big>}
   */
  const balances = new Map();

  const epoch = new Date(COINBASE_EPOCH);

  /**
   * @param {string} currency
   */
  function initializeZeroBalance(currency) {
    ledger.push([currency, epoch, '0', 'coinbase_epoch_zero', '0', '0']);
    balances.set(currency, new Big('0'));
  }

  for (const transaction of transactions) {
    if (transaction.received_currency) {
      if (!balances.has(transaction.received_currency)) {
        initializeZeroBalance(transaction.received_currency); // should set Big(0)
      }
      let balance = balances.get(transaction.received_currency); // should be a Big
      const quantity = new Big(transaction.received_quantity || '0');
      balance = balance.plus(quantity);
      ledger.push([
        transaction.received_currency,
        transaction.date,
        balance.toString(), // keep as string for display/storage
        transaction.transaction_id,
        transaction.received_quantity,
        '0',
      ]);
      balances.set(transaction.received_currency, balance);
    }

    if (transaction.sent_currency) {
      if (!balances.has(transaction.sent_currency)) {
        initializeZeroBalance(transaction.sent_currency); // should set Big(0)
      }
      let balance = balances.get(transaction.sent_currency); // should be a Big
      const quantity = new Big(transaction.sent_quantity || '0');
      balance = balance.minus(quantity);
      ledger.push([
        transaction.sent_currency,
        transaction.date,
        balance.toString(),
        transaction.transaction_id,
        '0',
        transaction.sent_quantity,
      ]);
      balances.set(transaction.sent_currency, balance);
    }
  }

  const BATCH_SIZE = 10000;
  const client = await getClient();
  try {
    await client.query('BEGIN');

    for (let i = 0; i < ledger.length; i += BATCH_SIZE) {
      const batch = ledger.slice(i, i + BATCH_SIZE);
      log.info(`Inserting ${batch.length} into ledger...`);
      await insertCointrackerBalancesBatch(batch);
    }
    log.info(`Inserted ${ledger.length} into ledger.`);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }

  const rows = await selectCointrackerLastBalance();
  console.table(rows);
}
