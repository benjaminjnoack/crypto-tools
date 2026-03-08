import {
  BALANCE_COLUMNS,
  getAbbreviatedType,
  getClassifierForType,
  getSuperclassForType,
  TRANSACTIONS_COLUMNS,
} from '../dictionary';
import { getBalanceToIncrement } from '@db/cli/utils.js';
/**
 * This class represents a transaction as stored in the COINBASE_TRANSACTIONS_TABLE
 */
export default class Transaction {
  /**
   * @param {object} row - the row as returned from the DB
   */
  constructor(row) {
    for (const [key, value] of Object.entries(TRANSACTIONS_COLUMNS)) {
      if (!Object.hasOwn(row, value)) {
        console.dir(row);
        throw new Error(`Transaction column is missing ${key}: ${value}`);
      }
    }
    this.row = row;
    if (Object.hasOwn(row, BALANCE_COLUMNS.BALANCE)) {
      this._balance = row[BALANCE_COLUMNS.BALANCE];
    } else {
      this._balance = null;
    }
  }

  /**
   * @returns {string} - CSV string
   */
  get id() {
    return this.row[TRANSACTIONS_COLUMNS.ID];
  }
  /**
   * @returns {Date} - Date returned from the DB
   */
  get timestamp() {
    return this.row[TRANSACTIONS_COLUMNS.TIMESTAMP];
  }
  /**
   * @returns {string} - CSV string
   */
  get type() {
    return this.row[TRANSACTIONS_COLUMNS.TYPE];
  }
  /**
   * @returns {string} - getClassifierForType(this.type)
   */
  get classifier() {
    return getClassifierForType(this.type);
  }
  /**
   * @returns {string} - getSuperclassForType(this.type)
   */
  get superClassifier() {
    return getSuperclassForType(this.type);
  }
  /**
   * @returns {string} - CSV string
   */
  get asset() {
    return this.row[TRANSACTIONS_COLUMNS.ASSET];
  }
  /**
   * @returns {string} - CSV string
   */
  get quantity() {
    return this.row[TRANSACTIONS_COLUMNS.QUANTITY];
  }
  /**
   * @returns {string} - CSV string
   */
  get price_currency() {
    return this.row[TRANSACTIONS_COLUMNS.PRICE_CURRENCY];
  }
  /**
   * @returns {string} - CSV string
   */
  get price_at_tx() {
    return this.row[TRANSACTIONS_COLUMNS.PRICE_AT_TX];
  }
  /**
   * @returns {string} - CSV string
   */
  get subtotal() {
    return this.row[TRANSACTIONS_COLUMNS.SUBTOTAL];
  }
  /**
   * @returns {string} - CSV string
   */
  get total() {
    return this.row[TRANSACTIONS_COLUMNS.TOTAL];
  }
  /**
   * @returns {string} - CSV string
   */
  get fee() {
    return this.row[TRANSACTIONS_COLUMNS.FEE];
  }
  /**
   * @returns {string} - CSV string
   */
  get notes() {
    return this.row[TRANSACTIONS_COLUMNS.NOTES];
  }
  /**
   * @returns {string} clean string, stored NUMERIC
   */
  get num_quantity() {
    return this.row[TRANSACTIONS_COLUMNS.NUM_QUANTITY];
  }
  /**
   * @returns {string} clean string, stored NUMERIC
   */
  get num_price_at_tx() {
    return this.row[TRANSACTIONS_COLUMNS.NUM_PRICE_AT_TX];
  }
  /**
   * @returns {string} clean string, stored NUMERIC
   */
  get num_subtotal() {
    return this.row[TRANSACTIONS_COLUMNS.NUM_SUBTOTAL];
  }
  /**
   * @returns {string} clean string, stored NUMERIC
   */
  get num_total() {
    return this.row[TRANSACTIONS_COLUMNS.NUM_TOTAL];
  }
  /**
   * @returns {string} clean string, stored NUMERIC
   */
  get num_fee() {
    return this.row[TRANSACTIONS_COLUMNS.NUM_FEE];
  }
  /**
   * @returns {number} clean string, parsed as a Number, and stored DOUBLE PRECISION
   */
  get js_num_quantity() {
    return this.row[TRANSACTIONS_COLUMNS.JS_NUM_QUANTITY];
  }
  /**
   * @returns {number} clean string, parsed as a Number, and stored DOUBLE PRECISION
   */
  get js_num_price_at_tx() {
    return this.row[TRANSACTIONS_COLUMNS.JS_NUM_PRICE_AT_TX];
  }
  /**
   * @returns {number} clean string, parsed as a Number, and stored DOUBLE PRECISION
   */
  get js_num_subtotal() {
    return this.row[TRANSACTIONS_COLUMNS.JS_NUM_SUBTOTAL];
  }
  /**
   * @returns {number} clean string, parsed as a Number, and stored DOUBLE PRECISION
   */
  get js_num_total() {
    return this.row[TRANSACTIONS_COLUMNS.JS_NUM_TOTAL];
  }
  /**
   * @returns {number} clean string, parsed as a Number, and stored DOUBLE PRECISION
   */
  get js_num_fee() {
    return this.row[TRANSACTIONS_COLUMNS.JS_NUM_FEE];
  }
  /**
   * @returns {string} - clean string, covered to Big, scaled by lazy inference, stored NUMERIC
   */
  get int_quantity() {
    return this.row[TRANSACTIONS_COLUMNS.INT_QUANTITY];
  }
  /**
   * @returns {string} - clean string, covered to Big, scaled by lazy inference, stored NUMERIC
   */
  get int_price_at_tx() {
    return this.row[TRANSACTIONS_COLUMNS.INT_PRICE_AT_TX];
  }
  /**
   * @returns {string} - clean string, covered to Big, scaled by lazy inference, stored NUMERIC
   */
  get int_subtotal() {
    return this.row[TRANSACTIONS_COLUMNS.INT_SUBTOTAL];
  }
  /**
   * @returns {string} - clean string, covered to Big, scaled by lazy inference, stored NUMERIC
   */
  get int_total() {
    return this.row[TRANSACTIONS_COLUMNS.INT_TOTAL];
  }
  /**
   * @returns {string} - clean string, covered to Big, scaled by lazy inference, stored NUMERIC
   */
  get int_fee() {
    return this.row[TRANSACTIONS_COLUMNS.INT_FEE];
  }
  /**
   * @returns {string|null}
   */
  get balance() {
    return this._balance;
  }

  /**
   * Intended to be used to set precise strings
   * @param {string} balance
   */
  set balance(balance) {
    this._balance = balance;
  }

  /**
   * @param {boolean} classify
   * @param {boolean} notes
   * @param {boolean} balance
   * @param {boolean} raw
   * @returns {Promise<{id: string, timestamp: Date, asset: string}>}
   */
  async toTableRow(classify, notes, balance, raw) {
    const row = {
      id: this.id,
      timestamp: this.timestamp,
      asset: this.asset,
    };

    if (notes) {
      // classify is ignored by notes
      row['type'] = getAbbreviatedType(this.type);
      row['quantity'] = this.num_quantity;
      row['notes'] = this.notes;
    } else {
      if (classify) {
        row['class'] = this.classifier;
        row['super'] = this.superClassifier;
      } else {
        row['type'] = this.type;
      }
      row['quantity'] = this.num_quantity;
      row['price'] = this.num_price_at_tx;
      row['total'] = this.num_total;
      row['fee'] = this.num_fee;
    }

    if (balance) {
      if (this._balance === null) {
        throw new Error(`Transaction ${this.id} => missing balance`);
      }
      if (raw) {
        row['balance'] = this.balance;
      } else {
        row['balance'] = await getBalanceToIncrement(this.asset, this.balance, false);
      }
    }

    return row;
  }

  /**
   * @param {boolean} balance
   * @param {boolean} raw - return values as they were parsed directly from the CSV, else use the clean num_x values
   * @returns {Promise<string>}
   */
  async toCsvRow(balance = false, raw = false) {
    let row;
    if (raw) {
      row = [
        this.id,
        this.timestamp.toISOString(),
        this.type,
        this.asset,
        this.quantity,
        this.price_currency,
        this.price_at_tx,
        this.subtotal,
        this.total,
        this.fee,
        this.notes?.replace(/[\n\r,]/g, ' ') ?? '',
      ];
    } else {
      row = [
        this.id,
        this.timestamp.toISOString(),
        this.type,
        this.asset,
        this.num_quantity,
        this.price_currency,
        this.num_price_at_tx,
        this.num_subtotal,
        this.num_total,
        this.num_fee,
        this.notes?.replace(/[\n\r,]/g, ' ') ?? '',
      ];
    }

    if (balance) {
      if (this._balance === null) {
        throw new Error(`Transaction ${this.id} => missing balance`);
      }
    }

    if (raw) {
      row.push(this.balance);
    } else {
      let b = await getBalanceToIncrement(this.asset, this.balance, false);
      row.push(b);
    }

    return row.join(',');
  }
}
