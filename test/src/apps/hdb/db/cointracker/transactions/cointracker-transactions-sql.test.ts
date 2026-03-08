import { describe, expect, it } from "vitest";
import {
  buildFilterConditions,
  buildSelectCointrackerTransactionsGroupSql,
  buildSelectCointrackerTransactionsSql,
} from "../../../../../../../src/apps/hdb/db/cointracker/transactions/cointracker-transactions-sql.js";

describe("cointracker transactions sql", () => {
  it("builds base date filters and positional params", () => {
    const { conditions, values } = buildFilterConditions({
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-02-01T00:00:00.000Z"),
    });

    expect(conditions).toEqual(["t.date >= $1", "t.date < $2"]);
    expect(values).toHaveLength(2);
  });

  it("adds optional filter conditions in stable parameter order", () => {
    const { conditions, values } = buildFilterConditions({
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-02-01T00:00:00.000Z"),
      assets: ["BTC"],
      excluded: ["ETH"],
      types: ["BUY"],
      received: ["USDC"],
      sent: ["USD"],
    });

    expect(conditions).toEqual([
      "t.date >= $1",
      "t.date < $2",
      "(t.received_currency = ANY($3::text[]) OR t.sent_currency = ANY($3::text[]))",
      "NOT (t.received_currency = ANY($4::text[]) OR t.sent_currency = ANY($4::text[]))",
      "t.type = ANY($5::text[])",
      "t.received_currency = ANY($6::text[])",
      "t.sent_currency = ANY($7::text[])",
    ]);
    expect(values[2]).toEqual(["BTC"]);
    expect(values[6]).toEqual(["USD"]);
  });

  it("builds select sql with and without balance joins", () => {
    const plainSql = buildSelectCointrackerTransactionsSql(false, ["t.date >= $1"]);
    const withBalancesSql = buildSelectCointrackerTransactionsSql(true, ["t.date >= $1"]);

    expect(plainSql).toContain("SELECT *");
    expect(plainSql).toContain("WHERE t.date >= $1");

    expect(withBalancesSql).toContain("received_currency_balance");
    expect(withBalancesSql).toContain("sent_currency_balance");
  });

  it("builds group sql with and without interval", () => {
    const baseSql = buildSelectCointrackerTransactionsGroupSql(["t.date >= $1"]);
    const monthlySql = buildSelectCointrackerTransactionsGroupSql(["t.date >= $1"], "month");

    expect(baseSql).not.toContain("DATE_TRUNC");
    expect(baseSql).not.toContain("GROUP BY");

    expect(monthlySql).toContain("DATE_TRUNC('month', t.date)");
    expect(monthlySql).toContain("GROUP BY month");
    expect(monthlySql).toContain("ORDER BY month ASC");
  });
});
