import { describe, expect, it } from "vitest";
import {
  buildCapitalGainsConditions,
  buildSelectCointrackerCapitalGainsGroupSql,
  buildSelectCointrackerCapitalGainsSql,
  buildSelectCointrackerCapitalGainsTotalsSql,
  CREATE_COINTRACKER_CAPITAL_GAINS_TABLE_SQL,
  DROP_COINTRACKER_CAPITAL_GAINS_TABLE_SQL,
  TRUNCATE_COINTRACKER_CAPITAL_GAINS_TABLE_SQL,
} from "../../../../../../../src/apps/hdb/db/cointracker/capital-gains/cointracker-capital-gains-sql.js";

describe("cointracker capital gains sql", () => {
  it("exports lifecycle sql", () => {
    expect(CREATE_COINTRACKER_CAPITAL_GAINS_TABLE_SQL).toContain("CREATE TABLE IF NOT EXISTS cointracker_capital_gains");
    expect(DROP_COINTRACKER_CAPITAL_GAINS_TABLE_SQL).toContain("DROP TABLE IF EXISTS cointracker_capital_gains");
    expect(TRUNCATE_COINTRACKER_CAPITAL_GAINS_TABLE_SQL).toContain("TRUNCATE cointracker_capital_gains");
  });

  it("builds conditions and select sql", () => {
    const { conditions, values } = buildCapitalGainsConditions({
      assets: ["BTC"],
      excluding: ["USDC"],
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-02-01T00:00:00.000Z"),
      filterZero: true,
    });

    expect(conditions).toContain("asset_name = ANY($1::text[])");
    expect(conditions).toContain("received_date >= $2");
    expect(conditions).toContain("date_sold < $3");
    expect(conditions).toContain("NOT (asset_name = ANY($4::text[]))");
    expect(conditions).toContain("gain_usd != 0");
    expect(values).toHaveLength(4);

    expect(buildSelectCointrackerCapitalGainsSql(conditions, true)).toContain("ORDER BY gain_usd DESC");
    expect(buildSelectCointrackerCapitalGainsTotalsSql(conditions)).toContain("SUM(gain_usd) AS gain");
    expect(buildSelectCointrackerCapitalGainsGroupSql(conditions, false, true)).toContain("HAVING");
  });
});
