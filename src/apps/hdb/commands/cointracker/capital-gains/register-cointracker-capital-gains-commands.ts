import type { Command } from "commander";
import { z } from "zod";
import { addDebugOption, addFromOption, addRangeOption, addToOption, addYearOption } from "../../../../../shared/cli/option-builders.js";
import { runAction, runActionWithArgument } from "../../shared/action-runner.js";
import { parseArgWithOptions, parseOptions, withAction } from "../../register/register-utils.js";
import { COINBASE_EPOCH } from "../../shared/date-range-utils.js";
import {
  cointrackerCapitalGains,
  cointrackerCapitalGainsGroup,
  cointrackerCapitalGainsRegenerate,
  cointrackerCapitalGainsUsdc,
} from "./cointracker-capital-gains-handlers.js";
import {
  CointrackerCapitalGainsGetOptionsSchema,
  CointrackerCapitalGainsGroupOptionsSchema,
  CointrackerCapitalGainsRegenerateOptionsSchema,
  CointrackerCapitalGainsUsdcOptionsSchema,
} from "./schemas/cointracker-capital-gains-options.js";

const NOW = new Date().toISOString();

export function registerCointrackerCapitalGainsCommands(cointracker: Command): void {
  const capitalGains = cointracker.command("gains").description("CoinTracker capital gains");

  const list = capitalGains
    .command("list [assets]")
    .description("List cointracker_capital_gains rows");

  addDebugOption(list);
  addFromOption(list, COINBASE_EPOCH);
  addRangeOption(list);
  addToOption(list, NOW);
  addYearOption(list, "Query gains for the specified year");

  list
    .option("--crypto", "Exclude cash assets (USD and USDC)", false)
    .option("--cash", "Set [assets] to cash assets (USD and USDC)", false)
    .option("--csv", "Export rows to CSV", false)
    .option("--f8949", "Generate IRS Form 8949", false)
    .option("--headers", "Include headers in output files", false)
    .option("--pages", "Paginate F8949 output", false)
    .option("--exclude <assets>", "Exclude <assets> from the result set")
    .option("--zero", "Filter out rows where gain is zero", false)
    .option("--gains", "Order by gain_usd DESC", false)
    .option("--first <first>", "Show only the first N rows")
    .option("--json", "Print machine-readable JSON output", false)
    .option("--json-file <path>", "Write machine-readable JSON output to <path>")
    .option("--last <last>", "Show only the last N rows")
    .option("--quiet", "Do not print rows", false)
    .option("--raw", "Print totals raw from DB", false)
    .option("--totals", "Print totals summary", false)
    .option("--received <received>", "Filter by received date (YYYY-MM-DD)")
    .option("--sent <sent>", "Filter by sold date (YYYY-MM-DD)")
    .action(
      withAction(
        parseArgWithOptions(z.string().optional()),
        async (assets, options) =>
          runActionWithArgument(
            cointrackerCapitalGains,
            assets,
            options,
            CointrackerCapitalGainsGetOptionsSchema,
          ),
      ),
    );

  const summary = capitalGains
    .command("summary [assets]")
    .description("Group cointracker_capital_gains by asset");

  addDebugOption(summary);
  addFromOption(summary, COINBASE_EPOCH);
  addRangeOption(summary);
  addToOption(summary, NOW);
  addYearOption(summary, "Query grouped gains for the specified year");

  summary
    .option("--bleeders", "Filter assets where roi_basis is less than 0.01", false)
    .option("--crypto", "Exclude cash assets (USD and USDC)", false)
    .option("--cash", "Set [assets] to cash assets (USD and USDC)", false)
    .option("--csv", "Export rows to CSV", false)
    .option("--f8949", "Generate IRS Form 8949", false)
    .option("--headers", "Include headers in output files", false)
    .option("--pages", "Paginate F8949 output", false)
    .option("--raw", "Use raw values where supported", false)
    .option("--exclude <assets>", "Exclude <assets> from the result set")
    .option("--zero", "Filter out rows where gain is zero", false)
    .option("--gains", "Order by gains DESC", false)
    .option("--first <first>", "Show only the first N rows")
    .option("--json", "Print machine-readable JSON output", false)
    .option("--json-file <path>", "Write machine-readable JSON output to <path>")
    .option("--last <last>", "Show only the last N rows")
    .option("--quiet", "Do not print rows", false)
    .option("--totals", "Print totals summary", false)
    .option("--type <type>", "Filter by type: short|long")
    .option("--received <received>", "Filter by received date (YYYY-MM-DD)")
    .option("--sent <sent>", "Filter by sold date (YYYY-MM-DD)")
    .action(
      withAction(
        parseArgWithOptions(z.string().optional()),
        async (assets, options) =>
          runActionWithArgument(
            cointrackerCapitalGainsGroup,
            assets,
            options,
            CointrackerCapitalGainsGroupOptionsSchema,
          ),
      ),
    );

  const analyzeUsdc = capitalGains
    .command("analyze-usdc")
    .description("Analyze USDC capital gains");

  addDebugOption(analyzeUsdc);

  analyzeUsdc
    .option("--buckets", "Analyze per-unit gain buckets", false)
    .option("--interval <interval>", "Group USDC gains by interval (day, week, month, quarter, year)")
    .action(
      withAction(
        parseOptions(),
        async (options) => runAction(cointrackerCapitalGainsUsdc, options, CointrackerCapitalGainsUsdcOptionsSchema),
      ),
    );

  const rebuild = capitalGains
    .command("rebuild")
    .description("Rebuild cointracker_capital_gains from input CSV files");

  addDebugOption(rebuild);

  rebuild
    .option("--drop", "Drop table and re-create before inserting", false)
    .option("--input-dir <dir>", "Input directory containing CoinTracker capital gains CSV files")
    .action(
      withAction(
        parseOptions(),
        async (options) => runAction(cointrackerCapitalGainsRegenerate, options, CointrackerCapitalGainsRegenerateOptionsSchema),
      ),
    );
}
