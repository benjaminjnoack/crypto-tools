# PR CI Plan: Required Checks + Read-Only Coinbase Integration Tests

## Purpose

Move from a lightweight CI check to a PR-gated workflow where all required checks must pass before merge, while preserving strict safety:

- Unit/default tests must never call the exchange.
- Integration tests may call Coinbase only with a dedicated read-only API key.
- CI must enforce defense-in-depth so write/trade calls are blocked even if a test is misconfigured.

## Current Baseline

Current workflow in `.github/workflows/ci.yml` runs:

- `npm ci`
- CI env fixture setup (`test/fixtures/ci/helper.env`)
- `npm run release:check`

This is a strong base and should remain part of required checks.

## Target End State

PRs to the default branch require all of the following to pass:

1. `lint`
2. `typecheck`
3. `unit tests` (no network / no exchange)
4. `build`
5. `release:check`
6. `integration tests (read-only)` (GET-only Coinbase access)

Merge policy:

- PR required for normal merges
- required status checks must pass
- branch must be up to date before merge
- squash merge only
- auto-delete branch after merge

## Safety Model (Defense in Depth)

### Layer 1: Test Partitioning

Separate tests into explicit tiers:

- Unit tests: default suite, no network/exchange calls allowed.
- Integration tests: separate folder/pattern, opt-in in CI only.

Suggested structure:

- `test/src/**` for unit tests (current pattern)
- `test/integration/**` for live read-only tests

### Layer 2: Runtime HTTP Guardrail

Add a guard in Coinbase HTTP client layer (single choke point):

- Enabled when `CI_INTEGRATION_READONLY=true`
- Hard fail any non-`GET` request
- Optional: host allowlist + path allowlist for extra control

This ensures a mistaken test cannot place/cancel/edit orders in CI.

### Layer 3: Key Scoping

Use a dedicated Coinbase API key with read-only permissions only:

- No trade/write permissions
- No transfer/withdraw permissions
- Separate from any developer/local keys
- Rotated periodically

### Layer 4: CI Environment Isolation

Use a dedicated GitHub Environment (e.g. `ci-integration-readonly`) containing secrets:

- `COINBASE_API_KEY`
- `COINBASE_API_SECRET`
- any required passphrase/metadata

Require environment-scoped access from integration job only.

## Proposed npm Scripts

Keep current behavior safe by default:

- `test` -> unit tests only
- `test:unit` -> explicit alias for unit tests
- `test:integration` -> integration suite only
- `ci:pr` -> `lint && typecheck && test:unit && build && release:check`

Integration can run as its own CI job (recommended) so failures are clearly isolated.

## Proposed GitHub Actions Layout

## Workflow Trigger

- `pull_request` to default branch (currently `master`)

## Jobs

1. `validate`
   - checkout
   - setup node + cache
   - `npm ci`
   - fixture env setup (if still needed)
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test:unit`
   - `npm run build`
   - `npm run release:check`

2. `integration-readonly`
   - needs: `validate`
   - runs in environment `ci-integration-readonly`
   - sets `CI_INTEGRATION_READONLY=true`
   - runs `npm run test:integration`

Optional:

- concurrency cancellation for superseded PR runs
- path filters if integration tests should only run when relevant files change

## Branch Protection Configuration

For the default branch (`master` today):

- Require a pull request before merging
- Require status checks to pass:
  - `validate`
  - `integration-readonly`
- Require branches to be up to date before merging
- Restrict merge methods to squash only
- Optionally require 1+ approvals

## Rollout Plan

### Phase 1: Safety + Structure

1. Add integration test folder/pattern and `test:integration` script.
2. Add HTTP method guardrail (`GET`-only in readonly CI mode).
3. Keep integration workflow non-blocking initially (informational).

### Phase 2: Stabilize

1. Add a minimal set of reliable read-only integration tests.
2. Fix flakes/timeouts/retries.
3. Ensure logs are clean and secrets are never echoed.

### Phase 3: Enforce

1. Make `integration-readonly` a required status check.
2. Enable strict branch protection and squash-only merge policy.
3. Document emergency hotpatch process (admin bypass + follow-up PR).

## Minimal Integration Test Scope (Recommended)

Start with safe, useful endpoints only:

- product info
- open order reads
- single order read
- account read endpoints (if needed)

Avoid broad, high-latency coverage initially; expand gradually.

## Emergency Hotpatch Policy (Pragmatic Exception)

Because urgent hotpatches are sometimes necessary:

- Keep an explicit admin override path for direct patching.
- Require a follow-up PR that re-runs and restores full CI guarantees.
- Tag these events in commit/PR notes for traceability.

## Acceptance Criteria

This plan is complete when:

1. PRs cannot merge without all required checks passing.
2. Integration tests run with read-only credentials only.
3. CI blocks non-GET Coinbase requests at runtime.
4. Unit/default tests still guarantee no exchange/network calls.
5. Team docs clearly describe normal path vs hotpatch exception.
