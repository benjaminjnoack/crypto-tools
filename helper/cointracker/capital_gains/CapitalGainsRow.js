import { CAPITAL_GAINS_CSV_COLUMNS } from '../dictionary.js';

export default class CapitalGainsRow {
  constructor(row) {
    for (const [key, value] of Object.entries(CAPITAL_GAINS_CSV_COLUMNS)) {
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
    return this.row[CAPITAL_GAINS_CSV_COLUMNS.ASSET_AMOUNT];
  }
  /**
   * @returns {string}
   */
  get asset_name() {
    return this.row[CAPITAL_GAINS_CSV_COLUMNS.ASSET_NAME];
  }
  /**
   * @returns {string}
   */
  get received_date() {
    return this.row[CAPITAL_GAINS_CSV_COLUMNS.RECEIVED_DATE];
  }
  /**
   * @returns {string}
   */
  get date_sold() {
    return this.row[CAPITAL_GAINS_CSV_COLUMNS.DATE_SOLD];
  }
  /**
   * @returns {string}
   */
  get proceeds_usd() {
    return this.row[CAPITAL_GAINS_CSV_COLUMNS.PROCEEDS_USD];
  }
  /**
   * @returns {string}
   */
  get cost_basis_usd() {
    return this.row[CAPITAL_GAINS_CSV_COLUMNS.COST_BASIS_USD];
  }
  /**
   * @returns {string}
   */
  get gain_usd() {
    return this.row[CAPITAL_GAINS_CSV_COLUMNS.GAIN_USD];
  }
  /**
   * @returns {string}
   */
  get type() {
    return this.row[CAPITAL_GAINS_CSV_COLUMNS.TYPE];
  }

  /**
   * @returns {string[]}
   */
  toSqlValues() {
    return [
      this.asset_amount,
      this.asset_name,
      new Date(this.received_date),
      new Date(this.date_sold),
      this.proceeds_usd,
      this.cost_basis_usd,
      this.gain_usd,
      this.type,
    ];
  }
}
