import process from 'node:process';
import { program } from 'commander';
import { getVersion } from '@src/project_version';
import {
  handleAccountsAction,
  handleAskAction,
  handleBalanceAction,
  handleBidAction,
  handleBracketAction,
  handleBuyAction,
  handleCancelAction,
  handleCashAction,
  handleLimitAction,
  handleMarketAction,
  handleOrdersAction,
  handleSellAction,
  handleStopAction,
  handleOrderAction,
  handleProductAction,
  handleMaxAction,
  handleLoadOrderAction,
  handlePriceAction,
  handleFeesAction,
  handlePlanAction,
} from '@cb/cli/actions';
import {
  type AccountsOptions,
  AccountsOptionsSchema,
  type AskOptions,
  AskOptionsSchema,
  BidOptionsSchema,
  BracketOptionsSchema,
  BuyOptionsSchema,
  LimitOptionsSchema,
  MarketOptionsSchema,
  OrderIdSchema,
  PlanOptionsSchema,
  ProductSchema,
  SellOptionsSchema,
  StopOptionsSchema,
} from '@cb/cli/contracts';
import { z, ZodError } from 'zod';

const version = await getVersion();

program.name('cb').description('Coinbase command-line tool for placing orders').version(version);

program.on('--help', () => {
  console.log('\nFor more information about a specific command, use:');
  console.log('  cb <command> --help');
});

const OptionFlags = {
  baseSize: '-b, --baseSize <baseSize>',
  value: '-v, --value <value>',
  buy: '-B, --buy',
  sell: '-S, --sell',
  limitPrice: '-l, --limitPrice <limitPrice>',
  stopPrice: '-s, --stopPrice <stopPrice>',
  takeProfitPrice: '-t, --takeProfitPrice <takeProfitPrice>',
  buyPrice: '-b, --buyPrice <price>',
  bufferPercent: '-B, --bufferPercent <bufferPercent>',
  riskPercent: '-r, --riskPercent <riskPercent>',
  dryRunFlag: '-x, --dryRunFlag',
} as const;

function printErrorAndExit(commandName: string, e: ZodError | Error | any, code: number = 1) {
  if (e instanceof ZodError) {
    console.error(`\nInvalid options for ${commandName}:\n`, z.formatError(e));
  } else if (e instanceof Error) {
    console.error(e.message);
  } else {
    console.error(e);
  }
  process.exit(code);
}

program
  .command('accounts [product]')
  .alias('account')
  .description('List all account balances, optionally filtered by product')
  .option('--crypto', 'Crypto accounts', false)
  .option('--cash', 'Cash accounts', false)
  .action(async (_product: string | undefined, options: any) => {
    try {
      const product = ProductSchema.parse(_product);
      const parsed: AccountsOptions = AccountsOptionsSchema.parse(options);
      await handleAccountsAction(product, parsed);
    } catch (e) {
      printErrorAndExit('accounts', e);
    }
  });

program
  .command('ask [product]')
  .description('Limit sell at current ask price (default BTC)')
  .option(OptionFlags.baseSize, 'Size to sell (units of asset)')
  .option(OptionFlags.value, 'Value to sell (USD)')
  .action(async (_product: string | undefined, options: any) => {
    try {
      const product = ProductSchema.parse(_product);
      const parsed: AskOptions = AskOptionsSchema.parse(options);
      await handleAskAction(product, parsed);
    } catch (e) {
      printErrorAndExit('ask', e);
    }
  });

program
  .command('balance')
  .alias('usd')
  .description('Show the current USD balance in your Coinbase account')
  .action(async () => {
    try {
      await handleBalanceAction();
    } catch (e) {
      printErrorAndExit('balance', e);
    }
  });

program
  .command('bid [product]')
  .description('Limit buy at current bid price (default BTC)')
  .option(OptionFlags.baseSize, 'Size to buy (units of asset)')
  .option(OptionFlags.value, 'Value to buy (USD)')
  .action(async (_product: string | undefined, options: any) => {
    try {
      const product = ProductSchema.parse(_product);
      const parsed = BidOptionsSchema.parse(options);
      await handleBidAction(product, parsed);
    } catch (e) {
      printErrorAndExit('bid', e);
    }
  });

program
  .command('bracket [product]')
  .description('Bracket order (default BTC)')
  .requiredOption(OptionFlags.baseSize, 'Size to sell (units of asset)')
  .requiredOption(OptionFlags.limitPrice, 'Limit price')
  .requiredOption(OptionFlags.stopPrice, 'Stop trigger price')
  .action(async (_product: string | undefined, options: any) => {
    try {
      const product = ProductSchema.parse(_product);
      const parsed = BracketOptionsSchema.parse(options);
      await handleBracketAction(product, parsed);
    } catch (e) {
      printErrorAndExit('bracket', e);
    }
  });

program
  .command('buy [product]')
  .description('Market buy order (default BTC)')
  .option(OptionFlags.baseSize, 'Size to buy (units of asset)')
  .option(OptionFlags.value, 'Value to buy (USD)')
  .action(async (_product: string | undefined, options: any) => {
    try {
      const product = ProductSchema.parse(_product);
      const parsed = BuyOptionsSchema.parse(options);
      await handleBuyAction(product, parsed);
    } catch (e) {
      printErrorAndExit('buy', e);
    }
  });

program
  .command('cancel <order_id>')
  .description('Cancel an open order by order ID')
  .action(async (_order_id: string) => {
    try {
      const order_id = OrderIdSchema.parse(_order_id);
      await handleCancelAction(order_id);
    } catch (e) {
      printErrorAndExit('cancel', e);
    }
  });

program.command('cash').description('List cash balance').action(handleCashAction);

program
  .command('limit [product]')
  .description('Place a limit order (buy or sell) (default BTC)')
  .option(OptionFlags.baseSize, 'Size to buy/sell (units of asset)')
  .option(OptionFlags.buy, 'Place a buy limit order', false)
  .option(OptionFlags.limitPrice, 'Limit price')
  .option(OptionFlags.sell, 'Place a sell limit order', false)
  .option(OptionFlags.value, 'Value to buy/sell (USD)')
  .action(async (_product: string | undefined, options: any) => {
    try {
      const product = ProductSchema.parse(_product);
      const parsed = LimitOptionsSchema.parse(options);
      await handleLimitAction(product, parsed);
    } catch (e) {
      printErrorAndExit('limit', e);
    }
  });

program
  .command('load-order <order_id>')
  .alias('lo')
  .description('Load order specified by order ID')
  .action(async (_order_id: string) => {
    try {
      const order_id = OrderIdSchema.parse(_order_id);
      await handleLoadOrderAction(order_id);
    } catch (e) {
      printErrorAndExit('limit', e);
    }
  });

program
  .command('market <product>')
  .description('Place a market order')
  .option(OptionFlags.buy, 'Place a buy market order')
  .option(OptionFlags.sell, 'Place a sell market order')
  .option(OptionFlags.baseSize, 'Size to buy or sell (units of asset)')
  .option(OptionFlags.value, 'Value of the order to buy or sell (USD)')
  .action(async (_product: string | undefined, options: any) => {
    try {
      const product = ProductSchema.parse(_product);
      const parsed = MarketOptionsSchema.parse(options);
      await handleMarketAction(product, parsed);
    } catch (e) {
      printErrorAndExit('market', e);
    }
  });

program
  .command('max [product]')
  .description('Max bid product (default BTC)')
  .action(async (_product: string | number) => {
    try {
      const product = ProductSchema.parse(_product);
      await handleMaxAction(product);
    } catch (e) {
      printErrorAndExit('max', e);
    }
  });

program
  .command('order <order_id>')
  .description('Print order specified by order ID')
  .action(async (_order_id: string) => {
    try {
      const order_id = OrderIdSchema.parse(_order_id);
      await handleOrderAction(order_id);
    } catch (e) {
      printErrorAndExit('order', e);
    }
  });

program
  .command('orders [product]')
  .alias('open')
  .description('List all open orders, optionally filtered by product')
  .action(async (_product: string | number) => {
    try {
      const product = ProductSchema.parse(_product);
      await handleOrdersAction(product);
    } catch (e) {
      printErrorAndExit('orders', e);
    }
  });

program
  .command('product [product]')
  .description('Print product specified (default BTC)')
  .action(async (_product: string | undefined) => {
    try {
      const product = ProductSchema.parse(_product);
      await handleProductAction(product);
    } catch (e) {
      printErrorAndExit('product', e);
    }
  });

const DEFAULT_RISK_PERCENT = (1 / 4).toFixed(2); // 1H Quarter Portion
const DEFAULT_BUFFER_PERCENT = (0.1).toFixed(3); // 0.1%
program
  .command('plan [product]')
  .option(OptionFlags.buyPrice, 'Buy price')
  .option(OptionFlags.bufferPercent, 'Stop buffer percentage', DEFAULT_BUFFER_PERCENT)
  .option(OptionFlags.stopPrice, 'Stop loss price')
  .option(OptionFlags.takeProfitPrice, 'Take profit price')
  .option(OptionFlags.riskPercent, 'Risk percentage', DEFAULT_RISK_PERCENT)
  .option(OptionFlags.dryRunFlag, 'dry run', false)
  .description('Plan a position based on buy price, stop loss, and take profit')
  .action(async (_product: string | undefined, options: any) => {
    try {
      const product = ProductSchema.parse(_product);
      const parsed = PlanOptionsSchema.parse(options);
      await handlePlanAction(product, parsed);
    } catch (e) {
      printErrorAndExit('plan', e);
    }
  });

program
  .command('price [product]')
  .description('Print the current price of the product (default BTC)')
  .action(async (_product: string | undefined) => {
    try {
      const product = ProductSchema.parse(_product);
      await handlePriceAction(product);
    } catch (e) {
      printErrorAndExit('price', e);
    }
  });

program
  .command('sell [product]')
  .description('Market sell order (default BTC)')
  .option(OptionFlags.baseSize, 'Size to sell (units of asset)')
  .option(OptionFlags.value, 'Value to sell (USD)')
  .action(async (_product: string | undefined, options: any) => {
    try {
      const product = ProductSchema.parse(_product);
      const parsed = SellOptionsSchema.parse(options);
      await handleSellAction(product, parsed);
    } catch (e) {
      printErrorAndExit('sell', e);
    }
  });

program
  .command('stop [product]')
  .description('Stop-limit order (default BTC)')
  .option(OptionFlags.baseSize, 'Size to sell (units of asset)')
  .option(OptionFlags.limitPrice, 'Limit price')
  .option(OptionFlags.stopPrice, 'Stop price')
  .action(async (_product: string | undefined, options: any) => {
    try {
      const product = ProductSchema.parse(_product);
      const parsed = StopOptionsSchema.parse(options);
      await handleStopAction(product, parsed);
    } catch (e) {
      printErrorAndExit('stop', e);
    }
  });

program.command('fees').description('Get the transaction fees').action(handleFeesAction);

program.parse(process['argv']);
