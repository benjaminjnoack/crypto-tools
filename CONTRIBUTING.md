# Contributing to crypto-tools

This document describes setup, architecture, tooling, and contributor workflow for the monorepo.

## Technology Stack

- TypeScript (`strict`) on Node.js 20+
- ES modules (`module: NodeNext`)
- CLI framework: `commander`
- Validation: `zod`
- HTTP and service integration: `axios`
- PostgreSQL access for `hdb`: `pg`
- Linting: ESLint (`eslint.config.mjs`)
- Testing: Vitest (`vitest.config.ts`)
- Git hooks: Husky + lint-staged

## Requirements

- Node.js `>=20`
- npm

## Initial Setup

1. Install dependencies:
   - `npm install`
2. Configure env file in the default helper path:
   - `mkdir -p "${XDG_CONFIG_HOME:-$HOME/.config}/helper"`
   - `cp .env.example "${XDG_CONFIG_HOME:-$HOME/.config}/helper/.env"`
3. Set Coinbase credentials path in that env file:
   - `HELPER_COINBASE_CREDENTIALS_PATH=/absolute/path/to/coinbase-credentials.json`
4. Optional env override:
   - `HELPER_ENV_FILE=/absolute/path/to/.env`

Never commit secrets, `.env` files, or credential material.

## Repository Organization

- `src/shared/`: shared Coinbase integration, common utilities, schemas, logging, and helper binaries
- `src/apps/cb/`: `cb` CLI (Coinbase trading commands)
- `src/apps/hdb/`: `hdb` CLI (database-oriented tools and command groups)
- `src/version.ts`: package version export
- `test/`: repository-level Vitest test suites
- `test/setup/no-network.ts`: global outbound-network block for tests
- `dist/`: compiled output

### CLI Entrypoints

- `src/apps/cb/cli.ts`
- `src/apps/hdb/cli.ts`
- `src/shared/bin/validate-env.ts` (`helper-env-check`)

### cb Conventions

For `src/apps/cb`, keep these boundaries:

- `commands/`: command intent handlers only
- `service/order-builders.ts`: pure, testable order sizing/validation/merge logic
- `service/order-prompts.ts`: user interaction (`console`/prompt formatting)
- `service/order-service.ts`: orchestration only
- `src/shared/coinbase/orders-client.ts`: order-focused transport API
- `src/shared/coinbase/rest.ts`: low-level HTTP/signed request primitives

Command registration in `src/apps/cb/commands/register/` should use:

- `withAction(commandName, parser, handler)` from `register/register-utils.ts`
- parser helpers (`parseArg`, `parseArgOptions`, `parseProductId`, `parseProductIdOptions`, etc.)

Avoid introducing additional one-off wrapper helpers when parser composition is sufficient.

Order command topology is intentionally nested:

- `cb order get <order_id>`
- `cb order list [product]`
- `cb order cancel <order_id>`
- `cb order modify <order_id> ...`

## Commands and Scripts

- `npm run dev`: run `cb` from TypeScript (`tsx src/apps/cb/cli.ts`)
- `npm run build`: clean + compile to `dist/` + mark CLI files executable
- `npm run clean`: remove `dist/`
- `npm run lint`: run ESLint
- `npm run lint:fix`: run ESLint with autofix
- `npm run typecheck`: run TypeScript checks without emit
- `npm run test`: run Vitest once
- `npm run test:watch`: run Vitest in watch mode
- `npm run smoke:bin`: smoke-test built `cb` CLI (`node dist/apps/cb/cli.js --help`)
- `npm run pack:dry`: preview npm package contents
- `npm run release:check`: lint + typecheck + test + pack dry run
- `npm run prepare`: build during install (including git-based installs)
- `npm run patch|minor|major`: version bump + push commit/tag after checks

Useful direct commands that are not mapped to npm scripts:

- `tsx src/apps/hdb/cli.ts --help` (run `hdb` from source)
- `node dist/apps/hdb/cli.js --help` (run built `hdb`)

## Local Development Workflow

1. Implement changes.
2. Run quality checks:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
3. Validate build artifacts:
   - `npm run build`
   - `npm run smoke:bin`
4. Optional release preflight:
   - `npm run release:check`

## Testing Guidelines

- Put tests under `test/**/*.test.ts`.
- Prefer unit tests for pure logic and schema parsing.
- Mock side effects and external service calls.
- Outbound network access is blocked by default in tests.
- Keep `test/setup/no-network.ts` enabled in `vitest.config.ts`.

## hdb Database Notes

- `hdb` uses PostgreSQL for local workflows.
- Use `DATABASE_URL` for connection configuration.
- Local Postgres setup examples are documented in `src/apps/hdb/README.postgres.md`.

## Linting and Code Quality

ESLint is type-aware and enforces consistency around:

- promise handling
- import/type style
- control-flow safety (e.g., exhaustive switches)
- general formatting and correctness rules

If a rule appears incorrect for a valid case, discuss before disabling it.

## Binaries and Linking

After `npm run build`, package binaries are:

- `cb` -> `dist/apps/cb/cli.js`
- `hdb` -> `dist/apps/hdb/cli.js`
- `helper-env-check` -> `dist/shared/bin/validate-env.js`

For local shell usage:

- `npm link`

## Pre-commit Hooks

Husky + lint-staged is configured:

- `.husky/pre-commit` runs `npx lint-staged`
- staged `*.{ts,tsx,js,mjs,cjs}` files run `eslint --fix`

If hooks are not active in your clone:

- `git config core.hooksPath .husky/_`

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`

- Triggers on pull requests and pushes to `main`
- Uses Node.js 20
- Runs:
  - `npm ci`
  - `npm run release:check`
  - `npm run build`

## Releases

- `npm run patch`
- `npm run minor`
- `npm run major`

Each command runs `release:check`, bumps version via `npm version`, and pushes commits/tags.
Pushing `v*` tags triggers `.github/workflows/release.yml` to create a GitHub Release.

## Pull Requests

Please include:

- a concise summary of behavior changes
- tests for behavior changes
- notes for API, schema, or command-surface changes
