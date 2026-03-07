import { CAPITAL_GAINS_TABLE } from '../dictionary.js';

export default class CapitalGains {
  constructor(row) {
    for (const [key, value] of Object.entries(CAPITAL_GAINS_TABLE)) {
      if (!Object.hasOwn(row, value)) {
        console.dir(row);
        throw new Error(`Capital Gains row is missing ${key}: ${value}`);
      }
    }
    this.row = row;
  }
  /**
   * @returns {string}
   */
  get asset_amount() {
    return this.row[CAPITAL_GAINS_TABLE.ASSET_AMOUNT];
  }
  /**
   * @returns {string}
   */
  get asset_name() {
    return this.row[CAPITAL_GAINS_TABLE.ASSET_NAME];
  }
  /**
   * @returns {Date}
   */
  get received_date() {
    return this.row[CAPITAL_GAINS_TABLE.RECEIVED_DATE];
  }
  /**
   * @returns {Date}
   */
  get date_sold() {
    return this.row[CAPITAL_GAINS_TABLE.DATE_SOLD];
  }
  /**
   * @returns {string}
   */
  get proceeds_usd() {
    return this.row[CAPITAL_GAINS_TABLE.PROCEEDS_USD];
  }
  /**
   * @returns {string}
   */
  get cost_basis_usd() {
    return this.row[CAPITAL_GAINS_TABLE.COST_BASIS_USD];
  }
  /**
   * @returns {string}
   */
  get gain_usd() {
    return this.row[CAPITAL_GAINS_TABLE.GAIN_USD];
  }
  /**
   * @returns {string}
   */
  get type() {
    return this.row[CAPITAL_GAINS_TABLE.TYPE];
  }

  /**
   * @returns {{asset_name: string, asset_amount: string, received_date: Date, date_sold: Date, proceeds_usd: string, cost_basis_usd: string, gain_usd: string, type: string}}
   */
  toTableRow() {
    return {
      [CAPITAL_GAINS_TABLE.ASSET_AMOUNT]: this.asset_amount,
      [CAPITAL_GAINS_TABLE.ASSET_NAME]: this.asset_name,
      [CAPITAL_GAINS_TABLE.RECEIVED_DATE]: this.received_date,
      [CAPITAL_GAINS_TABLE.DATE_SOLD]: this.date_sold,
      [CAPITAL_GAINS_TABLE.PROCEEDS_USD]: this.proceeds_usd,
      [CAPITAL_GAINS_TABLE.COST_BASIS_USD]: this.cost_basis_usd,
      [CAPITAL_GAINS_TABLE.GAIN_USD]: this.gain_usd,
      [CAPITAL_GAINS_TABLE.TYPE]: this.type,
    };
  }

  /**
   * NOTE: dates are returned in the locale date string
   * as that is how they are imported
   * @returns {string}
   */
  toCsvRow() {
    return [
      this.asset_amount,
      this.asset_name,
      this.received_date.toLocaleDateString(),
      this.date_sold.toLocaleDateString(),
      this.proceeds_usd,
      this.cost_basis_usd,
      this.gain_usd,
      this.type,
    ].join(',');
  }

  /**
   * NOTE: dates are returned in the locale date string
   * as required by U.S. Tax Law
   * @returns {string}
   */
  toF8949Row() {
    return [
      `${this.asset_amount} ${this.asset_name}`,
      this.received_date.toLocaleDateString(),
      this.date_sold.toLocaleDateString(),
      this.proceeds_usd,
      this.cost_basis_usd,
      '',
      '',
      this.gain_usd,
    ].join(',');
  }
}
