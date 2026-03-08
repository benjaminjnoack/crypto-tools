import { STATEMENT_COLUMNS, TRANSACTION_TYPES } from '../dictionary';
import StatementRow from './StatementRow.js';

/**
 * If you staked ETH on Coinbase during or after 2021–2022, the staked ETH was tracked internally as ETH2
 * Once withdrawals were enabled (after the Shanghai upgrade in 2023), Coinbase began allowing ETH2 balances to convert back to regular ETH
 * ETH2 was never a real asset, just an internal accounting label
 * @param {string} ticker
 * @returns {string}
 */
export function normalizeAsset(ticker) {
  if (ticker === 'ETH2') return 'ETH';
  return ticker;
}

/**
 * @param {StatementRow} row
 * @returns {StatementRow[]}
 */
export function normalizeTradeRow(row) {
  const results = [row];

  const synthetic = {
    [STATEMENT_COLUMNS.ID]: `synthetic-${row.id}`,
    [STATEMENT_COLUMNS.TIMESTAMP]: row.timestamp,
    // type: 'Advanced Trade Buy',
    // asset: 'AVAX',
    // quantity: '0.283',
    // price_currency: 'USD',
    // price_at_tx: '28.7031791476',
    // subtotal: '8.123',
    // total: '8.18392',
    [STATEMENT_COLUMNS.FEE]: '$0.00', // The fee is paid in the original transaction record
    [STATEMENT_COLUMNS.NOTES]: row.notes,
  };
  let syntheticCreated = false;

  let regex, match;

  switch (row.type) {
    case TRANSACTION_TYPES.ADVANCED_TRADE_BUY: // Always a positive number
      /**
       *   {
       *     id: '66845422c580382cd88e0f1d',
       *     timestamp: 2024-07-02T19:25:22.000Z,
       *     type: 'Advanced Trade Buy',
       *     asset: 'AVAX',
       *     quantity: '0.0210667360487531',
       *     price_currency: 'USD',
       *     price_at_tx: '28.7031791476',
       *     subtotal: '0.60468',
       *     total: '0.60922',
       *     fee: '0.004535117241841392',
       *     notes: 'Bought 0.0210667360487531 AVAX for 0.000009821534600000009494 BTC on AVAX-BTC at 0.00046274 BTC/AVAX',
       *     synthetic: false
       *   }
       */
      regex =
        /Bought (\d+(?:\.\d+)?) (\w+) for (\d+(?:\.\d+)?) (\w+) on (\w+-\w+) at (\d+(?:\.\d+)?) (\w+\/\w+)/;
      match = row.notes.match(regex);
      if (match) {
        const [
          _,
          boughtSize, // 0.0210667360487531 (quantity)
          boughtProduct, // AVAX (asset)
          soldSize, // 0.000009821534600000009494 (not found)
          soldProduct, // BTC (not found)
          productId, // AVAX-BTC (not found)
          price, // 0.00046274 (not found)
          priceUnit, // BTC/AVAX (not found)
        ] = match;
        synthetic[STATEMENT_COLUMNS.TYPE] = TRANSACTION_TYPES.ADVANCED_TRADE_SELL;
        synthetic[STATEMENT_COLUMNS.ASSET] = soldProduct;
        /**
         * TODO the soldSize parsed from notes caries a precision beyond BTC
         */
        synthetic[STATEMENT_COLUMNS.QUANTITY] = soldSize;
        synthetic[STATEMENT_COLUMNS.PRICE_CURRENCY] = row.asset;
        /**
         * TODO the math is correct, but the precision may be wrong
         */
        synthetic[STATEMENT_COLUMNS.PRICE_AT_TX] =
          `$${(row.js_num_price_at_tx / parseFloat(price)).toString(10)}`;
        synthetic[STATEMENT_COLUMNS.SUBTOTAL] = `$${row.num_quantity}`;
        synthetic[STATEMENT_COLUMNS.TOTAL] = `$${row.num_quantity}`;
        syntheticCreated = true;
      } else {
        throw new Error(`Cannot normalize ${row.type}: ${row.notes}`);
      }
      break;
    case TRANSACTION_TYPES.BUY: // Always a positive number
      /**
       *   {
       *     id: '66846061d270500025b19094',
       *     timestamp: 2024-07-02T20:17:37.000Z,
       *     type: 'Buy',
       *     asset: 'USDC',
       *     quantity: '100',
       *     price_currency: 'USD',
       *     price_at_tx: '1',
       *     subtotal: '100',
       *     total: '100',
       *     fee: '0',
       *     notes: 'Bought 100 USDC for 100 USD',
       *     synthetic: false
       *   }
       *
       *  {
       *     id: '66805974723f5c3d1fd6c6d8',
       *     timestamp: 2024-06-29T18:59:00.000Z,
       *     type: 'Buy',
       *     asset: 'BTC',
       *     quantity: '0.01593908',
       *     price_currency: 'USD',
       *     price_at_tx: '60967.85',
       *     subtotal: '971.77144',
       *     total: '1000',
       *     fee: '28.228561422',
       *     notes: 'Bought 0.01593908 BTC for 1000 USD',
       *     synthetic: false
       *   }
       */
      regex = /Bought (\d+(?:\.\d+)?) (\w+) for (\d+(?:\.\d+)?) (\w+)/;
      match = row.notes.match(regex);
      if (match) {
        //
        const [
          _,
          boughtSize, // 0.01593908 (quantity)
          boughtProduct, // BTC (asset)
          soldSize, // 1000 (total)
          soldProduct, // USD (price_currency)
        ] = match;
        synthetic[STATEMENT_COLUMNS.TYPE] = TRANSACTION_TYPES.SELL;
        synthetic[STATEMENT_COLUMNS.ASSET] = row.price_currency;
        synthetic[STATEMENT_COLUMNS.QUANTITY] = row.num_total;
        synthetic[STATEMENT_COLUMNS.PRICE_CURRENCY] = row.asset;
        synthetic[STATEMENT_COLUMNS.PRICE_AT_TX] = `$${(1 / row.js_num_price_at_tx).toString(10)}`;
        synthetic[STATEMENT_COLUMNS.SUBTOTAL] = `$${row.num_quantity}`;
        synthetic[STATEMENT_COLUMNS.TOTAL] = `$${row.num_quantity}`;
        syntheticCreated = true;
      } else {
        throw new Error(`Cannot normalize ${row.type}: ${row.notes}`);
      }
      break;
    case TRANSACTION_TYPES.ADVANCED_TRADE_SELL: // Always a positive number
      /**
       * {
       *     id: '6685def7ee6bd71810e235da',
       *     timestamp: 2024-07-03T23:29:59.000Z,
       *     type: 'Advanced Trade Sell',
       *     asset: 'SOL',
       *     quantity: '3.5573',
       *     price_currency: 'USD',
       *     price_at_tx: '140.5258116',
       *     subtotal: '499.89247',
       *     total: '497.8929',
       *     fee: '1.99956987841872',
       *     notes: 'Sold 3.5573 SOL for 0.151005677496 ETH on SOL-ETH at 0.04262 ETH/SOL',
       *     synthetic: false
       *   }
       */
      regex =
        /Sold (\d+(?:\.\d+)?) (\w+) for (\d+(?:\.\d+)?) (\w+) on (\w+-\w+) at (\d+(?:\.\d+)?) (\w+\/\w+)/;
      match = row.notes.match(regex);
      if (match) {
        const [
          _,
          soldSize, // 3.5573 (quantity)
          soldProduct, // SOL (asset)
          boughtSize, // 0.151005677496 (not found)
          boughtProduct, // ETH (not found)
          productId, // SOL-ETH (not found)
          price, // 0.04262 (not found)
          priceUnit, // ETH/SOL (not found)
        ] = match;
        synthetic[STATEMENT_COLUMNS.TYPE] = TRANSACTION_TYPES.ADVANCED_TRADE_BUY;
        synthetic[STATEMENT_COLUMNS.ASSET] = boughtProduct;
        synthetic[STATEMENT_COLUMNS.QUANTITY] = boughtSize;
        synthetic[STATEMENT_COLUMNS.PRICE_CURRENCY] = row.asset;
        synthetic[STATEMENT_COLUMNS.PRICE_AT_TX] =
          `$${(row.js_num_price_at_tx / parseFloat(price)).toString(10)}`;
        synthetic[STATEMENT_COLUMNS.SUBTOTAL] = `$${row.num_quantity}`;
        synthetic[STATEMENT_COLUMNS.TOTAL] = `$${row.num_quantity}`;
        syntheticCreated = true;
      } else {
        throw new Error(`Cannot normalize ${row.type}: ${row.notes}`);
      }
      break;
    case TRANSACTION_TYPES.SELL: // Always a negative number
      /**
       * {
       *     id: '6685683b723f5c3d1f91ae42',
       *     timestamp: 2024-07-03T15:03:23.000Z,
       *     type: 'Sell',
       *     asset: 'USDC',
       *     quantity: '-122.711298',
       *     price_currency: 'USD',
       *     price_at_tx: '1',
       *     subtotal: '122.71',
       *     total: '122.71',
       *     fee: '0',
       *     notes: 'Sold 122.711298 USDC for 122.71 USD',
       *     synthetic: false
       *   }
       */
      regex = /Sold (\d+(?:\.\d+)?) (\w+) for (\d+(?:\.\d+)?) (\w+)/;
      match = row.notes.match(regex);
      if (match) {
        const [
          _,
          soldSize, // 122.711298 (quantity (now that StatementRow.parseStr removes "-"))
          soldProduct, // USDC (asset)
          boughtSize, // 122.71 (total)
          boughtProduct, // USD (price_currency)
        ] = match;
        synthetic[STATEMENT_COLUMNS.TYPE] = TRANSACTION_TYPES.BUY;
        synthetic[STATEMENT_COLUMNS.ASSET] = row.price_currency;
        synthetic[STATEMENT_COLUMNS.QUANTITY] = row.num_total;
        synthetic[STATEMENT_COLUMNS.PRICE_CURRENCY] = row.asset;
        synthetic[STATEMENT_COLUMNS.PRICE_AT_TX] = `$${(1 / row.js_num_price_at_tx).toString(10)}`;
        synthetic[STATEMENT_COLUMNS.SUBTOTAL] = `$${row.num_quantity}`;
        synthetic[STATEMENT_COLUMNS.TOTAL] = `$${row.num_quantity}`;
        syntheticCreated = true;
      } else {
        throw new Error(`Cannot normalize ${row.type}: ${row.notes}`);
      }
      break;
    case TRANSACTION_TYPES.STAKING_INCOME: // Always a positive number
    case TRANSACTION_TYPES.REWARD_INCOME: // Always a positive number
    case TRANSACTION_TYPES.SUBSCRIPTION_REBATE: // Always a positive number
    case TRANSACTION_TYPES.SUBSCRIPTION_REBATE_24: // Always a positive number
    case TRANSACTION_TYPES.DEPOSIT: // Always a positive number
    case TRANSACTION_TYPES.RECEIVE: // Always a positive number
    case TRANSACTION_TYPES.WITHDRAWAL: // Always a negative number
    case TRANSACTION_TYPES.SEND: // Always a negative number
    case TRANSACTION_TYPES.UNWRAP: // Can be both!
      // Do nothing
      break;
    default:
      throw new Error(`Cannot normalize row for unknown type: ${row['type']}`);
  }

  if (syntheticCreated) {
    results.push(new StatementRow(synthetic, true, false));
  }

  return results;
}
