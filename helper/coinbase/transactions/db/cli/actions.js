import path from 'node:path';
import {
  formatDate,
  formatToCents,
  getAssets,
  getToAndFromDates,
  printFirstLastTableRows,
} from '@db/cli/utils.js';
import { log } from '@core/logger.js';
import { safeNumber } from '@core/validation.js';
import * as uuid from 'uuid';
import { promptYesNo } from '@cli/utils.js';
import promises from 'node:fs/promises';
import {
  COINBASE_TRANSACTIONS_TABLE,
  createCoinbaseTransactionsTable,
  dropCoinbaseTransactionsTable,
  insertCoinbaseTransactions,
  selectCoinbaseTransactionById,
  selectCoinbaseTransactions,
  selectCoinbaseTransactionsByIds,
  selectCoinbaseTransactionsGroup,
  truncateCoinbaseTransactionsTable,
} from '../queries.js';
import { coinbaseBalancesRegenerate } from '@cb/balances/db/cli/actions.js';
import {
  getClassifierForType,
  getTypesForClassifier,
  STATEMENT_COLUMNS,
  TRANSACTION_TYPES,
} from '@cb/dictionary';
import StatementRow from '../../StatementRow.js';
import { exportCoinbaseTransactionsToCSV } from '../../csv.js';
import { fromLotId } from '@cb/lots/lot_id.js';
import { batchInsertStatementRows, parseStatementCSV } from './utils.js';
import AccountManager from '../../../accounts/AccountManager';
import { getHdbPath, HdbDir } from '@db/cli/hdbPaths.js';

/**
 * @param {string} asset
 * @param {object} options
 * @returns {Promise<Transaction[]>}
 */
export async function coinbaseTransactions(asset, options) {
  const {
    balance,
    classify,
    classifier,
    csv,
    exclude,
    first,
    last,
    notClassifier,
    notes,
    paired,
    quiet,
    raw,
    type,
    synthetic,
    excludeSynthetic,
    manual,
    excludeManual,
  } = options;
  const { from, to } = await getToAndFromDates(options);
  const assets = getAssets(asset);
  const excluding = getAssets(exclude);
  const types = classifier ? getTypesForClassifier(classifier) : type ? type.split(':') : [];
  const notTypes = notClassifier ? getTypesForClassifier(notClassifier) : [];
  const selectManual = manual ? true : excludeManual ? false : null;
  const selectSynthetic = synthetic ? true : excludeSynthetic ? false : null;

  const transactions = await selectCoinbaseTransactions(
    to,
    from,
    assets,
    types,
    notTypes,
    balance,
    paired,
    excluding,
    selectManual,
    selectSynthetic,
  );

  if (quiet) {
    return transactions;
  } else if (transactions.length === 0) {
    log.warn(`No transactions found from ${from.toISOString()} to ${to.toISOString()}`);
    return transactions;
  }

  const tableRows = [];
  for (const transaction of transactions) {
    const row = await transaction.toTableRow(classify, notes, balance, raw);
    tableRows.push(row);
  }
  printFirstLastTableRows(tableRows, first, last);

  if (csv) {
    const filename = `coinbase_transactions__${formatDate(from)}-${formatDate(to)}`;
    await exportCoinbaseTransactionsToCSV(filename, transactions, balance);
  }

  return transactions;
}

/**
 * @param {string} asset
 * @param {object} options
 * @returns {Promise<*[]>}
 */
export async function coinbaseTransactionsGroup(asset, options) {
  const assets = getAssets(asset);
  const { from, to } = await getToAndFromDates(options);
  const {
    classifier,
    exclude,
    excludeManual,
    excludeSynthetic,
    interval,
    manual,
    synthetic,
    type,
  } = options;
  const excluding = getAssets(exclude);
  const types = classifier ? getTypesForClassifier(classifier) : type ? type.split(':') : [];

  const selectManual = manual ? true : excludeManual ? false : null;
  const selectSynthetic = synthetic ? true : excludeSynthetic ? false : null;

  const rows = await selectCoinbaseTransactionsGroup(
    from,
    to,
    assets,
    excluding,
    types,
    interval,
    selectManual,
    selectSynthetic,
  );
  console.table(rows);

  if (interval) {
    console.log('Totals:');
    const rows = await selectCoinbaseTransactionsGroup(
      from,
      to,
      assets,
      excluding,
      types,
      '',
      selectManual,
      selectSynthetic,
    );
    console.table(rows);
  }
  return rows;
}

/**
 * @param {string} id
 * @param {object} options
 * @returns {Promise<Transaction[]>}
 */
export async function coinbaseTransactionsId(id, options) {
  const { balance, classify, lotId, notes, quiet, raw } = options;
  /**
   * @type {Transaction[]}
   */
  let transactions;
  if (lotId) {
    const { buy, sell } = fromLotId(lotId);
    transactions = await selectCoinbaseTransactionsByIds([buy, sell]);
  } else if (id) {
    const ids = id.split(':');
    transactions = await selectCoinbaseTransactionsByIds(ids);
  } else {
    throw new Error(`Must provide either ID(s) or Lot ID`);
  }

  if (quiet) {
    return transactions;
  } else if (transactions.length === 0) {
    log.warn(`No transactions found with ID ${id ? id : lotId}`);
    return transactions;
  }

  const tableRows = [];
  for (const transaction of transactions) {
    const row = await transaction.toTableRow(classify, notes, balance, raw);
    tableRows.push(row);
  }

  console.table(tableRows);

  return transactions;
}

/**
 * @param {string} filePath
 * @param {object} options
 * @returns {Promise<void>}
 */
export async function coinbaseTransactionsImport(filePath, options) {
  const { manual, normalize } = options;

  const fullPath = path.resolve(filePath);
  if (manual) {
    log.info(`Importing ${fullPath} as MANUAL`);
  } else {
    log.info(`Importing ${fullPath}`);
  }

  const statementRows = await parseStatementCSV(filePath, normalize, manual);
  await batchInsertStatementRows(statementRows);
}

export async function coinbaseTransactionsManual(asset, options) {
  let {
    dryRun,
    fee,
    notes,
    quantity,
    price_currency,
    price_at_tx,
    rewriteExisting,
    subtotal,
    timestamp,
    total,
    type,
  } = options;
  if (dryRun) {
    log.warn('Dry Run...');
  }

  const numFee = safeNumber(fee, 'fee');
  const numQuantity = safeNumber(quantity, 'quantity');
  const numPriceAtTx = safeNumber(price_at_tx, 'priceAtTx');

  let numSubtotal;
  try {
    numSubtotal = safeNumber(subtotal, 'subtotal');
  } catch (e) {
    log.warn(e.message);
    log.warn(`Defaulting to ${numQuantity} * ${numPriceAtTx}`);
    numSubtotal = numQuantity * numPriceAtTx;
    subtotal = numSubtotal.toString();
  }

  let numTotal;
  try {
    numTotal = safeNumber(total, 'total');
  } catch (e) {
    log.warn(e.message);
    log.warn(`Defaulting to ${numSubtotal} + ${numFee}`);
    numTotal = numSubtotal + numFee;
    total = numTotal.toString();
  }

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid from date format. Use ISO format');
  }

  const classifier = getClassifierForType(type);
  if (classifier === 'unknown') {
    throw new Error(`Unknown type: ${type}`);
  }

  notes = `Manual ${notes}`;

  const id = `manual-${uuid.v4()}`;
  const transaction = {
    [STATEMENT_COLUMNS.ID]: id,
    [STATEMENT_COLUMNS.TIMESTAMP]: date.toISOString(),
    [STATEMENT_COLUMNS.TYPE]: type,
    [STATEMENT_COLUMNS.ASSET]: asset.toUpperCase(),
    [STATEMENT_COLUMNS.QUANTITY]: quantity,
    [STATEMENT_COLUMNS.PRICE_CURRENCY]: price_currency,
    [STATEMENT_COLUMNS.PRICE_AT_TX]: price_at_tx,
    [STATEMENT_COLUMNS.SUBTOTAL]: subtotal,
    [STATEMENT_COLUMNS.TOTAL]: total,
    [STATEMENT_COLUMNS.FEE]: fee,
    [STATEMENT_COLUMNS.NOTES]: notes,
  };
  console.dir(transaction);
  if (dryRun) {
    return;
  }
  const answer = await promptYesNo('Do you want to insert this transaction into the database?', 1);
  if (!answer) {
    log.info('Aborting.');
    return;
  }

  const statementRow = new StatementRow(transaction, false, true);
  await insertCoinbaseTransactions(statementRow, rewriteExisting);
  const transactions = await selectCoinbaseTransactionById(transaction.id, false);
  console.table(transactions);
}

/**
 * PnL =  ((usdBalance + usdcBalance) + cryptoValue) - (totalDeposits - totalWithdrawals)
 * @param {options} options
 * @returns {Promise<number>}
 */
export async function coinbaseTransactionsNAV(options) {
  const { quiet } = options;
  const { to, from } = await getToAndFromDates(options);
  const assets = ['USD'];

  const usdDeposits = await selectCoinbaseTransactions(to, from, assets, [
    TRANSACTION_TYPES.DEPOSIT,
  ]);
  const totalDeposits = usdDeposits.reduce((acc, cur) => acc + parseFloat(cur.num_quantity), 0);

  const usdWithdrawals = await selectCoinbaseTransactions(to, from, assets, [
    TRANSACTION_TYPES.WITHDRAWAL,
  ]);
  const totalWithdrawals = usdWithdrawals.reduce(
    (acc, cur) => acc + parseFloat(cur.num_quantity),
    0,
  );

  const netCashFlow = totalDeposits - totalWithdrawals;

  await AccountManager.retrieveAllAccount();
  const usdBalance = await AccountManager.getAccountBalanceByCurrency('USD', false);
  const usdcBalance = await AccountManager.getAccountBalanceByCurrency('USDC', false);
  const cashBalance = usdBalance + usdcBalance;

  const cryptoValue = await AccountManager.getTotalCryptoValue();
  const accountValue = cashBalance + cryptoValue;

  const [{ fee }] = await selectCoinbaseTransactionsGroup(from, to);
  const numFeesPaid = Number(fee);

  const PnL = accountValue - netCashFlow;

  if (!quiet) {
    console.table({
      'Gross Deposits': formatToCents(totalDeposits.toString()),
      'Gross Withdrawals': formatToCents(totalWithdrawals.toString()),
      'Net Cash Flow': formatToCents(netCashFlow.toString()),
      'Cash Balance': formatToCents(cashBalance.toString()),
      'Crypto Value': formatToCents(cryptoValue.toString()),
      'Account Value': formatToCents(accountValue.toString()),
      'Fees Paid': formatToCents(numFeesPaid.toString()),
      PnL: formatToCents(PnL.toString()),
    });
  }

  return PnL;
}

export async function coinbaseTransactionsRegenerate(options) {
  const { drop, yes } = options;
  if (yes) {
    log.warn(`Re-generating ${COINBASE_TRANSACTIONS_TABLE}...`);
  } else {
    const answer = await promptYesNo(
      `Do you want to regenerate ${COINBASE_TRANSACTIONS_TABLE}?`,
      1,
    );
    if (answer) {
      log.warn(`Re-generating ${COINBASE_TRANSACTIONS_TABLE}...`);
    } else {
      log.info('Aborting.');
      return;
    }
  }

  const dir = getHdbPath(HdbDir.COINBASE_TRANSACTIONS_INPUT);
  const files = await promises.readdir(dir);
  if (files.length === 0) {
    // Check for input files before blowing away the DB table
    log.warn(`No input files found in ${dir}`);
    return 0;
  }

  if (drop) {
    log.warn(`Dropping the ${COINBASE_TRANSACTIONS_TABLE} table...`);
    await dropCoinbaseTransactionsTable();

    log.warn(`Creating the ${COINBASE_TRANSACTIONS_TABLE} table...`);
    await createCoinbaseTransactionsTable();
  } else {
    log.warn(`Truncating the ${COINBASE_TRANSACTIONS_TABLE} table...`);
    await truncateCoinbaseTransactionsTable();
  }

  /**
   * @type {StatementRow[]}
   */
  const statementRows = [];
  for (const file of files) {
    const manual = file === 'manual.csv';
    const filepath = path.resolve(dir, file);
    const rows = await parseStatementCSV(filepath, true, manual);
    statementRows.push(...rows);
  }

  await batchInsertStatementRows(statementRows);

  await coinbaseBalancesRegenerate(options);
}
