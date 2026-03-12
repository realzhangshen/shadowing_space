# Testing Strategy and Governance

## Directory Layout

- `tests/server/**`: main test suite (gating path).
- `tests/diagnostics/**`: diagnostic/manual tests (non-gating by default).
- `tests/catalog.yaml`: test case registry for ownership and lifecycle review.

## Commands

- `npm run test`: run main suite and generate status artifacts.
- `npm run test:all`: run main + diagnostics and generate status artifacts.
- `npm run test:status`: same as `npm run test`.
- `npm run test:catalog`: validate catalog coverage; fails if any discovered test is uncataloged.

## Generated Reports

- `reports/tests/latest.json`: machine-readable latest report.
- `reports/tests/latest.md`: human-readable summary.
- `reports/tests/history/<timestamp>.json`: immutable snapshot for each run.

`latest.json` includes:

- `summary`: total/pass/fail/skip counts.
- `cases`: per-test status with governance metadata.
- `diff.newFailures`: tests that became failing since previous `latest.json`.
- `diff.resolved`: tests that were failing previously and now pass.
- `diff.newSkips`: tests that became skipped since previous `latest.json`.
- `governance.uncataloged`: discovered tests missing from `catalog.yaml`.
- `governance.outdatedCandidates`: entries explicitly marked `outdated-candidate`.
- `governance.reviewOverdue`: entries with `reviewBy` earlier than today.

## Catalog Schema (`tests/catalog.yaml`)

Each test case entry must include:

- `file`: test file path under `tests/`.
- `name`: exact `test("...")` case name.
- `category`: `unit | integration | diagnostic`.
- `validity`: `reasonable | needs-review | outdated-candidate | obsolete`.
- `owner`: accountable owner/team.
- `reason`: why the test exists.
- `lastReviewedOn`: `YYYY-MM-DD`.
- `reviewBy`: `YYYY-MM-DD`.

## Governance Rules

- Diagnostic entries should use `category: diagnostic` and `validity: needs-review`.
- Main suite excludes `tests/diagnostics/**` by default.
- `npm run test:catalog` enforces no uncataloged tests.
- Overdue review dates and outdated candidates are highlighted in generated reports.
