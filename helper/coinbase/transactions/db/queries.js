import { getClient } from '@db/client.js';
import { log } from '@core/logger.js';
import Transaction from '../Transaction.js';
import format from 'pg-format';

export const COINBASE_TRANSACTIONS_TABLE = 'coinbase_transactions';

export async function createCoinbaseTransactionsTable() {
  const sql = `CREATE TABLE IF NOT EXISTS ${COINBASE_TRANSACTIONS_TABLE} (
                                                                               id TEXT PRIMARY KEY,
                                                                               timestamp TIMESTAMPTZ NOT NULL,
                                                                               type TEXT NOT NULL,
                                                                               asset TEXT NOT NULL,
                                                                               price_currency TEXT NOT NULL,
                                                                               notes TEXT DEFAULT '',
                                                                               synthetic BOOLEAN DEFAULT FALSE,
                                                                               manual BOOLEAN DEFAULT FALSE,
        -- These are the raw strings parsed from the statement CSV
                                                                               quantity TEXT NOT NULL,
                                                                               price_at_tx TEXT NOT NULL,
                                                                               subtotal TEXT NOT NULL,
                                                                               total TEXT NOT NULL,
                                                                               fee TEXT NOT NULL,
        -- Clean strings (no dollar signs, commas, or hyphens)
        -- NOTE: this means no negative values!
        -- Direction is given by type (Sell, Deposit, etc...) not value
                                                                               num_quantity NUMERIC NOT NULL,
                                                                               num_price_at_tx NUMERIC NOT NULL,
                                                                               num_subtotal NUMERIC NULL,
                                                                               num_total NUMERIC NOT NULL,
                                                                               num_fee NUMERIC NOT NULL,
        -- Clean strings passed to Number(str)
                                                                               js_num_quantity DOUBLE PRECISION NOT NULL,
                                                                               js_num_price_at_tx DOUBLE PRECISION NOT NULL,
                                                                               js_num_subtotal DOUBLE PRECISION NULL,
                                                                               js_num_total DOUBLE PRECISION NOT NULL,
                                                                               js_num_fee DOUBLE PRECISION NOT NULL,
        -- Clean strings scaled with lazy inference and converted to BigInt
        -- NOTE: BIGINT columns were determined to not be big enough!
        -- so NUMERIC columns are used as passed the BigInt as a string
                                                                               int_quantity NUMERIC NOT NULL,
                                                                               int_price_at_tx NUMERIC NOT NULL,
                                                                               int_subtotal NUMERIC NULL,
                                                                               int_total NUMERIC NOT NULL,
                                                                               int_fee NUMERIC NOT NULL
                 );`;
  const client = await getClient();
  return client.query(sql);
}

export async function dropCoinbaseTransactionsTable() {
  const sql = `DROP TABLE IF EXISTS ${COINBASE_TRANSACTIONS_TABLE};`;
  const client = await getClient();
  return client.query(sql);
}

export async function truncateCoinbaseTransactionsTable() {
  const sql = `
    TRUNCATE ${COINBASE_TRANSACTIONS_TABLE}
    RESTART IDENTITY
    CASCADE
    ;`;
  const client = await getClient();
  return client.query(sql);
}

/**
 * @param {StatementRow} row
 * @param {boolean} rewriteExisting
 * @returns {Promise<*>}
 */
export async function insertCoinbaseTransactions(row, rewriteExisting) {
  const client = await getClient();

  const conflictClause = rewriteExisting
    ? `
        ON CONFLICT (id) DO UPDATE SET
          timestamp = EXCLUDED.timestamp,
          type = EXCLUDED.type,
          asset = EXCLUDED.asset,
          price_currency = EXCLUDED.price_currency,
          notes = EXCLUDED.notes,
          synthetic = EXCLUDED.synthetic,
          manual = EXCLUDED.manual,
          quantity = EXCLUDED.quantity,
          price_at_tx = EXCLUDED.price_at_tx,
          subtotal = EXCLUDED.subtotal,
          total = EXCLUDED.total,
          fee = EXCLUDED.fee,
          num_quantity = EXCLUDED.num_quantity,
          num_price_at_tx = EXCLUDED.num_price_at_tx,
          num_subtotal = EXCLUDED.num_subtotal,
          num_total = EXCLUDED.num_total,
          num_fee = EXCLUDED.num_fee,
          js_num_quantity = EXCLUDED.js_num_quantity,
          js_num_price_at_tx = EXCLUDED.js_num_price_at_tx,
          js_num_subtotal = EXCLUDED.js_num_subtotal,
          js_num_total = EXCLUDED.js_num_total,
          js_num_fee = EXCLUDED.js_num_fee,
          int_quantity = EXCLUDED.int_quantity,
          int_price_at_tx = EXCLUDED.int_price_at_tx,
          int_subtotal = EXCLUDED.int_subtotal,
          int_total = EXCLUDED.int_total,
          int_fee = EXCLUDED.int_fee;
      `
    : `ON CONFLICT (id) DO NOTHING;`;

  const sql = `INSERT INTO ${COINBASE_TRANSACTIONS_TABLE} (
        id, timestamp, type, asset, price_currency, notes, synthetic, manual,
        quantity, price_at_tx, subtotal, total, fee,
        num_quantity, num_price_at_tx, num_subtotal, num_total, num_fee,
        js_num_quantity, js_num_price_at_tx, js_num_subtotal, js_num_total, js_num_fee,
        int_quantity, int_price_at_tx, int_subtotal, int_total, int_fee
    ) VALUES (
                 $1, $2, $3, $4, $5, $6, $7, $8,
                 $9, $10, $11, $12, $13,
                 $14, $15, $16, $17, $18,
                 $19, $20, $21, $22, $23,
                 $24, $25, $26, $27, $28
             )
                     ${conflictClause}`;

  const values = row.toSqlValues();
  return client.query(sql, values);
}

/**
 * @param {StatementRow[]} rows
 * @returns {Promise<*>}
 */
export async function insertCoinbaseTransactionsBatch(rows) {
  if (!rows.length) return;

  const client = await getClient();

  const values = rows.map((row) => row.toSqlValues());
  const valuesSQL = format('%L', values);

  const sql = `INSERT INTO ${COINBASE_TRANSACTIONS_TABLE} (
        id, timestamp, type, asset, price_currency, notes, synthetic, manual,
        quantity, price_at_tx, subtotal, total, fee,
        num_quantity, num_price_at_tx, num_subtotal, num_total, num_fee,
        js_num_quantity, js_num_price_at_tx, js_num_subtotal, js_num_total, js_num_fee,
        int_quantity, int_price_at_tx, int_subtotal, int_total, int_fee
    ) VALUES ${valuesSQL};
    `;

  return client.query(sql);
}

/**
 * TODO switch the argument order: from, to
 * @param {Date} to
 * @param {Date} from
 * @param {string[]} assets
 * @param {string[]} types
 * @param {string[]} notTypes
 * @param {boolean} withBalances
 * @param {boolean} withPairedSynthetic
 * @param {string[]} excluding
 * @param {boolean|null} selectManual
 * @param {boolean|null} selectSynthetic
 * @returns {Promise<Transaction[]>}
 */
export async function selectCoinbaseTransactions(
  to,
  from,
  assets = [],
  types = [],
  notTypes = [],
  withBalances = false,
  withPairedSynthetic = false,
  excluding = [],
  selectManual = null,
  selectSynthetic = null,
) {
  const client = await getClient();

  const conditions = [`t.timestamp IS NOT NULL`];
  const values = [];

  if (assets.length) {
    values.push(assets);
    //Similar query from selectByIDs WHERE id = ANY($1::text[])
    conditions.push(`t.asset = ANY($${values.length}::text[])`);
  }
  if (excluding.length) {
    values.push(excluding);
    conditions.push(`NOT (t.asset = ANY($${values.length}::text[]))`);
  }
  if (from) {
    values.push(from);
    conditions.push(`t.timestamp >= $${values.length}`);
  }
  if (to) {
    values.push(to);
    conditions.push(`t.timestamp < $${values.length}`);
  }
  if (types.length > 0) {
    values.push(types);
    conditions.push(`t.type = ANY($${values.length}::text[])`);
  }
  if (notTypes.length > 0) {
    values.push(notTypes);
    conditions.push(`t.type = NOT (ANY($${values.length}::text[]))`);
  }
  if (selectManual === true) {
    conditions.push('t.manual = true');
  } else if (selectManual === false) {
    conditions.push('t.manual = false');
  }
  if (selectSynthetic === true) {
    conditions.push('t.synthetic = true');
  } else if (selectSynthetic === false) {
    conditions.push('t.synthetic = false');
  }

  let baseSql;

  if (withPairedSynthetic) {
    baseSql = `
        WITH filtered AS (
            SELECT *
            FROM ${COINBASE_TRANSACTIONS_TABLE} t
            WHERE ${conditions.join(' AND ')}
        ),
        synthetic_ids AS (
            SELECT id AS synthetic_id,
                   regexp_replace(id, '^synthetic-', '') AS real_id
            FROM filtered
            WHERE id LIKE 'synthetic-%'
        ),
        full_ids AS (
            SELECT synthetic_id AS id FROM synthetic_ids
            UNION
            SELECT real_id AS id FROM synthetic_ids
            UNION
            SELECT id FROM filtered
        )
        SELECT ${withBalances ? 't.*, b.balance' : 't.*'}
        FROM ${COINBASE_TRANSACTIONS_TABLE} t
        ${withBalances ? 'LEFT JOIN coinbase_balance_ledger b ON t.id = b.tx_id' : ''}
        JOIN full_ids f ON t.id = f.id
        ORDER BY t.timestamp ASC;
    `;
  } else {
    baseSql = withBalances
      ? `
            SELECT t.*, b.balance
            FROM ${COINBASE_TRANSACTIONS_TABLE} t
                     LEFT JOIN coinbase_balance_ledger b ON t.id = b.tx_id
            WHERE ${conditions.join(' AND ')}
            ORDER BY t.timestamp ASC;
        `
      : `
            SELECT *
            FROM ${COINBASE_TRANSACTIONS_TABLE} t
            WHERE ${conditions.join(' AND ')}
            ORDER BY t.timestamp ASC;
        `;
  }

  const { rows } = await client.query(baseSql, values);
  log.debug(`selectCoinbaseTransactions => ${rows.length} row(s)`);
  return rows.map((row) => new Transaction(row));
}

/**
 * @param {string} id
 * @param {boolean} withBalances
 * @returns {Promise<Transaction[]>}
 */
export async function selectCoinbaseTransactionById(id, withBalances = false) {
  const values = [];
  values.push(id);
  const conditions = [`t.id = $${values.length}`];

  const baseSql = withBalances
    ? `
                SELECT t.*, b.balance
                FROM ${COINBASE_TRANSACTIONS_TABLE} t
                         LEFT JOIN coinbase_balance_ledger b ON t.id = b.tx_id
                WHERE ${conditions.join(' AND ')}
                ORDER BY t.timestamp ASC;
        `
    : `
                SELECT *
                FROM ${COINBASE_TRANSACTIONS_TABLE} t
                WHERE ${conditions.join(' AND ')}
                ORDER BY t.timestamp ASC;
        `;

  const client = await getClient();
  const { rows } = await client.query(baseSql, values);

  log.info(`Returned ${rows.length} row(s)`);
  return rows.map((row) => new Transaction(row));
}

/**
 * @param {string[]} txIds
 * @returns {Promise<Transaction[]>}
 */
export async function selectCoinbaseTransactionsByIds(txIds) {
  if (!txIds || txIds.length === 0) return [];

  const sql = `
        SELECT *
        FROM ${COINBASE_TRANSACTIONS_TABLE}
        WHERE id = ANY($1::text[])
        ORDER BY timestamp ASC;
    `;

  const client = await getClient();
  const res = await client.query(sql, [txIds]);
  const rows = res['rows'];
  log.debug(`selectCoinbaseTransactionsByIds => ${rows.length} rows(s)`);
  return rows.map((row) => new Transaction(row));
}

/**
 *
 * @param {Date} from
 * @param {Date} to
 * @returns {Promise<*[]>}
 */
export async function selectCoinbaseTransactionsDistinctAsset(from, to) {
  const conditions = [];
  const values = [];
  if (from) {
    values.push(from);
    conditions.push(`t.timestamp >= $${values.length}`);
  }
  if (to) {
    values.push(to);
    conditions.push(`t.timestamp < $${values.length}`);
  }

  const query = `
        SELECT DISTINCT t.asset
        FROM ${COINBASE_TRANSACTIONS_TABLE} t
        WHERE ${conditions.join(' AND ')}
        ORDER BY t.asset ASC;
    `;

  const client = await getClient();
  const res = await client.query(query, values);
  return res.rows.map((row) => row.asset);
}

/**
 * @param {Date} from
 * @param {Date} to
 * @param {string[]} assets
 * @param {string[]} excluding
 * @param {string[]} types
 * @param {string} interval
 * @param {boolean|null} selectManual
 * @param {boolean|null} selectSynthetic
 * @returns {Promise<{quantity: string, subtotal: string, fee: string, total: string}[]>}
 */
export async function selectCoinbaseTransactionsGroup(
  from = null,
  to = null,
  assets = [],
  excluding = [],
  types = [],
  interval = '',
  selectManual = null,
  selectSynthetic = null,
) {
  const conditions = [];
  const values = [];
  if (from) {
    values.push(from);
    conditions.push(`timestamp >= $${values.length}`);
  }
  if (to) {
    values.push(to);
    conditions.push(`timestamp < $${values.length}`);
  }
  if (assets.length) {
    values.push(assets);
    conditions.push(`asset = ANY($${values.length}::text[])`);
  }
  if (excluding.length) {
    values.push(excluding);
    conditions.push(`NOT (asset = ANY($${values.length}::text[]))`);
  }
  if (types.length) {
    values.push(types);
    conditions.push(`type = ANY($${values.length}::text[])`);
  }
  if (selectManual === true) {
    conditions.push('manual = true');
  } else if (selectManual === false) {
    conditions.push('manual = false');
  }
  if (selectSynthetic === true) {
    conditions.push('synthetic = true');
  } else if (selectSynthetic === false) {
    conditions.push('synthetic = false');
  }

  let selectionClause, groupByClause, orderByClause;
  switch (interval) {
    case 'year':
    case 'quarter':
    case 'month':
    case 'week':
    case 'day':
      selectionClause = `DATE(DATE_TRUNC('${interval}', timestamp)) AS ${interval},`;
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
        SUM(num_quantity) AS quantity,
        SUM(num_subtotal) AS subtotal,
        SUM(num_fee) AS fee,
        SUM(num_total) AS total
    FROM ${COINBASE_TRANSACTIONS_TABLE}
    WHERE ${conditions.join(' AND ')}
    ${groupByClause}
    ${orderByClause}
    `;
  const client = await getClient();
  const { rows } = await client.query(sql, values);
  return rows;
}
