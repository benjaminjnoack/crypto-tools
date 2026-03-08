# Shared Modules

`src/shared` contains reusable modules consumed by `cb` and `hdb`.

This directory is internal to the monorepo and is not documented as a standalone package.

## Directory Map

- `coinbase/`: Coinbase REST, signing, credentials, product/order helpers
- `coinbase/schemas/`: zod schemas for Coinbase payloads
- `common/`: env loading, delay, cache helpers, numeric helpers
- `common/schemas/`: env schema
- `log/`: logger, error, and order logging helpers
- `schemas/`: shared primitive schemas
- `bin/validate-env.ts`: `helper-env-check` CLI entrypoint

## Environment Loading

Shared env loading uses this order:

1. explicit path passed by tooling (for example `helper-env-check --env-file <path>`)
2. `HELPER_ENV_FILE`
3. default path: `${XDG_CONFIG_HOME:-$HOME/.config}/helper/.env`

Minimum required Coinbase variable:

```bash
HELPER_COINBASE_CREDENTIALS_PATH=/absolute/path/to/coinbase-credentials.json
HELPER_ALLOW_LIVE_EXCHANGE=true
```

`hdb` also requires:

```bash
HELPER_POSTGRES_DATABASE=...
HELPER_POSTGRES_USERNAME=...
HELPER_POSTGRES_PASSWORD=...
```

## helper-env-check

Validate env file and Coinbase credential parsing:

```bash
npm run build
npm link
helper-env-check
```

Optional custom env path:

```bash
helper-env-check --env-file /absolute/path/to/.env
```

## Coinbase Credentials Format

Use Coinbase App API credentials created in CDP with `ECDSA`/`ES256`.

Expected JSON structure:

```json
{
  "name": "organizations/{org_id}/apiKeys/{key_id}",
  "privateKey": "-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----\n"
}
```

Reference: https://docs.cdp.coinbase.com/coinbase-app/authentication-authorization/api-key-authentication
