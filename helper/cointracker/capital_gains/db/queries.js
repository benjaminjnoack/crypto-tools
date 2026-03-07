import { getClient } from '@db/client.js';
import format from 'pg-format';
import { log } from '@core/logger.js';
import CapitalGains from '../CapitalGains.js';
import { CAPITAL_GAIN_TYPE, CAPITAL_GAINS_TABLE } from '../../dictionary.js';
import CapitalGainsGroup from '../CapitalGainsGroup.js';
import { CapitalGainsTotals } from '../CapitalGainsTotals.js';

export const COINTRACKER_CAPITAL_GAINS_TABLE = 'cointracker_capital_gains';

/**
 * @returns {Promise<*>}
 */
export async function createCointrackerCapitalGainsTable() {
  const sql = `
    CREATE table IF NOT EXISTS ${COINTRACKER_CAPITAL_GAINS_TABLE} (
        id BIGSERIAL PRIMARY KEY,
        asset_amount NUMERIC NOT NULL,
        asset_name TEXT NOT NULL,
        received_date TIMESTAMPTZ NOT NULL,
        date_sold TIMESTAMPTZ NOT NULL,
        proceeds_usd NUMERIC NOT NULL,
        cost_basis_usd NUMERIC NOT NULL,
        gain_usd NUMERIC NOT NULL,
        type TEXT NOT NULL
    );
    `;
  const client = await getClient();
  return client.query(sql);
}

export async function dropCointrackerCapitalGainsTable() {
  const sql = `DROP TABLE IF EXISTS ${COINTRACKER_CAPITAL_GAINS_TABLE};`;
  const client = await getClient();
  return client.query(sql);
}

/**
 * @returns {Promise<*>}
 */
export async function truncateCointrackerCapitalGainsTable() {
  const sql = `
    TRUNCATE ${COINTRACKER_CAPITAL_GAINS_TABLE} -- Faster than DELETE, preserves indexes and constraints
    RESTART IDENTITY -- Resets any serial/sequence columns
    CASCADE; -- truncates child tables with foreign key dependencies
    `;
  const client = await getClient();
  return client.query(sql);
}

/**
 * @param {CapitalGainsRow[]} rows
 * @returns {Promise<number>}
 */
export async function insertCointrackerCapitalGainsBatch(rows) {
  if (!rows.length) return 0;

  const client = await getClient();

  const values = rows.map((row) => row.toSqlValues());
  const valuesSQL = format('%L', values);

  const sql = `
    INSERT INTO ${COINTRACKER_CAPITAL_GAINS_TABLE} (
        asset_amount,
        asset_name,
        received_date,
        date_sold,
        proceeds_usd,
        cost_basis_usd,
        gain_usd,
        type
    ) VALUES ${valuesSQL};
    `;

  const { command, rowCount } = await client.query(sql);
  log.info(`${command} ${rowCount}`);
  return rowCount;
}

/**
 * @param {string[]} assets - array of asset names
 * @param {Date} from - greater than or equal to received date
 * @param {Date} to - less than date sold
 * @param {string[]} excluding - excluded asset names
 * @param {boolean} filterZero - exclude rows where the gain is zero
 * @returns {{conditions: string[], values: *[]}}
 */
function getConditionsAndValues(assets, from, to, excluding, filterZero) {
  const conditions = [];
  const values = [];

  if (assets.length) {
    values.push(assets);
    conditions.push(`asset_name = ANY($${values.length}::text[])`);
  }

  if (from) {
    values.push(from);
    conditions.push(`received_date >= $${values.length}`);
  }
  if (to) {
    values.push(to);
    conditions.push(`date_sold < $${values.length}`);
  }

  if (excluding.length) {
    values.push(excluding);
    conditions.push(`NOT (asset_name = ANY($${values.length}::text[]))`);
  }

  if (filterZero) {
    conditions.push('gain_usd != 0');
  }

  return { conditions, values };
}

/**
 * @param {string[]} assets - array of asset names
 * @param {Date} from - greater than or equal to received date
 * @param {Date} to - less than date sold
 * @param {string[]} excluding - excluded asset names
 * @param {boolean} filterZero - exclude rows where the gain is zero TODO these should be done in post-processing
 * @param {boolean} orderByGains - order by gain_usd DESC
 * @param {Date|null} received
 * @param {Date|null} sent
 * @returns {Promise<CapitalGains[]>}
 */
export async function selectCointrackerCapitalGains(
  assets,
  from,
  to,
  excluding,
  filterZero = false,
  orderByGains = false,
  received = null,
  sent = null,
) {
  const client = await getClient();

  const { conditions, values } = getConditionsAndValues(assets, from, to, excluding, filterZero);

  if (received) {
    values.push(received);
    conditions.push(`received_date = $${values.length}`);
  }
  if (sent) {
    values.push(sent);
    conditions.push(`date_sold = $${values.length}`);
  }

  const orderByClause = orderByGains
    ? `ORDER BY ${CAPITAL_GAINS_TABLE.GAIN_USD} DESC`
    : `ORDER BY ${CAPITAL_GAINS_TABLE.RECEIVED_DATE} ASC`;

  const sql = `
    SELECT *
    FROM cointracker_capital_gains
    WHERE ${conditions.join(' AND ')}
    ${orderByClause};
    `;

  const { rows } = await client.query(sql, values);
  log.debug(`selected ${rows.length} rows`);
  return rows.map((row) => new CapitalGains(row));
}

/**
 * Do the summation in the database
 * @param {string[]} assets - array of asset names
 * @param {Date} from - greater than or equal to received date
 * @param {Date} to - less than date sold
 * @param {string[]} excluding - excluded asset names
 * @returns {Promise<CapitalGainsTotals>}
 */
export async function selectCointrackerCapitalGainsTotals(assets, from, to, excluding) {
  const client = await getClient();
  const filterZero = false; //The only way I can see zero values affecting the results is if they are not zero
  const { conditions, values } = getConditionsAndValues(assets, from, to, excluding, filterZero);

  const sql = `SELECT
        COUNT(*) AS trades,
        SUM(${CAPITAL_GAINS_TABLE.COST_BASIS_USD}) AS cost_basis,
        SUM(${CAPITAL_GAINS_TABLE.PROCEEDS_USD}) AS proceeds,
        SUM(${CAPITAL_GAINS_TABLE.GAIN_USD}) AS gain
        FROM ${COINTRACKER_CAPITAL_GAINS_TABLE}
        WHERE ${conditions.join(' AND ')};
    `;

  const { rows } = await client.query(sql, values);
  log.debug(`selected ${rows.length} rows`);
  return new CapitalGainsTotals(rows[0]);
}

/**
 * @param {string} type
 * @param {string[]} conditions
 */
function getTypeCondition(type, conditions) {
  switch (type.toLowerCase()) {
    case 'short':
      conditions.push(`type = '${CAPITAL_GAIN_TYPE.SHORT_TERM}'`);
      break;
    case 'long':
      conditions.push(`type = '${CAPITAL_GAIN_TYPE.LONG_TERM}'`);
      break;
    case '':
      break;
    default:
      throw new Error(`Unsupported type ${type}`);
  }
}

/**
 * @param {string[]} assets - array of asset names
 * @param {Date} from - greater than or equal to received date
 * @param {Date} to - less than date sold
 * @param {string[]} excluding - excluded asset names
 * @param {boolean} filterZero - exclude rows where the gain is zero
 * @param {boolean} orderByGains - order by gain_usd DESC
 * @param {boolean} filterBleeders - filter where roi basis is less than 0.01
 * @param {string} type - select and group by type, default is by asset
 * @param {Date|null} received
 * @param {Date|null} sent
 * @returns {Promise<CapitalGainsGroup[]>}
 */
export async function selectCointrackerCapitalGainsGroup(
  assets,
  from,
  to,
  excluding,
  filterZero = false,
  orderByGains = false,
  filterBleeders = false,
  type = '',
  received = null,
  sent = null,
) {
  const { conditions, values } = getConditionsAndValues(assets, from, to, excluding, filterZero);
  getTypeCondition(type, conditions);
  if (received) {
    values.push(received);
    conditions.push(`received_date = $${values.length}`);
  }
  if (sent) {
    values.push(sent);
    conditions.push(`date_sold = $${values.length}`);
  }

  const havingClause = filterBleeders
    ? `HAVING (SUM(${CAPITAL_GAINS_TABLE.GAIN_USD}) / NULLIF(SUM(${CAPITAL_GAINS_TABLE.COST_BASIS_USD}), 0)) < 0.01`
    : '';
  const orderByClause = orderByGains
    ? `ORDER BY gains DESC`
    : `ORDER BY ${CAPITAL_GAINS_TABLE.ASSET_NAME} ASC`;

  const sql = `
            SELECT 
            ${CAPITAL_GAINS_TABLE.ASSET_NAME} AS group,
            COUNT(*) AS trades,
            SUM(${CAPITAL_GAINS_TABLE.ASSET_AMOUNT}) AS amount,
            SUM(${CAPITAL_GAINS_TABLE.COST_BASIS_USD}) AS basis,
            SUM(${CAPITAL_GAINS_TABLE.PROCEEDS_USD}) AS proceeds,
            SUM(${CAPITAL_GAINS_TABLE.GAIN_USD}) AS gains,
            AVG(${CAPITAL_GAINS_TABLE.GAIN_USD}) AS avg_gain,
            MAX(${CAPITAL_GAINS_TABLE.GAIN_USD}) AS max_gain,
            MIN(${CAPITAL_GAINS_TABLE.GAIN_USD}) AS max_loss,
            (SUM(${CAPITAL_GAINS_TABLE.GAIN_USD}) / NULLIF(SUM(${CAPITAL_GAINS_TABLE.COST_BASIS_USD}), 0)) AS roi_basis
        FROM cointracker_capital_gains
        WHERE ${conditions.join(' AND ')}
        GROUP BY ${CAPITAL_GAINS_TABLE.ASSET_NAME}
        ${havingClause}
        ${orderByClause};
    `;

  const client = await getClient();
  const { rows } = await client.query(sql, values);
  log.debug(`selected ${rows.length} rows`);
  return rows.map((row) => new CapitalGainsGroup(row));
}

/**
 * @param {string[]} assets - array of asset names
 * @param {Date} from - greater than or equal to received date
 * @param {Date} to - less than date sold
 * @param {string[]} excluding - excluded asset names
 * @param {string} type - select and group by type, default is by asset
 * @returns {Promise<CapitalGainsTotals>}
 */
export async function selectCointrackerCapitalGainsGroupTotals(
  assets,
  from,
  to,
  excluding,
  type = '',
) {
  const filterZero = false; //The only way I can see zero values affecting the results is if they are not zero
  const { conditions, values } = getConditionsAndValues(assets, from, to, excluding, filterZero);
  getTypeCondition(type, conditions);

  const sql = `
            SELECT 
            COUNT(*) AS trades,
            SUM(${CAPITAL_GAINS_TABLE.COST_BASIS_USD}) AS cost_basis,
            SUM(${CAPITAL_GAINS_TABLE.PROCEEDS_USD}) AS proceeds,
            SUM(${CAPITAL_GAINS_TABLE.GAIN_USD}) AS gain
        FROM cointracker_capital_gains
        WHERE ${conditions.join(' AND ')}
    `;

  const client = await getClient();
  const { rows } = await client.query(sql, values);
  log.debug(`selected ${rows.length} rows`);
  return new CapitalGainsTotals(rows[0]);
}

/**
 * Next Step Suggestions
 * Analyze total USD impact by weighting loss per unit × amount
 * → To separate real loss from distorted ratios on small lots
 *
 * Filter by lot size to get a clean sample — e.g. only show buckets where asset_amount > 1
 *
 * Cap per-unit losses/gains to +/- 0.01 and drop anything extreme as noise/artifacts
 *
 * Next Moves (when you’re ready)
 * Weight the per-unit loss by asset_amount to find your actual dollar impact from slippage.
 *
 * Visualize the histogram for a clearer skew view.
 *
 * Inspect outliers in bucket 0 and 51 for data quality or edge-case detection.
 *
 * Compute trimmed mean (excluding bucket 0 and 51) to get a "typical" per-unit loss for 95% of trades.
 * @returns {Promise<*>}
 */
export async function selectCointrackerCapitalGainsUsdcBuckets() {
  const sql = `
        WITH binned AS (
            SELECT
            width_bucket(gain_usd / asset_amount, -0.001, 0.001, 50) AS bucket,
            gain_usd / asset_amount AS per_unit_gain
            FROM cointracker_capital_gains
            WHERE asset_name = 'USDC'
            AND asset_amount > 1
        )
        SELECT
            bucket,
            MIN(per_unit_gain) AS bucket_min,
            MAX(per_unit_gain) AS bucket_max,
            AVG(per_unit_gain) AS bucket_avg,
            MODE() WITHIN GROUP (ORDER BY per_unit_gain) AS bucket_mode,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY per_unit_gain) AS bucket_median,
            COUNT(*) AS count
        FROM binned
        GROUP BY bucket
        ORDER BY bucket;
    `;
  const client = await getClient();
  const { rows } = await client.query(sql);
  log.debug(`selected ${rows.length} rows`);
  return rows;
}

/**
 * @param {string} interval
 * @returns {{selectionClause: string, groupByClause: string, orderByClause: string}}
 */
function getIntervalClauses(interval) {
  let selectionClause, groupByClause, orderByClause;
  switch (interval) {
    case 'year':
    case 'quarter':
    case 'month':
    case 'week':
    case 'day':
      selectionClause = `DATE(DATE_TRUNC('${interval}', date_sold)) AS ${interval},`;
      groupByClause = `GROUP BY ${interval}`;
      orderByClause = `ORDER BY ${interval} ASC`;
      break;
    default:
      selectionClause = ``;
      groupByClause = ``;
      orderByClause = ``;
  }

  return { selectionClause, groupByClause, orderByClause };
}

export async function selectCointrackerCapitalGainsUsdcInterval(interval) {
  const { selectionClause, groupByClause, orderByClause } = getIntervalClauses(interval);
  const sql = `
        SELECT
            ${selectionClause}
            COUNT(*) AS records,
            SUM(asset_amount) AS amount,
            SUM(cost_basis_usd) AS basis,
            SUM(proceeds_usd) AS proceeds,
            SUM(gain_usd) AS gain,
            MAX(gain_usd) AS max_gain,
            MIN(gain_USD) AS min_gain,
            AVG(gain_usd) AS avg_gain,
            MODE() WITHIN GROUP (ORDER BY gain_usd) AS mode,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gain_usd) AS median
        FROM cointracker_capital_gains
        WHERE asset_name = 'USDC'
        ${groupByClause}
        ${orderByClause};
    `;

  const client = await getClient();
  const { rows } = await client.query(sql);
  log.debug(`selected ${rows.length} rows`);
  return rows;
}
