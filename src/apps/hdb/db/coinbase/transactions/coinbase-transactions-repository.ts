import { getClient } from "../../db-client.js";
import { logger } from "#shared/log/index";
import {
  buildCoinbaseTransactionsFilterConditions,
  buildSelectCoinbaseTransactionsGroupSql,
  buildSelectCoinbaseTransactionsSql,
  COINBASE_TRANSACTIONS_TABLE,
  type CoinbaseTransactionFilters,
  type CoinbaseTransactionGroupInterval,
  SELECT_COINBASE_TRANSACTIONS_BY_IDS_SQL,
} from "./coinbase-transactions-sql.js";

export type CoinbaseTransactionRow = {
  id: string;
  timestamp: Date;
  type: string;
  asset: string;
  quantity: string;
  price_currency: string;
  price_at_tx: string;
  subtotal: string | null;
  total: string;
  fee: string;
  notes: string;
  synthetic: boolean;
  manual: boolean;
  num_quantity: string;
  num_price_at_tx: string;
  num_subtotal: string | null;
  num_total: string;
  num_fee: string;
  balance?: string | null;
  [key: string]: unknown;
};

export type CoinbaseTransactionGroupRow = {
  day?: string;
  week?: string;
  month?: string;
  quarter?: string;
  year?: string;
  quantity: string;
  subtotal: string;
  fee: string;
  total: string;
};

export { COINBASE_TRANSACTIONS_TABLE };

export async function selectCoinbaseTransactions(
  filters: CoinbaseTransactionFilters,
  includeBalances: boolean,
  pairSynthetic: boolean,
): Promise<CoinbaseTransactionRow[]> {
  const client = await getClient();
  const { conditions, values } = buildCoinbaseTransactionsFilterConditions(filters);
  const sql = buildSelectCoinbaseTransactionsSql(conditions, includeBalances, pairSynthetic);

  const { rows } = await client.query<CoinbaseTransactionRow>(sql, values);
  logger.debug(`Selected ${rows.length} coinbase transaction rows`);
  return rows;
}

export async function selectCoinbaseTransactionsGroup(
  filters: CoinbaseTransactionFilters,
  interval?: CoinbaseTransactionGroupInterval,
): Promise<CoinbaseTransactionGroupRow[]> {
  const client = await getClient();
  const { conditions, values } = buildCoinbaseTransactionsFilterConditions(filters);
  const sql = buildSelectCoinbaseTransactionsGroupSql(conditions, interval);

  const { rows } = await client.query<CoinbaseTransactionGroupRow>(sql, values);
  logger.debug(`Selected ${rows.length} coinbase transaction group rows`);
  return rows;
}

export async function selectCoinbaseTransactionsByIds(ids: string[]): Promise<CoinbaseTransactionRow[]> {
  if (ids.length === 0) {
    return [];
  }

  const client = await getClient();
  const { rows } = await client.query<CoinbaseTransactionRow>(SELECT_COINBASE_TRANSACTIONS_BY_IDS_SQL, [ids]);
  logger.debug(`Selected ${rows.length} coinbase transaction rows by ids`);
  return rows;
}
