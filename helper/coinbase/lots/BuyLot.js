import {
  Lot,
  LOT_EMPTY_NUMERICAL_FIELD,
  LOT_INVALID_DATE_FIELD,
  LOT_NOT_APPLICABLE_FIELD,
} from './Lot.js';

export default class BuyLot extends Lot {
  /**
   * @param {string} asset
   * @param {string} buy_tx_id
   * @param {number} size
   * @param {Date} acquired
   * @param {number} balance
   * @param {number} price
   * @param {number} fees
   */
  constructor(asset, buy_tx_id, size, acquired, balance, price, fees) {
    super();
    this._asset = asset;
    this._buy_tx_id = buy_tx_id;
    this._acquired = acquired;
    this._sold = new Date(LOT_INVALID_DATE_FIELD);
    this._size = size;
    this._balance = balance;
    this._proceeds = LOT_EMPTY_NUMERICAL_FIELD;
    this._basis = LOT_EMPTY_NUMERICAL_FIELD;
    this._gain = LOT_EMPTY_NUMERICAL_FIELD;
    this._term = LOT_NOT_APPLICABLE_FIELD;

    /**
     * Initialized with size
     * @type {number}
     */
    this.remaining = size;

    /**
     * transaction.num_price_at_tx
     * @type {number}
     */
    this.price = price;

    /**
     * transaction.num_fee
     * @type {number}
     */
    this.fees = fees;
  }
}
