//TODO almost none of this is necessary or helpful with TS and zod
/**
 * Start of the year I opened my coinbase account
 */
export const COINBASE_EPOCH = '2024-01-01T00:00:00.000Z';

export const ORDER_PLACEMENT_SOURCE = {
  UNKNOWN: 'UNKNOWN_PLACEMENT_SOURCE',
  SIMPLE: 'RETAIL_SIMPLE',
  ADVANCED: 'RETAIL_ADVANCED',
} as const;

export const STATEMENT_COLUMNS = {
  ID: 'ID',
  TIMESTAMP: 'Timestamp',
  TYPE: 'Transaction Type',
  ASSET: 'Asset',
  QUANTITY: 'Quantity Transacted',
  PRICE_CURRENCY: 'Price Currency',
  PRICE_AT_TX: 'Price at Transaction',
  SUBTOTAL: 'Subtotal',
  TOTAL: 'Total (inclusive of fees and/or spread)',
  FEE: 'Fees and/or Spread',
  NOTES: 'Notes',
} as const;

export const TRANSACTION_TYPES = {
  ADVANCED_TRADE_BUY: 'Advanced Trade Buy', // Positive
  BUY: 'Buy', // Positive
  ADVANCED_TRADE_SELL: 'Advanced Trade Sell', // Positive
  SELL: 'Sell', // Negative
  STAKING_INCOME: 'Staking Income', // Positive
  REWARD_INCOME: 'Reward Income', // Positive
  SUBSCRIPTION_REBATE: 'Subscription Rebate', // Positive
  SUBSCRIPTION_REBATE_24: 'Subscription Rebates (24 Hours)', // Positive
  DEPOSIT: 'Deposit', // Positive
  RECEIVE: 'Receive', // Positive
  WITHDRAWAL: 'Withdrawal', // Negative
  SEND: 'Send', // Negative
  UNWRAP: 'Unwrap', // Both!
} as const;
type TransactionType = (typeof TRANSACTION_TYPES)[keyof typeof TRANSACTION_TYPES];

export const CLASSIFIER_TYPES = {
  TRADE_BUY: 'trade_buy',
  TRADE_SELL: 'trade_sell',
  STAKING_INCOME: 'staking_income',
  REWARD_INCOME: 'reward_income',
  REBATE: 'rebate',
  TRANSFER_IN: 'transfer_in',
  TRANSFER_OUT: 'transfer_out',
  UNWRAP: 'unwrap',
} as const;
// type ClassifierType = typeof CLASSIFIER_TYPES[keyof typeof CLASSIFIER_TYPES];

export const CLASSIFIER_MAP = {
  trade_buy: [TRANSACTION_TYPES.ADVANCED_TRADE_BUY, TRANSACTION_TYPES.BUY],
  trade_sell: [TRANSACTION_TYPES.ADVANCED_TRADE_SELL, TRANSACTION_TYPES.SELL],
  staking_income: [TRANSACTION_TYPES.STAKING_INCOME],
  reward_income: [TRANSACTION_TYPES.REWARD_INCOME],
  rebate: [TRANSACTION_TYPES.SUBSCRIPTION_REBATE, TRANSACTION_TYPES.SUBSCRIPTION_REBATE_24],
  transfer_in: [TRANSACTION_TYPES.DEPOSIT, TRANSACTION_TYPES.RECEIVE],
  transfer_out: [TRANSACTION_TYPES.WITHDRAWAL, TRANSACTION_TYPES.SEND],
  unwrap: [TRANSACTION_TYPES.UNWRAP],
} as const;
type ClassifierKey = keyof typeof CLASSIFIER_MAP; // "trade_buy" | "trade_sell" | ...
const CLASSIFIER_MAP_RECORD: Record<ClassifierKey, readonly TransactionType[]> = CLASSIFIER_MAP;

export const SUPERCLASS_MAP = {
  income: [
    CLASSIFIER_TYPES.STAKING_INCOME,
    CLASSIFIER_TYPES.REWARD_INCOME,
    CLASSIFIER_TYPES.REBATE,
  ],
  trade: [CLASSIFIER_TYPES.TRADE_BUY, CLASSIFIER_TYPES.TRADE_SELL],
  non_taxable: [
    CLASSIFIER_TYPES.TRANSFER_IN,
    CLASSIFIER_TYPES.TRANSFER_OUT,
    CLASSIFIER_TYPES.UNWRAP,
  ],
} as const;
type SuperclassKey = keyof typeof SUPERCLASS_MAP; // "income" | "trade" | "non_taxable"
const SUPERCLASS_MAP_RECORD: Record<SuperclassKey, readonly ClassifierKey[]> = SUPERCLASS_MAP;

export function getAbbreviatedType(type: string): string {
  switch (type) {
    case TRANSACTION_TYPES.ADVANCED_TRADE_BUY:
      return 'ATB';
    case TRANSACTION_TYPES.BUY:
      return 'BUY';
    case TRANSACTION_TYPES.ADVANCED_TRADE_SELL:
      return 'ATS';
    case TRANSACTION_TYPES.SELL:
      return 'SEL';
    case TRANSACTION_TYPES.STAKING_INCOME:
      return 'SIN';
    case TRANSACTION_TYPES.REWARD_INCOME:
      return 'RIN';
    case TRANSACTION_TYPES.SUBSCRIPTION_REBATE:
      return 'SUB';
    case TRANSACTION_TYPES.SUBSCRIPTION_REBATE_24:
      return 'S24';
    case TRANSACTION_TYPES.DEPOSIT:
      return 'DEP';
    case TRANSACTION_TYPES.RECEIVE:
      return 'REC';
    case TRANSACTION_TYPES.WITHDRAWAL:
      return 'WDL';
    case TRANSACTION_TYPES.SEND:
      return 'SEN';
    case TRANSACTION_TYPES.UNWRAP:
      return 'UNW';
    default:
      throw new Error(`Cannot abbreviate unknown type '${type}'`);
  }
}

export function getClassifierForType(type: TransactionType): string {
  for (const [classifier, types] of Object.entries(CLASSIFIER_MAP)) {
    if ((types as readonly string[]).includes(type)) return classifier;
  }
  return 'unknown';
}

export function getSuperclassForType(type: TransactionType): string {
  const classifier = getClassifierForType(type);
  for (const [superclass, subclasses] of Object.entries(SUPERCLASS_MAP)) {
    if ((subclasses as readonly string[]).includes(classifier)) return superclass;
  }
  return 'uncategorized';
}

// export function getTypesForClassifier(label: ClassifierKey): readonly TransactionType[];
// export function getTypesForClassifier(label: SuperclassKey): readonly TransactionType[];
export function getTypesForClassifier(
  label: ClassifierKey | SuperclassKey,
): readonly TransactionType[] {
  if (label in CLASSIFIER_MAP_RECORD) {
    return CLASSIFIER_MAP_RECORD[label as ClassifierKey];
  }
  if (label in SUPERCLASS_MAP_RECORD) {
    const subs = SUPERCLASS_MAP_RECORD[label as SuperclassKey];
    return subs.flatMap((sub) => CLASSIFIER_MAP_RECORD[sub]);
  }
  throw new Error(`Unknown classifier: ${label}`);
}

export const TRANSACTIONS_COLUMNS = {
  ID: 'id',
  TIMESTAMP: 'timestamp',
  TYPE: 'type',
  ASSET: 'asset',
  QUANTITY: 'quantity',
  PRICE_CURRENCY: 'price_currency',
  PRICE_AT_TX: 'price_at_tx',
  SUBTOTAL: 'subtotal',
  TOTAL: 'total',
  FEE: 'fee',
  JS_NUM_QUANTITY: 'js_num_quantity',
  JS_NUM_PRICE_AT_TX: 'js_num_price_at_tx',
  JS_NUM_SUBTOTAL: 'js_num_subtotal',
  JS_NUM_TOTAL: 'js_num_total',
  JS_NUM_FEE: 'js_num_fee',
  NUM_QUANTITY: 'num_quantity',
  NUM_PRICE_AT_TX: 'num_price_at_tx',
  NUM_SUBTOTAL: 'num_subtotal',
  NUM_TOTAL: 'num_total',
  NUM_FEE: 'num_fee',
  INT_QUANTITY: 'int_quantity',
  INT_PRICE_AT_TX: 'int_price_at_tx',
  INT_SUBTOTAL: 'int_subtotal',
  INT_TOTAL: 'int_total',
  INT_FEE: 'int_fee',
  NOTES: 'notes',
  SYNTHETIC: 'synthetic',
  MANUAL: 'manual',
} as const;

export const BALANCE_COLUMNS = {
  ID: 'id',
  ASSET: 'asset',
  TIMESTAMP: 'timestamp',
  BALANCE: 'balance',
  TX_ID: 'tx_id',
  NOTES: 'notes',
} as const;
