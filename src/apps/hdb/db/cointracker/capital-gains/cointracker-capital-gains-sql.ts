export const COINTRACKER_CAPITAL_GAINS_TABLE = "cointracker_capital_gains";

export const CREATE_COINTRACKER_CAPITAL_GAINS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ${COINTRACKER_CAPITAL_GAINS_TABLE} (
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

export const DROP_COINTRACKER_CAPITAL_GAINS_TABLE_SQL = `DROP TABLE IF EXISTS ${COINTRACKER_CAPITAL_GAINS_TABLE};`;

export const TRUNCATE_COINTRACKER_CAPITAL_GAINS_TABLE_SQL = `
  TRUNCATE ${COINTRACKER_CAPITAL_GAINS_TABLE}
  RESTART IDENTITY
  CASCADE;
`;

export type CointrackerUsdcInterval = "day" | "week" | "month" | "quarter" | "year";

export type CointrackerCapitalGainsFilters = {
  assets?: string[];
  excluding?: string[];
  from: Date;
  to: Date;
  filterZero?: boolean;
  received?: Date;
  sent?: Date;
};

export type CointrackerCapitalGainsGroupFilters = CointrackerCapitalGainsFilters & {
  filterBleeders?: boolean;
  type?: "short" | "long";
};

export function buildCapitalGainsConditions(filters: CointrackerCapitalGainsFilters): {
  conditions: string[];
  values: Array<Date | string[]>;
} {
  const values: Array<Date | string[]> = [];
  const conditions: string[] = [];

  if (filters.assets && filters.assets.length > 0) {
    values.push(filters.assets);
    conditions.push(`asset_name = ANY($${values.length}::text[])`);
  }

  values.push(filters.from);
  conditions.push(`received_date >= $${values.length}`);

  values.push(filters.to);
  conditions.push(`date_sold < $${values.length}`);

  if (filters.excluding && filters.excluding.length > 0) {
    values.push(filters.excluding);
    conditions.push(`NOT (asset_name = ANY($${values.length}::text[]))`);
  }

  if (filters.filterZero) {
    conditions.push("gain_usd != 0");
  }

  if (filters.received) {
    values.push(filters.received);
    conditions.push(`received_date = $${values.length}`);
  }

  if (filters.sent) {
    values.push(filters.sent);
    conditions.push(`date_sold = $${values.length}`);
  }

  return { conditions, values };
}

export function buildSelectCointrackerCapitalGainsSql(
  conditions: string[],
  orderByGains: boolean,
): string {
  const orderByClause = orderByGains
    ? "ORDER BY gain_usd DESC"
    : "ORDER BY received_date ASC";

  return `
    SELECT *
    FROM ${COINTRACKER_CAPITAL_GAINS_TABLE}
    WHERE ${conditions.join(" AND ")}
    ${orderByClause};
  `;
}

export function buildSelectCointrackerCapitalGainsTotalsSql(conditions: string[]): string {
  return `
    SELECT
      COUNT(*) AS trades,
      SUM(cost_basis_usd) AS cost_basis,
      SUM(proceeds_usd) AS proceeds,
      SUM(gain_usd) AS gain
    FROM ${COINTRACKER_CAPITAL_GAINS_TABLE}
    WHERE ${conditions.join(" AND ")};
  `;
}

export function buildSelectCointrackerCapitalGainsGroupSql(
  conditions: string[],
  orderByGains: boolean,
  filterBleeders: boolean,
): string {
  const havingClause = filterBleeders
    ? "HAVING (SUM(gain_usd) / NULLIF(SUM(cost_basis_usd), 0)) < 0.01"
    : "";
  const orderByClause = orderByGains
    ? "ORDER BY gains DESC"
    : "ORDER BY asset_name ASC";

  return `
    SELECT
      asset_name AS group,
      COUNT(*) AS trades,
      SUM(asset_amount) AS amount,
      SUM(cost_basis_usd) AS basis,
      SUM(proceeds_usd) AS proceeds,
      SUM(gain_usd) AS gains,
      AVG(gain_usd) AS avg_gain,
      MAX(gain_usd) AS max_gain,
      MIN(gain_usd) AS max_loss,
      (SUM(gain_usd) / NULLIF(SUM(cost_basis_usd), 0)) AS roi_basis
    FROM ${COINTRACKER_CAPITAL_GAINS_TABLE}
    WHERE ${conditions.join(" AND ")}
    GROUP BY asset_name
    ${havingClause}
    ${orderByClause};
  `;
}

export const SELECT_COINTRACKER_CAPITAL_GAINS_USDC_BUCKETS_SQL = `
  WITH binned AS (
    SELECT
      width_bucket(gain_usd / asset_amount, -0.001, 0.001, 50) AS bucket,
      gain_usd / asset_amount AS per_unit_gain
    FROM ${COINTRACKER_CAPITAL_GAINS_TABLE}
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

export function buildSelectCointrackerCapitalGainsUsdcIntervalSql(interval?: CointrackerUsdcInterval): string {
  const selectionClause = interval ? `DATE(DATE_TRUNC('${interval}', date_sold)) AS ${interval},` : "";
  const groupByClause = interval ? `GROUP BY ${interval}` : "";
  const orderByClause = interval ? `ORDER BY ${interval} ASC` : "";

  return `
    SELECT
      ${selectionClause}
      COUNT(*) AS records,
      SUM(asset_amount) AS amount,
      SUM(cost_basis_usd) AS basis,
      SUM(proceeds_usd) AS proceeds,
      SUM(gain_usd) AS gain,
      MAX(gain_usd) AS max_gain,
      MIN(gain_usd) AS min_gain,
      AVG(gain_usd) AS avg_gain,
      MODE() WITHIN GROUP (ORDER BY gain_usd) AS mode,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gain_usd) AS median
    FROM ${COINTRACKER_CAPITAL_GAINS_TABLE}
    WHERE asset_name = 'USDC'
    ${groupByClause}
    ${orderByClause};
  `;
}
