import { promptYesNo } from '@cli/utils.js';
import promises from 'node:fs/promises';
import { log } from '@core/logger.js';
import {
  COINTRACKER_CAPITAL_GAINS_TABLE,
  createCointrackerCapitalGainsTable,
  truncateCointrackerCapitalGainsTable,
  insertCointrackerCapitalGainsBatch,
  selectCointrackerCapitalGains,
  selectCointrackerCapitalGainsGroup,
  selectCointrackerCapitalGainsGroupTotals,
  selectCointrackerCapitalGainsTotals,
  dropCointrackerCapitalGainsTable,
  selectCointrackerCapitalGainsUsdcBuckets,
  selectCointrackerCapitalGainsUsdcInterval,
} from '../queries.js';
import fs from 'node:fs';
import { parse } from 'csv-parse';
import CapitalGainsRow from '../../CapitalGainsRow.js';
import {
  formatDate,
  getAssets,
  getToAndFromDates,
  parseAsUtc,
  printFirstLastTableRows,
} from '../../../../db/cli/utils.js';
import {
  writeCapitalGainsCsv,
  writeCapitalGainsF8949,
  writeCapitalGainsGroupCsv,
  writeCapitalGainsGroupF8949,
} from '../../csv.js';
import { getHdbPath, HdbDir } from '../../../../db/cli/hdbPaths.js';
import path from 'node:path';

/**
 * @param {object} options
 * @returns {Promise<number>}
 */
export async function cointrackerCapitalGainsRegenerate(options) {
  const { drop, yes } = options;
  if (yes) {
    log.warn(`Re-generating ${COINTRACKER_CAPITAL_GAINS_TABLE}...`);
  } else {
    const answer = await promptYesNo(
      `Do you want to regenerate ${COINTRACKER_CAPITAL_GAINS_TABLE}?`,
      1,
    );
    if (answer) {
      log.warn(`Re-generating ${COINTRACKER_CAPITAL_GAINS_TABLE}...`);
    } else {
      log.info('Aborting.');
      return 0;
    }
  }

  const dir = getHdbPath(HdbDir.COINTRACKER_CAPITAL_GAINS_INPUT);
  const files = await promises.readdir(dir);
  if (files.length === 0) {
    // Check for input files before blowing away the DB table
    log.warn(`No input files found in ${dir}`);
    return 0;
  }

  if (drop) {
    log.warn(`Dropping the ${COINTRACKER_CAPITAL_GAINS_TABLE} table...`);
    await dropCointrackerCapitalGainsTable();

    log.warn(`Creating the ${COINTRACKER_CAPITAL_GAINS_TABLE} table...`);
    await createCointrackerCapitalGainsTable();
  } else {
    log.warn(`Truncating the ${COINTRACKER_CAPITAL_GAINS_TABLE} table...`);
    await truncateCointrackerCapitalGainsTable();
  }

  /**
   * @type {CapitalGainsRow[]}
   */
  const rows = [];

  for (const file of files) {
    const filepath = path.resolve(dir, file);
    const parser = fs.createReadStream(filepath).pipe(parse({ columns: true }));
    for await (const parsed of parser) {
      rows.push(new CapitalGainsRow(parsed));
    }
  }

  return insertCointrackerCapitalGainsBatch(rows);
}

/**
 * @param {string} asset
 * @param {object} options
 * @returns {Promise<CapitalGains[]>}
 */
export async function cointrackerCapitalGains(asset, options) {
  const {
    crypto,
    cash,
    csv,
    exclude,
    f8949,
    first,
    gains,
    headers,
    last,
    pages,
    quiet,
    raw,
    totals,
    zero,
  } = options;
  let assets = getAssets(asset);
  let excluding = getAssets(exclude);
  if (cash) {
    assets.push('USD', 'USDC');
  } else if (crypto) {
    excluding.push('USD', 'USDC');
  }

  let { to, from } = await getToAndFromDates(options);
  let { sent, received } = options;
  if (received) {
    received = parseAsUtc(received);
  }
  if (sent) {
    sent = parseAsUtc(sent);
  }

  const rows = await selectCointrackerCapitalGains(
    assets,
    from,
    to,
    excluding,
    zero,
    gains,
    received,
    sent,
  );

  if (!quiet) {
    const tableRows = rows.map((row) => row.toTableRow());
    printFirstLastTableRows(tableRows, first, last);
  }

  let capitalGainsTotals = null;
  if (totals) {
    capitalGainsTotals = await selectCointrackerCapitalGainsTotals(assets, from, to, excluding);
    console.table(capitalGainsTotals.toTableRow(raw));
  }

  const filename = `${formatDate(from, false)}_${formatDate(to, false)}`;
  if (csv) {
    await writeCapitalGainsCsv(filename, rows, true, capitalGainsTotals);
  }
  if (f8949) {
    await writeCapitalGainsF8949(filename, rows, headers, capitalGainsTotals, pages);
  }

  return rows;
}

/**
 * @param assets
 * @param {object} options
 * @returns {Promise<CapitalGainsGroup[]>}
 */
export async function cointrackerCapitalGainsGroup(assets, options) {
  const {
    bleeders,
    crypto,
    cash,
    csv,
    exclude,
    f8949,
    first,
    gains,
    headers,
    last,
    pages,
    quiet,
    raw,
    totals,
    type,
    zero,
  } = options;
  assets = getAssets(assets);
  let excluding = getAssets(exclude);
  if (cash) {
    assets.push('USD', 'USDC');
  } else if (crypto) {
    excluding.push('USD', 'USDC');
  }

  const { to, from } = await getToAndFromDates(options);
  let { sent, received } = options;
  if (received) {
    received = parseAsUtc(received);
  }
  if (sent) {
    sent = parseAsUtc(sent);
  }
  const rows = await selectCointrackerCapitalGainsGroup(
    assets,
    from,
    to,
    excluding,
    zero,
    gains,
    bleeders,
    type,
    received,
    sent,
  );

  if (!quiet) {
    const tableRows = rows.map((row) => row.toTableRow(raw));
    printFirstLastTableRows(tableRows, first, last);
  }

  let capitalGainsTotals = null;
  if (totals) {
    capitalGainsTotals = await selectCointrackerCapitalGainsGroupTotals(
      assets,
      from,
      to,
      excluding,
    );
    console.table(capitalGainsTotals.toTableRow());
  }

  const filename = `${formatDate(from, false)}_${formatDate(to, false)}`;
  if (csv) {
    if (type) {
      log.warn(`CSV by type is not supported`);
    } else {
      await writeCapitalGainsGroupCsv(filename, rows, raw, headers, capitalGainsTotals);
    }
  }

  if (f8949) {
    if (type) {
      log.warn(`F8949 by type is not supported`);
    } else {
      await writeCapitalGainsGroupF8949(filename, rows, headers, capitalGainsTotals, pages);
    }
  }

  return rows;
}

export async function cointrackerCapitalGainsUsdc(options) {
  const { buckets, interval } = options;

  let rows;
  if (buckets) {
    rows = await selectCointrackerCapitalGainsUsdcBuckets();
    console.table(rows);
  } else if (interval) {
    rows = await selectCointrackerCapitalGainsUsdcInterval(interval);
    console.table(rows);
    rows = await selectCointrackerCapitalGainsUsdcInterval('year');
    console.table(rows);
  } else {
    throw new Error(`Missing instructions`);
  }
}
