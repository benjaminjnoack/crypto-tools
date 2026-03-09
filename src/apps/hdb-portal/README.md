# hdb-portal

`hdb-portal` is a local-only web front end for `hdb` data display and analysis.

## Safety

- Read-only only.
- No live Coinbase requests.
- No rebuild, import, or other mutation endpoints.
- Uses the same local Postgres configuration as `hdb`.

## Run

From source:

```bash
npm run dev:hdb-portal
```

From built output:

```bash
npm run build
node dist/apps/hdb-portal/cli.js
```

Defaults:

- host: `127.0.0.1`
- port: `43110`

Optional overrides:

```bash
export HELPER_HDB_PORTAL_HOST=127.0.0.1
export HELPER_HDB_PORTAL_PORT=43110
```

## Routes

- `/` local portal UI
- `/api/health`
- `/api/dashboard/summary`
- `/api/coinbase/balances`
- `/api/coinbase/balances/trace`
- `/api/coinbase/transactions`
- `/api/coinbase/transactions/group`
- `/api/coinbase/lots`
- `/api/coinbase/lots/compare`
- `/api/cointracker/gains`
- `/api/cointracker/gains/group`
