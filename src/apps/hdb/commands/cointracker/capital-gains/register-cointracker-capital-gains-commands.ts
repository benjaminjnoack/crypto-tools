import type { Command } from "commander";
import { z } from "zod";
import { addDebugOption, addFromOption, addRangeOption, addToOption, addYearOption } from "#shared/cli/option-builders";
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
  const capitalGains = cointracker.command("capital-gains").description("CoinTracker capital gains operations");

  const get = capitalGains
    .command("get [assets]")
    .alias("g")
    .description("Query cointracker_capital_gains rows");

  addDebugOption(get);
  addFromOption(get, COINBASE_EPOCH);
  addRangeOption(get);
  addToOption(get, NOW);
  addYearOption(get, "Query gains for the specified year");

  get
    .option("-c, --crypto", "Exclude cash assets (USD and USDC)", false)
    .option("-C, --cash", "Set [assets] to cash assets (USD and USDC)", false)
    .option("--csv", "Export rows to CSV", false)
    .option("--f8949", "Generate IRS Form 8949", false)
    .option("-H, --headers", "Include headers in output files", false)
    .option("-p, --pages", "Paginate F8949 output", false)
    .option("-x, --exclude <assets>", "Exclude <assets> from the result set")
    .option("-z, --zero", "Filter out rows where gain is zero", false)
    .option("-g, --gains", "Order by gain_usd DESC", false)
    .option("--first <first>", "Show only the <first> number of rows")
    .option("--last <last>", "Show only the <last> number of rows")
    .option("-q, --quiet", "Do not print rows", false)
    .option("--totals", "Print totals summary", false)
    .option("-R, --received <received>", "Filter by received date (YYYY-MM-DD)")
    .option("-S, --sent <sent>", "Filter by sold date (YYYY-MM-DD)")
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

  const group = capitalGains
    .command("group [assets]")
    .alias("grp")
    .description("Group cointracker_capital_gains by asset");

  addDebugOption(group);
  addFromOption(group, COINBASE_EPOCH);
  addRangeOption(group);
  addToOption(group, NOW);
  addYearOption(group, "Query grouped gains for the specified year");

  group
    .option("-b, --bleeders", "Filter assets where roi_basis is less than 0.01", false)
    .option("-c, --crypto", "Exclude cash assets (USD and USDC)", false)
    .option("-C, --cash", "Set [assets] to cash assets (USD and USDC)", false)
    .option("--csv", "Export rows to CSV", false)
    .option("--f8949", "Generate IRS Form 8949", false)
    .option("-H, --headers", "Include headers in output files", false)
    .option("-p, --pages", "Paginate F8949 output", false)
    .option("--raw", "Use raw values where supported", false)
    .option("-x, --exclude <assets>", "Exclude <assets> from the result set")
    .option("-z, --zero", "Filter out rows where gain is zero", false)
    .option("-g, --gains", "Order by gains DESC", false)
    .option("--first <first>", "Show only the <first> number of rows")
    .option("--last <last>", "Show only the <last> number of rows")
    .option("-q, --quiet", "Do not print rows", false)
    .option("--type <type>", "Filter by type: short|long")
    .option("-R, --received <received>", "Filter by received date (YYYY-MM-DD)")
    .option("-S, --sent <sent>", "Filter by sold date (YYYY-MM-DD)")
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

  const regenerate = capitalGains
    .command("regenerate")
    .alias("r")
    .description("Rebuild cointracker_capital_gains from input CSV files");

  addDebugOption(regenerate);

  regenerate
    .option("-d, --drop", "Drop table and re-create before inserting", false)
    .option("--input-dir <dir>", "Input directory containing CoinTracker capital gains CSV files")
    .option("-y, --yes", "Confirm destructive table rebuild", false)
    .action(
      withAction(
        parseOptions(),
        async (options) => runAction(cointrackerCapitalGainsRegenerate, options, CointrackerCapitalGainsRegenerateOptionsSchema),
      ),
    );

  const usdc = capitalGains
    .command("usdc")
    .alias("u")
    .description("Analyze USDC capital gains");

  addDebugOption(usdc);

  usdc
    .option("-b, --buckets", "Analyze per-unit gain buckets", false)
    .option(
      "-i, --interval <interval>",
      "Group USDC gains by interval (day, week, month, quarter, year)",
    )
    .action(
      withAction(
        parseOptions(),
        async (options) => runAction(cointrackerCapitalGainsUsdc, options, CointrackerCapitalGainsUsdcOptionsSchema),
      ),
    );
}
