# cb

`cb` is the Coinbase trading CLI in this monorepo.

Source location: `src/apps/cb`

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
- `cb modify <order_id> [--baseSize <baseSize>] [--limitPrice <limitPrice>] [--stopPrice <stopPrice>]`
- `cb max [product]`

### Plan

- `cb plan [product] --buyPrice <price> --stopPrice <stopPrice> --takeProfitPrice <takeProfitPrice> [--riskPercent <riskPercent>] [--bufferPercent <bufferPercent>] [--all-in] [--dryRunFlag] [--no-postOnly]`

### Orders

- `cb orders [product]` (alias: `open`)
- `cb order <order_id>`
- `cb cancel <order_id>`

## Development

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run release:check`

Project workflow and standards are in [`CONTRIBUTING.md`](../../../CONTRIBUTING.md).
