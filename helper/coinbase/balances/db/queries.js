import { getClient } from '@db/client.js';
import { DUST_THRESHOLD } from '@db/cli/utils.js';
import { log } from '@core/logger.js';
import Balance from '../Balance.js';
import format from 'pg-format';

export const COINBASE_BALANCE_LEDGER_TABLE = 'coinbase_balance_ledger';

export async function createCoinbaseBalanceLedgerTable() {
  const sql = `CREATE TABLE ${COINBASE_BALANCE_LEDGER_TABLE} (
                                                                   id BIGSERIAL PRIMARY KEY,
                                                                   asset TEXT NOT NULL,
                                                                   timestamp TIMESTAMPTZ NOT NULL,
                                                                   balance NUMERIC NOT NULL,
                                                                   tx_id TEXT,
                                                                   notes TEXT
                 );`;
  const client = await getClient();
  return client.query(sql);
}

export async function dropCoinbaseBalanceLedgerTable() {
  const sql = `DROP TABLE IF EXISTS ${COINBASE_BALANCE_LEDGER_TABLE};`;
  const client = await getClient();
  return client.query(sql);
}

/**
 * @param {Balance} balance
 * @returns {Promise<void>}
 */
export async function insertCoinbaseBalanceLedger(balance) {
  const sql = `
        INSERT INTO ${COINBASE_BALANCE_LEDGER_TABLE}
            (timestamp, asset, balance, tx_id, notes)
        SELECT $1, $2, $3, $4, $5
            WHERE NOT EXISTS (
            SELECT 1 FROM ${COINBASE_BALANCE_LEDGER_TABLE}
            WHERE asset = $2 AND ABS(balance) < 1e-8 AND timestamp = $1
            );
    `;
  const values = balance.toSqlValues();
  const client = await getClient();
  return client.query(sql, values);
}

/**
 * @param {Balance[]} balances
 * @returns {Promise<*>}
 */
export async function insertCoinbaseBalanceLedgerBatch(balances) {
  if (!balances.length) return;

  const client = await getClient();

  const values = balances.map((b) => b.toSqlValues());
  const valuesSQL = format('%L', values);

  const sql = `
        INSERT INTO ${COINBASE_BALANCE_LEDGER_TABLE}
            (timestamp, asset, balance, tx_id, notes)
        VALUES ${valuesSQL};
    `;

  return client.query(sql);
}

/**
 * @param {string[]} assets
 * @param {Date} from
 * @param {Date} to
 * @returns {Promise<Balance[]>}
 */
export async function selectCoinbaseBalanceLedger(assets, from, to) {
  const client = await getClient();

  const values = [];
  values.push(assets);
  const conditions = [];
  conditions.push(`asset = ANY($${values.length}::text[])`);

  if (from) {
    values.push(from);
    conditions.push(`timestamp >= $${values.length}`);
  }

  if (to) {
    values.push(to);
    conditions.push(`timestamp <= $${values.length}`);
  }

  const sql = `
        SELECT *
        FROM coinbase_balance_ledger
        WHERE ${conditions.join(' AND ')}
        ORDER BY timestamp ASC, id ASC;
    `;

  const { rows } = await client.query(sql, values);
  log.debug(`selectCoinbaseBalanceLedger => ${rows.length} row(s)`);
  return rows.map((row) => new Balance(row));
}

/**
 * Select all the balances for this <asset>
 * where the timestamp is greater than or equal to the last time the balance was dust
 * and LESS THAN the <to> date
 * NOTE: the <to> date balance WILL NOT be returned!
 * @param {string} asset - the asset to trace
 * @param {Date} to - the time to trace up to
 * @returns {Promise<Balance[]>}
 */
export async function traceCoinbaseBalanceLedger(asset, to) {
  const client = await getClient();

  const sql = `
        SELECT *
        FROM ${COINBASE_BALANCE_LEDGER_TABLE}
        WHERE asset = $1
        AND timestamp >= (
            SELECT MAX(timestamp)
            FROM ${COINBASE_BALANCE_LEDGER_TABLE}
            WHERE asset = $1
            AND ABS(balance) < ${DUST_THRESHOLD}
            and timestamp < $2
        )
        AND timestamp < $2
        ORDER BY timestamp ASC, id ASC;
    `;

  const { rows } = await client.query(sql, [asset, to]);
  log.debug(`traceCoinbaseBalanceLedger => ${rows.length} row(s)`);
  return rows.map((row) => new Balance(row));
}

/**
 * @param {Date} to
 * @returns {Promise<Balance[]>}
 */
export async function selectCoinbaseBalancesAtTime(to) {
  const client = await getClient();

  const sql = `
        SELECT DISTINCT ON (asset) id, asset, balance, timestamp, tx_id, notes
        FROM ${COINBASE_BALANCE_LEDGER_TABLE} 
        ${to ? 'WHERE timestamp <= $1' : ''}
        ORDER BY asset, timestamp DESC, id DESC
    `;

  const values = to ? [to] : [];

  const { rows } = await client.query(sql, values);
  log.debug(`selectCoinbaseBalancesAtTime => ${rows.length} row(s)`);
  return rows.map((row) => new Balance(row));
}
