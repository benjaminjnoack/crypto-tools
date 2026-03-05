# AGENTS.md

## Top Priority Safety Rule

- Never make live calls to Coinbase/exchange endpoints.
- Never run commands, scripts, tests, or binaries that could place/cancel/modify/fetch live exchange orders or account data.
- Treat this as a hard stop rule for all development work, debugging, and validation.
- If a requested action could hit the exchange, stop and require an explicit safe alternative (mock/fixture/stub/offline-only path).

## Engineering Quality Standard

- Implement changes as idiomatically as possible for the language/runtime/tooling in use.
- Default to established best practices for readability, maintainability, correctness, and testability.
- Treat this repository as both production tooling and interview/demo material: code should be clean, coherent, and easy to reason about at a glance.
- Prefer simple, explicit designs over clever shortcuts, and leave code in a better state after each change.

## Required Validation Workflow

For code changes, run these checks unless the task is docs-only:

1. `npm run typecheck`
2. `npm run lint` (or targeted `npx eslint ...` during iteration, then full lint when practical)
3. `npm run test` (or targeted `npm test -- <files>` during iteration, then broader test run for affected area)

Report what was run and what was not run.

## Safe Execution Rules

- Prefer unit/integration tests that mock network boundaries.
- Keep `test/setup/no-network.ts` active and do not bypass it.
- Do not run ad-hoc scripts that invoke live Coinbase REST helpers.
- Do not run `cb`/`hdb` commands against real credentials.
- If CLI behavior must be verified, use parser-level tests and mocked handlers.

## Architecture Guidance (cb)

- Current preferred layout:
  - command intent in `src/apps/cb/commands/`
  - deterministic order logic in `src/apps/cb/service/order-builders.ts`
  - CLI prompt/output interaction in `src/apps/cb/service/order-prompts.ts`
  - orchestration in `src/apps/cb/service/order-service.ts`
  - order transport in `src/shared/coinbase/orders-client.ts`
  - low-level HTTP/signing in `src/shared/coinbase/rest.ts`
- This layout is guidance, not a hard constraint.
- Architectural improvements are encouraged when they simplify the codebase or improve correctness/testability.
- If changing architecture, update tests and docs in the same change.

## Command Topology (cb)

Use nested order commands only:

- `cb order get <order_id>`
- `cb order list [product]`
- `cb order cancel <order_id>`
- `cb order modify <order_id> [--baseSize ...] [--limitPrice ...] [--stopPrice ...]`

Do not reintroduce legacy root aliases without explicit request.

## Command Registration Conventions

In `src/apps/cb/commands/register/`:

- Use `withAction(commandName, parser, handler)` from `register/register-utils.ts`.
- Use parser helpers (`parseArg`, `parseArgOptions`, `parseProductId`, `parseProductIdOptions`, etc.).
- Prefer parser composition over adding one-off wrapper helpers.

## Testing Conventions

- Prefer shared typed fixtures over large inline objects.
- Use `test/src/fixtures/coinbase-orders.ts` for Coinbase order payloads.
- Expand fixture factories before duplicating order literals in tests.
- When refactoring, preserve behavior and update/extend tests in the same change.

## Change Management

- Keep changes scoped and incremental.
- Avoid unrelated refactors in feature/fix PRs.
- Architecture is allowed to evolve; do not treat current module boundaries as immutable.
- Document new architectural decisions in:
  - `src/apps/cb/README.md`
  - `CONTRIBUTING.md`
  - this `AGENTS.md` (when agent workflow/policy changes)

## If Blocked

- If safety constraints conflict with a request, explain the conflict briefly and propose an offline-safe path (mocks, fixtures, parser tests, or dry-run logic).
