import CondensedLot from './CondensedLot.js';
import { F8949_COLUMN_NAMES } from '../../db/cli/dictionary.js';
import { HdbDir, writeHbdFile } from '../../db/cli/hdbPaths.js';

/**
 * @param {Lot[]} lots
 * @param {string} fileName - name for the file, without .csv
 * @param {boolean} headers - include header rows in the master and paginated output
 * @param {boolean} totals - include totals rows in the master and paginated output
 * @param {boolean} pages - Form 8949 only has room for fourteen line items (and a totals row) per page.
 * @param {Promise<number>} linesPerPage - number of lots per page of paginated output, default is 14 to match the Form 8949
 */
export async function exportLotsToForm8949CSV(
  lots,
  fileName,
  headers = true,
  totals = true,
  pages = false,
  linesPerPage = 14,
) {
  let masterLines = [];

  let header;
  if (headers) {
    const columns = [
      F8949_COLUMN_NAMES.DESCRIPTION,
      F8949_COLUMN_NAMES.DATE_ACQUIRED,
      F8949_COLUMN_NAMES.DATE_SOLD,
      F8949_COLUMN_NAMES.PROCEEDS,
      F8949_COLUMN_NAMES.COST,
      F8949_COLUMN_NAMES.CODE,
      F8949_COLUMN_NAMES.ADJUSTMENT,
      F8949_COLUMN_NAMES.GAIN,
    ];
    header = columns.join(',');
    masterLines.push(header);
  }

  let masterTotalProceeds = 0;
  let masterTotalCost = 0;
  let masterTotalGainOrLoss = 0;

  let pageLines = [];
  let pageTotalProceeds = 0;
  let pageTotalCost = 0;
  let pageTotalGainOrLoss = 0;
  let pageNumber = 0;

  for (const lot of lots) {
    masterTotalProceeds += lot.proceeds;
    masterTotalCost += lot.basis;
    masterTotalGainOrLoss += lot.gain;

    const line = format8949Line(lot);
    masterLines.push(line);

    if (pages) {
      pageTotalProceeds += lot.proceeds;
      pageTotalCost += lot.basis;
      pageTotalGainOrLoss += lot.gain;
      pageLines.push(line);

      if (pageLines.length === linesPerPage) {
        pageNumber++;

        if (headers) {
          pageLines.unshift(header);
        }
        if (totals) {
          const totalLine = formatTotalsLine(pageTotalProceeds, pageTotalCost, pageTotalGainOrLoss);
          pageLines.push(totalLine);
        }

        const paddedPageNum = String(pageNumber).padStart(2, '0');
        const pageFilePage = `${fileName}.pg${paddedPageNum}`;
        await writeHbdFile(HdbDir.COINBASE_LOTS_OUTPUT, `${pageFilePage}.csv`, pageLines);

        pageLines = [];
        pageTotalProceeds = 0;
        pageTotalCost = 0;
        pageTotalGainOrLoss = 0;
      }
    }
  }

  if (pages) {
    if (pageLines.length) {
      pageNumber++;

      if (headers) {
        pageLines.unshift(header);
      }
      if (totals) {
        const totalLine = formatTotalsLine(pageTotalProceeds, pageTotalCost, pageTotalGainOrLoss);
        pageLines.push(totalLine);
      }

      const paddedPageNum = String(pageNumber).padStart(2, '0');
      const pageFilePage = `${fileName}.pg${paddedPageNum}`;
      await writeHbdFile(HdbDir.COINBASE_LOTS_OUTPUT, `${pageFilePage}.csv`, pageLines);
    }
  }

  if (totals) {
    const totalLine = formatTotalsLine(masterTotalProceeds, masterTotalCost, masterTotalGainOrLoss);
    masterLines.push(totalLine);
  }

  return writeHbdFile(HdbDir.COINBASE_LOTS_OUTPUT, `${fileName}.csv`, masterLines);
}

/**
 * @param {string} asset
 * @param {Lot[]} lots
 * @param {string} term
 * @returns {Lot}
 */
export function summarizeLotsForCondensed8949(asset, lots, term = 'short') {
  const filtered = lots.filter((l) => l.term === term);
  const size = filtered.reduce((acc, l) => acc + l.size, 0);
  const proceeds = filtered.reduce((acc, l) => acc + l.proceeds, 0);
  const cost = filtered.reduce((acc, l) => acc + l.basis, 0);

  return new CondensedLot(asset, size, proceeds, cost, term);
}

/**
 * TODO use class helpers
 * @param {Lot} lot
 * @returns {string}
 */
function format8949Line(lot) {
  return [
    `${lot.size} ${lot.asset}`,
    lot.acquired,
    lot.sold,
    lot.proceeds.toFixed(2),
    lot.basis.toFixed(2),
    '',
    '',
    lot.gain > 0 ? lot.gain.toFixed(2) : `(${Math.abs(lot.gain).toFixed(2)})`,
  ].join(',');
}

/**
 * @param {number} proceeds
 * @param {number} cost
 * @param {number} gain
 * @returns {string}
 */
function formatTotalsLine(proceeds, cost, gain) {
  return ['Totals', '', '', proceeds.toFixed(2), cost.toFixed(2), '', '', gain.toFixed(2)].join(
    ',',
  );
}
