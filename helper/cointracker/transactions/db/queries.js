import { COINTRACKER_TABLE, TRANSACTIONS_TABLE } from '../../dictionary.js';
import { getClient } from '@db/client.js';
import format from 'pg-format';
import { log } from '@core/logger.js';
import CointrackerTransaction from '../CointrackerTransaction.js';

/**
 * @returns {Promise<*>}
 */
export async function createCointrackerTransactionsTable() {
  const sql = `
    CREATE table IF NOT EXISTS ${COINTRACKER_TABLE.TRANSACTIONS}
    (
        ${TRANSACTIONS_TABLE.TRANSACTION_ID} TEXT PRIMARY KEY,
        ${TRANSACTIONS_TABLE.DATE} TIMESTAMPTZ NOT NULL,
        ${TRANSACTIONS_TABLE.TYPE} TEXT NOT NULL,
        ${TRANSACTIONS_TABLE.RECEIVED_QUANTITY} NUMERIC,
        ${TRANSACTIONS_TABLE.RECEIVED_CURRENCY} TEXT,
        ${TRANSACTIONS_TABLE.RECEIVED_COST_BASIS} NUMERIC,
        ${TRANSACTIONS_TABLE.RECEIVED_WALLET} TEXT,
        ${TRANSACTIONS_TABLE.RECEIVED_ADDRESS} TEXT,
        ${TRANSACTIONS_TABLE.RECEIVED_COMMENT} TEXT,
        ${TRANSACTIONS_TABLE.SENT_QUANTITY} NUMERIC,
        ${TRANSACTIONS_TABLE.SENT_CURRENCY} TEXT,
        ${TRANSACTIONS_TABLE.SENT_COST_BASIS} NUMERIC,
        ${TRANSACTIONS_TABLE.SENT_WALLET} TEXT,
        ${TRANSACTIONS_TABLE.SENT_ADDRESS} TEXT,
        ${TRANSACTIONS_TABLE.SENT_COMMENT} TEXT,
        ${TRANSACTIONS_TABLE.FEE_AMOUNT} NUMERIC,
        ${TRANSACTIONS_TABLE.FEE_CURRENCY} TEXT,
        ${TRANSACTIONS_TABLE.FEE_COST_BASIS} NUMERIC,
        ${TRANSACTIONS_TABLE.REALIZED_RETURN} NUMERIC,
        ${TRANSACTIONS_TABLE.FEE_REALIZED_RETURN} NUMERIC,
        ${TRANSACTIONS_TABLE.TRANSACTION_HASH} TEXT
    );
    `;

  const client = await getClient();
  return client.query(sql);
}

/**
 * @returns {Promise<*>}
 */
export async function dropCointrackerTransactionsTable() {
  const sql = `DROP TABLE IF EXISTS ${COINTRACKER_TABLE.TRANSACTIONS};`;
  const client = await getClient();
  return client.query(sql);
}

/**
 * @returns {Promise<*>}
 */
export async function truncateCointrackerTransactionsTable() {
  const sql = `
    TRUNCATE ${COINTRACKER_TABLE.TRANSACTIONS}
    RESTART IDENTITY
    CASCADE;
    `;
  const client = await getClient();
  return client.query(sql);
}

/**
 * @param {TransactionRow[]} transactions
 * @returns {Promise<void>}
 */
export async function insertCointrackerTransactionsBatch(transactions) {
  if (!transactions.length) return;

  const client = await getClient();

  const values = transactions.map((transaction) => transaction.toSqlValues());
  const valuesSql = format('%L', values);

  const sql = `
        INSERT INTO ${COINTRACKER_TABLE.TRANSACTIONS}
        (
            ${TRANSACTIONS_TABLE.TRANSACTION_ID},
            ${TRANSACTIONS_TABLE.DATE},
            ${TRANSACTIONS_TABLE.TYPE},
            ${TRANSACTIONS_TABLE.RECEIVED_QUANTITY},
            ${TRANSACTIONS_TABLE.RECEIVED_CURRENCY},
            ${TRANSACTIONS_TABLE.RECEIVED_COST_BASIS},
            ${TRANSACTIONS_TABLE.RECEIVED_WALLET},
            ${TRANSACTIONS_TABLE.RECEIVED_ADDRESS},
            ${TRANSACTIONS_TABLE.RECEIVED_COMMENT},
            ${TRANSACTIONS_TABLE.SENT_QUANTITY},
            ${TRANSACTIONS_TABLE.SENT_CURRENCY},
            ${TRANSACTIONS_TABLE.SENT_COST_BASIS},
            ${TRANSACTIONS_TABLE.SENT_WALLET},
            ${TRANSACTIONS_TABLE.SENT_ADDRESS},
            ${TRANSACTIONS_TABLE.SENT_COMMENT},
            ${TRANSACTIONS_TABLE.FEE_AMOUNT},
            ${TRANSACTIONS_TABLE.FEE_CURRENCY},
            ${TRANSACTIONS_TABLE.FEE_COST_BASIS},
            ${TRANSACTIONS_TABLE.REALIZED_RETURN},
            ${TRANSACTIONS_TABLE.FEE_REALIZED_RETURN},
            ${TRANSACTIONS_TABLE.TRANSACTION_HASH}
        )
        VALUES ${valuesSql};
    `;

  return client.query(sql);
}

/**
 * @param {Date} from
 * @param {Date} to
 * @param {string[]} assets
 * @param {string[]} excluded
 * @param {string[]} types
 * @param {string[]} received
 * @param {string[]} sent
 * @returns {{conditions: string[], values: *[]}}
 */
function getConditionsAndValues(from, to, assets, excluded, types, received, sent) {
  const conditions = [];
  const values = [];
  if (from) {
    values.push(from);
    conditions.push(`t.date >= $${values.length}`);
  }
  if (to) {
    values.push(to);
    conditions.push(`t.date < $${values.length}`);
  }
  if (assets.length) {
    values.push(assets);
    conditions.push(
      `(t.received_currency = ANY($${values.length}::text[]) OR t.sent_currency = ANY($${values.length}::text[]))`,
    );
  }
  if (excluded.length) {
    values.push(excluded);
    conditions.push(
      `NOT (t.received_currency = ANY($${values.length}::text[]) OR t.sent_currency = ANY($${values.length}::text[]))`,
    );
  }
  if (types.length) {
    values.push(types);
    conditions.push(`t.type = ANY($${values.length}::text[])`);
  }
  if (received.length) {
    values.push(received);
    conditions.push(`t.received_currency = ANY($${values.length}::text[])`);
  }
  if (sent.length) {
    values.push(sent);
    conditions.push(`t.sent_currency = ANY($${values.length}::text[])`);
  }

  return { conditions, values };
}

/**
 * @param {Date} from
 * @param {Date} to
 * @param {string[]} assets
 * @param {string[]} excluded
 * @param {string[]} types
 * @param {string[]} received
 * @param {string[]} sent
 * @param {boolean} includeBalances
 * @returns {Promise<CointrackerTransaction[]>}
 */
export async function selectCointrackerTransactions(
  from,
  to,
  assets = [],
  excluded = [],
  types = [],
  received = [],
  sent = [],
  includeBalances = false,
) {
  const { conditions, values } = getConditionsAndValues(
    from,
    to,
    assets,
    excluded,
    types,
    received,
    sent,
  );

  const client = await getClient();

  let sql;
  if (includeBalances) {
    sql = `
            SELECT
                t.*,
                (
                    SELECT b.balance
                    FROM cointracker_balances_ledger b
                    WHERE b.cointracker_transaction_id = t.transaction_id
                      AND b.currency = t.received_currency
                    LIMIT 1
                ) AS received_currency_balance,
                (
                    SELECT b.balance
                    FROM cointracker_balances_ledger b
                    WHERE b.cointracker_transaction_id = t.transaction_id
                      AND b.currency = t.sent_currency
                    LIMIT 1
                ) AS sent_currency_balance
            FROM cointracker_transactions t
            WHERE ${conditions.join(' AND ')}
            ORDER BY t.date ASC;
        `;
  } else {
    sql = `
            SELECT *
            FROM cointracker_transactions t
            WHERE ${conditions.join(' AND ')}
            ORDER BY t.date ASC;
        `;
  }

  const { rows } = await client.query(sql, values);
  log.debug(`Selected ${rows.length} rows`);

  return rows.map((row) => new CointrackerTransaction(row));
}

/**
 * @param {Date} from
 * @param {Date} to
 * @param {string} interval
 * @param {string[]} assets
 * @param {string[]} excluded
 * @param {string[]} types
 * @param {string[]} received
 * @param {string[]} sent
 * @returns {Promise<*[]>}
 */
export async function selectCointrackerTransactionsGroup(
  from,
  to,
  interval,
  assets,
  excluded,
  types,
  received,
  sent,
) {
  const { conditions, values } = getConditionsAndValues(
    from,
    to,
    assets,
    excluded,
    types,
    received,
    sent,
  );

  let selectionClause, groupByClause, orderByClause;
  switch (interval) {
    case 'year':
    case 'quarter':
    case 'month':
    case 'week':
    case 'day':
      selectionClause = `DATE(DATE_TRUNC('${interval}', t.date)) AS ${interval},`;
      groupByClause = `GROUP BY ${interval}`;
      orderByClause = `ORDER BY ${interval} ASC`;
      break;
    default:
      selectionClause = ``;
      groupByClause = ``;
      orderByClause = ``;
  }

  const sql = `
        SELECT
            ${selectionClause}
            COALESCE(SUM(t.received_quantity), 0) AS received,
            COALESCE(SUM(t.sent_quantity), 0) AS sent,
            COALESCE(SUM(t.fee_amount), 0) AS fees,
            COALESCE(SUM(t.realized_return), 0) AS returns,
            COALESCE(SUM(t.realized_return), 0) - COALESCE(SUM(t.fee_amount), 0) AS net_returns
        FROM cointracker_transactions t
        WHERE ${conditions.join(' AND ')}
        ${groupByClause}
        ${orderByClause};
    `;

  const client = await getClient();
  const { rows } = await client.query(sql, values);
  log.debug(`Selected ${rows.length} rows`);
  return rows;
}
