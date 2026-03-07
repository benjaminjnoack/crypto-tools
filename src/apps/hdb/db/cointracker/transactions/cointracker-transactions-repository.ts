import { getClient } from "../../db-client.js";
import { logger } from "#shared/log/index";
import {
  buildFilterConditions,
  buildSelectCointrackerTransactionsGroupSql,
  buildSelectCointrackerTransactionsSql,
  type CointrackerTransactionFilters,
  type CointrackerTransactionGroupInterval,
} from "./cointracker-transactions-sql.js";

export type CointrackerTransactionRow = {
  transaction_id: string;
  date: Date;
  type: string;
  received_quantity: string | null;
  received_currency: string | null;
  sent_quantity: string | null;
  sent_currency: string | null;
  fee_amount: string | null;
  realized_return: string | null;
  [key: string]: unknown;
};

export type CointrackerTransactionGroupRow = {
  day?: string;
  week?: string;
  month?: string;
  quarter?: string;
  year?: string;
  received: string;
  sent: string;
  fees: string;
  returns: string;
  net_returns: string;
};

export async function selectCointrackerTransactions(
  filters: CointrackerTransactionFilters,
  includeBalances: boolean,
): Promise<CointrackerTransactionRow[]> {
  const client = await getClient();
  const { conditions, values } = buildFilterConditions(filters);
  const sql = buildSelectCointrackerTransactionsSql(includeBalances, conditions);

  const { rows } = await client.query<CointrackerTransactionRow>(sql, values);
  logger.debug(`Selected ${rows.length} cointracker transaction rows`);
  return rows;
}

export async function selectCointrackerTransactionsGroup(
  filters: CointrackerTransactionFilters,
  interval?: CointrackerTransactionGroupInterval,
): Promise<CointrackerTransactionGroupRow[]> {
  const client = await getClient();
  const { conditions, values } = buildFilterConditions(filters);
  const sql = buildSelectCointrackerTransactionsGroupSql(conditions, interval);

  const { rows } = await client.query<CointrackerTransactionGroupRow>(sql, values);
  logger.debug(`Selected ${rows.length} cointracker transaction group rows`);
  return rows;
}
