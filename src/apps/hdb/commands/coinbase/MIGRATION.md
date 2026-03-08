# hdb Coinbase Migration Checklist

This tracks migration of legacy `helper` coinbase `hdb` commands into the TS command tree.

## Scope Snapshot

Legacy command surface (`helper/db/cli/hdb.js`):

- `coinbase-balances <asset>`
- `coinbase-balances-batch`
- `coinbase-balances-trace <asset>`
- `coinbase-balances-regenerate`
- `coinbase-lots <asset>`
- `coinbase-lots-batch`
- `coinbase-lots-batch-compare`
- `coinbase-lots-compare <asset>`
- `coinbase-orders <orderId>`
- `coinbase-orders-insert <orderId>`
- `coinbase-orders-fees [productId]`
- `coinbase-orders-object <orderId>`
- `coinbase-orders-regenerate`
- `coinbase-orders-update`
- `coinbase-transactions [asset]`
- `coinbase-transactions-group [asset]`
- `coinbase-transactions-id [id]`
- `coinbase-transactions-manual <asset>`
- `coinbase-transactions-nav`
- `coinbase-transactions-regenerate`
- `coinbase-transactions-statement <filepath>`

Current TS surface (`src/apps/hdb/commands/coinbase`):

- `coinbase balances get <asset>`
- `coinbase balances batch`
- `coinbase balances trace <asset>`
- `coinbase balances regenerate`
- `coinbase lots get <asset>`
- `coinbase lots batch`
- `coinbase lots compare <asset>`
- `coinbase lots batch-compare`
- `coinbase orders get <orderId>`
- `coinbase orders fees [productId]`
- `coinbase orders insert <orderId>`
- `coinbase orders object <orderId>`
- `coinbase orders regenerate`
- `coinbase orders update`
- `coinbase transactions get [asset]`
- `coinbase transactions group [asset]`
- `coinbase transactions id [id]`
- `coinbase transactions manual <asset>`
- `coinbase transactions nav`
- `coinbase transactions regenerate`
- `coinbase transactions statement <filepath>`

## Status

- `orders/get`: migrated
- `orders/fees`: migrated
- `orders/insert`: migrated (live-gated with `--remote --yes`)
- `orders/update`: migrated (explicit source gating: `--cache` or `--remote`)
- `orders/object`: migrated
- `orders/regenerate`: migrated
- `balances/get`: migrated
- `balances/batch`: migrated
- `balances/trace`: migrated
- `balances/regenerate`: migrated
- `lots/get`: migrated
- `lots/batch`: migrated
- `lots/compare`: migrated
- `lots/batch-compare`: migrated
- `transactions/get`: migrated
- `transactions/group`: migrated
- `transactions/id`: migrated (lot-id mode pending)
- `transactions/manual`: migrated
- `transactions/nav`: migrated (live-gated with `--remote --yes`)
- `transactions/statement`: migrated
- `transactions/regenerate`: migrated

## Recommended Slice Order

1. Coinbase command migration complete for current scope; continue hardening/tests/refinement as needed

## Migration Rules (Coinbase)

- Keep network boundaries mockable and test-first.
- Preserve command behavior unless it is incorrect or unsafe.
- Do not make live exchange calls by default; require explicit opt-in for live modes.
- Prefer deterministic repository-level tests and parser/handler tests for CLI behavior.
