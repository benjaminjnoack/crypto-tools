import { dateUtc } from "../../../../../fixtures/time.js";
import { describe, expect, it } from "vitest";
import {
  buildSelectCoinbaseBalanceLedgerSql,
  COINBASE_BALANCE_LEDGER_TABLE,
  TRACE_COINBASE_BALANCE_LEDGER_SQL,
} from "../../../../../../../src/apps/hdb/db/coinbase/balances/coinbase-balances-sql.js";

describe("coinbase balances sql", () => {
  it("builds select sql with asset/from/to filters", () => {
    const from = dateUtc({ year: 2026, month: 1, day: 1 });
    const to = dateUtc({ year: 2026, month: 1, day: 31 });

    const { sql, values } = buildSelectCoinbaseBalanceLedgerSql({
      assets: ["BTC", "ETH"],
      from,
      to,
    });

    expect(sql).toContain(`FROM ${COINBASE_BALANCE_LEDGER_TABLE}`);
    expect(sql).toContain("asset = ANY($1::text[])");
    expect(sql).toContain("timestamp >= $2");
    expect(sql).toContain("timestamp <= $3");
    expect(values).toEqual([["BTC", "ETH"], from, to]);
  });

  it("trace sql uses asset and to placeholders", () => {
    expect(TRACE_COINBASE_BALANCE_LEDGER_SQL).toContain("WHERE asset = $1");
    expect(TRACE_COINBASE_BALANCE_LEDGER_SQL).toContain("timestamp < $2");
  });
});
