import {
  DUST_THRESHOLD,
  getAssets,
  getBalanceToIncrement,
  getToAndFromDates,
  printFirstLastTableRows,
} from '@db/cli/utils.js';
import AccountManager from '../../../accounts/AccountManager';
import { log } from '@core/logger.js';
import { promptYesNo } from '@cli/utils.js';
import {
  COINBASE_BALANCE_LEDGER_TABLE,
  createCoinbaseBalanceLedgerTable,
  dropCoinbaseBalanceLedgerTable,
  insertCoinbaseBalanceLedgerBatch,
  selectCoinbaseBalanceLedger,
  selectCoinbaseBalancesAtTime,
  traceCoinbaseBalanceLedger,
} from '../queries.js';
import { selectCoinbaseTransactions } from '@cb/transactions/db/queries.js';
import { BALANCE_COLUMNS, COINBASE_EPOCH, TRANSACTION_TYPES } from '@cb/dictionary';
import { getClient } from '@db/client.js';
import { normalizeAsset } from '@cb/transactions/normalize.js';
import Balance from '../../Balance.js';

/**
 * @param {string} asset
 * @param {object} options
 * @returns {Promise<Balance[]>}
 */
export async function coinbaseBalances(asset, options) {
  const assets = getAssets(asset);
  const { current, first, last, quiet, raw } = options;
  let from, to;
  if (current) {
    from = new Date(COINBASE_EPOCH);
    to = new Date();
  } else {
    ({ from, to } = await getToAndFromDates(options));
  }

  const balances = await selectCoinbaseBalanceLedger(assets, from, to);

  if (quiet) {
    return balances;
  } else if (balances.length === 0) {
    log.warn(
      `No balances found for ${assets.join(', ')} from ${from.toISOString()} to ${to.toISOString()}`,
    );
    return balances;
  }

  const tableRows = [];
  for (const balance of balances) {
    const row = await balance.toTableRow(raw);
    tableRows.push(row);
  }

  printFirstLastTableRows(tableRows, first, last);

  if (current) {
    await AccountManager.retrieveAllAccount();
    let accountBalance = await AccountManager.getAccountBalanceByCurrency(asset, false);
    accountBalance = await getBalanceToIncrement(asset, accountBalance);
    console.log(`Current Balance: ${accountBalance} ${asset}`);
  }

  return balances;
}

/**
 * @param {object} options
 * @returns {Promise<Balance[]>}
 */
export async function coinbaseBalancesBatch(options) {
  const { current, quiet, raw } = options;
  let to;
  if (current) {
    to = new Date();
  } else {
    ({ to } = await getToAndFromDates(options));
  }

  const balances = await selectCoinbaseBalancesAtTime(to);

  if (quiet) {
    return balances;
  } else if (balances.length === 0) {
    console.log(`No balances found to ${to.toISOString()}`);
    return balances;
  }

  if (current) {
    await AccountManager.retrieveAllAccount();
  }

  const tableRows = [];
  for (const balance of balances) {
    if (current) {
      let accountBalance = await AccountManager.getAccountBalanceByCurrency(balance.asset, false);
      accountBalance = await getBalanceToIncrement(balance.asset, accountBalance); //TODO
      const row = await balance.toTableRow(raw, accountBalance);
      tableRows.push(row);
    } else {
      const row = await balance.toTableRow(raw);
      tableRows.push(row);
    }
  }

  console.table(tableRows);

  return balances;
}

/**
 * @param asset
 * @param options
 * @returns {Promise<Balance[]>}
 */
export async function coinbaseBalancesTrace(asset, options) {
  asset = asset.toUpperCase();
  const { quiet, raw } = options;

  const { to } = await getToAndFromDates(options);
  const balances = await traceCoinbaseBalanceLedger(asset, to);

  if (quiet) {
    return balances;
  } else if (balances.length === 0) {
    log.warn(`No balances found for ${asset} to ${to.toISOString()}`);
    return balances;
  }

  const tableRows = [];
  for (const balance of balances) {
    const row = await balance.toTableRow(raw);
    tableRows.push(row);
  }

  console.table(tableRows);

  return balances;
}
/**
 * @param {object} options
 * @returns {Promise<Balance[]>}
 */
export async function coinbaseBalancesRegenerate(options) {
  const { dryRun, yes } = options;
  if (dryRun) {
    //TODO remove
    log.warn('Dry Run...');
  } else if (yes) {
    log.warn('Answering yes to all prompts...');
  } else {
    if (yes) {
      log.warn(`Re-generating ${COINBASE_BALANCE_LEDGER_TABLE}...`);
    } else {
      const answer = await promptYesNo(
        `Do you want to regenerate ${COINBASE_BALANCE_LEDGER_TABLE}?`,
        1,
      );
      if (answer) {
        log.warn(`Re-generating ${COINBASE_BALANCE_LEDGER_TABLE}...`);
      } else {
        log.info('Aborting.');
        return [];
      }
    }
  }

  if (dryRun) {
    log.warn(`Not dropping the ${COINBASE_BALANCE_LEDGER_TABLE} table...`);
  } else {
    log.warn(`Dropping the ${COINBASE_BALANCE_LEDGER_TABLE} table...`);
    await dropCoinbaseBalanceLedgerTable();
  }

  if (dryRun) {
    log.warn(`Not creating the ${COINBASE_BALANCE_LEDGER_TABLE} table...`);
  } else {
    log.warn(`Creating the ${COINBASE_BALANCE_LEDGER_TABLE} table...`);
    await createCoinbaseBalanceLedgerTable();
  }

  const { from, to } = await getToAndFromDates(options, true, true);
  const transactions = await selectCoinbaseTransactions(to, from, [], [], [], null, false);

  const assets = [...new Set(transactions.map((row) => row.asset))];
  const epoch = new Date(COINBASE_EPOCH);
  /**
   * TODO
   *  another way to do this would be to check the runningBalance for a value,
   *  just as is done now,
   *  and if none is found then insert this record first
   *  that way you have a starting balance for every asset
   *  and don't need the assets string[] up there
   * Start with the zero balances
   * @type {Balance[]}
   */
  const balances = assets.map((asset) => {
    return new Balance({
      [BALANCE_COLUMNS.TIMESTAMP]: epoch,
      [BALANCE_COLUMNS.ASSET]: asset,
      [BALANCE_COLUMNS.BALANCE]: 0,
      [BALANCE_COLUMNS.TX_ID]: `synthetic-zero-${asset}`,
      [BALANCE_COLUMNS.NOTES]: `Synthetic zero balance at COINBASE_EPOCH for ${asset}`,
    });
  });

  /**
   * @type {Map<string, number>}
   */
  const runningBalances = new Map();
  for (const transaction of transactions) {
    const ticker = normalizeAsset(transaction.asset);
    let delta = Number(transaction.num_quantity);

    switch (transaction.type) {
      case TRANSACTION_TYPES.ADVANCED_TRADE_SELL:
      /**
       * NOTE: the raw CSV quantity for these types is always a negative number
       * HOWEVER, the StatementRow.parseStr function removes the negative (-) sign
       * THEREFORE, num_quantity is always a positive number
       */
      case TRANSACTION_TYPES.SELL:
      case TRANSACTION_TYPES.WITHDRAWAL:
      case TRANSACTION_TYPES.SEND:
        delta *= -1; // We're dispossessing, so this is a negative delta
        break;
      case TRANSACTION_TYPES.UNWRAP:
        switch (transaction.asset) {
          case 'ETH2':
            /**
             * The quantity is positive
             * ETH2 will be normalized as ETH
             * So we are adding to the ETH balance
             */
            break;
          case 'CBETH':
            /**
             * cbETH unwraps subtract from the cbETH balance
             */
            delta *= -1;
            break;
          default:
            throw new Error(
              `Unsure how to quantify delta for ${TRANSACTION_TYPES.UNWRAP} of ${transaction.asset}`,
            );
        }
        break;
    }

    const prev = runningBalances.get(ticker) ?? 0;
    const balance = prev + delta;
    if (balance < 0 && Math.abs(balance) > DUST_THRESHOLD) {
      log.error(`NEGATIVE BALANCE: ${transaction.timestamp.toISOString()} ${balance} ${ticker}`);
    }
    runningBalances.set(ticker, balance);

    if (dryRun) {
      log.debug(`${transaction.timestamp.toISOString()} ${balance} ${ticker}`);
    } else {
      balances.push(
        new Balance({
          [BALANCE_COLUMNS.TIMESTAMP]: transaction.timestamp,
          [BALANCE_COLUMNS.ASSET]: ticker,
          [BALANCE_COLUMNS.BALANCE]: balance,
          [BALANCE_COLUMNS.TX_ID]: transaction.id,
          [BALANCE_COLUMNS.NOTES]: transaction.notes,
        }),
      );
    }
  }

  const BATCH_SIZE = 10000;
  const client = await getClient();
  try {
    await client.query('BEGIN');

    for (let i = 0; i < balances.length; i += BATCH_SIZE) {
      const batch = balances.slice(i, i + BATCH_SIZE);
      await insertCoinbaseBalanceLedgerBatch(batch);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }

  return coinbaseBalancesBatch({ current: true });
}
