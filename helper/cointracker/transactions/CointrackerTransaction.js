import { TRANSACTIONS_TABLE } from '../dictionary.js';
import { formatToCents, getBalanceToIncrement } from '../../db/cli/utils.js';

export default class CointrackerTransaction {
  constructor(row) {
    for (const [key, value] of Object.entries(TRANSACTIONS_TABLE)) {
      if (!Object.hasOwn(row, value)) {
        console.dir(row);
        throw new Error(`Cointracker Transactions row is missing ${key}: ${value}`);
      }
    }
    this.row = row;
  }

  /**
   * @returns {Date}
   */
  get date() {
    return this.row[TRANSACTIONS_TABLE.DATE];
  }
  /**
   * @returns {string}
   */
  get type() {
    return this.row[TRANSACTIONS_TABLE.TYPE];
  }
  /**
   * @returns {string}
   */
  get transaction_id() {
    return this.row[TRANSACTIONS_TABLE.TRANSACTION_ID];
  }
  /**
   * @returns {string}
   */
  get received_quantity() {
    return this.row[TRANSACTIONS_TABLE.RECEIVED_QUANTITY];
  }
  /**
   * @returns {string}
   */
  get received_currency() {
    return this.row[TRANSACTIONS_TABLE.RECEIVED_CURRENCY];
  }
  /**
   * @returns {string}
   */
  get received_cost_basis() {
    return this.row[TRANSACTIONS_TABLE.RECEIVED_COST_BASIS];
  }
  /**
   * @returns {string}
   */
  get received_wallet() {
    return this.row[TRANSACTIONS_TABLE.RECEIVED_WALLET];
  }
  /**
   * @returns {string}
   */
  get received_address() {
    return this.row[TRANSACTIONS_TABLE.RECEIVED_ADDRESS];
  }
  /**
   * @returns {string}
   */
  get received_comment() {
    return this.row[TRANSACTIONS_TABLE.RECEIVED_COMMENT];
  }
  /**
   * @returns {string}
   */
  get sent_quantity() {
    return this.row[TRANSACTIONS_TABLE.SENT_QUANTITY];
  }
  /**
   * @returns {string}
   */
  get sent_currency() {
    return this.row[TRANSACTIONS_TABLE.SENT_CURRENCY];
  }
  /**
   * @returns {string}
   */
  get sent_cost_basis() {
    return this.row[TRANSACTIONS_TABLE.SENT_COST_BASIS];
  }
  /**
   * @returns {string}
   */
  get sent_wallet() {
    return this.row[TRANSACTIONS_TABLE.SENT_WALLET];
  }
  /**
   * @returns {string}
   */
  get sent_address() {
    return this.row[TRANSACTIONS_TABLE.SENT_ADDRESS];
  }
  /**
   * @returns {string}
   */
  get sent_comment() {
    return this.row[TRANSACTIONS_TABLE.SENT_COMMENT];
  }
  /**
   * @returns {string}
   */
  get fee_amount() {
    return this.row[TRANSACTIONS_TABLE.FEE_AMOUNT];
  }
  /**
   * @returns {string}
   */
  get fee_currency() {
    return this.row[TRANSACTIONS_TABLE.FEE_CURRENCY];
  }
  /**
   * @returns {string}
   */
  get fee_cost_basis() {
    return this.row[TRANSACTIONS_TABLE.FEE_COST_BASIS];
  }
  /**
   * @returns {string}
   */
  get realized_return() {
    return this.row[TRANSACTIONS_TABLE.REALIZED_RETURN];
  }
  /**
   * @returns {string}
   */
  get fee_realized_return() {
    return this.row[TRANSACTIONS_TABLE.FEE_REALIZED_RETURN];
  }
  /**
   * @returns {string}
   */
  get transaction_hash() {
    return this.row[TRANSACTIONS_TABLE.TRANSACTION_HASH];
  }

  /**
   * @param {boolean} raw
   * @returns {Promise<{id: string, date: Date, type: string, received_quantity: string, received_currency: string, sent_quantity: string, sent_currency: string, realized_return: string, fees: string}>}
   */
  async toTableRow(raw = false) {
    const row = {
      id: this.transaction_id,
      date: this.date,
      type: this.type,
    };

    if (raw) {
      row.received_currency = this.received_currency;
      row.received_quantity = this.received_quantity;
      row.sent_currency = this.sent_currency;
      row.sent_quantity = this.sent_quantity;
    } else {
      if (this.received_currency) {
        row.received_currency = this.received_currency;
        row.received_quantity = await getBalanceToIncrement(
          this.received_currency,
          this.received_quantity,
        );
      } else {
        row.received_currency = null;
        row.received_quantity = 0;
      }
      if (this.sent_currency) {
        row.sent_currency = this.sent_currency;
        row.sent_quantity = await getBalanceToIncrement(this.sent_currency, this.sent_quantity);
      } else {
        row.sent_currency = null;
        row.sent_quantity = 0;
      }
    }

    row.realized_return = raw ? this.realized_return : formatToCents(this.realized_return);
    row.fees = raw ? this.fee_amount : formatToCents(this.fee_amount);

    if (raw) {
      if (this.row['received_currency_balance']) {
        row.received_balance = this.row['received_currency_balance'];
      }
      if (this.row['sent_currency_balance']) {
        row.sent_balance = this.row['sent_currency_balance'];
      }
    } else {
      if (this.row['received_currency_balance']) {
        row.received_balance = await getBalanceToIncrement(
          this.received_currency,
          this.row['received_currency_balance'],
        );
      }
      if (this.row['sent_currency_balance']) {
        row.sent_balance = await getBalanceToIncrement(
          this.sent_currency,
          this.row['sent_currency_balance'],
        );
      }
    }

    return row;
  }
}
