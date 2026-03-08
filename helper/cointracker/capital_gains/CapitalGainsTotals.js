import { formatToCents } from '../../db/cli/utils.js';
import { CAPITAL_GAINS_TOTALS } from '../dictionary.js';

export class CapitalGainsTotals {
  constructor(row) {
    for (const [key, value] of Object.entries(CAPITAL_GAINS_TOTALS)) {
      if (!Object.hasOwn(row, value)) {
        console.dir(row);
        throw new Error(`Capital Gains Totals row is missing ${key}: ${value}`);
      }
    }
    this.row = row;
  }
  /**
   * @returns {string}
   */
  get cost_basis() {
    return this.row[CAPITAL_GAINS_TOTALS.COST_BASIS];
  }
  /**
   * @returns {string}
   */
  get gain() {
    return this.row[CAPITAL_GAINS_TOTALS.GAIN];
  }
  /**
   * @returns {string}
   */
  get proceeds() {
    return this.row[CAPITAL_GAINS_TOTALS.PROCEEDS];
  }
  /**
   * @returns {string}
   */
  get trades() {
    return this.row[CAPITAL_GAINS_TOTALS.TRADES];
  }

  /**
   * @param raw
   * @returns {{trades: string, cost_basis: string, proceeds: string, gain: string}}
   */
  toTableRow(raw = false) {
    if (raw) {
      return {
        trades: this.trades,
        cost_basis: this.cost_basis,
        proceeds: this.proceeds,
        gain: this.gain,
      };
    } else {
      return {
        trades: this.trades,
        cost_basis: formatToCents(this.cost_basis),
        proceeds: formatToCents(this.proceeds),
        gain: formatToCents(this.gain),
      };
    }
  }

  /**
   * @param raw
   * @returns {string}
   */
  toCsvRow(raw = false) {
    return [
      'Totals:',
      '',
      '',
      raw ? this.cost_basis : formatToCents(this.cost_basis),
      raw ? this.proceeds : formatToCents(this.proceeds),
      raw ? this.gain : formatToCents(this.gain),
    ].join(',');
  }

  /**
   * @returns {string}
   */
  toF8949CSV() {
    return [
      'Totals:',
      '',
      '',
      formatToCents(this.proceeds),
      formatToCents(this.cost_basis),
      '',
      '',
      formatToCents(this.gain),
    ].join(',');
  }
}
