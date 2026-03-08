const TRANSACTION_TYPES = {
  ADVANCED_TRADE_BUY: "Advanced Trade Buy",
  BUY: "Buy",
  ADVANCED_TRADE_SELL: "Advanced Trade Sell",
  SELL: "Sell",
  STAKING_INCOME: "Staking Income",
  REWARD_INCOME: "Reward Income",
  SUBSCRIPTION_REBATE: "Subscription Rebate",
  SUBSCRIPTION_REBATE_24: "Subscription Rebates (24 Hours)",
  DEPOSIT: "Deposit",
  RECEIVE: "Receive",
  WITHDRAWAL: "Withdrawal",
  SEND: "Send",
  UNWRAP: "Unwrap",
} as const;

type TransactionType = (typeof TRANSACTION_TYPES)[keyof typeof TRANSACTION_TYPES];

const CLASSIFIER_MAP = {
  trade_buy: [TRANSACTION_TYPES.ADVANCED_TRADE_BUY, TRANSACTION_TYPES.BUY],
  trade_sell: [TRANSACTION_TYPES.ADVANCED_TRADE_SELL, TRANSACTION_TYPES.SELL],
  staking_income: [TRANSACTION_TYPES.STAKING_INCOME],
  reward_income: [TRANSACTION_TYPES.REWARD_INCOME],
  rebate: [TRANSACTION_TYPES.SUBSCRIPTION_REBATE, TRANSACTION_TYPES.SUBSCRIPTION_REBATE_24],
  transfer_in: [TRANSACTION_TYPES.DEPOSIT, TRANSACTION_TYPES.RECEIVE],
  transfer_out: [TRANSACTION_TYPES.WITHDRAWAL, TRANSACTION_TYPES.SEND],
  unwrap: [TRANSACTION_TYPES.UNWRAP],
} as const;

type ClassifierKey = keyof typeof CLASSIFIER_MAP;
const CLASSIFIER_MAP_RECORD: Record<ClassifierKey, readonly TransactionType[]> = CLASSIFIER_MAP;

const SUPERCLASS_MAP = {
  income: ["staking_income", "reward_income", "rebate"],
  trade: ["trade_buy", "trade_sell"],
  non_taxable: ["transfer_in", "transfer_out", "unwrap"],
} as const;

type SuperclassKey = keyof typeof SUPERCLASS_MAP;
const SUPERCLASS_MAP_RECORD: Record<SuperclassKey, readonly ClassifierKey[]> = SUPERCLASS_MAP;

const ABBREVIATIONS: Record<string, string> = {
  [TRANSACTION_TYPES.ADVANCED_TRADE_BUY]: "ATB",
  [TRANSACTION_TYPES.BUY]: "BUY",
  [TRANSACTION_TYPES.ADVANCED_TRADE_SELL]: "ATS",
  [TRANSACTION_TYPES.SELL]: "SEL",
  [TRANSACTION_TYPES.STAKING_INCOME]: "SIN",
  [TRANSACTION_TYPES.REWARD_INCOME]: "RIN",
  [TRANSACTION_TYPES.SUBSCRIPTION_REBATE]: "SUB",
  [TRANSACTION_TYPES.SUBSCRIPTION_REBATE_24]: "S24",
  [TRANSACTION_TYPES.DEPOSIT]: "DEP",
  [TRANSACTION_TYPES.RECEIVE]: "REC",
  [TRANSACTION_TYPES.WITHDRAWAL]: "WDL",
  [TRANSACTION_TYPES.SEND]: "SEN",
  [TRANSACTION_TYPES.UNWRAP]: "UNW",
};

export const CoinbaseTransactionClassifierValues = [
  "trade_buy",
  "trade_sell",
  "staking_income",
  "reward_income",
  "rebate",
  "transfer_in",
  "transfer_out",
  "unwrap",
  "income",
  "trade",
  "non_taxable",
] as const;

export function getTypesForClassifier(label: string): string[] {
  if (label in CLASSIFIER_MAP_RECORD) {
    return [...CLASSIFIER_MAP_RECORD[label as ClassifierKey]];
  }

  if (label in SUPERCLASS_MAP_RECORD) {
    const classes = SUPERCLASS_MAP_RECORD[label as SuperclassKey];
    return classes.flatMap((value) => CLASSIFIER_MAP_RECORD[value]);
  }

  throw new Error(`Unknown classifier: ${label}`);
}

export function getClassifierForType(type: string): string {
  for (const [classifier, types] of Object.entries(CLASSIFIER_MAP_RECORD)) {
    if (types.includes(type as TransactionType)) {
      return classifier;
    }
  }
  return "unknown";
}

export function getSuperclassForType(type: string): string {
  const classifier = getClassifierForType(type);
  for (const [superclass, subclasses] of Object.entries(SUPERCLASS_MAP_RECORD)) {
    if (subclasses.includes(classifier as ClassifierKey)) {
      return superclass;
    }
  }
  return "uncategorized";
}

export function getAbbreviatedType(type: string): string {
  return ABBREVIATIONS[type] ?? type;
}
