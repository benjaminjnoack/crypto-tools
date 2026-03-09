# hdb

`hdb` is the crypto accounting database CLI in this monorepo.

Source location: `src/apps/hdb`

For the local web UI over `hdb` data, see [`../hdb-portal/README.md`](../hdb-portal/README.md).

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
- `hdb system rebuild-all`
  - rebuilds all input-derived tables sequentially
  - excludes Coinbase orders
  - stages: Coinbase transactions -> Coinbase balances -> CoinTracker transactions/balances -> CoinTracker gains

### Coinbase

- `hdb coinbase balances list <asset>`
  - `asset` supports colon-separated values
  - `--current` live check requires `--remote`
- `hdb coinbase balances snapshot`
  - `--current` live check requires `--remote`
- `hdb coinbase balances trace <asset>`
- `hdb coinbase balances rebuild`
- `hdb coinbase lots analyze <asset>`
- `hdb coinbase lots analyze-all`
- `hdb coinbase lots compare <asset>`
- `hdb coinbase lots compare-all`
  - supports `--csv` and `--f8949` exports
- `hdb coinbase orders show <orderId>`
- `hdb coinbase orders inspect <orderId>`
- `hdb coinbase orders fees [productId]`
- `hdb coinbase orders import-one <orderId>`
  - requires explicit live mode: `--remote`
- `hdb coinbase orders rebuild`
  - source selection required: `--cache` or `--remote`
- `hdb coinbase orders sync`
  - requires source selection: `--cache` or `--remote`

### Coinbase Transactions

- `hdb coinbase transactions list [asset]`
- `hdb coinbase transactions summary [asset]`
- `hdb coinbase transactions show [id]`
- `hdb coinbase transactions add-manual <asset>`
- `hdb coinbase transactions import-statement <filepath>`
- `hdb coinbase transactions rebuild`
  - input directory: `--input-dir <dir>` or `${HELPER_HDB_ROOT_DIR}/input/coinbase-transactions`
- `hdb coinbase transactions analyze-nav`
  - requires explicit live mode: `--remote`

Coinbase migration status and next slices are tracked in:
- [`src/apps/hdb/commands/coinbase/MIGRATION.md`](./commands/coinbase/MIGRATION.md)

### CoinTracker

- `hdb cointracker balances list [currency]`
- `hdb cointracker balances rebuild`
- `hdb cointracker gains list [assets]`
  - export flags: `--csv`, `--f8949`, `--headers`, `--pages`
  - totals/format: `--totals`, `--raw`
- `hdb cointracker gains summary [assets]`
  - export flags: `--csv`, `--f8949`, `--headers`, `--pages`
  - totals/format: `--totals`, `--raw`
- `hdb cointracker gains rebuild`
  - input directory: `--input-dir <dir>` or `${HELPER_HDB_ROOT_DIR}/input/cointracker-capital-gains`
- `hdb cointracker gains analyze-usdc`
  - use `--buckets` or `--interval <day|week|month|quarter|year>`
- `hdb cointracker transactions list [asset]`
- `hdb cointracker transactions summary [asset]`
- `hdb cointracker transactions rebuild`
  - input directory: `--input-dir <dir>` or `${HELPER_HDB_ROOT_DIR}/input/cointracker-transactions`
  - also rebuilds `cointracker_balances_ledger`

Use `hdb <command path> --help` for option details.

## Remaining TODOs

This section tracks legacy `old.js` TODOs that are still relevant for the migrated `hdb` app.

### 1) Incremental transaction import + controlled overrides

Goal: support incremental ingestion of new CSVs by filename (without full rebuild), with explicit conflict handling.

Current state: Coinbase supports `import-statement <filepath>` and both Coinbase/CoinTracker support directory rebuilds. Conflict replacement is available for manual Coinbase inserts only.

Needed:
- Add incremental file import command(s) for CoinTracker transactions similar to Coinbase statement import.
- Add explicit conflict policy (`error`, `skip`, `replace`) for CSV imports/rebuilds.
- For replace paths on Coinbase transactions, trigger or enforce dependent recomputation (at minimum balances, and potentially lots) to keep derived data consistent.

### 2) Tie Coinbase transactions to orders/fills

Goal: map trade transactions to order lifecycle and fill records for stronger auditability and reconciliation.

Current state: `coinbase_orders` is stored, but `coinbase_transactions` rows do not contain `order_id`, and there is no fill-level table.

Needed:
- Add a `coinbase_fills` model (or equivalent) with fill-level attributes, including `order_id`.
- Build a deterministic transaction-to-fill linking path where possible.
- Add explicit unmatched/ambiguous handling plus optional manual overrides for hard cases.

### 3) Historical NAV reconstruction

Goal: compute point-in-time NAV over a historical range, not only current snapshot NAV.

Current state: `coinbase transactions analyze-nav` uses current live account balances and current product prices, not historical prices.

Needed:
- Historical price source and ingestion pipeline.
- Local storage for historical candles/prices keyed by product and interval.
- Valuation logic that joins historical holdings with historical prices at consistent timestamps.
- Policy for missing candle data (fail, nearest, interpolation).

Reference:
- Coinbase Advanced Trade candles API: https://docs.cdp.coinbase.com/api-reference/advanced-trade-api/rest-api/products/get-product-candles

### 4) CoinTracker balances ledger linkage to Coinbase transactions

Goal: extend CoinTracker balance ledger to optionally reference matched Coinbase transaction IDs for cross-system reconciliation.

Current state: CoinTracker balances ledger is implemented and references `cointracker_transaction_id`, but it does not store Coinbase linkage.

Needed:
- Add Coinbase linkage field(s) or a dedicated mapping table.
- Build matching heuristics (timestamp window, asset, quantity, type).
- Persist match confidence/status and allow unresolved rows.

### 5) Explain CoinTracker PnL vs Coinbase NAV deltas

Goal: provide a reproducible reconciliation report that explains differences between CoinTracker PnL and Coinbase NAV.

Current state: both views exist, but there is no dedicated decomposition/reporting workflow.

Needed:
- Define exact reconciliation semantics (realized/unrealized, cash handling, fees, time windows, excluded assets).
- Add command/report output that breaks deltas into categories (pricing basis, unmatched transfers, fees, synthetic rows, timing differences).
- Add regression tests over fixed fixtures to prevent silent drift in reconciliation logic.

### Completed Legacy TODO

- USDC day-level grouping is available now via `hdb cointracker gains analyze-usdc --interval day`.

## Development

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run validate:hdb:inputs`
  - offline CSV parser validation for `${repoRoot}/data/input/*`
  - optional input root override: `npm run validate:hdb:inputs -- --input-root <dir>`
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
