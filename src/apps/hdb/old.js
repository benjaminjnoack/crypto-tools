import { Command } from 'commander';
import { getVersion } from '../../project_version.ts';
import { handleTestAction, handleAction, handleActionWithArgument } from './actions.js';
import {
  coinbaseBalances,
  coinbaseBalancesBatch,
  coinbaseBalancesRegenerate,
  coinbaseBalancesTrace,
} from '../../coinbase/balances/db/cli/actions.js';
import {
  coinbaseOrders,
  coinbaseOrdersFees,
  coinbaseOrdersInsert,
  coinbaseOrdersOrder,
  coinbaseOrdersUpdate,
  coinbaseOrdersRegenerate,
} from '../../coinbase/order/db/cli/actions.js';
import {
  coinbaseTransactions,
  coinbaseTransactionsGroup,
  coinbaseTransactionsId,
  coinbaseTransactionsImport,
  coinbaseTransactionsManual,
  coinbaseTransactionsNAV,
  coinbaseTransactionsRegenerate,
} from '@cb/transactions/db/cli/actions.js';
import { COINBASE_TRANSACTIONS_TABLE } from '@cb/transactions/db/queries.js';
import { COINBASE_BALANCE_LEDGER_TABLE } from '@cb/balances/db/queries.js';
import { COINBASE_ORDERS_TABLE } from '@cb/order/db/queries.js';
import {
  coinbaseLotsBatch,
  coinbaseLotsBatchCompare,
  coinbaseLots,
  coinbaseLotsCompare,
} from '@cb/lots/db/cli/actions.js';
import { COINBASE_EPOCH } from '@cb/dictionary';
import { COINTRACKER_CAPITAL_GAINS_TABLE } from '../../cointracker/capital_gains/db/queries.js';
import {
  cointrackerCapitalGains,
  cointrackerCapitalGainsGroup,
  cointrackerCapitalGainsRegenerate,
  cointrackerCapitalGainsUsdc,
} from '../../cointracker/capital_gains/db/cli/actions.js';
import {
  CAPITAL_GAINS_TABLE,
  COINTRACKER_TABLE,
  TRANSACTION_TYPE,
} from '../../cointracker/dictionary.js';
import { getHdbPath, HdbDir } from './hdbPaths.js';
import {
  cointrackerTransactions,
  cointrackerTransactionsGroup,
  cointrackerTransactionsRegenerate,
} from '../../cointracker/transactions/db/cli/actions.js';
import {
  cointrackerBalances,
  cointrackerBalancesRegenerate,
} from '../../cointracker/balances/db/cli/actions.js';

const NOW = new Date().toISOString();

const program = new Command();
const version = await getVersion();

/**
 * TODO
 *  Cointracker Transactions
 *  Update Workflow
 *      Support adding new source CSVs
 *      filename on the command line, the directory is inferred
 *      Need a flag to override records
 *      I don't think overrides should be allowed for coinbase transactions unless you want to re-calculate balances
 *  Fills
 *      Fills are actually transactions
 *      Fills have the order IDs
 *      So I can tie transactions to orders
 *  bank statements?
 */

program.name('hdb').description("Command Line Interface for helper's database").version(version);

program
  .command('coinbase-balances <asset>')
  .alias('cb')
  .description('Read the balance of <asset> at the specified time')
  .option('-c, --current', 'Retrieve current account balance for <asset> from coinbase', false)
  .option('-D, --debug', 'Enable debug logging', false)
  .option('-f, --from <date>', 'Start date (inclusive, ISO format)', COINBASE_EPOCH)
  .option('--first <first>', 'Show only the <first> number of records')
  .option('--last <last>', 'Show only the <last> number of records')
  .option('-q, --quiet', 'Do not print anything to the console', false)
  .option('-r, --raw', 'Display the raw balance value from the database', false)
  .option('-t, --to <date>', 'End date (exclusive, ISO format)', NOW)
  .option('-y, --year <year>', 'Show balances for <year>')
  .action(async (asset, options) => handleActionWithArgument(coinbaseBalances, asset, options));

program
  .command('coinbase-balances-batch')
  .alias('cbb')
  .description('Batch coinbase-balances operation')
  .option('-c, --current', 'Retrieve current account balance from coinbase', false)
  .option('-D, --debug', 'Enable debug logging', false)
  .option('-f, --from <date>', 'Start date (inclusive, ISO format)', COINBASE_EPOCH)
  .option('-q, --quiet', 'Do not print anything to the console', false)
  .option('-r, --raw', 'Display the raw balance value from the database', false)
  .option('-t, --to <date>', 'End date (exclusive, ISO format)', NOW)
  .action(async (options) => handleAction(coinbaseBalancesBatch, options));

program
  .command('coinbase-balances-trace <asset>')
  .alias('cbt')
  .description('Trace the balance of <asset> back to zero')
  .option('-D, --debug', 'Enable debug logging', false)
  .option('-q, --quiet', 'Do not print anything to the console', false)
  .option('-r, --raw', 'Display the raw balance value from the database', false)
  .option('-t, --to <date>', 'End date (exclusive, ISO format)', NOW)
  .option('-y, --year <year>', 'Trace balance for the end of <year>')
  .action(async (asset, options) =>
    handleActionWithArgument(coinbaseBalancesTrace, asset, options),
  );

program
  .command('coinbase-balances-regenerate')
  .alias('cbr')
  .description(
    `Drop ${COINBASE_BALANCE_LEDGER_TABLE}, re-create anew, and re-populate with all asset balances as calculated from ${COINBASE_TRANSACTIONS_TABLE}`,
  )
  .option('--dry-run', 'Do not modify the database')
  .option('-D, --debug', 'Enable debug logging', false)
  .option('-y, --yes', 'Answer yes to all prompts', false)
  .action(async (options) => handleAction(coinbaseBalancesRegenerate, options));

program
  .command('coinbase-lots <asset>')
  .alias('cl')
  .description(
    `Match buy and sell lots for <asset> according to <accounting> strategy from ${COINBASE_TRANSACTIONS_TABLE}`,
  )
  .option(
    '-a, --accounting <accounting>',
    'Cost basis accounting method (FIFO, HIFO, LIFO)',
    'FIFO',
  )
  .option('--all', 'Include all transactions used in lot accounting', false)
  .option('-b, --balance', 'Print account balance after lot accounting', false)
  .option('-B, --buy-lots', 'Include buy lots', false)
  .option('-D, --debug', 'Enable debug logging', false)
  .option('-e, --csv', 'Export to CSV')
  .option('-f, --from <date>', 'Start date (inclusive, ISO format)', COINBASE_EPOCH)
  .option('--f8949', 'Generate IRS Form 8949', false)
  .option('--notes', 'Include generated notes with CSV', false)
  .option('--obfuscate', 'Obfuscate Lot IDs in CSV (overrides notes)', false)
  .option('--pages', 'Paginate f8949 output', false)
  .option('-q, --quiet', 'Do not print anything to the console', false)
  .option('-r, --range <period>', 'Shortcut range: week | month | quarter | year')
  .option(
    '--totals',
    'Calculate total cost basis, proceeds, short and long term gains for <asset> according to <accounting> strategy',
    false,
  )
  .option('-t, --to <date>', 'End date (exclusive, ISO format)', NOW)
  .option('-y, --year <year>', 'Calculate lots for the specified year')
  .action(async (asset, options) => handleActionWithArgument(coinbaseLots, asset, options));

program
  .command('coinbase-lots-batch')
  .alias('clb')
  .description('Batch lots from transactions')
  .option(
    '-a, --accounting <accounting>',
    'Cost basis accounting method (FIFO, HIFO, LIFO)',
    'FIFO',
  )
  .option('-b, --balance', 'Print account balance after lot accounting', false)
  .option('-B, --buy-lots', 'Include buy lots', false)
  .option('-c, --cash', 'Calculate lots for cash (USD/C)', false)
  .option('-D, --debug', 'Enable debug logging', false)
  .option('-e, --csv', 'Export to CSV')
  .option('-f, --from <date>', 'Start date (inclusive, ISO format)', COINBASE_EPOCH)
  .option('--f8949', 'Generate IRS Form 8949', false)
  .option('--notes', 'Include generated notes with CSV', false)
  .option('--obfuscate', 'Obfuscate Lot IDs in CSV (overrides notes)', false)
  .option('--pages', 'Paginate f8949 output', false)
  .option('-q, --quiet', 'Do not print anything to the console', false)
  .option('-r, --range <period>', 'Shortcut range: week | month | quarter | year')
  .option(
    '--totals',
    'Calculate total cost basis, proceeds, short and long term gains for all assets according to <accounting> strategy',
    false,
  )
  .option('-t, --to <date>', 'End date (exclusive, ISO format)', NOW)
  .option('-y, --year <year>', 'Calculate lots for the specified year')
  .action(async (options) => handleAction(coinbaseLotsBatch, options));

program
  .command('coinbase-lots-batch-compare')
  .alias('clbc')
  .description('Batch lots from transactions')
  .option('-b, --balance', 'Print account balance after lot accounting', false)
  .option('-D, --debug', 'Enable debug logging', false)
  .option('-f, --from <date>', 'Start date (inclusive, ISO format)', COINBASE_EPOCH)
  .option('-q, --quiet', 'Do not print anything to the console', false)
  .option('-r, --range <period>', 'Shortcut range: week | month | quarter | year')
  .option('-t, --to <date>', 'End date (exclusive, ISO format)', NOW)
  .option('-y, --year <year>', 'Calculate lots for the specified year')
  .action(async (options) => handleAction(coinbaseLotsBatchCompare, options));

program
  .command('coinbase-lots-compare <asset>')
  .alias('clc')
  .description('Compare cost basis accounting methods for <asset>')
  .option('-D, --debug', 'Enable debug logging', false)
  .option('-f, --from <date>', 'Start date (inclusive, ISO format)', COINBASE_EPOCH)
  .option('-q, --quiet', 'Do not print anything to the console', false)
  .option('-r, --range <period>', 'Shortcut range: week | month | quarter | year')
  .option('-t, --to <date>', 'End date (exclusive, ISO format)', NOW)
  .option('-y, --year <year>', 'Calculate lots for the specified year')
  .action(async (asset, options) => handleActionWithArgument(coinbaseLotsCompare, asset, options));

program
  .command('coinbase-orders <orderId>')
  .alias('co')
  .description(
    'Select order from the database by orderId and print the order record to the console',
  )
  .option('-D, --debug', 'Enable debug logging', false)
  .action(async (orderId, options) => handleActionWithArgument(coinbaseOrders, orderId, options));

program
  .command('coinbase-orders-insert <orderId>')
  .alias('coi')
  .description('Download an order from the exchange and insert into the database')
  .option('-D, --debug', 'Enable debug logging', false)
  .action(async (orderId, options) =>
    handleActionWithArgument(coinbaseOrdersInsert, orderId, options),
  );

program
  .command('coinbase-orders-fees [productId]')
  .alias('cof')
  .description('Show total fees paid on orders')
  .option('-D, --debug', 'Enable debug logging', false)
  .option('-f, --from <date>', 'Start date (inclusive, ISO format)', COINBASE_EPOCH)
  .option('-r, --range <period>', 'Shortcut range: week | month | quarter | year | all')
  .option('-s, --side <side>', 'Order side (BUY || SELL)')
  .option('-t, --to <date>', 'End date (exclusive, ISO format)', NOW)
  .option('-y, --year <year>', 'Calculate fees for the specified year')
  .action(async (productId, options) =>
    handleActionWithArgument(coinbaseOrdersFees, productId, options),
  );

program
  .command('coinbase-orders-object <orderId>')
  .alias('coo')
  .description(
    'Select an order record from the database and reconstruct it as an Order like object',
  )
  .option('-D, --debug', 'Enable debug logging', false)
  .action(async (orderId, options) =>
    handleActionWithArgument(coinbaseOrdersOrder, orderId, options),
  );

program
  .command('coinbase-orders-regenerate')
  .alias('cor')
  .description(
    `Drop the ${COINBASE_ORDERS_TABLE}, re-create it anew, and re-populate with all orders from ${COINBASE_EPOCH}`,
  )
  .option('--dry-run', 'Do not modify the database')
  .option('-D, --debug', 'Enable debug logging', false)
  .option('-y, --yes', 'Answer yes to all prompts', false)
  .action(async (options) => handleAction(coinbaseOrdersRegenerate, options));

program
  .command('coinbase-orders-update')
  .alias('cou')
  .description(`Update ${COINBASE_ORDERS_TABLE} from cache or remote`)
  .option('-c, --cache', 'Use only cached orders')
  .option('-D, --debug', 'Enable debug logging', false)
  .option('-f, --from <date>', 'Start date (inclusive, ISO format)', COINBASE_EPOCH)
  .option('-t, --to <date>', 'End date (exclusive, ISO format)', NOW)
  .option(
    '-r, --rsync',
    `Read the last filled order from ${COINBASE_ORDERS_TABLE} and request all filled orders since`,
    false,
  )
  .option('-y, --yes', 'Answer yes to all prompts', false)
  .action(async (options) => handleAction(coinbaseOrdersUpdate, options));

program
  .command('coinbase-transactions [asset]')
  .alias('ct')
  .description(
    `Select [asset] transactions from ${COINBASE_TRANSACTIONS_TABLE}.  Select multiple asset with a colon separated string`,
  )
  .option('-D, --debug', 'Enable debug logging', false)
  // Time Selection
  .option('-f, --from <date>', 'Start date (inclusive, ISO format)', COINBASE_EPOCH)
  .option('-r, --range <period>', 'Shortcut range: week | month | quarter | year | all')
  .option('-t, --to <date>', 'End date (exclusive, ISO format)', NOW)
  .option('-y, --year <year>', 'Read transactions for the specified year')
  // Value Selection
  .option('-b, --balance', `Include balances from ${COINBASE_BALANCE_LEDGER_TABLE} table`)
  .option('-c, --classifier <classifier>', 'Select transactions by classifier')
  .option('-m, --manual', 'Select manual transaction records', false)
  .option('-M, --exclude-manual', 'Exclude manual transaction records', false)
  .option('-N, --not-classifier <classifier>', 'Exclude transactions by classifier')
  .option('-p, --paired', 'Pair synthetic transaction records', false)
  .option('-s, --synthetic', 'Select synthetic transaction records', false)
  .option('-T, --type <type>', 'Select transactions of a single type (is overridden by classifier)')
  .option('-S, --exclude-synthetic', 'Exclude synthetic transaction records', false)
  .option('-x, --exclude <assets>', 'Exclude <assets> from the result set')
  // Output Format
  .option('-C, --classify', 'Classify types in output (ignored with notes)', false)
  .option('-F, --first <first>', 'Show only the <first> number of records')
  .option('-L, --last <last>', 'Show only the <last> number of records')
  .option('-n, --notes', 'Print dated notes to the console', false)
  .option(
    '-R, --raw',
    'Keep calculated figures as raw numbers (as opposed to rounded to product increment)',
    false,
  )
  .option('-q, --quiet', 'Do not print anything to the console', false)
  // Write Options
  .option('-e, --csv', 'Export to CSV')
  .action(async (asset, options) => handleActionWithArgument(coinbaseTransactions, asset, options));

program
  .command('coinbase-transactions-group [asset]')
  .alias('ctg')
  .description(`Select sums from ${COINBASE_TRANSACTIONS_TABLE}`)
  .option('-D, --debug', 'Enable debug logging', false)
  // Time Selection
  .option('-f, --from <date>', 'Start date (inclusive, ISO format)', COINBASE_EPOCH)
  .option('-r, --range <period>', 'Shortcut range: week | month | quarter | year | all')
  .option('-t, --to <date>', 'End date (exclusive, ISO format)', NOW)
  .option('-y, --year <year>', 'Read transactions for the specified year')
  // Value Selection
  .option('-c, --classifier <classifier>', 'Select transactions by classifier')
  .option(
    '-i, --interval <interval>',
    'Group transactions by <interval> (day, week, month, quarter, or year)',
  )
  .option('-m, --manual', 'Select manual transaction records')
  .option('-M, --exclude-manual', 'Exclude manual transaction records')
  .option('-N, --not-classifier <classifier>', 'Exclude transactions by classifier')
  .option('-s, --synthetic', 'Select synthetic transaction records')
  .option('-T, --type <type>', 'Select transactions of a single type (is overridden by classifier)')
  .option('-S, --exclude-synthetic', 'Exclude synthetic transaction records')
  .option('-x, --exclude <assets>', 'Exclude <assets> from the result set')
  // Output Format
  .option(
    '-R, --raw',
    'Keep calculated figures as raw numbers (as opposed to rounded to product increment)',
    false,
  )
  .option('-q, --quiet', 'Do not print anything to the console', false)
  .action(async (asset, options) =>
    handleActionWithArgument(coinbaseTransactionsGroup, asset, options),
  );

program
  .command('coinbase-transactions-id [id]')
  .alias('cti')
  .description(`Select transaction by ID`)
  .option('-D, --debug', 'Enable debug logging', false)
  // Selection
  .option('-b, --balance', `Include balances from ${COINBASE_BALANCE_LEDGER_TABLE} table`)
  .option('-l, --lot-id <lotId>', 'Select transactions by <lotId>')
  // Output
  .option('-C, --classify', 'Classify types in output (ignored with notes)', false)
  .option('-n, --notes', 'Print dated notes to the console', false)
  .option(
    '-R, --raw',
    'Keep calculated figures as raw numbers (as opposed to rounded to product increment)',
    false,
  )
  .option('-q, --quiet', 'Do not print anything to the console', false)
  .action(async (id, options) => handleActionWithArgument(coinbaseTransactionsId, id, options));

program
  .command('coinbase-transactions-manual <asset>')
  .alias('ctm')
  .description(`Manually insert a transaction into the ${COINBASE_TRANSACTIONS_TABLE} table`)
  .option('--dry-run', 'Validate and preview rows without inserting')
  .option('--fee <fee>', 'The fee of the transaction', '0')
  .requiredOption('--notes <notes>', 'Evidence or reasons for the manual transaction')
  .requiredOption('--quantity <quantity>', 'The quantity of the transaction')
  .option('--price_currency <price_currency>', "The currency of the transaction's price", 'USD')
  .option('--price_at_tx <price_at_tx>', 'The price at the time of the transaction', '1')
  .option('--rewrite-existing', 'Overwrite existing rows with same ID')
  .option(
    '--subtotal <subtotal>',
    'The subtotal amount of the transaction. Default is (quantity * price_at_tx)',
  )
  .requiredOption('--timestamp <date>', 'The date of the transaction in ISO format')
  .option('--total <total>', 'The total amount of the transaction. Default is (subtotal + fee)')
  .requiredOption('--type <type>', 'The type of the transaction')
  .action(async (asset, options) =>
    handleActionWithArgument(coinbaseTransactionsManual, asset, options),
  );

/**
 * TODO
 *  in order to reconstruct a historical NAV
 *  I would need all the balances (which I have)
 *  and the market value of the assets at that time
 *  (which I don't have)
 *  possible with coinbase historical data.
 *  Not extremely high resolution,
 *  but enough for day to day
 */
program
  .command('coinbase-transactions-nav')
  .alias('ctn')
  .description('Determine the Net Asset Value of the portfolio')
  .option('-D, --debug', 'Enable debug logging', false)
  .option('-q, --quiet', 'Do not print anything to the console', false)
  .action(async (options) => handleAction(coinbaseTransactionsNAV, options));

program
  .command('coinbase-transactions-regenerate')
  .alias('ctr')
  .description(
    `Truncate ${COINBASE_TRANSACTIONS_TABLE}, and re-populate with Coinbase statement CSVs read from ${getHdbPath(HdbDir.COINBASE_TRANSACTIONS_INPUT)}`,
  )
  .option(
    '-d, --drop',
    `Drop ${COINBASE_TRANSACTIONS_TABLE}, and re-create anew before repopulating`,
    false,
  )
  .option('-D, --debug', 'Enable debug logging', false)
  .option('-y, --yes', 'Answer yes to all prompts', false)
  .action(async (options) => handleAction(coinbaseTransactionsRegenerate, options));

program
  .command('coinbase-transactions-statement <filepath>')
  .alias('cts')
  .description(`Import Coinbase CSV statement into ${COINBASE_TRANSACTIONS_TABLE}`)
  .option('-D, --debug', 'Enable debug logging', false)
  .option('-m, --manual', 'Treat transactions in <filepath> as manual transactions', false)
  .option('-n, --normalize', 'Normalize trade rows', true)
  .action(async (filepath, options) =>
    handleActionWithArgument(coinbaseTransactionsImport, filepath, options),
  );

/**
 * TODO cointracker balances ledger
 *  1. create the ledger with reference to the cointracker transaction record
 *  2. Somehow ID and tie in the matching coinbase transaction
 *      1. This will not always be possible (Subscription Rebate 24 Hours)
 *      2. This will often mean pulling in a synthetic record
 */
program
  .command('cointracker-balances [currency]')
  .alias('tb')
  .description('Select from cointracker_balances_ledger')
  .option('-f, --from <date>', 'Start date (inclusive, ISO format)', COINBASE_EPOCH)
  .option('-r, --range <period>', 'Shortcut range: week | month | quarter | year | all')
  .option('-t, --to <date>', 'End date (exclusive, ISO format)', NOW)
  .option('-T, --include-type', 'Select transaction type from cointracker_transactions')
  .option('-y, --year <year>', 'Shortcut query by year')
  .action(async (currency, options) =>
    handleActionWithArgument(cointrackerBalances, currency, options),
  );

program
  .command('cointracker-balances-regenerate')
  .alias('tbr')
  .description(`Regenerate the cointracker balance ledger`)
  .option('-d, --drop', `Drop balance ledger table, and re-create anew before repopulating`, false)
  .option('-D, --debug', 'Enable debug logging', false)
  .option('-y, --yes', 'Answer yes to all prompts', false)
  .action(async (options) => handleAction(cointrackerBalancesRegenerate, options));

program
  .command('cointracker-capital-gains [assets]')
  .alias('tg') // Tracker Gains
  .description(`Query ${COINTRACKER_CAPITAL_GAINS_TABLE}`)
  .option('-c, --crypto', "Exclude cash ('USD' || 'USDC')", false)
  .option('-C, --cash', "Set <assets> to cash ('USD' || 'USDC')", false)
  .option('--csv', 'Export rows to CSV', false)
  .option('-D, --debug', 'Enable debug logging', false)
  .option('--f8949', 'Generate IRS Form 8949', false)
  .option('-f, --from <date>', 'Start date (inclusive, ISO format)', COINBASE_EPOCH)
  .option('--first <first>', 'Show only the <first> number of records')
  .option('-g, --gains', `Order by ${CAPITAL_GAINS_TABLE.GAIN_USD} DESC`, false)
  .option('-h, --headers', 'Include headers in CSV output', false)
  .option('--last <last>', 'Show only the <last> number of records')
  .option('-p, --pages', 'Paginate CSV output', false)
  .option('-q, --quiet', 'Do not print the row table to the console', false)
  .option('-r, --range <period>', 'Shortcut range: week | month | quarter | year | all')
  .option('--raw', 'Print calculated totals values raw from the DB', false)
  .option('-R, --received <recieved>', 'Select only records where received_date = <received>')
  .option('-S, --sent <sent>', 'Select only records where sent_date = <sent>')
  .option('-t, --to <date>', 'End date (exclusive, ISO format)', NOW)
  .option('--totals', 'Print a table of totals', false)
  .option('--type <type>', "Query by type ('short' || 'long')")
  .option('-x, --exclude <assets>', 'Exclude <assets> from the result set')
  .option('-y, --year <year>', 'Shortcut query by year')
  .option('-z, --zero', 'Filter out rows where the gain is zero', false)
  .action(async (asset, options) =>
    handleActionWithArgument(cointrackerCapitalGains, asset, options),
  );

/**
 * TODO I want to group this by day so I can see the increased splintering of USDC
 */
program
  .command('cointracker-capital-gains-group [assets]')
  .alias('tgg')
  .description(
    `Query ${COINTRACKER_CAPITAL_GAINS_TABLE}, group by ${CAPITAL_GAINS_TABLE.ASSET_NAME}`,
  )
  .option('-b, --bleeders', 'Filter assets where roi_basis is less than 0.01')
  .option('-c, --crypto', 'Exclude cash (USD & USDC)', false)
  .option('-C, --cash', 'Set [assets] to cash (USD & USDC)', false)
  .option('--csv', 'Export rows to CSV', false)
  .option('-D, --debug', 'Enable debug logging', false)
  .option('-f, --from <date>', 'Start date (inclusive, ISO format)', COINBASE_EPOCH)
  .option('--first <first>', 'Show only the <first> number of records')
  .option('--f8949', 'Generate IRS Form 8949', false)
  .option('-g, --gains', `Order by gains DESC`, false)
  .option('--last <last>', 'Show only the <last> number of records')
  .option('-p, --pages', 'Paginate CSV output', false)
  .option('-q, --quiet', 'Do not print the row table to the console', false)
  .option('-r, --range <period>', 'Shortcut range: week | month | quarter | year | all')
  .option('--raw', 'Print calculated values raw from the DB', false)
  .option('-R, --received <recieved>', 'Select only records where received_date = <received>')
  .option('-S, --sent <sent>', 'Select only records where sent_date = <sent>')
  .option('-t, --to <date>', 'End date (exclusive, ISO format)', NOW)
  .option('--totals', 'Print a table of totals', false)
  .option('--type <type>', 'Select type ("short" || "long")')
  .option('-x, --exclude <assets>', 'Exclude <assets> from the result set')
  .option('-y, --year <year>', 'Shortcut query by year')
  .option('-z, --zero', 'Filter out rows where the gain is zero', false)
  .action(async (assets, options) =>
    handleActionWithArgument(cointrackerCapitalGainsGroup, assets, options),
  );

program
  .command('cointracker-capital-gains-regenerate')
  .alias('tgr')
  .description(
    `Truncate ${COINTRACKER_CAPITAL_GAINS_TABLE}, and re-populate with CSVs from ${getHdbPath(HdbDir.COINTRACKER_CAPITAL_GAINS_INPUT)}`,
  )
  .option(
    '-d, --drop',
    `Drop ${COINTRACKER_CAPITAL_GAINS_TABLE}, and re-create anew before repopulating`,
    false,
  )
  .option('-D, --debug', 'Enable debug logging', false)
  .option('-y, --yes', 'Answer yes to all prompts', false)
  .action(async (options) => handleAction(cointrackerCapitalGainsRegenerate, options));

program
  .command('cointracker-capital-gains-usdc')
  .alias('tgu')
  .description('Hunting USDC losses')
  .option('-D, --debug', 'Enable debug logging', false)
  .option('-b, --buckets', 'Buckets', false)
  .option(
    '-i, --interval <interval>',
    'Group capital gains by <interval> (day, week, month, quarter, or year)',
  )
  .action(async (options) => handleAction(cointrackerCapitalGainsUsdc, options));

/**
 * TODO
 *  figure out why cointracker PnL is so much worse than coinbase nav
 *  Maybe start by looking at the performance of a particular asset?
 *  Is there maybe some filtering of USD/C somewhere which is making NAV more optimistic?
 */
const COINTRACKER_TRANSACTION_TYPES = Object.keys(TRANSACTION_TYPE).join(',');
program
  .command('cointracker-transactions [asset]')
  .alias('tt')
  .description(`Select transactions from ${COINTRACKER_TABLE.TRANSACTIONS}`)
  .option('-b, --include-balances', 'Select balances from cointracker_balances_ledger', false)
  .option('-D, --debug', 'Enable debug logging', false)
  .option('-f, --from <date>', 'Start date (inclusive, ISO format)', COINBASE_EPOCH)
  .option('-q, --quiet', 'Do not print anything to the console', false)
  .option('-r, --range <period>', 'Shortcut range: week | month | quarter | year | all')
  .option('--raw', 'Print values raw from the DB', false)
  .option('-R, --received <asset>', `Select records where received_currency is <asset>`)
  .option('-S, --sent <asset>', `Select records where sent_currency is <asset>`)
  .option('-t, --to <date>', 'End date (exclusive, ISO format)', NOW)
  .option('-T, --type <type>', `Filter transactions by <type> (${COINTRACKER_TRANSACTION_TYPES})`)
  .option('-x, --exclude <assets>', 'Exclude <assets> from the result set')
  .option('-y, --year <year>', 'Calculate fees for the specified year')
  .action(async (asset, options) =>
    handleActionWithArgument(cointrackerTransactions, asset, options),
  );

program
  .command('cointracker-transactions-group [asset]')
  .alias('ttg')
  .description(`Calculate total realized returns selected from ${COINTRACKER_TABLE.TRANSACTIONS}`)
  .option('-D, --debug', 'Enable debug logging', false)
  .option('-f, --from <date>', 'Start date (inclusive, ISO format)', COINBASE_EPOCH)
  .option(
    '-i, --interval <interval>',
    'Group transactions by <interval> (day, week, month, quarter, or year)',
  )
  .option('-q, --quiet', 'Do not print anything to the console', false)
  .option('-r, --range <period>', 'Shortcut range: week | month | quarter | year | all')
  .option('-R, --received <asset>', `Select records where received_currency is <asset>`)
  .option('-S, --sent <asset>', `Select records where sent_currency is <asset>`)
  .option('-t, --to <date>', 'End date (exclusive, ISO format)', NOW)
  .option('-T, --type <type>', `Filter transactions by <type> (${COINTRACKER_TRANSACTION_TYPES})`)
  .option('-x, --exclude <assets>', 'Exclude <assets> from the result set')
  .option('-y, --year <year>', 'Calculate fees for the specified year')
  .action(async (asset, options) =>
    handleActionWithArgument(cointrackerTransactionsGroup, asset, options),
  );

program
  .command('cointracker-transactions-regenerate')
  .alias('ttr')
  .description(
    `Truncate ${COINTRACKER_TABLE.TRANSACTIONS}, and re-populate with CSVs from ${getHdbPath(HdbDir.COINTRACKER_TRANSACTIONS_INPUT)}`,
  )
  .option(
    '-d, --drop',
    `Drop ${COINTRACKER_TABLE.TRANSACTIONS}, and re-create anew before repopulating`,
    false,
  )
  .option('-D, --debug', 'Enable debug logging', false)
  .option('-y, --yes', 'Answer yes to all prompts', false)
  .action(async (options) => handleAction(cointrackerTransactionsRegenerate, options));

program
  .command('test')
  .description('Test connection to the database')
  .option('-D, --debug', 'Enable debug logging', false)
  .action(async (options) => handleAction(handleTestAction, options));

program.parse(process.argv);
