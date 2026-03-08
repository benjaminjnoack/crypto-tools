import { dateUtc } from "../../../../../fixtures/time.js";
import { describe, expect, it } from "vitest";
import {
  buildCoinbaseTransactionsFilterConditions,
  buildSelectCoinbaseTransactionsGroupSql,
  buildSelectCoinbaseTransactionsSql,
  SELECT_COINBASE_TRANSACTIONS_DISTINCT_ASSET_SQL,
} from "../../../../../../../src/apps/hdb/db/coinbase/transactions/coinbase-transactions-sql.js";

describe("coinbase transactions sql", () => {
  it("builds filter conditions with all optional selectors", () => {
    const { conditions, values } = buildCoinbaseTransactionsFilterConditions({
      from: dateUtc({ year: 2026, month: 1, day: 1 }),
      to: dateUtc({ year: 2026, month: 2, day: 1 }),
      assets: ["BTC"],
      excluded: ["ETH"],
      types: ["Buy"],
      notTypes: ["Sell"],
      selectManual: true,
      selectSynthetic: false,
    });

    expect(conditions).toContain("t.asset = ANY($3::text[])");
    expect(conditions).toContain("NOT (t.asset = ANY($4::text[]))");
    expect(conditions).toContain("t.type = ANY($5::text[])");
    expect(conditions).toContain("NOT (t.type = ANY($6::text[]))");
    expect(conditions).toContain("t.manual = true");
    expect(conditions).toContain("t.synthetic = false");
    expect(values).toHaveLength(6);
  });

  it("builds paired transaction selection sql", () => {
    const sql = buildSelectCoinbaseTransactionsSql(["t.timestamp >= $1"], true, true);
    expect(sql).toContain("WITH filtered AS");
    expect(sql).toContain("id LIKE 'synthetic-%'");
    expect(sql).toContain("LEFT JOIN coinbase_balance_ledger");
  });

  it("builds grouped sql with interval", () => {
    const sql = buildSelectCoinbaseTransactionsGroupSql(["t.timestamp >= $1"], "month");
    expect(sql).toContain("DATE(DATE_TRUNC('month', t.timestamp)) AS month");
    expect(sql).toContain("GROUP BY month");
    expect(sql).toContain("ORDER BY month ASC");
  });

  it("includes distinct asset selector sql", () => {
    expect(SELECT_COINBASE_TRANSACTIONS_DISTINCT_ASSET_SQL).toContain("SELECT DISTINCT asset");
    expect(SELECT_COINBASE_TRANSACTIONS_DISTINCT_ASSET_SQL).toContain("timestamp >= $1");
    expect(SELECT_COINBASE_TRANSACTIONS_DISTINCT_ASSET_SQL).toContain("timestamp < $2");
  });
});
