import { getClient } from '@db/client.js';
import format from 'pg-format';
import { log } from '@core/logger.js';

/**
 * Create the cointracker_balances_ledger table if it does not already exist
 * @returns {Promise<*>}
 */
export async function createCointrackerBalancesTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS cointracker_balances_ledger
        (
            id BIGSERIAL PRIMARY KEY,
            currency TEXT NOT NULL,
            -- This table is populated from the cointracker_transaction table records
            -- That table should already have the correct timestamp timezone logic
            -- See TransactionRow.toSqlRow() comments
            date TIMESTAMPTZ NOT NULL,
            balance NUMERIC NOT NULL,
            cointracker_transaction_id TEXT NOT NULL,
            -- The balance will either be incremented or decremented by one of these values
            -- Question: should the fee (if applicable) be a separate balance entry?
            received_quantity NUMERIC,
            sent_quantity NUMERIC
        )
    ;`;

  const client = await getClient();
  return client.query(sql);
}

/**
 * Drop the cointracker_balances_ledger table if it exists
 * @returns {Promise<*>}
 */
export async function dropCointrackerBalancesTable() {
  const sql = `DROP TABLE IF EXISTS cointracker_balances_ledger;`;
  const client = await getClient();
  return client.query(sql);
}

/**
 * Truncate the cointracker_balances_ledger table
 * @returns {Promise<*>}
 */
export async function truncateCointrackerBalancesTable() {
  const sql = `
    TRUNCATE cointracker_balances_ledger
    RESTART IDENTITY
    CASCADE
    ;`;
  const client = await getClient();
  return client.query(sql);
}

export async function insertCointrackerBalancesBatch(balances) {
  if (!balances.length) return;

  const valuesSql = format('%L', balances);

  const sql = `
    INSERT INTO cointracker_balances_ledger
        (currency, date, balance, cointracker_transaction_id, received_quantity, sent_quantity)
        VALUES ${valuesSql}
    ;`;

  const client = await getClient();
  return client.query(sql);
}

/**
 * @param {string[]} currencies
 * @param {Date} from
 * @param {Date} to
 * @param {boolean} includeType
 * @returns {Promise<{}[]>}
 */
export async function selectCointrackerBalances(currencies, from, to, includeType = false) {
  const values = [];
  const conditions = [];
  const joins = [];
  const columns = ['cointracker_balances_ledger.*'];

  if (includeType) {
    columns.push('cointracker_transactions.type');
    joins.push(`LEFT JOIN cointracker_transactions
                    ON cointracker_balances_ledger.cointracker_transaction_id = cointracker_transactions.transaction_id`);
  }

  if (currencies.length) {
    values.push(currencies);
    conditions.push(`cointracker_balances_ledger.currency = ANY($${values.length}::text[])`);
  }
  if (from) {
    values.push(from);
    conditions.push(`cointracker_balances_ledger.date >= $${values.length}`);
  }
  if (to) {
    values.push(to);
    conditions.push(`cointracker_balances_ledger.date < $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
        SELECT ${columns.join(', ')}
        FROM cointracker_balances_ledger
                 ${joins.join('\n')}
            ${whereClause}
        ORDER BY date ASC, id ASC
        ;`;

  const client = await getClient();
  const { rows } = await client.query(sql, values);
  log.debug(`Selected ${rows.length} rows`);
  return rows;
}

/**
 * @returns {Promise<{currency: string, cointracker_transaction_id: string, date: Date, balance: string}[]>}
 */
export async function selectCointrackerLastBalance() {
  const sql = `
        SELECT DISTINCT ON (currency)
            currency, id, cointracker_transaction_id, date, balance
        FROM cointracker_balances_ledger
        ORDER BY currency, date DESC, id DESC;
    ;`;

  const client = await getClient();
  const { rows } = await client.query(sql);
  log.debug(`Selected ${rows.length} rows`);
  return rows;
}
