# Contributing to Shadowing Space

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. Fork the repository and clone your fork
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and configure as needed
4. Start the dev server: `npm run dev`

## Test-Driven Development (TDD)

All new features and bug fixes **must** follow TDD:

1. **Red** — Write a failing test that describes the expected behavior
2. **Green** — Write the minimum code to make the test pass
3. **Refactor** — Clean up while keeping tests green

- Tests live in `tests/` mirroring `src/` structure — e.g. `src/server/foo.ts` → `tests/server/foo.test.ts`, `src/lib/bar.ts` → `tests/lib/bar.test.ts`, `src/components/baz.ts` → `tests/components/baz.test.ts`. Scripts under `scripts/` test into `tests/scripts/`.
- Every new test case **must** be registered in `tests/catalog.yaml` with an owner, validity, and review date. The runner flags uncataloged or overdue entries.
- Prefer extracting logic into pure functions that Node's built-in `node:test` runner can exercise — component-only behavior is hard to cover with our current setup.
- Run `npm test` to verify before committing.

## Submitting Changes

1. Create a feature branch from `main`: `git checkout -b feat/my-feature`
2. Make your changes following TDD
3. If you add, remove, or rename any i18n key, update **all** locales under `messages/` — the `i18n:check` gate compares them to `en.json`.
4. Run the full check suite before submitting:
   ```bash
   npm run ci:local
   ```
   This covers type-checking, linting, formatting, i18n alignment, tests, and a production build.
5. Open a pull request against `main`

## Guidelines

- **TypeScript only** - no plain JavaScript files
- **One feature per PR** - keep pull requests focused and reviewable
- **Write tests first** - follow TDD; add tests for new server-side logic under `tests/`
- **Commit messages** - use clear, descriptive messages (e.g. `fix: handle missing transcript fallback`)

## Reporting Bugs

When opening a bug report, please include:

- Steps to reproduce
- Expected vs actual behavior
- Browser and OS (if relevant)
- Any error messages from the browser console or server logs
