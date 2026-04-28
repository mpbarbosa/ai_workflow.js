## CONTRIBUTING

# Contributing to ai_workflow.js

Thanks for contributing.

## Getting Started

- Fork the repository and clone your fork.
- Install dependencies with `npm install`.
- Validate substantive changes with:
  - `npm run lint`
  - `npm test`
  - `npm run build`

## Code Style

- Follow the existing module boundaries:
  - `src/cli/` for commands, prompts, and TUI code
  - `src/orchestrator/` for workflow execution
  - `src/lib/` for reusable domain logic
  - `src/core/` and `src/utils/` for low-level helpers
- Prefer small, focused changes over broad rewrites.
- Keep user-facing behavior in sync with `README.md` and `docs/CLI_USAGE_GUIDE.md`.

## Pull Requests

- Reference related issues in the PR description when applicable.
- Include tests for behavior changes.
- Update directly affected documentation.

## Documentation

- Keep architecture changes aligned across:
  - `docs/ARCHITECTURE.md`
  - `docs/architecture/OVERVIEW.md`
  - `docs/architecture/DEPENDENCY_GRAPH.md`
- Prefer linking to authoritative docs instead of duplicating large inventories.

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Questions

Open an issue or discussion if you need help.
