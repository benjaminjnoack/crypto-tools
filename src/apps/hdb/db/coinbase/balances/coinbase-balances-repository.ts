import { getClient } from "../../db-client.js";
import { logger } from "../../../../../shared/log/index.js";
import {
  buildSelectCoinbaseBalanceLedgerSql,
  COINBASE_BALANCE_LEDGER_TABLE,
  type CoinbaseBalanceFilters,
  CREATE_COINBASE_BALANCE_LEDGER_TABLE_SQL,
  DROP_COINBASE_BALANCE_LEDGER_TABLE_SQL,
  SELECT_COINBASE_BALANCES_AT_TIME_SQL,
  TRACE_COINBASE_BALANCE_LEDGER_SQL,
  TRUNCATE_COINBASE_BALANCE_LEDGER_TABLE_SQL,
} from "./coinbase-balances-sql.js";

export type CoinbaseBalanceRow = {
  id?: string;
  timestamp: Date;
  asset: string;
  balance: string;
  tx_id: string;
  notes: string;
};

type Queryable = {
  query: (sql: string, values?: unknown[]) => Promise<unknown>;
};

export { COINBASE_BALANCE_LEDGER_TABLE };

export async function createCoinbaseBalanceLedgerTable(queryable?: Queryable): Promise<void> {
  const client = queryable ?? await getClient();
  await client.query(CREATE_COINBASE_BALANCE_LEDGER_TABLE_SQL);
}

export async function dropCoinbaseBalanceLedgerTable(queryable?: Queryable): Promise<void> {
  const client = queryable ?? await getClient();
  await client.query(DROP_COINBASE_BALANCE_LEDGER_TABLE_SQL);
}

export async function truncateCoinbaseBalanceLedgerTable(queryable?: Queryable): Promise<void> {
  const client = queryable ?? await getClient();
  await client.query(TRUNCATE_COINBASE_BALANCE_LEDGER_TABLE_SQL);
}

export async function insertCoinbaseBalanceLedgerBatch(
  balances: CoinbaseBalanceRow[],
  queryable?: Queryable,
): Promise<void> {
  if (balances.length === 0) {
    return;
  }

  const values: unknown[] = [];
  const placeholders = balances.map((balance, rowIndex) => {
    const start = rowIndex * 5;
    values.push(balance.timestamp, balance.asset, balance.balance, balance.tx_id, balance.notes);
    return `($${start + 1}, $${start + 2}, $${start + 3}, $${start + 4}, $${start + 5})`;
  });

  const client = queryable ?? await getClient();
  const sql = `
    INSERT INTO ${COINBASE_BALANCE_LEDGER_TABLE}
    (timestamp, asset, balance, tx_id, notes)
    VALUES ${placeholders.join(", ")};
  `;
  await client.query(sql, values);
}

export async function selectCoinbaseBalanceLedger(filters: CoinbaseBalanceFilters): Promise<CoinbaseBalanceRow[]> {
  const client = await getClient();
  const { sql, values } = buildSelectCoinbaseBalanceLedgerSql(filters);

  const { rows } = await client.query<CoinbaseBalanceRow>(sql, values);
  logger.debug(`Selected ${rows.length} coinbase balance rows`);
  return rows;
}

export async function traceCoinbaseBalanceLedger(asset: string, to: Date): Promise<CoinbaseBalanceRow[]> {
  const client = await getClient();
  const { rows } = await client.query<CoinbaseBalanceRow>(TRACE_COINBASE_BALANCE_LEDGER_SQL, [asset, to]);
  logger.debug(`Traced ${rows.length} coinbase balance rows`);
  return rows;
}

export async function selectCoinbaseBalancesAtTime(to: Date): Promise<CoinbaseBalanceRow[]> {
  const client = await getClient();
  const { rows } = await client.query<CoinbaseBalanceRow>(SELECT_COINBASE_BALANCES_AT_TIME_SQL, [to]);
  logger.debug(`Selected ${rows.length} coinbase balances at time`);
  return rows;
}
