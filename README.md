# crypto-tools

Production Coinbase operations toolkit: `cb` for trade planning and order lifecycle management, `hdb` for ledger ingestion/reconciliation and tax-facing analytics, `hdb-portal` for local read-only web analysis, plus shared TypeScript modules for authenticated API access and reusable CLI infrastructure.

## What is here

- `cb`: trading operations CLI (quotes, sizing, plan workflows, order lifecycle) (`src/apps/cb`)
- `hdb`: accounting/data CLI (imports, snapshots, lots, reconciliation, exports) (`src/apps/hdb`)
- `hdb-portal`: local web portal for `hdb` analysis (`src/apps/hdb-portal`)
- `shared`: reusable Coinbase/auth/env/log/schema modules (`src/shared`)
- `helper-env-check`: env/credential validation binary (`src/shared/bin/validate-env.ts`)

## Imports

Use explicit relative imports with `.js` specifiers under NodeNext.

## Requirements

- Node.js `>=20`
- npm

## Quick Start

```bash
npm install
mkdir -p "${XDG_CONFIG_HOME:-$HOME/.config}/helper"
cp .env.example "${XDG_CONFIG_HOME:-$HOME/.config}/helper/.env"
```

Set this value in the env file:

```bash
HELPER_COINBASE_CREDENTIALS_PATH=/absolute/path/to/coinbase-credentials.json
HELPER_ALLOW_LIVE_EXCHANGE=true
```

Create Coinbase App API credentials using:
https://docs.cdp.coinbase.com/coinbase-app/authentication-authorization/api-key-authentication

When creating the key in CDP, select the `ECDSA` signature algorithm (`ES256`).

Build and link binaries locally:

```bash
npm run build
npm link
```

## Running CLIs

- `cb --help`
- `hdb --help`
- `helper-env-check --help`

From source:

- `npm run dev -- --help` (runs `cb`)
- `npm run dev:hdb -- --help` (runs `hdb`)

## Documentation

- [`cb CLI README`](src/apps/cb/README.md)
- [`src/apps/hdb/README.md`](src/apps/hdb/README.md)
- [`src/apps/hdb/README.postgres.md`](src/apps/hdb/README.postgres.md)
- [`src/apps/hdb-portal/README.md`](src/apps/hdb-portal/README.md)
- [`src/shared/README.md`](src/shared/README.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Quality Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Integration smoke checks (readonly mode + sanitized env):

```bash
npm run test:integration:smoke
```

Override readonly env file path when needed:

```bash
INTEGRATION_ENV_FILE=/absolute/path/to/.env.readonly npm run test:integration:smoke
```

## License

Apache-2.0
