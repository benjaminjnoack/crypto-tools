import { getClient } from "../../db-client.js";
import { logger } from "../../../../../shared/log/index.js";
import {
  buildSelectCointrackerBalancesSql,
  COINTRACKER_BALANCES_TABLE,
  type CointrackerBalancesFilters,
  CREATE_COINTRACKER_BALANCES_TABLE_SQL,
  DROP_COINTRACKER_BALANCES_TABLE_SQL,
  getCoinbaseEpochDate,
  REBUILD_COINTRACKER_BALANCES_LEDGER_SQL,
  SELECT_COINTRACKER_LAST_BALANCE_SQL,
  TRUNCATE_COINTRACKER_BALANCES_TABLE_SQL,
} from "./cointracker-balances-sql.js";

export type CointrackerBalanceRow = {
  id: string;
  currency: string;
  date: Date;
  balance: string;
  cointracker_transaction_id: string;
  received_quantity: string | null;
  sent_quantity: string | null;
  type?: string;
};

export type CointrackerLastBalanceRow = {
  currency: string;
  id: string;
  cointracker_transaction_id: string;
  date: Date;
  balance: string;
};

export { COINTRACKER_BALANCES_TABLE };

export async function createCointrackerBalancesTable(): Promise<void> {
  const client = await getClient();
  await client.query(CREATE_COINTRACKER_BALANCES_TABLE_SQL);
}

export async function dropCointrackerBalancesTable(): Promise<void> {
  const client = await getClient();
  await client.query(DROP_COINTRACKER_BALANCES_TABLE_SQL);
}

export async function truncateCointrackerBalancesTable(): Promise<void> {
  const client = await getClient();
  await client.query(TRUNCATE_COINTRACKER_BALANCES_TABLE_SQL);
}

export async function rebuildCointrackerBalancesLedger(): Promise<void> {
  const client = await getClient();
  await client.query(REBUILD_COINTRACKER_BALANCES_LEDGER_SQL, [getCoinbaseEpochDate()]);
}

export async function selectCointrackerBalances(
  filters: CointrackerBalancesFilters,
  includeType: boolean,
): Promise<CointrackerBalanceRow[]> {
  const client = await getClient();
  const { sql, values } = buildSelectCointrackerBalancesSql(filters, includeType);
  const { rows } = await client.query<CointrackerBalanceRow>(sql, values);
  logger.debug(`Selected ${rows.length} cointracker balance rows`);
  return rows;
}

export async function selectCointrackerLastBalance(): Promise<CointrackerLastBalanceRow[]> {
  const client = await getClient();
  const { rows } = await client.query<CointrackerLastBalanceRow>(SELECT_COINTRACKER_LAST_BALANCE_SQL);
  logger.debug(`Selected ${rows.length} cointracker last balance rows`);
  return rows;
}
