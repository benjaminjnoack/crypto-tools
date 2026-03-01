# Contributing to cb

This document is the developer guide for working on `cb`.

## Requirements

- Node.js `>=20`
- npm
- Access to GitHub to resolve the `cb-lib` dependency (`git+https://github.com/benjaminjnoack/cb-lib.git#v3.0.0`)

## Initial Setup

1. Install dependencies:
   - `npm install`
2. Create local env file:
   - `cp .env.example .env`
3. Set credentials path:
   - `HELPER_COINBASE_CREDENTIALS_PATH=/absolute/path/to/coinbase-credentials.json`

Never commit `.env` or credential material.

## Project Layout

- `src/cli.ts`: executable entrypoint (shebang)
- `src/cb.ts`: command registration bootstrap (`createProgram`, `main`)
- `src/commands/`: command handlers and command registration
- `src/service/`: CLI-side service glue (order confirmations/placement wrappers)
- `test/`: unit tests
- `test/setup/no-network.ts`: global outbound-network block for tests

Coinbase-specific domain logic and schemas are intentionally consumed from `cb-lib`.

## Scripts

- `npm run dev`: run CLI directly from TypeScript via `tsx`
- `npm run build`: compile to `dist/` using `tsconfig.build.json`
- `npm run typecheck`: TypeScript check only (`tsc -p tsconfig.json`)
- `npm run lint`: ESLint on `src`, `test`, and tool configs
- `npm run lint:fix`: ESLint autofix
- `npm run test`: run Vitest once
- `npm run test:watch`: run Vitest in watch mode
- `npm run clean`: remove `dist/`
- `npm run pack:dry`: preview npm package contents
- `npm run release:check`: lint + typecheck + test + pack dry run
- `npm run smoke:bin`: execute built CLI entrypoint
- `npm run update`: update `cb-lib`, verify installed version, and rebuild

## Local Workflow

1. Make code changes.
2. Run checks:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
3. Validate build:
   - `npm run build`
4. Optional release preflight:
   - `npm run release:check`

## Linting Standards

ESLint is configured in `eslint.config.mjs` with type-aware TypeScript rules:

- double quotes
- spacing inside curly braces
- strict equality and curly braces
- consistent type imports and type definitions
- no floating promises / no misused promises
- switch exhaustiveness checks

If a rule is noisy for a valid case, discuss before disabling it.

## Testing Guidelines

- Test files live under `test/**/*.test.ts`.
- Prefer unit tests for pure logic (`buildTradePlan`, schema parsing, utility functions).
- Mock side effects in command-handler tests.
- Outbound network calls are blocked globally in tests by default.

## Safety Rules for Tests

- Do not allow real API calls in tests.
- Keep `test/setup/no-network.ts` enabled in `vitest.config.ts` (`setupFiles`).
- When testing codepaths that normally call external services, mock at the imported module path.

## Pre-commit Hooks

Husky + lint-staged is configured:

- `.husky/pre-commit` runs `npx lint-staged`
- staged `*.{ts,tsx,js,mjs,cjs}` files run `eslint --fix`

Hooks are installed by `npm install` through the `prepare` script.

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`

Trigger:

- pull requests
- pushes to `main`

Checks run:

- `npm ci`
- `npm run release:check`
- `npm run build`

## Dependency Notes

- `cb` depends on `cb-lib` from GitHub: `git+https://github.com/benjaminjnoack/cb-lib.git#v3.0.0`.
- If `cb-lib` exports change, update imports and tests in `cb` accordingly.
- When tests mock `cb-lib`, mock the package specifier (`"cb-lib"`), not old local paths.

## Pull Request Checklist

Before opening a PR:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run pack:dry`

## Releases

Automated release scripts are available for semantic version bumps:

- `npm run patch`
- `npm run minor`
- `npm run major`

Each command runs:

1. `npm run release:check`
2. `npm version <level>` (creates `vX.Y.Z` tag)
3. `git push`
4. `git push --tags`
