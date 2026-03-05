# Contributing to Shadowing Space

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. Fork the repository and clone your fork
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and configure as needed
4. Start the dev server: `npm run dev`

## Submitting Changes

1. Create a feature branch from `main`: `git checkout -b feat/my-feature`
2. Make your changes
3. Run checks before submitting:
   ```bash
   npm run typecheck
   npm run test
   npm run build
   ```
4. Open a pull request against `main`

## Guidelines

- **TypeScript only** - no plain JavaScript files
- **One feature per PR** - keep pull requests focused and reviewable
- **Run checks** - ensure `typecheck`, `test`, and `build` all pass before submitting
- **Write tests** - add tests for new server-side logic under `tests/`
- **Commit messages** - use clear, descriptive messages (e.g. `fix: handle missing transcript fallback`)

## Reporting Bugs

When opening a bug report, please include:

- Steps to reproduce
- Expected vs actual behavior
- Browser and OS (if relevant)
- Any error messages from the browser console or server logs
