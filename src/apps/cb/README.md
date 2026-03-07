# cb

`cb` is the Coinbase trading CLI in this monorepo.

Source location: `src/apps/cb`

## Architecture Notes

`cb` follows a layered split for order workflows:

- `src/apps/cb/commands/`: command handlers (command intent only)
- `src/apps/cb/service/order-builders.ts`: pure sizing/validation/merge logic
- `src/apps/cb/service/order-prompts.ts`: interactive CLI summaries and confirmations
- `src/apps/cb/service/order-service.ts`: orchestration layer (builders + prompts + client calls)
- `src/shared/coinbase/orders-client.ts`: order-focused Coinbase transport API
- `src/shared/coinbase/rest.ts`: low-level signed REST request helpers

When adding or changing order behavior:

1. Put deterministic calculations and order-shape transforms in `order-builders.ts`.
2. Keep `orders.ts` thin and orchestration-only.
3. Keep direct Coinbase order create/get/list/cancel/edit calls behind `orders-client.ts`.
4. Add/adjust typed fixtures in `test/src/fixtures/coinbase-orders.ts` before adding large inline order objects in tests.

## Command Registration Conventions

Command registration under `src/apps/cb/commands/register/` uses one pattern:

- `withAction(commandName, parser, handler)` from `register/register-utils.ts`
- parser helpers (`parseArg`, `parseArgOptions`, `parseProductIdOptions`, etc.) handle validation and argument normalization

Prefer parser composition over adding new one-off wrapper helpers.

## Requirements

- Node.js `>=20`
- npm

## Setup

Install dependencies from the repo root:

```bash
npm install
```

Configure env in the default helper path:

```bash
mkdir -p "${XDG_CONFIG_HOME:-$HOME/.config}/helper"
cp .env.example "${XDG_CONFIG_HOME:-$HOME/.config}/helper/.env"
```

Set:

```bash
HELPER_COINBASE_CREDENTIALS_PATH=/absolute/path/to/coinbase-credentials.json
HELPER_ALLOW_LIVE_EXCHANGE=true
```

Optional override:

```bash
export HELPER_ENV_FILE=/absolute/path/to/.env
```

## Usage

Run from TypeScript source:

- `npm run dev -- --help`
- `npm run dev -- price btc`

Run built CLI:

- `npm run build`
- `node dist/apps/cb/cli.js --help`

Install binary in your shell:

- `npm link`
- `cb --help`

Notes:

- `[product]` defaults to `BTC` when omitted.
- Use `cb <command> --help` for command-specific options.

## Commands

### Accounts

- `cb accounts [product] [--crypto] [--cash]` (alias: `account`)
  - non-zero balances by default; when `[product]` is provided, matching accounts are shown with price-based USD values
- `cb balance` (alias: `usd`)
- `cb cash`
- `cb fees`

### Products

- `cb product [product]`
- `cb price [product]`

### Market Orders

- `cb buy [product] [--baseSize <baseSize>] [--value <value>]`
- `cb sell [product] [--baseSize <baseSize>] [--value <value>]`
- `cb market [product] (--buy | --sell) [--baseSize <baseSize>] [--value <value>]`

### Limit Orders

- `cb bid [product] [--baseSize <baseSize>] [--value <value>] [--no-postOnly]`
- `cb ask [product] [--baseSize <baseSize>] [--value <value>] [--no-postOnly]`
- `cb limit [product] (--buy | --sell) --limitPrice <limitPrice> [--baseSize <baseSize>] [--value <value>] [--no-postOnly]`
- `cb stop [product] --baseSize <baseSize> --limitPrice <limitPrice> --stopPrice <stopPrice>`
- `cb bracket [product] --baseSize <baseSize> --limitPrice <limitPrice> --stopPrice <stopPrice>`
- `cb max [product]`

### Plan

- `cb plan [product] --buyPrice <price> --stopPrice <stopPrice> --takeProfitPrice <takeProfitPrice> [--riskPercent <riskPercent>] [--bufferPercent <bufferPercent>] [--all-in] [--dryRunFlag] [--no-postOnly]`
- `cb fib [product] --fib0 <price> --fib1 <price> [--riskPercent <riskPercent>] [--bufferPercent <bufferPercent>] [--all-in] [--dryRunFlag] [--no-postOnly]`

### Orders

- `cb order get <order_id>`
- `cb order list [product]`
- `cb order cancel <order_id>`
- `cb order modify <order_id> [--baseSize <baseSize>] [--limitPrice <limitPrice>] [--stopPrice <stopPrice>] [--takeProfitPrice <takeProfitPrice>]` (supports limit, stop-limit, bracket, and TP/SL orders)
- `cb order breakeven <order_id> --buyPrice <buyPrice> [--limitPrice <limitPrice>]`

`cb order modify` behavior by order type:

- `LIMIT` without attached TP/SL:
  - `--baseSize`, `--limitPrice` update the entry order
  - `--stopPrice` / `--takeProfitPrice` are rejected
- `LIMIT` with attached TP/SL (for example, from `cb plan` before fill):
  - `--baseSize`, `--limitPrice` update the parent limit buy
  - `--stopPrice`, `--takeProfitPrice` update the attached TP/SL legs
- `BRACKET` (for example, the post-fill order created after a plan entry fills):
  - `--baseSize` updates position size
  - `--limitPrice` or `--takeProfitPrice` updates the take-profit leg (`price`)
  - `--stopPrice` updates the stop leg (`stop_price`)
- `TAKE_PROFIT_STOP_LOSS`:
  - same semantics as `BRACKET`
- `STOP_LIMIT`:
  - `--baseSize`, `--limitPrice`, `--stopPrice` are supported
  - `--takeProfitPrice` is rejected

## Development

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run release:check`

Project workflow and standards are in [`CONTRIBUTING.md`](../../../CONTRIBUTING.md).
