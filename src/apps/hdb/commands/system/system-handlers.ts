import { logger } from "#shared/log/index";
import { coinbaseBalancesRegenerate } from "../coinbase/balances/coinbase-balances-handlers.js";
import { coinbaseTransactionsRegenerate } from "../coinbase/transactions/coinbase-transactions-handlers.js";
import { cointrackerCapitalGainsRegenerate } from "../cointracker/capital-gains/cointracker-capital-gains-handlers.js";
import { cointrackerTransactionsRegenerate } from "../cointracker/transactions/cointracker-transactions-handlers.js";
import type { SystemRebuildAllOptions } from "./schemas/system-rebuild-all-options.js";

export type RebuildAllStageSummary = {
  rows: number;
  stage: string;
  status: "completed";
};

export async function systemRebuildAll(options: SystemRebuildAllOptions): Promise<RebuildAllStageSummary[]> {
  const { coinbaseTransactionsInputDir, cointrackerGainsInputDir, cointrackerTransactionsInputDir, drop, quiet } = options;

  const summaries: RebuildAllStageSummary[] = [];
  const sharedOptions = {
    drop,
    quiet,
  };

  const runStage = async (stage: string, action: () => Promise<number>): Promise<void> => {
    logger.info(`Starting ${stage}...`);
    const rows = await action();
    summaries.push({ rows, stage, status: "completed" });
    logger.info(`Completed ${stage}: ${rows} row(s)`);
  };

  await runStage(
    "coinbase transactions",
    async () => coinbaseTransactionsRegenerate({
      ...sharedOptions,
      inputDir: coinbaseTransactionsInputDir,
      normalize: true,
    }),
  );

  await runStage(
    "coinbase balances",
    async () => coinbaseBalancesRegenerate(sharedOptions),
  );

  await runStage(
    "cointracker transactions",
    async () => cointrackerTransactionsRegenerate({
      ...sharedOptions,
      inputDir: cointrackerTransactionsInputDir,
    }),
  );

  await runStage(
    "cointracker capital gains",
    async () => cointrackerCapitalGainsRegenerate({
      ...sharedOptions,
      inputDir: cointrackerGainsInputDir,
    }),
  );

  if (!quiet) {
    console.table(summaries);
  }
  logger.info("Completed all input-derived rebuild stages.");
  return summaries;
}
