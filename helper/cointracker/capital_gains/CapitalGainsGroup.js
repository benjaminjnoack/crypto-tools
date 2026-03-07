import { CAPITAL_GAINS_GROUP } from '../dictionary.js';
import { formatToCents, stripTrailingZeros } from '../../db/cli/utils.js';

export default class CapitalGainsGroup {
  constructor(row) {
    for (const [key, value] of Object.entries(CAPITAL_GAINS_GROUP)) {
      if (!Object.hasOwn(row, value)) {
        console.dir(row);
        throw new Error(`Capital Gains Group row is missing ${key}: ${value}`);
      }
    }
    this.row = row;
  }
  /**
   * @returns {string}
   */
  get group() {
    return this.row[CAPITAL_GAINS_GROUP.GROUP];
  }
  /**
   * @returns {string}
   */
  get amount() {
    return this.row[CAPITAL_GAINS_GROUP.AMOUNT];
  }
  /**
   * @returns {string}
   */
  get trades() {
    return this.row[CAPITAL_GAINS_GROUP.TRADES];
  }
  /**
   * @returns {string}
   */
  get basis() {
    return this.row[CAPITAL_GAINS_GROUP.BASIS];
  }
  /**
   * @returns {string}
   */
  get proceeds() {
    return this.row[CAPITAL_GAINS_GROUP.PROCEEDS];
  }
  /**
   * @returns {string}
   */
  get gains() {
    return this.row[CAPITAL_GAINS_GROUP.GAINS];
  }
  /**
   * @returns {string}
   */
  get avg_gain() {
    return this.row[CAPITAL_GAINS_GROUP.AVG_GAIN];
  }
  /**
   * @returns {string}
   */
  get max_gain() {
    return this.row[CAPITAL_GAINS_GROUP.MAX_GAIN];
  }
  /**
   * @returns {string}
   */
  get max_loss() {
    return this.row[CAPITAL_GAINS_GROUP.MAX_LOSS];
  }
  /**
   * @returns {string}
   */
  get roi_basis() {
    return this.row[CAPITAL_GAINS_GROUP.ROI_BASIS];
  }

  /**
   * @param {boolean} raw
   * @returns {{group: string, amount: string, basis: string, proceeds: string, gains: string, avg_gain: string, max_gain: string, max_loss: string, roi_basis: string}}
   */
  toTableRow(raw = false) {
    if (raw) {
      return {
        group: this.group,
        amount: this.amount,
        basis: this.basis,
        proceeds: this.proceeds,
        gains: this.gains,
        avg_gain: this.avg_gain,
        max_gain: this.max_gain,
        max_loss: this.max_loss,
        roi_basis: this.roi_basis,
      };
    } else {
      return {
        group: this.group,
        amount: formatToCents(this.amount),
        basis: formatToCents(this.basis),
        proceeds: formatToCents(this.proceeds),
        gains: formatToCents(this.gains),
        avg_gain: formatToCents(this.avg_gain),
        max_gain: formatToCents(this.max_gain),
        max_loss: formatToCents(this.max_loss),
        roi_basis: formatToCents(this.roi_basis),
      };
    }
  }

  /**
   * @param {boolean} raw
   * @returns {string}
   */
  toCsvRow(raw = false) {
    if (raw) {
      return [
        this.group,
        this.amount,
        this.trades,
        this.basis,
        this.proceeds,
        this.gains,
        this.avg_gain,
        this.max_gain,
        this.max_loss,
        this.roi_basis,
      ].join(',');
    } else {
      return [
        this.group,
        stripTrailingZeros(this.amount),
        this.trades,
        formatToCents(this.basis),
        formatToCents(this.proceeds),
        formatToCents(this.gains),
        formatToCents(this.avg_gain),
        formatToCents(this.max_gain),
        formatToCents(this.max_loss),
        formatToCents(this.roi_basis),
      ].join(',');
    }
  }

  /**
   * @returns {string}
   */
  toF8949Row() {
    return [
      `${stripTrailingZeros(this.amount)} ${this.group}`,
      'Various',
      'Various',
      formatToCents(this.proceeds),
      formatToCents(this.basis),
      '',
      '',
      formatToCents(this.gains),
    ].join(',');
  }
}
