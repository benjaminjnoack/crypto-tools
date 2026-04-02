# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev             # run cb CLI from TypeScript source
npm run dev:hdb         # run hdb CLI from TypeScript source
npm run build           # clean + compile to dist/ + mark binaries executable
npm run lint            # ESLint (type-aware)
npm run lint:fix        # ESLint with autofix
npm run typecheck       # TypeScript check without emit
npm run test            # unit tests (safe default)
npm run test:watch      # unit tests in watch mode
```

Run a single test file:
```bash
npx vitest run --config vitest.config.ts test/src/path/to/file.test.ts
```

Integration smoke tests (read-only, requires local `.env.readonly`):
```bash
npm run test:integration:smoke
```

Full pre-release gate:
```bash
npm run release:check   # lint + typecheck + test + pack dry run
```

## Architecture

TypeScript ESM monorepo (`module: NodeNext`). Three CLIs share a `src/shared/` layer.

- `src/apps/cb/` — `cb` binary: Coinbase trading CLI (quotes, sizing, order lifecycle)
- `src/apps/hdb/` — `hdb` binary: accounting/reconciliation CLI backed by PostgreSQL
- `src/apps/hdb-portal/` — local read-only web portal over `hdb` data
- `src/shared/` — auth/env/log/schema/HTTP primitives shared across apps
- `test/src/` — unit tests; `test/integration/` — integration tests
- `test/setup/no-network.ts` — global outbound-network block active in `vitest.config.ts`

**Use explicit relative imports with `.js` specifiers** (NodeNext resolution).

### cb app boundaries

| Concern | Location |
|---|---|
| Command intent/handlers | `src/apps/cb/commands/` |
| Pure order sizing/validation logic | `src/apps/cb/service/order-builders.ts` |
| CLI prompts and output formatting | `src/apps/cb/service/order-prompts.ts` |
| Orchestration | `src/apps/cb/service/order-service.ts` |
| Order transport API | `src/shared/coinbase/orders-client.ts` |
| Low-level HTTP/signing | `src/shared/coinbase/rest.ts` |

Command registration in `src/apps/cb/commands/register/` uses `withAction(commandName, parser, handler)` from `register-utils.ts` and parser helpers (`parseArg`, `parseArgOptions`, `parseProductId`, etc.).

Order commands are nested under `cb order`:  `get`, `list`, `cancel`, `modify`.

### Testing conventions

- Prefer shared typed fixtures over inline objects; use `test/src/fixtures/coinbase-orders.ts` for Coinbase order payloads.
- Outbound network is blocked in unit tests — do not bypass `no-network.ts`.
- Mock side effects and external calls; integration tests use a sanitized read-only env.

## Safety Rules

- **Never make live calls to Coinbase/exchange endpoints** during development, debugging, or validation.
- Do not run `cb`/`hdb` commands against real credentials.
- Do not run scripts that invoke live Coinbase REST helpers.
- If CLI behavior must be verified, use parser-level tests and mocked handlers.

## Validation Workflow

Classify risk before validating:
- **Low risk** (docs, comments, static copy): targeted lint minimum.
- **Medium risk** (non-critical logic, refactors, parser/output): full `typecheck + lint + test` at end of task.
- **High risk** (order logic, math, schemas, shared core): same full gate; prioritize regression prevention.

## Environment

Config is loaded from `${XDG_CONFIG_HOME:-$HOME/.config}/helper/.env`. Required env vars:
- `HELPER_COINBASE_CREDENTIALS_PATH` — absolute path to ECDSA credentials JSON
- `HELPER_ALLOW_LIVE_EXCHANGE=true` — explicit opt-in for live requests

`hdb` uses PostgreSQL via `DATABASE_URL`. See `src/apps/hdb/README.postgres.md` for local setup.
