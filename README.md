# cb-lib

[![CI](https://github.com/benjaminjnoack/cb-lib/actions/workflows/ci.yml/badge.svg)](https://github.com/benjaminjnoack/cb-lib/actions/workflows/ci.yml)

`cb-lib` is a TypeScript/Node.js library for interacting with Coinbase Advanced Trade APIs.

## Requirements

- Node.js `>=20`
- npm

## Installation

```bash
npm install cb-lib
```

Or install directly from GitHub:

```bash
npm install github:benjaminjnoack/cb-lib
```

## Configuration

A template is available in `.env.example`.

`cb-lib` loads environment variables from an env file in this order:

1. Explicit path passed by tooling (for example `helper-env-check --env-file <path>`)
2. `HELPER_ENV_FILE`
3. Default path: `$XDG_CONFIG_HOME/helper/.env` (or `~/.config/helper/.env` if `XDG_CONFIG_HOME` is unset)

Set the Coinbase credentials file path in that env file:

```bash
HELPER_COINBASE_CREDENTIALS_PATH=/absolute/path/to/coinbase-credentials.json
```

Example setup using the default location:

```bash
mkdir -p "${XDG_CONFIG_HOME:-$HOME/.config}/helper"
cp .env.example "${XDG_CONFIG_HOME:-$HOME/.config}/helper/.env"
```

You can validate environment setup and credentials file parsing with:

```bash
npm run build
npm link
helper-env-check
```

Optional override:

```bash
helper-env-check --env-file /absolute/path/to/.env
```

### Coinbase CDP API Keys

This library expects Coinbase App API credentials created in the CDP portal.

- Use a CDP Secret API key with the `ECDSA`/`ES256` signature algorithm (not `Ed25519` for Coinbase App API auth).
- The credentials JSON pointed to by `HELPER_COINBASE_CREDENTIALS_PATH` must match:

```json
{
  "name": "organizations/{org_id}/apiKeys/{key_id}",
  "privateKey": "-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----\n"
}
```

- Preserve private key newlines exactly (either real multiline PEM or `\n` escaped newlines in a single string).

Reference: https://docs.cdp.coinbase.com/coinbase-app/authentication-authorization/api-key-authentication

## Basic Usage

```ts
import {
  createMarketOrder,
  requestAccounts,
  requestCurrencyAccount,
  requestProduct,
  toIncrement,
} from "cb-lib";

const accounts = await requestAccounts();
const product = await requestProduct("BTC-USD");

const orderId = await createMarketOrder("BTC-USD", "BUY", "0.001");
const usd = await requestCurrencyAccount("USD");
const rounded = toIncrement("0.01", 123.456); // "123.45"
```

## API Surface

`cb-lib` uses named exports from `src/index.ts`:

- REST helpers from `src/rest.ts` (for example `requestAccounts`, `requestProduct`)
- Order helpers from `src/service/order.ts` (for example `createMarketOrder`, `createLimitOrder`)
- Utilities from `src/lib/*` (for example `toIncrement`, `getEnvConfig`, `delay`, signing/cache/error helpers)
- Credentials and logging helpers from `src/credentials.ts` and `src/log/*`
- Schemas/types from `src/schemas/*`
- `Product` class as a named export (`Product`)

There is no default export.

## What It Includes

- REST request helpers for Coinbase brokerage endpoints (`src/rest.ts`)
- Order creation helpers (`src/service/order.ts`)
- Increment/rounding helpers (`src/lib/increment.ts`)
- Cache and signing helpers (`src/lib/cache.ts`, `src/lib/signing.ts`)
- Credentials loading helper (`src/credentials.ts`)
- Logging helpers (`src/log/logger.ts`, `src/log/orders.ts`)
- Product helpers (`src/product.ts`)
- Transaction summary caching helper (`src/transaction_summary.ts`)
- Zod schemas for runtime validation (`src/schemas/`)

## Development

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
npm run release:check
```

## CI

GitHub Actions runs on push to `main` and on pull requests, executing:

- `npm ci`
- `npm run release:check`
- `npm run build`

Tag pushes matching `v*` also trigger automated GitHub Releases.

## License

Apache-2.0
