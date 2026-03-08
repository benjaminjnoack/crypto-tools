import { CAPITAL_GAIN_TYPE, CAPITAL_GAINS_CSV_COLUMNS } from '../dictionary.js';
import { F8949_COLUMN_NAMES } from '../../db/cli/dictionary.js';
import { HdbDir, writeHbdFile } from '../../db/cli/hdbPaths.js';
import { formatToCents } from '../../db/cli/utils.js';

/**
 * @param {number|string} proceeds
 * @param {number|string} cost
 * @param {number|string} gain
 * @param {boolean} format
 * @returns {string}
 */
function formatTotalsLine(proceeds, cost, gain, format = true) {
  return [
    '',
    '',
    '',
    format ? formatToCents(proceeds) : proceeds,
    format ? formatToCents(cost) : cost,
    '',
    '',
    format ? formatToCents(gain) : gain,
  ].join(',');
}

/**
 * @param {string[]} lines
 * @param {number|string} proceeds
 * @param {number|string} cost
 * @param {number|string} gain
 * @param {boolean} format
 */
function pushTotalsLines(lines, proceeds, cost, gain, format = true) {
  lines.push('');
  lines.push('Totals:');
  lines.push(formatTotalsLine(proceeds, cost, gain, format));
}

/**
 * @param {number} pageNumber
 * @param {string} filename
 * @param {string[]} pageLines
 * @returns {Promise<void>}
 */
async function writePage(pageNumber, filename, pageLines) {
  const paddedPageNum = String(pageNumber).padStart(2, '0');
  const pageFilePage = `${filename}.pg${paddedPageNum}`;
  const pageFileName = `${pageFilePage}.f8949.csv`;
  await writeHbdFile(HdbDir.COINTRACKER_CAPITAL_GAINS_OUTPUT, pageFileName, pageLines);
}

/**
 * @param {string} filename - filename
 * @param {CapitalGains[]} gains - array of CapitalGains
 * @param {boolean} headers
 * @param {CapitalGainsTotals} capitalGainsTotals
 * @returns {Promise<number>} - the number of rows written
 */
export async function writeCapitalGainsCsv(filename, gains, headers = true, capitalGainsTotals) {
  const lines = [];

  if (headers) {
    const header = [
      CAPITAL_GAINS_CSV_COLUMNS.ASSET_AMOUNT,
      CAPITAL_GAINS_CSV_COLUMNS.ASSET_NAME,
      CAPITAL_GAINS_CSV_COLUMNS.RECEIVED_DATE,
      CAPITAL_GAINS_CSV_COLUMNS.DATE_SOLD,
      CAPITAL_GAINS_CSV_COLUMNS.PROCEEDS_USD,
      CAPITAL_GAINS_CSV_COLUMNS.COST_BASIS_USD,
      CAPITAL_GAINS_CSV_COLUMNS.GAIN_USD,
      CAPITAL_GAINS_CSV_COLUMNS.TYPE,
    ].join(',');
    lines.push(header);
  }

  gains.forEach((row) => lines.push(row.toCsvRow()));

  if (capitalGainsTotals) {
    lines.push(capitalGainsTotals.toCsvRow());
  }

  return writeHbdFile(HdbDir.COINTRACKER_CAPITAL_GAINS_OUTPUT, `${filename}.csv`, lines);
}

/**
 * @param {string} filename - filename
 * @param {CapitalGains[]} gains - array of CapitalGains
 * @param {boolean} headers
 * @param {CapitalGainsTotals} capitalGainsTotals
 * @param {boolean} pages
 * @returns {Promise<number>} - the number of rows written
 */
export async function writeCapitalGainsF8949(
  filename,
  gains,
  headers = true,
  capitalGainsTotals,
  pages = false,
) {
  let linesWritten = 0;

  const long = gains.filter((g) => g.type === CAPITAL_GAIN_TYPE.LONG_TERM);
  if (long.length) {
    linesWritten += await writeCapitalGainsF8949CSV(
      filename,
      long,
      'long',
      headers,
      capitalGainsTotals,
      pages,
    );
  }

  const short = gains.filter((g) => g.type === CAPITAL_GAIN_TYPE.SHORT_TERM);
  if (short.length) {
    linesWritten += await writeCapitalGainsF8949CSV(
      filename,
      short,
      'short',
      headers,
      capitalGainsTotals,
      pages,
    );
  }

  return linesWritten;
}

const F8949_ROWS_PER_PAGE = 14;
/**
 * @param {string} filename - filename
 * @param {CapitalGains[]} gains - array of CapitalGains
 * @param {string} term
 * @param {boolean} headers
 * @param {CapitalGainsTotals} capitalGainsTotals
 * @param {boolean} pages
 * @returns {Promise<number>} - the number of rows written
 */
export async function writeCapitalGainsF8949CSV(
  filename,
  gains,
  term,
  headers = true,
  capitalGainsTotals,
  pages = false,
) {
  filename += `.${term}`;

  const masterLines = [];

  const header = [
    F8949_COLUMN_NAMES.DESCRIPTION,
    F8949_COLUMN_NAMES.DATE_ACQUIRED,
    F8949_COLUMN_NAMES.DATE_SOLD,
    F8949_COLUMN_NAMES.PROCEEDS,
    F8949_COLUMN_NAMES.COST,
    F8949_COLUMN_NAMES.CODE,
    F8949_COLUMN_NAMES.ADJUSTMENT,
    F8949_COLUMN_NAMES.GAIN,
  ].join(',');

  if (headers) {
    masterLines.push(header);
  }

  let pageLines = [];
  let pageProceeds = 0;
  let pageCost = 0;
  let pageGain = 0;
  let pageNumber = 0;

  for (const gain of gains) {
    // TODO JS Number math here is inferior to DB math
    const numProceeds = Number(gain.proceeds_usd);
    const numCost = Number(gain.cost_basis_usd);
    const numGain = Number(gain.gain_usd);

    masterLines.push(gain.toF8949Row());

    if (pages) {
      pageProceeds += numProceeds;
      pageCost += numCost;
      pageGain += numGain;

      if (pageLines.length === F8949_ROWS_PER_PAGE) {
        if (headers) {
          pageLines.unshift(header);
        }

        if (capitalGainsTotals) {
          pushTotalsLines(pageLines, pageProceeds, pageCost, pageGain);
        }

        await writePage(++pageNumber, filename, pageLines);

        pageLines = [];
        pageProceeds = 0;
        pageCost = 0;
        pageGain = 0;
      }
    }
  }

  if (pages) {
    if (pageLines.length) {
      if (headers) {
        pageLines.unshift(header);
      }

      if (capitalGainsTotals) {
        pushTotalsLines(pageLines, pageProceeds, pageCost, pageGain);
      }

      await writePage(++pageNumber, filename, pageLines);
    }
  }

  if (capitalGainsTotals) {
    masterLines.push(capitalGainsTotals.toF8949CSV());
  }

  return writeHbdFile(
    HdbDir.COINTRACKER_CAPITAL_GAINS_OUTPUT,
    `${filename}.f8949.csv`,
    masterLines,
  );
}

/**
 * @param {string} filename - filename
 * @param {CapitalGainsGroup[]} gains - array of CapitalGains
 * @param {boolean} raw
 * @param {boolean} headers
 * @param {CapitalGainsTotals} capitalGainsTotals
 * @returns {Promise<number>} - the number of rows written
 */
export async function writeCapitalGainsGroupCsv(
  filename,
  gains,
  raw,
  headers = true,
  capitalGainsTotals,
) {
  const lines = [];

  if (headers) {
    const header = [
      'Asset',
      'Amount',
      'Trades',
      'Cost Basis',
      'Proceeds',
      'Gains',
      'Average Gain',
      'Max Gain',
      'Max Loss',
      'ROI Basis',
    ].join(',');
    lines.push(header);
  }

  gains.forEach((gains) => lines.push(gains.toCsvRow(raw)));

  if (capitalGainsTotals) {
    lines.push(capitalGainsTotals.toCsvRow(raw));
  }

  return writeHbdFile(HdbDir.COINTRACKER_CAPITAL_GAINS_OUTPUT, `${filename}.group.csv`, lines);
}

/**
 * @param {string} filename
 * @param {CapitalGainsGroup[]} gains
 * @param {boolean} headers
 * @param {CapitalGainsTotals} capitalGainsTotals
 * @param {boolean} pages
 */
export async function writeCapitalGainsGroupF8949(
  filename,
  gains,
  headers = true,
  capitalGainsTotals,
  pages = false,
) {
  const lines = [];

  const header = [
    F8949_COLUMN_NAMES.DESCRIPTION,
    F8949_COLUMN_NAMES.DATE_ACQUIRED,
    F8949_COLUMN_NAMES.DATE_SOLD,
    F8949_COLUMN_NAMES.PROCEEDS,
    F8949_COLUMN_NAMES.COST,
    F8949_COLUMN_NAMES.CODE,
    F8949_COLUMN_NAMES.ADJUSTMENT,
    F8949_COLUMN_NAMES.GAIN,
  ].join(',');
  if (headers) {
    lines.push(header);
  }

  for (const gain of gains) {
    lines.push(gain.toF8949Row());
  }

  if (capitalGainsTotals) {
    lines.push(capitalGainsTotals.toF8949CSV());
  }

  return writeHbdFile(
    HdbDir.COINTRACKER_CAPITAL_GAINS_OUTPUT,
    `${filename}.group.f8949.csv`,
    lines,
  );
}
