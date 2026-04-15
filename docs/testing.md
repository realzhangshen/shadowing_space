# Testing Strategy and Governance

This document describes the current test workflow implemented by `scripts/tests/status.ts`.

## Directory Layout

- `tests/**/*.test.ts`: all test files discovered by the status runner.
- `tests/app/**`: route-handler and app-layer tests.
- `tests/features/**`: feature-level logic tests.
- `tests/server/**`: server and YouTube integration tests.
- `tests/diagnostics/**`: opt-in diagnostic/manual tests that are excluded from the default run.
- `tests/catalog.yaml`: registry for ownership, validity, and review cadence.

Only `tests/diagnostics/**` is non-gating by default. Everything else under `tests/**/*.test.ts` is part of the main suite.

## Commands

- `npm run test`: run the main suite, then write local status reports.
- `npm run test:status`: same as `npm run test`.
- `npm run test:all`: run the main suite plus `tests/diagnostics/**`.
- `npm run test:catalog`: validate catalog coverage only; it fails on uncataloged tests or duplicate catalog entries.

## Report Outputs

Every `npm run test` / `test:status` / `test:all` run writes local artifacts under `reports/tests/`.
These files are generated, gitignored, and can be deleted safely.

- `reports/tests/latest.json`: latest machine-readable report.
- `reports/tests/latest.md`: latest human-readable summary.
- `reports/tests/history/<timestamp>.json`: immutable snapshot for that run.

`latest.json` includes:

- `summary`: total/pass/fail/skip counts.
- `cases`: per-test runtime status plus catalog metadata when available.
- `diff.newFailures`: tests that were not failing in the previous local `latest.json` and now fail.
- `diff.resolved`: tests that failed previously and now pass.
- `diff.newSkips`: tests that were not skipped previously and now are skipped.
- `governance.uncataloged`: discovered tests missing from `tests/catalog.yaml`.
- `governance.outdatedCandidates`: catalog entries marked `outdated-candidate`.
- `governance.reviewOverdue`: catalog entries whose `reviewBy` date is earlier than today.
- `governance.catalogOrphans`: catalog entries that no longer match a discovered test.
- `governance.duplicateCatalogEntries`: duplicate `file + name` catalog entries.
- `governance.diagnosticPolicyViolations`: diagnostic entries whose validity is not `needs-review`.
- `parseErrors`: test files whose TAP output could not be parsed correctly.

## Catalog Schema

Each `tests/catalog.yaml` entry must include:

- `file`: path to the test file under `tests/`.
- `name`: exact `test("...")` case name discovered from source.
- `category`: `unit | integration | diagnostic`.
- `validity`: `reasonable | needs-review | outdated-candidate | obsolete`.
- `owner`: accountable owner or team.
- `reason`: why the test exists.
- `lastReviewedOn`: `YYYY-MM-DD`.
- `reviewBy`: `YYYY-MM-DD`.

## Exit Conditions

- `npm run test` fails when any executed test fails.
- `npm run test` also fails when the reporter hits parse errors or when duplicate catalog entries exist.
- `npm run test:catalog` fails when there are uncataloged tests or duplicate catalog entries.
- Overdue review dates, outdated candidates, catalog orphans, and diagnostic policy violations are reported, but do not fail the run by themselves.

## Update Checklist

- Add new tests under `tests/` using the same feature/server/app structure when possible.
- Add every new `test("...")` case to `tests/catalog.yaml`.
- Prefer `tests/diagnostics/**` only for manual or troubleshooting-only coverage.
- Run `npm run test` before committing.
