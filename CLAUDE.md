# Development Strategy

## TDD (Test-Driven Development)

All new features and bug fixes MUST follow Test-Driven Development:

1. **Red** — Write a failing test first that describes the expected behavior
2. **Green** — Write the minimum code to make the test pass
3. **Refactor** — Clean up while keeping tests green

- Never write implementation code without a corresponding failing test already in place
- Tests go in `tests/` mirroring `src/` structure (e.g., `src/server/foo.ts` → `tests/server/foo.test.ts`)
- New tests must be added to `tests/catalog.yaml`
- Run `npm test` to verify before committing
- After each completed phase or milestone, create a focused git commit before starting the next phase
