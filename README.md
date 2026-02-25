# crypto-tools

[![CI](https://github.com/benjaminjnoack/crypto-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/benjaminjnoack/crypto-tools/actions/workflows/ci.yml)

`crypto-tools` is a consolidated TypeScript/Node.js repo containing:

- `cb`: Coinbase trading CLI
- Shared Coinbase library code used by the CLI
- `helper-env-check`: environment and credentials validation CLI

## Requirements

- Node.js `>=20`
- npm

## Setup

1. Install dependencies:
   - `npm install`
2. Create default env location and copy template:
   - `mkdir -p "${XDG_CONFIG_HOME:-$HOME/.config}/helper"`
   - `cp .env.example "${XDG_CONFIG_HOME:-$HOME/.config}/helper/.env"`
3. Set:
   - `HELPER_COINBASE_CREDENTIALS_PATH=/absolute/path/to/coinbase-credentials.json`

You can override env loading with:

- `HELPER_ENV_FILE=/absolute/path/to/.env`
- or `helper-env-check --env-file /absolute/path/to/.env`

## Coinbase CDP API Keys

Use Coinbase App API credentials created in CDP.

- Use CDP Secret API key with `ECDSA`/`ES256`.
- Credentials JSON should contain:

```json
{
  "name": "organizations/{org_id}/apiKeys/{key_id}",
  "privateKey": "-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----\n"
}
```

- Preserve private key newlines exactly.

Reference: https://docs.cdp.coinbase.com/coinbase-app/authentication-authorization/api-key-authentication

## CLI Usage

Build and link local binaries:

```bash
npm run build
npm link
```

Then use:

- `cb --help`
- `helper-env-check --help`

Run CLI directly during development:

- `npm run dev -- --help`
- `npm run dev -- price btc`

Run built CLI directly:

- `node dist/apps/cb/cli.js --help`

## Commands (`cb`)

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
- `cb max [product]`

### Trade Plan

- `cb plan [product] --buyPrice <price> --stopPrice <stopPrice> --takeProfitPrice <takeProfitPrice> [--riskPercent <riskPercent>] [--bufferPercent <bufferPercent>] [--all-in] [--dryRunFlag] [--no-postOnly]`

### Orders

- `cb orders [product]` (alias: `open`)
- `cb order <order_id>`
- `cb cancel <order_id>`

## Library Usage

Library exports are available from the package root:

```ts
import {
  createMarketOrder,
  requestAccounts,
  requestCurrencyAccount,
  requestProduct,
  toIncrement,
} from "crypto-tools";

const accounts = await requestAccounts();
const product = await requestProduct("BTC-USD");

const orderId = await createMarketOrder("BTC-USD", "BUY", "0.001");
const usd = await requestCurrencyAccount("USD");
const rounded = toIncrement("0.01", 123.456); // "123.45"
```

## Development

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run release:check
```

Additional contributor details are in `CONTRIBUTING.md`.

## CI and Releases

- CI (`.github/workflows/ci.yml`) runs on PRs and pushes to `main`.
- Release workflow (`.github/workflows/release.yml`) creates GitHub Releases for pushed `v*` tags.

## License

Apache-2.0
