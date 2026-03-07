import Big from 'big.js';
import { STATEMENT_COLUMNS } from '../dictionary';
Big.strict = true;
/**
 * This class represents a single row from a Coinbase Statement.
 */
export default class StatementRow {
  /**
   * @param {object} row
   * @param {boolean} synthetic
   * @param {boolean} manual
   */
  constructor(row, synthetic = false, manual = false) {
    for (const [key, value] of Object.entries(STATEMENT_COLUMNS)) {
      if (!Object.hasOwn(row, value)) {
        console.dir(row);
        throw new Error(`Statement row is missing ${key}: ${value}`);
      }
    }
    this.row = row;
    this.synthetic = synthetic;
    this.manual = manual;
  }

  /**
   * @returns {string}
   */
  get id() {
    return this.row[STATEMENT_COLUMNS.ID];
  }
  /**
   * @returns {string}
   */
  get timestamp() {
    return this.row[STATEMENT_COLUMNS.TIMESTAMP];
  }
  /**
   * @returns {Date}
   */
  get date() {
    return new Date(this.timestamp);
  }
  /**
   * @returns {string}
   */
  get type() {
    return this.row[STATEMENT_COLUMNS.TYPE];
  }
  /**
   * @returns {string}
   */
  get asset() {
    return this.row[STATEMENT_COLUMNS.ASSET];
  }
  /**
   * @returns {string}
   */
  get quantity() {
    return this.row[STATEMENT_COLUMNS.QUANTITY];
  }
  /**
   * @returns {string}
   */
  get price_currency() {
    return this.row[STATEMENT_COLUMNS.PRICE_CURRENCY];
  }
  /**
   * @returns {string}
   */
  get price_at_tx() {
    return this.row[STATEMENT_COLUMNS.PRICE_AT_TX];
  }
  /**
   * @returns {string}
   */
  get subtotal() {
    return this.row[STATEMENT_COLUMNS.SUBTOTAL];
  }
  /**
   * @returns {string}
   */
  get total() {
    return this.row[STATEMENT_COLUMNS.TOTAL];
  }
  /**
   * @returns {string}
   */
  get fee() {
    return this.row[STATEMENT_COLUMNS.FEE];
  }
  /**
   * @returns {string}
   */
  get notes() {
    return this.row[STATEMENT_COLUMNS.NOTES];
  }
  /**
   * For use in NUMERIC columns
   * @param {string} str
   * @returns {string}
   */
  static parseStr(str) {
    if (typeof str !== 'string') {
      throw new Error(`${str} is not a string: ${typeof str}`);
    } else if (str === '') {
      throw new Error(`str is empty`);
    }
    // Remove dollar signs and commas that may be in the CSV data
    /**
     *  remove the negative sign (-) as well
     *  this requires all dispossession delta calculation to be multiplied by -1
     *  meaning, sell, advanced sell, withdrawal, send, are all quantity * -1
     *  for the calculation of delta
     *  The weird case is UNWRAP, which can be a positive or negative quantity
     *  so if we deleted the negative sign then there would be no way to know
     *  unless UNWRAP itself tells the story.
     *  Like UNWRAP cbETH deducts from the cbETH balance
     *  unwrap ETH2 adds to the ETH balance
     */
    return str.replace(/[$,-]/g, '');
  }
  /**
   * @returns {string} parseStr(this.quantity)
   */
  get num_quantity() {
    return StatementRow.parseStr(this.quantity);
  }
  /**
   * @returns {string} - parseStr(this.price_at_tx)
   */
  get num_price_at_tx() {
    return StatementRow.parseStr(this.price_at_tx);
  }
  /**
   * @returns {string} - parseStr(this.subtotal)
   */
  get num_subtotal() {
    return StatementRow.parseStr(this.subtotal);
  }
  /**
   * @returns {string} - parseStr(this.total)
   */
  get num_total() {
    return StatementRow.parseStr(this.total);
  }
  /**
   * @returns {string} - parseStr(this.fee)
   */
  get num_fee() {
    return StatementRow.parseStr(this.fee);
  }
  /**
   * For use in DOUBLE PRECISION columns
   * @param {string} str
   * @returns {number}
   */
  static parseNum(str) {
    const clean = StatementRow.parseStr(str);

    const num = Number(clean);

    if (!Number.isFinite(num)) {
      throw new Error(`${clean} is not finite`);
    }

    return num;
  }
  /**
   * @returns {number} parseNum(this.quantity)
   */
  get js_num_quantity() {
    return StatementRow.parseNum(this.quantity);
  }
  /**
   * @returns {number} - parseNum(this.price_at_tx)
   */
  get js_num_price_at_tx() {
    return StatementRow.parseNum(this.price_at_tx);
  }
  /**
   * @returns {number} - parseNum(this.subtotal)
   */
  get js_num_subtotal() {
    return StatementRow.parseNum(this.subtotal);
  }
  /**
   * @returns {number} - parseNum(this.total)
   */
  get js_num_total() {
    return StatementRow.parseNum(this.total);
  }
  /**
   * @returns {number} - parseNum(this.fee)
   */
  get js_num_fee() {
    return StatementRow.parseNum(this.fee);
  }
  /**
   * @param {string} str
   * @returns {number}
   */
  static lazyScaleInference(str) {
    return 10 ** (str.split('.')[1]?.length || 0);
  }
  /**
   * Intended for use in NUMERIC columns
   * (BIGINT columns may not be big enough!)
   * @param {string} str
   * @param {number} scale
   * @returns {string}
   */
  static parseInt(str, scale = -1) {
    const clean = StatementRow.parseStr(str);
    if (scale === -1) scale = StatementRow.lazyScaleInference(clean);
    const big = new Big(clean);
    const bigScale = new Big(scale.toFixed(0)); // calling toFixed is necessary for Big.strict = true
    const scaled = big.times(bigScale);
    const int = BigInt(scaled.toFixed(0)); // safe conversion to int
    return int.toString();
  }
  /**
   * @returns {string} - parseInt(this.quantity)
   */
  get int_quantity() {
    return StatementRow.parseInt(this.quantity);
  }
  /**
   * @returns {string} - parseInt(this.price_at_tx)
   */
  get int_price_at_tx() {
    return StatementRow.parseInt(this.price_at_tx);
  }
  /**
   * @returns {string} - parseInt(this.subtotal)
   */
  get int_subtotal() {
    return StatementRow.parseInt(this.subtotal);
  }
  /**
   * @returns {string} - parseInt(this.total)
   */
  get int_total() {
    return StatementRow.parseInt(this.total);
  }
  /**
   * @returns {string} - parseInt(this.fee)
   */
  get int_fee() {
    return StatementRow.parseInt(this.fee);
  }

  /**
   * @returns {(string|Date|number)[]}
   */
  toSqlValues() {
    return [
      this.id,
      this.date,
      this.type,
      this.asset,
      this.price_currency,
      this.notes,
      this.synthetic,
      this.manual,
      this.quantity,
      this.price_at_tx,
      this.subtotal,
      this.total,
      this.fee,
      this.num_quantity,
      this.num_price_at_tx,
      this.num_subtotal,
      this.num_total,
      this.num_fee,
      this.js_num_quantity,
      this.js_num_price_at_tx,
      this.js_num_subtotal,
      this.js_num_total,
      this.js_num_fee,
      this.int_quantity,
      this.int_price_at_tx,
      this.int_subtotal,
      this.int_total,
      this.int_fee,
    ];
  }
}
