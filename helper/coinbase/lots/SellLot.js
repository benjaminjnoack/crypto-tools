import { Lot, LOT_LONG_TERM, LOT_SHORT_TERM } from './Lot.js';
import { differenceInDays } from 'date-fns';

export default class SellLot extends Lot {
  /**
   * @param {string} asset
   * @param {string} buy_tx_id
   * @param {string} sell_tx_id
   * @param {number} size
   * @param {Date} acquired - anticipated to come from a BuyLot['acquired'] property
   * @param {Date} sold
   * @param {number} proceeds
   * @param {number} cost_basis
   * @param {number} balance
   */
  constructor(asset, buy_tx_id, sell_tx_id, size, acquired, sold, proceeds, cost_basis, balance) {
    super();
    this._asset = asset;
    this._buy_tx_id = buy_tx_id;
    this._sell_tx_id = sell_tx_id;
    this._acquired = acquired;
    this._sold = sold;
    this._size = size;
    this._balance = balance;
    if (proceeds < 0) {
      throw new Error(`Sell Lot proceeds cannot be less than zero: ${proceeds}`);
    }
    this._proceeds = proceeds;
    if (cost_basis < 0) {
      throw new Error(`Sell Lot cost_basis cannot be less than zero: ${cost_basis}`);
    }
    this._basis = cost_basis;
    this._gain = proceeds - cost_basis;

    const termDays = differenceInDays(this.sold, this.acquired);
    this._term = termDays >= 365 ? LOT_LONG_TERM : LOT_SHORT_TERM;
  }
}
