import { log } from '@core/logger.js';
import { HdbDir, writeHbdFile } from '@db/cli/hdbPaths.js';

/**
 * @param {Lot[]} lots
 * @param {string} filename
 * @param {boolean} balance
 * @param {boolean} notes
 * @param {boolean} obfuscate
 */
export function exportCoinbaseLotsToCSV(
  lots,
  filename,
  balance = false,
  notes = false,
  obfuscate = false,
) {
  if (lots.length === 0) {
    throw new Error(`No transactions to write to ${filename}`);
  }

  const statementColumns = [
    'Lot ID',
    'Asset',
    'Date Acquired',
    'Date Sold',
    'Size',
    'Cost Basis',
    'Proceeds',
    'Gain',
    'Term',
  ];

  if (balance) {
    statementColumns.push('Balance');
  }

  if (obfuscate) {
    log.warn('Obfuscating Lot IDs');
  } else if (notes) {
    statementColumns.push('Notes');
  }

  const header = statementColumns.join(',');

  const lines = [header];

  for (const lot of lots) {
    const row = [];
    if (obfuscate) {
      row.push(lot.getLotId());
    } else {
      row.push(lot.id);
    }

    row.push(
      lot.asset,
      lot.acquired,
      lot.sold,
      lot.size,
      lot.basis,
      lot.proceeds,
      lot.gain,
      lot.term,
    );

    if (balance) {
      row.push(lot.balance);
    }
    if (!obfuscate && notes) {
      row.push(lot.getNotes());
    }

    const line = row.map((val) => (val === null || val === undefined ? '' : val));
    lines.push(line.join(','));
  }

  return writeHbdFile(HdbDir.COINBASE_LOTS_OUTPUT, `${filename}.csv`, lines);
}
