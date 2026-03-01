# hdb

[![CI](https://github.com/benjaminjnoack/hdb/actions/workflows/ci.yml/badge.svg)](https://github.com/benjaminjnoack/hdb/actions/workflows/ci.yml)

Helper database command line tool.

## Requirements

- Node.js `>=20`
- npm

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

## Scripts

- `npm run build`: compile TypeScript to `dist/`
- `npm run lint`: run ESLint
- `npm run typecheck`: run TypeScript checks
- `npm run test`: run Vitest
- `npm run smoke:bin`: execute built CLI entrypoint
- `npm run release:check`: lint + typecheck + test + package dry run

## Notes

- This CLI depends on `cb-lib` for shared domain logic.
- PostgreSQL local setup: see `README.postgres.md`.
