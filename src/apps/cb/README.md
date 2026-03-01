# cb

[![CI](https://github.com/benjaminjnoack/cb/actions/workflows/ci.yml/badge.svg)](https://github.com/benjaminjnoack/cb/actions/workflows/ci.yml)

`cb` is a Node.js CLI for Coinbase account, product, and order workflows.

## Requirements

- Node.js `>=20`
- npm

## Installation

- From source (recommended while developing):
  - `npm install`
  - `npm run build`
  - `npm link`
- Or install globally from this repository:
  - `npm install -g .`

After either method, run with:

- `cb <command> [options]`

Note:

- This project depends on `cb-lib` from GitHub (`git+https://github.com/benjaminjnoack/cb-lib.git#v3.0.0`).
- Installing dependencies requires GitHub access for that dependency (local and CI).

## Setup

1. Create `.env` from the example:
   - `cp .env.example .env`
2. Set:
   - `HELPER_COINBASE_CREDENTIALS_PATH=/absolute/path/to/coinbase-credentials.json`
   - This is currently the only required env var in `.env`.
   - See cb-lib [README](https://github.com/benjaminjnoack/cb-lib?tab=readme-ov-file#coinbase-cdp-api-keys) for more information.
3. Keep secrets local:
   - `.env` is ignored and should never be committed.

## Usage

Run in development without building:

- `npm run dev -- <command> [options]`

Run built CLI directly:

- `npm run build`
- `node dist/cli.js <command> [options]`

Get help:

- `cb --help`
- `cb <command> --help`

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
- `cb market <product> (--buy | --sell) [--baseSize <baseSize>] [--value <value>]`

### Limit Orders

- `cb bid [product] [--baseSize <baseSize>] [--value <value>] [--no-postOnly]`
- `cb ask [product] [--baseSize <baseSize>] [--value <value>] [--no-postOnly]`
- `cb limit [product] (--buy | --sell) [--baseSize <baseSize>] [--value <value>] --limitPrice <limitPrice> [--no-postOnly]`
- `cb stop [product] --baseSize <baseSize> --limitPrice <limitPrice> --stopPrice <stopPrice>`
- `cb bracket [product] --baseSize <baseSize> --limitPrice <limitPrice> --stopPrice <stopPrice>`
- `cb max [product]`

### Plan

- `cb plan [product] --buyPrice <price> --stopPrice <stopPrice> --takeProfitPrice <takeProfitPrice> [--riskPercent <riskPercent>] [--bufferPercent <bufferPercent>] [--all-in] [--dryRunFlag] [--no-postOnly]`

Notes:

- `--all-in` sizes to max affordable position and overrides risk-based sizing.
- `--riskPercent` and `--bufferPercent` have defaults.
- `--dryRunFlag` does not place orders and sizes using USD `total` (not `available`).

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

### Test Safety

- Tests block all outbound network calls by default through `test/setup/no-network.ts`.
- Any real `http`, `https`, or `fetch` usage in tests must be mocked explicitly.

## Contributing

Project development workflow, tooling, and CI details are in [`CONTRIBUTING.md`](../../../CONTRIBUTING.md).
