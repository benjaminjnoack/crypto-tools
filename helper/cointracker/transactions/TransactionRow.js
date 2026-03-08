import { TRANSACTIONS_CSV } from '../dictionary.js';

export default class TransactionRow {
  constructor(row) {
    for (const [key, value] of Object.entries(TRANSACTIONS_CSV)) {
      if (!Object.hasOwn(row, value)) {
        console.dir(row);
        throw new Error(`Transaction row is missing ${key}: ${value}`);
      }
    }
    this.row = row;
  }
  /**
   * @returns {string}
   */
  get date() {
    return this.row[TRANSACTIONS_CSV.DATE];
  }
  /**
   * @returns {string}
   */
  get type() {
    return this.row[TRANSACTIONS_CSV.TYPE];
  }
  /**
   * @returns {string}
   */
  get transaction_id() {
    return this.row[TRANSACTIONS_CSV.TRANSACTION_ID];
  }
  /**
   * @returns {string}
   */
  get received_quantity() {
    return this.row[TRANSACTIONS_CSV.RECEIVED_QUANTITY];
  }
  /**
   * @returns {string}
   */
  get received_currency() {
    return this.row[TRANSACTIONS_CSV.RECEIVED_CURRENCY];
  }
  /**
   * @returns {string}
   */
  get received_cost_basis() {
    return this.row[TRANSACTIONS_CSV.RECEIVED_COST_BASIS];
  }
  /**
   * @returns {string}
   */
  get received_wallet() {
    return this.row[TRANSACTIONS_CSV.RECEIVED_WALLET];
  }
  /**
   * @returns {string}
   */
  get received_address() {
    return this.row[TRANSACTIONS_CSV.RECEIVED_ADDRESS];
  }
  /**
   * @returns {string}
   */
  get received_comment() {
    return this.row[TRANSACTIONS_CSV.RECEIVED_COMMENT];
  }
  /**
   * @returns {string}
   */
  get sent_quantity() {
    return this.row[TRANSACTIONS_CSV.SENT_QUANTITY];
  }
  /**
   * @returns {string}
   */
  get sent_currency() {
    return this.row[TRANSACTIONS_CSV.SENT_CURRENCY];
  }
  /**
   * @returns {string}
   */
  get sent_cost_basis() {
    return this.row[TRANSACTIONS_CSV.SENT_COST_BASIS];
  }
  /**
   * @returns {string}
   */
  get sent_wallet() {
    return this.row[TRANSACTIONS_CSV.SENT_WALLET];
  }
  /**
   * @returns {string}
   */
  get sent_address() {
    return this.row[TRANSACTIONS_CSV.SENT_ADDRESS];
  }
  /**
   * @returns {string}
   */
  get sent_comment() {
    return this.row[TRANSACTIONS_CSV.SENT_COMMENT];
  }
  /**
   * @returns {string}
   */
  get fee_amount() {
    return this.row[TRANSACTIONS_CSV.FEE_AMOUNT];
  }
  /**
   * @returns {string}
   */
  get fee_currency() {
    return this.row[TRANSACTIONS_CSV.FEE_CURRENCY];
  }
  /**
   * @returns {string}
   */
  get fee_cost_basis() {
    return this.row[TRANSACTIONS_CSV.FEE_COST_BASIS];
  }
  /**
   * @returns {string}
   */
  get realized_return() {
    return this.row[TRANSACTIONS_CSV.REALIZED_RETURN];
  }
  /**
   * @returns {string}
   */
  get fee_realized_return() {
    return this.row[TRANSACTIONS_CSV.FEE_REALIZED_RETURN];
  }
  /**
   * @returns {string}
   */
  get transaction_hash() {
    return this.row[TRANSACTIONS_CSV.TRANSACTION_HASH];
  }

  /**
   * @returns {(null|Date|string)[]}
   */
  toSqlValues() {
    return [
      this.transaction_id, // primary key
      /**
       * PostgreSQL interprets TIMESTAMPTZ values based on:
       * the server’s time zone, or
       * the client session's time zone, if not explicitly specified in the string.
       * So if you feed it '04/08/2025 16:35:48' without a timezone,
       * it assumes local time (e.g., America/New_York), and then converts it to UTC internally.
       * That’s why you get 20:35:48Z — it's applying a +4 hour offset.
       */
      new Date(`${this.date}Z`),
      this.type,
      cleanValue(this.received_quantity),
      this.received_currency,
      cleanValue(this.received_cost_basis),
      this.received_wallet,
      this.received_address,
      this.received_comment,
      cleanValue(this.sent_quantity),
      this.sent_currency,
      cleanValue(this.sent_cost_basis),
      this.sent_wallet,
      this.sent_address,
      this.sent_comment,
      cleanValue(this.fee_amount),
      this.fee_currency,
      cleanValue(this.fee_cost_basis),
      cleanValue(this.realized_return),
      cleanValue(this.fee_realized_return),
      this.transaction_hash,
    ];
  }
}

/**
 * PostgreSQL chokes on empty strings for NUMERIC columns
 * @param {string} val
 * @returns {string|null}
 */
function cleanValue(val) {
  if (val === '') return null;
  return val;
}
