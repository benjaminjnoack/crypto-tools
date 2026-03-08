# hdb

`hdb` is the crypto accounting database CLI in this monorepo.

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
- `tsx src/apps/hdb/cli.ts health`

Run built CLI:

- `npm run build`
- `node dist/apps/hdb/cli.js --help`

Install binary in your shell:

- `npm link`
- `hdb --help`

## Commands

### System

- `hdb health`

### Coinbase

- `hdb coinbase balances list <asset>`
  - `asset` supports colon-separated values
  - `--current` live check requires `--remote --yes`
- `hdb coinbase balances snapshot`
  - `--current` live check requires `--remote --yes`
- `hdb coinbase balances trace <asset>`
- `hdb coinbase balances rebuild`
  - requires `--yes`
- `hdb coinbase lots analyze <asset>`
- `hdb coinbase lots analyze-all`
- `hdb coinbase lots compare <asset>`
- `hdb coinbase lots compare-all`
  - supports `--csv` and `--f8949` exports
- `hdb coinbase orders show <orderId>`
- `hdb coinbase orders inspect <orderId>`
- `hdb coinbase orders fees [productId]`
- `hdb coinbase orders import-one <orderId>`
  - requires explicit live mode: `--remote --yes`
- `hdb coinbase orders rebuild`
  - requires `--yes`
  - source selection required: `--cache` or `--remote`
  - live mode requires confirmation: `--remote --yes`
- `hdb coinbase orders sync`
  - requires source selection: `--cache` or `--remote`
  - live mode requires confirmation: `--remote --yes`

### Coinbase Transactions

- `hdb coinbase transactions list [asset]`
- `hdb coinbase transactions summary [asset]`
- `hdb coinbase transactions show [id]`
- `hdb coinbase transactions add-manual <asset>`
- `hdb coinbase transactions import-statement <filepath>`
- `hdb coinbase transactions rebuild`
  - requires `--yes`
  - input directory: `--input-dir <dir>` or `${HELPER_HDB_ROOT_DIR}/input/coinbase-transactions`
- `hdb coinbase transactions analyze-nav`
  - requires explicit live mode: `--remote --yes`

Coinbase migration status and next slices are tracked in:
- [`src/apps/hdb/commands/coinbase/MIGRATION.md`](./commands/coinbase/MIGRATION.md)

### CoinTracker

- `hdb cointracker balances list [currency]`
- `hdb cointracker balances rebuild`
  - requires `--yes`
- `hdb cointracker gains list [assets]`
  - export flags: `--csv`, `--f8949`, `--headers`, `--pages`
  - totals/format: `--totals`, `--raw`
- `hdb cointracker gains summary [assets]`
  - export flags: `--csv`, `--f8949`, `--headers`, `--pages`
  - totals/format: `--totals`, `--raw`
- `hdb cointracker gains rebuild`
  - requires `--yes`
  - input directory: `--input-dir <dir>` or `${HELPER_HDB_ROOT_DIR}/input/cointracker-capital-gains`
- `hdb cointracker gains analyze-usdc`
  - use `--buckets` or `--interval <day|week|month|quarter|year>`
- `hdb cointracker transactions list [asset]`
- `hdb cointracker transactions summary [asset]`
- `hdb cointracker transactions rebuild`
  - requires `--yes`
  - input directory: `--input-dir <dir>` or `${HELPER_HDB_ROOT_DIR}/input/cointracker-transactions`
  - also rebuilds `cointracker_balances_ledger`

Use `hdb <command path> --help` for option details.

## Development

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run release:check`

## Naming Topology

To keep files easy to scan as `hdb` grows, avoid generic repeated names.

- Command registration files: `register-<domain>-commands.ts`
- Command handlers: `<domain>-handlers.ts`
- Command option schemas: `<domain>-options.ts`
- Shared date/time helpers: `date-range-utils.ts`
- DB entrypoint: `db-client.ts`
- DB pool module: `postgres-pool.ts`
- DB repositories: `<domain>-repository.ts`
- DB SQL modules: `<domain>-sql.ts`
- DB mapping modules: `<domain>-mappers.ts`
- General rule: prefer explicit, domain-scoped filenames over `register.ts`, `handlers.ts`, or `orders.ts`.

Project workflow and standards are in [`CONTRIBUTING.md`](../../../CONTRIBUTING.md).
