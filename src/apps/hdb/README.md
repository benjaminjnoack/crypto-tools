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
  - requires explicit live mode: `--remote --yes`
- `hdb coinbase orders update` (alias: `u`)
  - requires source selection: `--cache` or `--remote`
  - live mode requires confirmation: `--remote --yes`

### Coinbase Transactions

- `hdb coinbase transactions get [asset]` (alias: `g`)
- `hdb coinbase transactions group [asset]` (alias: `grp`)
- `hdb coinbase transactions id [id]`

Coinbase migration status and next slices are tracked in:
- [`src/apps/hdb/commands/coinbase/MIGRATION.md`](./commands/coinbase/MIGRATION.md)

### CoinTracker

- `hdb cointracker balances get [currency]` (alias: `g`)
- `hdb cointracker balances regenerate` (alias: `r`)
  - requires `--yes`
- `hdb cointracker capital-gains get [assets]` (alias: `g`)
  - export flags: `--csv`, `--f8949`, `-H|--headers`, `--pages`
  - totals/format: `--totals`, `--raw`
- `hdb cointracker capital-gains group [assets]` (alias: `grp`)
  - export flags: `--csv`, `--f8949`, `-H|--headers`, `--pages`
  - totals/format: `--totals`, `--raw`
- `hdb cointracker capital-gains regenerate` (alias: `r`)
  - requires `--yes`
  - input directory: `--input-dir <dir>` or `${HELPER_HDB_ROOT_DIR}/input/cointracker-capital-gains`
- `hdb cointracker capital-gains usdc` (alias: `u`)
  - use `--buckets` or `--interval <day|week|month|quarter|year>`
- `hdb cointracker transactions get [asset]` (alias: `g`)
- `hdb cointracker transactions group [asset]` (alias: `grp`)
- `hdb cointracker transactions regenerate` (alias: `r`)
  - requires `--yes`
  - input directory: `--input-dir <dir>` or `${HELPER_HDB_ROOT_DIR}/input/cointracker-transactions`
  - also rebuilds `cointracker_balances_ledger`

Use `hdb <command> --help` for option details.

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
