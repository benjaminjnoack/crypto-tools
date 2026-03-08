/**
 * @type {{TRANSACTIONS: string}}
 */
export const COINTRACKER_TABLE = {
  TRANSACTIONS: 'cointracker_transactions',
};
/**
 * @type {{SHORT_TERM: string, LONG_TERM: string}}
 */
export const CAPITAL_GAIN_TYPE = {
  SHORT_TERM: 'Short Term',
  LONG_TERM: 'Long Term',
};
/**
 * @type {{ASSET_AMOUNT: string, ASSET_NAME: string, RECEIVED_DATE: string, DATE_SOLD: string, PROCEEDS_USD: string, COST_BASIS_USD: string, GAIN_USD: string, TYPE: string}}
 */
export const CAPITAL_GAINS_CSV_COLUMNS = {
  ASSET_AMOUNT: 'Asset Amount',
  ASSET_NAME: 'Asset Name',
  RECEIVED_DATE: 'Received Date',
  DATE_SOLD: 'Date Sold',
  PROCEEDS_USD: 'Proceeds (USD)',
  COST_BASIS_USD: 'Cost Basis (USD)',
  GAIN_USD: 'Gain (USD)',
  TYPE: 'Type',
};

/**
 * @type {{ASSET_AMOUNT: string, ASSET_NAME: string, RECEIVED_DATE: string, DATE_SOLD: string, PROCEEDS_USD: string, COST_BASIS_USD: string, GAIN_USD: string, TYPE: string}}
 */
export const CAPITAL_GAINS_TABLE = {
  ASSET_AMOUNT: 'asset_amount',
  ASSET_NAME: 'asset_name',
  RECEIVED_DATE: 'received_date',
  DATE_SOLD: 'date_sold',
  PROCEEDS_USD: 'proceeds_usd',
  COST_BASIS_USD: 'cost_basis_usd',
  GAIN_USD: 'gain_usd',
  TYPE: 'type',
};

/**
 * @type {{GROUP: string, AMOUNT: string, BASIS: string, PROCEEDS: string, GAINS: string, AVG_GAIN: string, MAX_GAIN: string, MAX_LOSS: string, ROI_BASIS: string, TRADES: string}}
 */
export const CAPITAL_GAINS_GROUP = {
  GROUP: 'group',
  AMOUNT: 'amount',
  BASIS: 'basis',
  PROCEEDS: 'proceeds',
  GAINS: 'gains',
  AVG_GAIN: 'avg_gain',
  MAX_GAIN: 'max_gain',
  MAX_LOSS: 'max_loss',
  ROI_BASIS: 'roi_basis',
  TRADES: 'trades',
};

/**
 * @type {{COST_BASIS: string, PROCEEDS: string, GAIN: string}}
 */
export const CAPITAL_GAINS_TOTALS = {
  COST_BASIS: 'cost_basis',
  PROCEEDS: 'proceeds',
  GAIN: 'gain',
  TRADES: 'trades',
};

/**
 * These are the name of the columns in a CoinTracker Transaction CSV
 * @type {{DATE: string, TYPE: string, TRANSACTION_ID: string, RECEIVED_QUANTITY: string, RECEIVED_CURRENCY: string, RECEIVED_COST_BASIS: string, RECEIVED_WALLET: string, RECEIVED_ADDRESS: string, RECEIVED_COMMENT: string, SENT_QUANTITY: string, SENT_CURRENCY: string, SENT_COST_BASIS: string, SENT_WALLET: string, SENT_ADDRESS: string, SENT_COMMENT: string, FEE_AMOUNT: string, FEE_CURRENCY: string, FEE_COST_BASIS: string, REALIZED_RETURNS: string, FEE_REALIZED_RETURN: string, TRANSACTION_HASH: string}}
 */
export const TRANSACTIONS_CSV = {
  DATE: 'Date',
  TYPE: 'Type',
  TRANSACTION_ID: 'Transaction ID',
  RECEIVED_QUANTITY: 'Received Quantity',
  RECEIVED_CURRENCY: 'Received Currency',
  RECEIVED_COST_BASIS: 'Received Cost Basis (USD)',
  RECEIVED_WALLET: 'Received Wallet',
  RECEIVED_ADDRESS: 'Received Address',
  RECEIVED_COMMENT: 'Received Comment',
  SENT_QUANTITY: 'Sent Quantity',
  SENT_CURRENCY: 'Sent Currency',
  SENT_COST_BASIS: 'Sent Cost Basis (USD)',
  SENT_WALLET: 'Sent Wallet',
  SENT_ADDRESS: 'Sent Address',
  SENT_COMMENT: 'Sent Comment',
  FEE_AMOUNT: 'Fee Amount',
  FEE_CURRENCY: 'Fee Currency',
  FEE_COST_BASIS: 'Fee Cost Basis (USD)',
  REALIZED_RETURN: 'Realized Return (USD)',
  FEE_REALIZED_RETURN: 'Fee Realized Return (USD)',
  TRANSACTION_HASH: 'Transaction Hash',
};

/**
 * These are the DB table columns
 * @type {{DATE: string, TYPE: string, TRANSACTION_ID: string, RECEIVED_QUANTITY: string, RECEIVED_CURRENCY: string, RECEIVED_COST_BASIS: string, RECEIVED_WALLET: string, RECEIVED_ADDRESS: string, RECEIVED_COMMENT: string, SENT_QUANTITY: string, SENT_CURRENCY: string, SENT_COST_BASIS: string, SENT_WALLET: string, SENT_ADDRESS: string, SENT_COMMENT: string, FEE_AMOUNT: string, FEE_CURRENCY: string, FEE_COST_BASIS: string, REALIZED_RETURN: string, FEE_REALIZED_RETURN: string, TRANSACTION_HASH: string}}
 */
export const TRANSACTIONS_TABLE = {
  DATE: 'date',
  TYPE: 'type',
  TRANSACTION_ID: 'transaction_id',
  RECEIVED_QUANTITY: 'received_quantity',
  RECEIVED_CURRENCY: 'received_currency',
  RECEIVED_COST_BASIS: 'received_cost_basis',
  RECEIVED_WALLET: 'received_wallet',
  RECEIVED_ADDRESS: 'received_address',
  RECEIVED_COMMENT: 'received_comment',
  SENT_QUANTITY: 'sent_quantity',
  SENT_CURRENCY: 'sent_currency',
  SENT_COST_BASIS: 'sent_cost_basis',
  SENT_WALLET: 'sent_wallet',
  SENT_ADDRESS: 'sent_address',
  SENT_COMMENT: 'sent_comment',
  FEE_AMOUNT: 'fee_amount',
  FEE_CURRENCY: 'fee_currency',
  FEE_COST_BASIS: 'fee_cost_basis',
  REALIZED_RETURN: 'realized_return',
  FEE_REALIZED_RETURN: 'fee_realized_return',
  TRANSACTION_HASH: 'transaction_hash',
};

/**
 * SELECT DISTINCT(type) FROM cointracker_transactions ORDER BY type;
 * @type {{BUY: string, INTEREST_PAYMENT: string, OTHER_INCOME: string, RECEIVE: string, SELL: string, SEND: string, STAKING_REWARD: string, TRADE: string, TRANSFER: string}}
 */
export const TRANSACTION_TYPE = {
  BUY: 'BUY',
  INTEREST_PAYMENT: 'INTEREST_PAYMENT',
  OTHER_INCOME: 'OTHER_INCOME',
  RECEIVE: 'RECEIVE',
  SELL: 'SELL',
  SEND: 'SEND',
  STAKING_REWARD: 'STAKING_REWARD',
  TRADE: 'TRADE',
  TRANSFER: 'TRANSFER',
};
