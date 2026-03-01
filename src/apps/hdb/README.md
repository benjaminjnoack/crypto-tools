# hdb

`hdb` is the helper database CLI in this monorepo.

Source location: `src/apps/hdb`

## Requirements

- Node.js `>=20`
- npm
- local PostgreSQL

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

For `hdb`, set these required Postgres values in the env file:

```bash
HELPER_POSTGRES_DATABASE=hdb
HELPER_POSTGRES_USERNAME=hdb_user
HELPER_POSTGRES_PASSWORD=hdb_password
```

Optional override:

```bash
export HELPER_ENV_FILE=/absolute/path/to/.env
```

Local PostgreSQL setup details are in [`README.postgres.md`](./README.postgres.md).

## Usage

Run from TypeScript source:

- `tsx src/apps/hdb/cli.ts --help`
- `tsx src/apps/hdb/cli.ts test`

Run built CLI:

- `npm run build`
- `node dist/apps/hdb/cli.js --help`

Install binary in your shell:

- `npm link`
- `hdb --help`

## Commands

### System

- `hdb test`

### Coinbase Orders

- `hdb coinbase orders get <orderId>` (alias: `g`)
- `hdb coinbase orders fees [productId]` (alias: `f`)
- `hdb coinbase orders insert <orderId>` (alias: `i`)
- `hdb coinbase orders update` (alias: `u`)

### CoinTracker

- `hdb cointracker` (placeholder command group, in progress)

Use `hdb <command> --help` for option details.

## Development

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run release:check`

Project workflow and standards are in [`CONTRIBUTING.md`](../../../CONTRIBUTING.md).
