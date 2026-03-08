import { getClient } from "../../db-client.js";
import { logger } from "#shared/log/index";
import {
  buildCapitalGainsConditions,
  buildSelectCointrackerCapitalGainsGroupSql,
  buildSelectCointrackerCapitalGainsSql,
  buildSelectCointrackerCapitalGainsTotalsSql,
  buildSelectCointrackerCapitalGainsUsdcIntervalSql,
  COINTRACKER_CAPITAL_GAINS_TABLE,
  type CointrackerCapitalGainsFilters,
  type CointrackerCapitalGainsGroupFilters,
  type CointrackerUsdcInterval,
  CREATE_COINTRACKER_CAPITAL_GAINS_TABLE_SQL,
  DROP_COINTRACKER_CAPITAL_GAINS_TABLE_SQL,
  SELECT_COINTRACKER_CAPITAL_GAINS_USDC_BUCKETS_SQL,
  TRUNCATE_COINTRACKER_CAPITAL_GAINS_TABLE_SQL,
} from "./cointracker-capital-gains-sql.js";

export type CointrackerCapitalGainRow = {
  id: string;
  asset_amount: string;
  asset_name: string;
  received_date: Date;
  date_sold: Date;
  proceeds_usd: string;
  cost_basis_usd: string;
  gain_usd: string;
  type: string;
};

export type CointrackerCapitalGainsGroupRow = {
  group: string;
  trades: string;
  amount: string;
  basis: string;
  proceeds: string;
  gains: string;
  avg_gain: string;
  max_gain: string;
  max_loss: string;
  roi_basis: string;
};

export type CointrackerCapitalGainsTotalsRow = {
  trades: string;
  cost_basis: string;
  proceeds: string;
  gain: string;
};

export type CointrackerCapitalGainsUsdcBucketRow = {
  bucket: string;
  bucket_min: string;
  bucket_max: string;
  bucket_avg: string;
  bucket_mode: string;
  bucket_median: string;
  count: string;
};

export type CointrackerCapitalGainsUsdcIntervalRow = {
  day?: string;
  week?: string;
  month?: string;
  quarter?: string;
  year?: string;
  records: string;
  amount: string;
  basis: string;
  proceeds: string;
  gain: string;
  max_gain: string;
  min_gain: string;
  avg_gain: string;
  mode: string;
  median: string;
};

export type CointrackerCapitalGainInsertRow = {
  asset_amount: string;
  asset_name: string;
  received_date: Date;
  date_sold: Date;
  proceeds_usd: string;
  cost_basis_usd: string;
  gain_usd: string;
  type: string;
};

const INSERT_COLUMNS: Array<keyof CointrackerCapitalGainInsertRow> = [
  "asset_amount",
  "asset_name",
  "received_date",
  "date_sold",
  "proceeds_usd",
  "cost_basis_usd",
  "gain_usd",
  "type",
];

export { COINTRACKER_CAPITAL_GAINS_TABLE };

export async function createCointrackerCapitalGainsTable(): Promise<void> {
  const client = await getClient();
  await client.query(CREATE_COINTRACKER_CAPITAL_GAINS_TABLE_SQL);
}

export async function dropCointrackerCapitalGainsTable(): Promise<void> {
  const client = await getClient();
  await client.query(DROP_COINTRACKER_CAPITAL_GAINS_TABLE_SQL);
}

export async function truncateCointrackerCapitalGainsTable(): Promise<void> {
  const client = await getClient();
  await client.query(TRUNCATE_COINTRACKER_CAPITAL_GAINS_TABLE_SQL);
}

export async function insertCointrackerCapitalGainsBatch(rows: CointrackerCapitalGainInsertRow[]): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  const values: Array<Date | string> = [];
  const placeholders = rows.map((row, rowIndex) => {
    const start = rowIndex * INSERT_COLUMNS.length;
    const rowValues = INSERT_COLUMNS.map((column) => row[column]);
    values.push(...rowValues);
    const rowPlaceholders = INSERT_COLUMNS.map((_, columnIndex) => `$${start + columnIndex + 1}`);
    return `(${rowPlaceholders.join(", ")})`;
  });

  const sql = `
    INSERT INTO ${COINTRACKER_CAPITAL_GAINS_TABLE}
    (${INSERT_COLUMNS.join(", ")})
    VALUES ${placeholders.join(", ")};
  `;

  const client = await getClient();
  const result = await client.query(sql, values);
  return result.rowCount ?? 0;
}

function withTypeCondition(conditions: string[], type?: "short" | "long"): void {
  if (!type) {
    return;
  }

  if (type === "short") {
    conditions.push("type = 'Short Term'");
    return;
  }

  conditions.push("type = 'Long Term'");
}

export async function selectCointrackerCapitalGains(
  filters: CointrackerCapitalGainsFilters,
  orderByGains: boolean,
): Promise<CointrackerCapitalGainRow[]> {
  const { conditions, values } = buildCapitalGainsConditions(filters);
  const sql = buildSelectCointrackerCapitalGainsSql(conditions, orderByGains);

  const client = await getClient();
  const { rows } = await client.query<CointrackerCapitalGainRow>(sql, values);
  logger.debug(`Selected ${rows.length} cointracker capital gains rows`);
  return rows;
}

export async function selectCointrackerCapitalGainsGroup(
  filters: CointrackerCapitalGainsGroupFilters,
  orderByGains: boolean,
): Promise<CointrackerCapitalGainsGroupRow[]> {
  const { conditions, values } = buildCapitalGainsConditions(filters);
  withTypeCondition(conditions, filters.type);

  const sql = buildSelectCointrackerCapitalGainsGroupSql(
    conditions,
    orderByGains,
    Boolean(filters.filterBleeders),
  );

  const client = await getClient();
  const { rows } = await client.query<CointrackerCapitalGainsGroupRow>(sql, values);
  logger.debug(`Selected ${rows.length} cointracker capital gains group rows`);
  return rows;
}

export async function selectCointrackerCapitalGainsTotals(
  filters: CointrackerCapitalGainsFilters,
): Promise<CointrackerCapitalGainsTotalsRow> {
  const { conditions, values } = buildCapitalGainsConditions(filters);
  const sql = buildSelectCointrackerCapitalGainsTotalsSql(conditions);

  const client = await getClient();
  const { rows } = await client.query<CointrackerCapitalGainsTotalsRow>(sql, values);
  const first = rows[0] ?? {
    trades: "0",
    cost_basis: "0",
    proceeds: "0",
    gain: "0",
  };
  return first;
}

export async function selectCointrackerCapitalGainsGroupTotals(
  filters: CointrackerCapitalGainsGroupFilters,
): Promise<CointrackerCapitalGainsTotalsRow> {
  const { conditions, values } = buildCapitalGainsConditions(filters);
  withTypeCondition(conditions, filters.type);
  const sql = buildSelectCointrackerCapitalGainsTotalsSql(conditions);

  const client = await getClient();
  const { rows } = await client.query<CointrackerCapitalGainsTotalsRow>(sql, values);
  const first = rows[0] ?? {
    trades: "0",
    cost_basis: "0",
    proceeds: "0",
    gain: "0",
  };
  return first;
}

export async function selectCointrackerCapitalGainsUsdcBuckets(): Promise<CointrackerCapitalGainsUsdcBucketRow[]> {
  const client = await getClient();
  const { rows } = await client.query<CointrackerCapitalGainsUsdcBucketRow>(
    SELECT_COINTRACKER_CAPITAL_GAINS_USDC_BUCKETS_SQL,
  );
  logger.debug(`Selected ${rows.length} cointracker capital gains usdc bucket rows`);
  return rows;
}

export async function selectCointrackerCapitalGainsUsdcInterval(
  interval?: CointrackerUsdcInterval,
): Promise<CointrackerCapitalGainsUsdcIntervalRow[]> {
  const client = await getClient();
  const sql = buildSelectCointrackerCapitalGainsUsdcIntervalSql(interval);
  const { rows } = await client.query<CointrackerCapitalGainsUsdcIntervalRow>(sql);
  logger.debug(`Selected ${rows.length} cointracker capital gains usdc interval rows`);
  return rows;
}
