# Contributing to cb-lib

This document describes local setup, development workflow, and quality checks for this standalone library.

## Requirements

- Node.js `>=20`
- npm

## Environment Setup

1. Create the default env directory: `${XDG_CONFIG_HOME:-$HOME/.config}/helper`.
2. Copy `.env.example` to `${XDG_CONFIG_HOME:-$HOME/.config}/helper/.env`.
3. Set `HELPER_COINBASE_CREDENTIALS_PATH` to your local Coinbase credentials JSON path.
4. Optional: set `HELPER_ENV_FILE` if you want to use a non-default env file path.
5. Never commit real secrets or credential files.

## Project Structure

- `src/` library source code
- `src/schemas/` Zod schemas and runtime validators
- `src/service/` higher-level Coinbase service helpers
- `src/lib/` internal utilities
- `test/` Vitest tests
- `dist/` compiled build output

## Scripts

- `npm run build` compiles TypeScript to `dist/`
- `npm run clean` removes `dist/`
- `npm run lint` runs ESLint
- `npm run lint:fix` runs ESLint auto-fixes
- `npm run typecheck` runs TypeScript checks without emitting
- `npm run test` runs tests once
- `npm run test:watch` runs tests in watch mode
- `npm run pack:dry` previews npm package contents
- `npm run release:check` runs lint + typecheck + test + pack dry run
- `npm run prepare` builds the library (used for git-based installs)

## Development Workflow

1. Install dependencies with `npm install`.
2. Run `npm run typecheck` and `npm run lint` while developing.
3. Add or update tests in `test/` with each behavior change.
4. Before opening a PR, run `npm run release:check` and `npm run build`.

## Pre-commit Hooks

This repository uses Husky + lint-staged.

- `npm install` runs `prepare`, which builds the library.
- If hooks are not active in your clone, set the hooks path with:
  - `git config core.hooksPath .husky/_`
- On commit, staged `*.{ts,tsx,js,mjs,cjs}` files are auto-fixed with `eslint --fix`.

## Packaging Notes

- Published files are controlled by `package.json#files` (`dist`, `README.md`, `LICENSE`).
- `npm run prepack` performs a clean build before packaging/publish.

## Releasing

This repo uses tag-based GitHub Releases.

- Use one of:
  - `npm run patch`
  - `npm run minor`
  - `npm run major`
- Each command runs `release:check`, bumps version with `npm version`, then pushes commits and tags.
- Pushing a `v*` tag triggers `.github/workflows/release.yml`, which creates the GitHub Release automatically.

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`

- Runs on pull requests and pushes to `main`
- Uses Node.js 20
- Executes:
  - `npm ci`
  - `npm run release:check`
  - `npm run build`

## Pull Requests

Please keep PRs focused and include:

- A brief summary of the change
- Tests for behavior changes
- Notes about any API or schema changes
