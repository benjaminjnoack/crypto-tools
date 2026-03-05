# crypto-tools

Monorepo for Coinbase-related CLI tooling and shared TypeScript modules.

## What is here

- `cb`: trading-oriented Coinbase CLI (`src/apps/cb`)
- `hdb`: database-oriented helper CLI (`src/apps/hdb`)
- `shared`: shared Coinbase/env/log/schema modules (`src/shared`)
- `helper-env-check`: env/credential validation binary (`src/shared/bin/validate-env.ts`)

## Import Aliases

Prefer path aliases over deep relative imports:

- `#shared/*` -> `src/shared/*`
- `#cb/*` -> `src/apps/cb/*`
- `#hdb/*` -> `src/apps/hdb/*`

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

- [`src/apps/cb/README.md`](src/apps/cb/README.md)
- [`src/apps/hdb/README.md`](src/apps/hdb/README.md)
- [`src/apps/hdb/README.postgres.md`](src/apps/hdb/README.postgres.md)
- [`src/shared/README.md`](src/shared/README.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Quality Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## License

Apache-2.0
