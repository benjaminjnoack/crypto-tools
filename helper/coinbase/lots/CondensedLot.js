import { Lot } from './Lot.js';

export default class CondensedLot extends Lot {
  /**
   * @param {string} asset
   * @param {number} size
   * @param {number} proceeds
   * @param {number} cost
   * @param {string} term
   */
  constructor(asset, size, proceeds, cost, term) {
    super();
    this._asset = asset;
    this._id = 'Various:Various';
    this._acquired = 'Various';
    this._sold = 'Various';
    this._size = size;
    this._balance = 0;
    this._proceeds = proceeds;
    this._cost = cost;
    this._term = term;
  }
}
