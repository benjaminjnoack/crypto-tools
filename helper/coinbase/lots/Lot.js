import { toFixedNumber } from '../../lib/increment.js';
import { toLotId } from './lot_id.js';

/**
 * Some lot types may not need a specific date for acquired or sold
 * For instance, BuyLot instances do not need a sold date
 * @type {string}
 */
export const LOT_INVALID_DATE_FIELD = 'Invalid Date';
export const LOT_NOT_APPLICABLE_FIELD = 'N/A';
export const LOT_EMPTY_NUMERICAL_FIELD = 0;
export const LOT_SHORT_TERM = 'short';
export const LOT_LONG_TERM = 'long';
/**
 * This base class represents the generic behavior of a buy or sell lot
 */
export class Lot {
  constructor() {
    this._asset = null;
    this._buy_tx_id = null;
    this._sell_tx_id = null;
    this._acquired = null;
    this._sold = null;
    this._size = null;
    this._balance = null;
    this._proceeds = null;
    this._basis = null;
    this._gain = null;
    this._term = null;
  }
  /**
   * @returns {string}
   */
  get asset() {
    if (this._asset === null) {
      throw new Error('asset not found');
    }
    return this._asset;
  }
  /**
   * @returns {string}
   */
  get buy_tx_id() {
    if (this._buy_tx_id === null) {
      throw new Error('buy tx id not found');
    }
    return this._buy_tx_id;
  }
  /**
   * @returns {string}
   */
  get sell_tx_id() {
    if (this._sell_tx_id === null) {
      throw new Error('sell tx id not found');
    }
    return this._sell_tx_id;
  }
  /**
   * @returns {string}
   */
  get id() {
    if (this._buy_tx_id === null) {
      throw new Error('buy tx id not found');
    }
    let id = this._buy_tx_id;
    if (this._sell_tx_id) {
      id += `:${this._sell_tx_id}`;
    }
    return id;
  }
  /**
   * @returns {Date}
   */
  get acquired() {
    if (!this._acquired === null) {
      throw new Error('acquired not found');
    }
    return this._acquired;
  }
  /**
   * @returns {Date}
   */
  get sold() {
    if (!this._sold === null) {
      throw new Error('sold not found');
    }
    return this._sold;
  }
  /**
   * @returns {number}
   */
  get size() {
    if (this._size === null) {
      throw new Error('size not found');
    }
    return this._size;
  }
  /**
   * @returns {number}
   */
  get balance() {
    if (!this._balance === null) {
      throw new Error('balance not found');
    }
    return this._balance;
  }
  /**
   * @returns {number}
   */
  get proceeds() {
    if (!this._proceeds === null) {
      throw new Error('proceeds not found');
    }
    return this._proceeds;
  }
  /**
   * @returns {number}
   */
  get basis() {
    if (!this._basis === null) {
      throw new Error('basis not found');
    }
    return this._basis;
  }
  /**
   * @returns {number}
   */
  get gain() {
    if (!this._gain === null) {
      throw new Error('gain not found');
    }
    return this._gain;
  }
  /**
   * @returns {string}
   */
  get term() {
    if (!this._term === null) {
      throw new Error('term not found');
    }
    return this._term;
  }

  /**
   * @returns {{id: string, asset: string, acquired: Date, sold: Date, size: number, balance: number, basis: number, proceeds: number, gain: number, term: string}}
   */
  toTableRow() {
    return {
      id: this.id,
      asset: this.asset,
      // Saves a little terminal space to make these dates
      // Buy lots without sold dates, and various, will just be Invalid Date
      acquired: this.acquired,
      sold: this.sold,
      size: this.size,
      balance: this.balance,
      basis: toFixedNumber(this.basis),
      proceeds: toFixedNumber(this.proceeds),
      gain: toFixedNumber(this.gain),
      term: this.term,
    };
  }

  /**
   * TODO add the price at time of transaction for buy and sell
   * @returns {string}
   */
  getNotes() {
    let notes = '';
    if (this._buy_tx_id) {
      notes += `Bought ${this.size} ${this.asset} on ${this.acquired} for $${toFixedNumber(this.basis)} (${this.buy_tx_id})`;
    }
    if (this._sell_tx_id) {
      notes += ` and sold on ${this.sold} for $${toFixedNumber(this.proceeds)} (${this.sell_tx_id}) resulting in a ${this.gain > 0 ? 'profit' : 'loss'} of $${toFixedNumber(this.gain)}.`;
    } else {
      notes += '.';
    }

    return notes.replace(/\n/g, '');
  }

  /**
   * TODO may cause a problem for buyLots
   * @returns {string} - an obfuscated lot ID
   */
  getLotId() {
    return toLotId(this._buy_tx_id, this._sell_tx_id || '');
  }
}
