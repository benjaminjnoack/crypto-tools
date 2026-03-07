import { describe, expect, it } from "vitest";
import {
  buildSelectCointrackerBalancesSql,
  CREATE_COINTRACKER_BALANCES_TABLE_SQL,
  DROP_COINTRACKER_BALANCES_TABLE_SQL,
  REBUILD_COINTRACKER_BALANCES_LEDGER_SQL,
  SELECT_COINTRACKER_LAST_BALANCE_SQL,
  TRUNCATE_COINTRACKER_BALANCES_TABLE_SQL,
} from "../../../../../../../src/apps/hdb/db/cointracker/balances/cointracker-balances-sql.js";

describe("cointracker balances sql", () => {
  it("exports lifecycle SQL", () => {
    expect(CREATE_COINTRACKER_BALANCES_TABLE_SQL).toContain("CREATE TABLE IF NOT EXISTS cointracker_balances_ledger");
    expect(DROP_COINTRACKER_BALANCES_TABLE_SQL).toContain("DROP TABLE IF EXISTS cointracker_balances_ledger");
    expect(TRUNCATE_COINTRACKER_BALANCES_TABLE_SQL).toContain("TRUNCATE cointracker_balances_ledger");
    expect(SELECT_COINTRACKER_LAST_BALANCE_SQL).toContain("SELECT DISTINCT ON (currency)");
    expect(REBUILD_COINTRACKER_BALANCES_LEDGER_SQL).toContain("SUM(delta) OVER");
  });

  it("builds select sql with filters and includeType join", () => {
    const { sql, values } = buildSelectCointrackerBalancesSql(
      {
        currencies: ["BTC"],
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-02-01T00:00:00.000Z"),
      },
      true,
    );

    expect(sql).toContain("LEFT JOIN cointracker_transactions");
    expect(sql).toContain("b.currency = ANY($1::text[])");
    expect(sql).toContain("b.date >= $2");
    expect(sql).toContain("b.date < $3");
    expect(values).toHaveLength(3);
  });
});
