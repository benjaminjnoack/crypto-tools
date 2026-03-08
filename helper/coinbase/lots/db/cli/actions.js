import { DUST_THRESHOLD, formatDate, getAssets, getToAndFromDates } from '@db/cli/utils.js';
import {
  selectCoinbaseTransactions,
  selectCoinbaseTransactionsByIds,
  selectCoinbaseTransactionsDistinctAsset,
} from '@cb/transactions/db/queries.js';
import {
  coinbaseTransactionsLotsFifo,
  coinbaseTransactionsLotsHifo,
  coinbaseTransactionsLotsLifo,
  filterLots,
  sortLots,
} from '../../lots.js';
import { traceCoinbaseBalanceLedger } from '@cb/balances/db/queries.js';
import path from 'node:path';
import { LOTS_DIR } from '@core/cache.js';
import { exportLotsToForm8949CSV } from '../../f8949.js';
import { exportCoinbaseLotsToCSV } from '../../csv.js';
import { normalizeAsset } from '@cb/transactions/normalize.js';
import { coinbaseTransactionsFormatLotTotals, coinbaseTransactionsGetLotTotals } from './utils.js';
import { log } from '@core/logger.js';

/**
 * @param {string} asset
 * @param {object} options
 * @returns {Promise<Lot[]>}
 */
export async function coinbaseLots(asset, options) {
  const {
    accounting,
    all,
    balance: showBalance,
    buyLots,
    csv,
    f8949,
    notes,
    obfuscate,
    pages,
    quiet,
    totals,
  } = options;
  const { from, to } = await getToAndFromDates(options);

  // Step 0: Ensure we are only working with one asset at a time
  const assets = getAssets(asset);
  if (assets.length > 1) {
    throw new Error(`coinbaseLots => only one asset at a time!`);
  }
  asset = assets[0];

  // Step 1: Get period transactions
  const periodTxs = await selectCoinbaseTransactions(to, from, assets, [], [], null, false);
  if (!periodTxs.length)
    throw new Error(`No transactions found for ${asset} in the selected period.`);

  const firstTx = periodTxs[0];
  if (!quiet) {
    log.info(`first transaction (${firstTx.id}) ${firstTx.notes}`);
  }

  //
  /**
   * Step 2: Trace balance history up to first transaction
   *  There should always be a history because there are synthetic zero balance records for every asset
   */
  let traceRows = await traceCoinbaseBalanceLedger(asset, firstTx.timestamp);
  if (!traceRows.length)
    throw new Error(`Trace for ${asset} returned no history — possible unanchored carryover.`);

  /**
   * Step 3: Confirm we have a valid zero anchor
   *  there may be a recorded balance at exactly the same timestamp as the zero which caught the trace SQL.
   *  So it gets pulled in ahead of the zero.
   *  Therefore, we must walk forward until we find the zero
   */
  let anchorIndex = -1;
  for (let i = 0; i < traceRows.length; i += 1) {
    if (Math.abs(parseFloat(traceRows[i].balance)) < DUST_THRESHOLD) {
      anchorIndex = i;
      break;
    }
  }
  if (anchorIndex === -1)
    throw new Error(`Trace for ${asset} does not begin with zero balance — possible ledger gap.`);

  // Step 4: Discard the anchor and fetch the actual transaction rows
  if (!quiet) {
    let count = 0;
    do {
      log.warn(
        `discarding ${traceRows[count].balance} balance (${traceRows[count].tx_id}) ${traceRows[count].notes}`,
      );
      count++;
    } while (count < anchorIndex);
  }
  traceRows = traceRows.slice(anchorIndex + 1);

  let historicalTxs = [];
  if (traceRows.length) {
    const txIdsToFetch = traceRows.map((row) => row['tx_id']);
    const history = await selectCoinbaseTransactionsByIds(txIdsToFetch);
    historicalTxs.push(...history);
  } else if (!quiet) {
    log.warn(`There were no other transactions leading up to the first`);
  }

  // build a map keyed by tx id
  const allTxsMap = new Map();
  for (const tx of [...historicalTxs, ...periodTxs]) {
    allTxsMap.set(tx.id, tx); // overwrites duplicates
  }
  const allTxs = Array.from(allTxsMap.values());

  /**
   * @type {{balance: number, lots: Lot[]}}
   */
  let matched;
  switch (accounting.toUpperCase()) {
    case 'HIFO':
      matched = coinbaseTransactionsLotsHifo(allTxs, buyLots);
      break;
    case 'LIFO':
      matched = coinbaseTransactionsLotsLifo(allTxs, buyLots);
      break;
    case 'FIFO':
    default:
      matched = coinbaseTransactionsLotsFifo(allTxs, buyLots);
      break;
  }

  const lots = all ? matched.lots : filterLots(matched.lots, from, buyLots);
  sortLots(lots);

  if (!quiet) {
    console.table(lots.map((lot) => lot.toTableRow()));

    if (totals) {
      const lotTotals = coinbaseTransactionsGetLotTotals(lots);
      console.table([coinbaseTransactionsFormatLotTotals(lotTotals)]);
    }

    if (showBalance) {
      console.log(`Remaining Balance: ${matched.balance}`);
    }
  }

  if (csv) {
    const fileName = `coinbase_lots_${asset}_${formatDate(from)}_${formatDate(to)}`;
    exportCoinbaseLotsToCSV(lots, fileName, showBalance, notes, obfuscate);
  }

  if (f8949) {
    const fileName = `coinbase_lots_${asset}_${formatDate(from)}_${formatDate(to)}.f8949`;
    const filePath = path.join(LOTS_DIR, fileName);
    exportLotsToForm8949CSV(lots, filePath, true, totals, pages);
  }

  return lots;
}
/**
 * @param {object} options
 * @returns {Promise<Lot[]>}
 */
export async function coinbaseLotsBatch(options) {
  const { quiet, totals } = options;
  options.quiet = true; // Disable upstream printing
  options.totals = false; // Disable upstream aggregation

  const { from, to } = await getToAndFromDates(options);
  const assets = await selectCoinbaseTransactionsDistinctAsset(from, to);
  // Assets are normalized to avoid calculating lots for ETH2, which is normalized to ETH for balance calculations
  const normalizedAssets = assets.map((asset) => normalizeAsset(asset));

  /**
   * @type {Lot[]}
   */
  const batch = [];
  for (const asset of normalizedAssets) {
    if (asset === 'USD' || asset === 'USDC') continue; // Skip cash
    const lots = await coinbaseLots(asset, options);
    batch.push(...lots);
  }

  sortLots(batch);

  if (!quiet) {
    console.table(batch.map((lot) => lot.toTableRow()));

    if (totals) {
      const lotTotals = coinbaseTransactionsGetLotTotals(batch);
      console.table([coinbaseTransactionsFormatLotTotals(lotTotals)]);
    }
  }

  return batch;
}

/**
 * @param {object} options
 * @returns {Promise<{}>}
 */
export async function coinbaseLotsBatchCompare(options) {
  const { quiet } = options;
  options.quiet = true; // disable for coinbaseTransactionsLots

  const methods = ['FIFO', 'LIFO', 'HIFO'];
  const data = {};
  const tableData = {};

  for (const accounting of methods) {
    options.accounting = accounting;
    const lots = await coinbaseLotsBatch(options);
    const totals = coinbaseTransactionsGetLotTotals(lots);
    data[accounting] = totals;
    if (!quiet) {
      tableData[accounting] = coinbaseTransactionsFormatLotTotals(totals);
    }
  }

  if (quiet) {
    return data;
  }

  console.table(tableData);

  return data;
}

/**
 * @param {string} asset
 * @param {object} options
 * @returns {Promise<{}>} - Returns a hash of method => totals object
 */
export async function coinbaseLotsCompare(asset, options) {
  const { quiet } = options;
  options.quiet = true; // disable for coinbaseTransactionsLots

  const methods = ['FIFO', 'LIFO', 'HIFO'];
  const data = {};
  const tableData = {};

  for (const accounting of methods) {
    options.accounting = accounting;
    const lots = await coinbaseLots(asset, options);
    const totals = coinbaseTransactionsGetLotTotals(lots);
    data[accounting] = totals;
    if (!quiet) {
      tableData[accounting] = coinbaseTransactionsFormatLotTotals(totals);
    }
  }

  if (quiet) {
    return data;
  }

  console.table(tableData);

  return data;
}
