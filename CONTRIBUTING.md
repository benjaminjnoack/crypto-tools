# Contributing to crypto-tools

This guide covers local setup, workflow, and quality checks for the consolidated repo.

## Requirements

- Node.js `>=20`
- npm

## Initial Setup

1. Install dependencies:
   - `npm install`
2. Create default env location and copy template:
   - `mkdir -p "${XDG_CONFIG_HOME:-$HOME/.config}/helper"`
   - `cp .env.example "${XDG_CONFIG_HOME:-$HOME/.config}/helper/.env"`
3. Set credentials path in the env file:
   - `HELPER_COINBASE_CREDENTIALS_PATH=/absolute/path/to/coinbase-credentials.json`

Never commit secrets or credential files.

## Repository Layout

- `src/shared/`: shared Coinbase/client utilities, schemas, and helper binaries
- `src/apps/cb/`: `cb` command-line app and command registration
- `test/`: Vitest suites
- `test/setup/no-network.ts`: global outbound-network block for tests
- `dist/`: compiled output

## Scripts

- `npm run dev`: run `cb` from TypeScript (`tsx src/apps/cb/cli.ts`)
- `npm run build`: compile TypeScript to `dist/` and set executable bits for CLIs
- `npm run clean`: remove `dist/`
- `npm run lint`: run ESLint
- `npm run lint:fix`: run ESLint with autofix
- `npm run typecheck`: run TypeScript checks without emitting
- `npm run test`: run Vitest once
- `npm run test:watch`: run Vitest in watch mode
- `npm run smoke:bin`: run built `cb` help (`node dist/apps/cb/cli.js --help`)
- `npm run pack:dry`: preview package contents
- `npm run release:check`: lint + typecheck + test + pack dry run
- `npm run prepare`: build during install (for git-based installs)

## Local Workflow

1. Make code changes.
2. Run checks:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
3. Validate distributable output:
   - `npm run build`
   - `npm run smoke:bin`
4. Optional release preflight:
   - `npm run release:check`

## CLI Binaries

After `npm run build`, package binaries are:

- `cb` -> `dist/apps/cb/cli.js`
- `helper-env-check` -> `dist/shared/bin/validate-env.js`

For local shell usage:

- `npm link`

## Testing Safety

- Outbound network calls are blocked by default in tests.
- Keep `test/setup/no-network.ts` enabled in `vitest.config.ts`.
- Mock external service calls in tests.

## Pre-commit Hooks

Husky + lint-staged is configured:

- `.husky/pre-commit` runs `npx lint-staged`
- staged `*.{ts,tsx,js,mjs,cjs}` files run `eslint --fix`

If hooks are not active in your clone, set:

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

- summary of behavior change
- tests for behavior changes
- notes on API/schema changes
