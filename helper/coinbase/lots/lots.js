import { TRANSACTION_TYPES } from '../dictionary';
import { log } from '@core/logger.js';
import { PRECISION_EPSILON } from '@db/cli/utils.js';
import BuyLot from './BuyLot.js';
import SellLot from './SellLot.js';

/**
 * @param {string} type
 * @returns {boolean}
 */
const isBuyType = (type) =>
  [
    TRANSACTION_TYPES.BUY,
    TRANSACTION_TYPES.ADVANCED_TRADE_BUY,
    TRANSACTION_TYPES.STAKING_INCOME,
    TRANSACTION_TYPES.REWARD_INCOME,
    TRANSACTION_TYPES.SUBSCRIPTION_REBATE,
    TRANSACTION_TYPES.SUBSCRIPTION_REBATE_24,
    TRANSACTION_TYPES.DEPOSIT,
    TRANSACTION_TYPES.RECEIVE,
  ].includes(type);

/**
 * @param {string} type
 * @returns {boolean}
 */
const isSellType = (type) =>
  [TRANSACTION_TYPES.SELL, TRANSACTION_TYPES.ADVANCED_TRADE_SELL].includes(type);

/**
 * @param {Transaction[]} transactions
 * @param {function} lotSelector
 * @param {boolean} buyLots - include buy lots in the returned lots
 * @returns {{balance: number, lots: (BuyLot|SellLot)[]}}
 */
function coinbaseTransactionsMatchSells(transactions, lotSelector, buyLots = false) {
  // First things first, make sure all the data is in the correct order.
  transactions.sort((a, b) => a.timestamp - b.timestamp);

  /**
   * @type {BuyLot[]}
   */
  const buys = [];
  /**
   * @type {(BuyLot|SellLot)[]}
   */
  const lots = [];

  /**
   * @returns {number}
   */
  const getRemainingBalance = () => buys.reduce((acc, cur) => acc + cur.remaining, 0);

  for (const transaction of transactions) {
    const size = parseFloat(transaction.num_quantity);
    const price = parseFloat(transaction.num_price_at_tx);
    const fees = parseFloat(transaction.num_fee);

    if (isBuyType(transaction.type)) {
      const balance = getRemainingBalance() + size; //Whatever we had, plus this
      const buyLot = new BuyLot(
        transaction.asset,
        transaction.id,
        size,
        transaction.timestamp,
        balance,
        price,
        fees,
      );
      buys.push(buyLot);
      if (buyLots) {
        lots.push(buyLot);
      }
    } else if (isSellType(transaction.type)) {
      let remainingToSell = size;
      const grossSellValue = price * size;
      const sellFeeRate = grossSellValue === 0 ? 0 : fees / grossSellValue;

      while (remainingToSell > PRECISION_EPSILON) {
        /**
         * @type {BuyLot}
         */
        const buyLot = lotSelector(buys);
        if (buyLot) {
          const usedSize = Math.min(remainingToSell, buyLot.remaining);

          // Portion of buy-side fees for matched size
          const buyFeePortion = buyLot.fees * (usedSize / buyLot.size);

          // Portion of sell-side fees for matched size
          const sellFeePortion = grossSellValue * sellFeeRate * (usedSize / size);

          // Net proceeds and basis
          const proceeds = price * usedSize - sellFeePortion;
          const costBasis = buyLot.price * usedSize + buyFeePortion;

          remainingToSell -= usedSize;
          if (remainingToSell < PRECISION_EPSILON) remainingToSell = 0;

          buyLot.remaining -= usedSize;
          if (buyLot.remaining < PRECISION_EPSILON) {
            buyLot.remaining = 0;
            const lotIndex = buys.indexOf(buyLot);
            if (lotIndex !== -1 && buys[lotIndex].remaining < PRECISION_EPSILON) {
              buys.splice(lotIndex, 1);
            }
          }

          const balance = getRemainingBalance(); // Whatever is left AFTER the buy lot has had this sale deducted from the remaining balance
          lots.push(
            new SellLot(
              transaction.asset,
              buyLot.id,
              transaction.id,
              usedSize,
              buyLot.acquired,
              transaction.timestamp,
              proceeds,
              costBasis,
              balance,
            ),
          );
        } else {
          throw new Error(`Not enough inventory to cover SELL of ${size} ${transaction.asset}`);
        }
      }
    } else {
      log.debug(`Ignoring ${transaction.type} Transaction ${transaction.id}`);
    }
  }

  return {
    balance: getRemainingBalance(),
    lots,
  };
}

/**
 * @param {BuyLot[]} buys
 * @returns {BuyLot|null}
 */
function coinbaseTransactionsSelectFifoLot(buys) {
  const buyLot = buys.find((b) => b.remaining > PRECISION_EPSILON);
  return buyLot ? buyLot : null;
}

/**
 * @param {BuyLot[]} buys
 * @returns {BuyLot|null}
 */
function coinbaseTransactionsSelectLifoLot(buys) {
  for (let i = buys.length - 1; i >= 0; i--) {
    if (buys[i].remaining > PRECISION_EPSILON) return buys[i];
  }
  return null;
}

/**
 * @param {BuyLot[]} buys
 * @returns {BuyLot|null}
 */
function coinbaseTransactionsSelectHifoLot(buys) {
  let maxLot = null;
  for (const lot of buys) {
    if (lot.remaining > PRECISION_EPSILON) {
      if (!maxLot || lot.price > maxLot.price) {
        maxLot = lot;
      }
    }
  }
  return maxLot;
}

/**
 * @param {Transaction[]} transactions
 * @param {boolean} buyLots
 * @returns {{balance: number, lots: (BuyLot|SellLot)[]}}
 */
export function coinbaseTransactionsLotsFifo(transactions, buyLots = false) {
  return coinbaseTransactionsMatchSells(transactions, coinbaseTransactionsSelectFifoLot, buyLots);
}

/**
 * @param {Transaction[]} transactions
 * @param {boolean} buyLots
 * @returns {{balance: number, lots: (BuyLot|SellLot)[]}}
 */
export function coinbaseTransactionsLotsLifo(transactions, buyLots = false) {
  return coinbaseTransactionsMatchSells(transactions, coinbaseTransactionsSelectLifoLot, buyLots);
}

/**
 * @param {Transaction[]} transactions
 * @param {boolean} buyLots
 * @returns {{balance: number, lots: (BuyLot|SellLot)[]}}
 */
export function coinbaseTransactionsLotsHifo(transactions, buyLots = false) {
  return coinbaseTransactionsMatchSells(transactions, coinbaseTransactionsSelectHifoLot, buyLots);
}

/**
 * Filter lots to only the SellLot instances on or after <from>, optionally including BuyLot instances necessary to complete the record
 * @param {Lot[]} lots
 * @param {Date} from - start of the period
 * @param {boolean} buyLots - include buy lots in return
 * @returns {Lot[]}
 */
export function filterLots(lots, from, buyLots = false) {
  // Filter down to only SellLots that fall within the target date range
  const filteredLots = lots.filter((lot) => lot instanceof SellLot && lot.sold >= from);

  // Include the BuyLots that were used to create those SellLots
  if (buyLots) {
    const buyTxIds = lots.map((lot) => lot.buy_tx_id);
    filteredLots.push(
      ...lots.filter((lot) => lot instanceof BuyLot && buyTxIds.includes(lot.buy_tx_id)),
    );
  }

  return filteredLots;
}

/**
 * Sort the lots by date, putting BuyLot instances ahead of SellLot instances in case of a tie
 * @param {Lot[]} lots
 * @returns {Lot[]}
 */
export function sortLots(lots) {
  lots.sort((a, b) => {
    const aDate = a instanceof BuyLot ? a.acquired : a.sold;
    const bDate = b instanceof BuyLot ? b.acquired : b.sold;

    // If dates are different, sort by date
    if (aDate < bDate) return -1;
    if (aDate > bDate) return 1;

    // Same date: BuyLots come before SellLots
    if (a instanceof BuyLot && b instanceof SellLot) return -1;
    if (a instanceof SellLot && b instanceof BuyLot) return 1;

    return 0;
  });
  return lots;
}
