import { primeEnv } from '@boot/env';
primeEnv();

import { Command } from 'commander';
import { getVersion } from '../project_version.js';
import {
  handleCancelAction,
  handleOpenAction,
  handlePlanAction,
  handleStateAction,
  handleStatusAction,
  handleModifyAction,
  handleSellAction,
  handleFillsAction,
  handleFireSaleAction,
  handleExecAction,
  handleBreakEvenAction,
  handleTakeProfitAction,
  handleScheduleAction,
  handleSaveAction,
  handleTradeAction,
  handleClearAction,
  handleFibAction,
  handleAskAction,
  handleTrailAction,
  handleReadOrderAction,
  handleLoadOrderAction,
} from './actions.js';
import {
  type FibOptions,
  FibOptionsSchema,
  type LoadOrderOptions,
  LoadOrderOptionsSchema,
  type ModifyOptions,
  ModifyOptionsSchema,
  type OpenOptions,
  OpenOptionsSchema,
  type PositionArgs,
  PositionArgsSchema,
  type ProductArgs,
  ProductArgsSchema,
  type ReadOrderOptions,
  ReadOrderOptionsSchema,
  type TakeProfitOptions,
  TakeProfitOptionsSchema,
  type TrailOptions,
  TrailOptionsSchema,
  type ScheduleOptions,
  ScheduleOptionsSchema,
  type PlanOptions,
  PlanOptionsSchema,
} from '@cli/contracts';
import { z } from 'zod';

const program = new Command();

const version = await getVersion();

const DEFAULT_RISK_PERCENT = (1 / 4).toFixed(2); // 1H Quarter Portion
const DEFAULT_BUFFER_PERCENT = (0.1).toFixed(3); // 0.1%

/**
 * TODO
 *  build a caching test system
 *  something to read, force update, clean, etc...
 *
 *  What would be nice is a -R flag for helper plan that allowed the specification of real R/R.
 *  And, without a target price, it would auto calculate 1R.
 *  I'd like to simplify the plan function - only what I actually do
 *  then have like a deprecated plan function that uses the current code.
 *
 *  TODO build a handler wrapper that prints errors
 *    that way we can just use parse instead of safeParse
 */

program
  .name('helper')
  .description('CLI tool to communicate with the helper daemon')
  .version(version);

program
  .command('ask [position]')
  .alias('close')
  .description('Attempt to close a position at the current asking price')
  .action(handleAskAction);

program
  .command('break [position]')
  .alias('be')
  .description('Break even on a position')
  .action(handleBreakEvenAction);

program.command('cancel [position]').description('Cancel a position').action(handleCancelAction);

program
  .command('clear [position]')
  .description('Clear closed and cancelled positions')
  .action(handleClearAction);

program
  .command('exec [position]')
  .alias('execute')
  .description('Exec position')
  .action(handleExecAction);

program
  .command('fib [product]')
  .description('Plan a trade with Fib extensions')
  .option('-b, --buyFib <price>', 'Buy Fib extension', '382')
  .option('-B, --bufferPercent <bufferPercent>', 'Stop buffer percentage', DEFAULT_BUFFER_PERCENT)
  .requiredOption('-o, --onePrice <onePrice>', 'One price')
  .option('-r, --riskPercent <riskPercent>', 'Risk percentage', DEFAULT_RISK_PERCENT)
  .option('-t, --takeProfitFib <price>', 'Take profit Fib extension', '2')
  .option('-x, --dryRunFlag', 'dry run', false)
  .requiredOption('-z, --zeroPrice <zeroPrice>', 'Zero price')
  .action(async (productRaw: string | undefined, options: unknown): Promise<void> => {
    const args: ProductArgs = ProductArgsSchema.parse({ product: productRaw ?? undefined });

    const parsed = FibOptionsSchema.safeParse(options);
    if (parsed.success) {
      const safe: FibOptions = parsed.data;
      await handleFibAction(args.product, safe);
    } else {
      console.error('\nInvalid options:\n', z.treeifyError(parsed.error));
    }
  });

program
  .command('fills [position]')
  .alias('fees')
  .alias('summary')
  .description('Summary of fills and fees for position')
  .action(handleFillsAction);

program.command('firesale').alias('fire').description('Fire Sale').action(handleFireSaleAction);

program
  .command('load-order <order_id>')
  .alias('lo')
  .description('Load order from database, cache, or remote server')
  .option('-f, --force', 'Force update from the server', false)
  .action(async (orderId: string, options: unknown): Promise<void> => {
    // TODO validate the order_id format
    const parsed = LoadOrderOptionsSchema.safeParse(options);
    if (parsed.success) {
      const safe: LoadOrderOptions = parsed.data;
      await handleLoadOrderAction(orderId, safe);
    } else {
      console.error('\nInvalid options:\n', z.treeifyError(parsed.error));
    }
  });

program
  .command('modify [position]')
  .description(
    'Setting the buyPrice will modify the buy order\nSetting the stopPrice only will modify all stops\nSetting the stopPrice and targetPrice will modify either the specified order, or the sole OPEN order',
  )
  .option('-b, --buyPrice <price>', 'Buy price')
  .option('-s, --stopPrice <price>', 'Stop loss price')
  .option('-t, --takeProfitPrice <price>', 'Take profit price')
  .option('-i, --orderId <id>', 'Optional Order ID')
  .action(async (positionRaw: string, options: unknown): Promise<void> => {
    const args: PositionArgs = PositionArgsSchema.parse({ position: positionRaw ?? undefined });

    const parsed = ModifyOptionsSchema.safeParse(options);
    if (parsed.success) {
      const safe: ModifyOptions = parsed.data;
      await handleModifyAction(args.position, safe);
    } else {
      console.error('\nInvalid options:\n', z.treeifyError(parsed.error));
    }
  });

program
  .command('open <product>')
  .requiredOption('-b, --buyPrice <price>', 'Buy price')
  .requiredOption('-s, --stopPrice <price>', 'Stop loss price')
  .requiredOption('-t, --takeProfitPrice <price>', 'Take profit price')
  .requiredOption('-v, --value <value>', 'Position Value')
  .description('Open a new position')
  .action(async (productRaw: string, options: unknown): Promise<void> => {
    const args: ProductArgs = ProductArgsSchema.parse({ product: productRaw ?? undefined });

    const parsed = OpenOptionsSchema.safeParse(options);
    if (parsed.success) {
      const safe: OpenOptions = parsed.data;
      await handleOpenAction(args.product, safe);
    } else {
      console.error('\nInvalid options:\n', z.treeifyError(parsed.error));
    }
  });

program
  .command('plan [product]')
  .alias('prep')
  .option('-b, --buyPrice <price>', 'Buy price')
  .option('-B, --bufferPercent <bufferPercent>', 'Stop buffer percentage', DEFAULT_BUFFER_PERCENT)
  .option('-s, --stopPrice <price>', 'Stop loss price')
  .option('-t, --takeProfitPrice <price>', 'Take profit price')
  .option('-r, --riskPercent <riskPercent>', 'Risk percentage', DEFAULT_RISK_PERCENT)
  .option('-x, --dryRunFlag', 'dry run', false)
  .description('Plan a position based on buy price, stop loss, and take profit')
  .action(async (productRaw: string | undefined, options: unknown): Promise<void> => {
    const args: ProductArgs = ProductArgsSchema.parse({ product: productRaw ?? undefined });

    const parsed = PlanOptionsSchema.safeParse(options);
    if (parsed.success) {
      const safe: PlanOptions = parsed.data;
      await handlePlanAction(args.product, safe);
    } else {
      console.error('\nInvalid options:\n', z.treeifyError(parsed.error));
    }
  });

program
  .command('read-order <order_id>')
  .alias('ro')
  .description('Read order from database, cache, or remote server')
  .option('-f, --force', 'Force update from the server', false)
  .action(async (orderId: string, options: unknown): Promise<void> => {
    // TODO validate order_id

    const parsed = ReadOrderOptionsSchema.safeParse(options);
    if (parsed.success) {
      const safe: ReadOrderOptions = parsed.data;
      await handleReadOrderAction(orderId, safe);
    } else {
      console.error('\nInvalid options:\n', z.treeifyError(parsed.error));
    }
  });

program.command('save').description('Save position data').action(handleSaveAction);

program
  .command('schedule [position]')
  .alias('sc')
  .description('Schedule position')
  .requiredOption('-o, --onePrice <onePrice>', 'One price')
  .option('-S, --schedule <schedule>', 'Profit schedule', '22')
  .requiredOption('-z, --zeroPrice <zeroPrice>', 'Zero price')
  .option('-p, --print', 'Print the schedules', false)
  .action(async (positionRaw: string | undefined, options: unknown): Promise<void> => {
    const args: PositionArgs = PositionArgsSchema.parse({ position: positionRaw ?? undefined });

    const parsed = ScheduleOptionsSchema.safeParse(options);
    if (parsed.success) {
      const safe: ScheduleOptions = parsed.data;
      await handleScheduleAction(args.position, safe);
    } else {
      console.error('\nInvalid options:\n', z.treeifyError(parsed.error));
    }
  });

program
  .command('sell [position]')
  .alias('dump')
  .description('Market sell a position')
  .action(handleSellAction);

program
  .command('state [position]')
  .description('Fetch the current state of active positions')
  .action(handleStateAction);

program
  .command('status')
  .description('Check the status of the helper daemon')
  .action(handleStatusAction);

program
  .command('take-profit <position>')
  .alias('tp')
  .description('Take profit on a position')
  .requiredOption('-t, --takeProfitPrice <price>', 'Take profit price')
  .action(async (positionRaw: string | undefined, options: unknown): Promise<void> => {
    const args: PositionArgs = PositionArgsSchema.parse({ position: positionRaw ?? undefined });

    const parsed = TakeProfitOptionsSchema.safeParse(options);
    if (parsed.success) {
      const safe: TakeProfitOptions = parsed.data;
      await handleTakeProfitAction(args.position, safe);
    } else {
      console.error('\nInvalid options:\n', z.treeifyError(parsed.error));
    }
  });

program
  .command('trail <position>')
  .description('Install a trailing stop loss on a position')
  .requiredOption('-s, --stopLossPrice <stopLossPrice>', 'Stop loss price')
  .requiredOption('-t, --targetPrice <targetPrice>', 'Target price')
  .action(async (positionRaw: string | undefined, options: unknown): Promise<void> => {
    const args: PositionArgs = PositionArgsSchema.parse({ position: positionRaw ?? undefined });

    const parsed = TrailOptionsSchema.safeParse(options);
    if (parsed.success) {
      const safe: TrailOptions = parsed.data;
      await handleTrailAction(args.position, safe);
    } else {
      console.error('\nInvalid options:\n', z.treeifyError(parsed.error));
    }
  });

program.command('trade').alias('grade').description('grade the trade').action(handleTradeAction);

program.parse(process.argv);
