# Test Fixtures

This directory contains self-contained sample projects used as test fixtures
for integration and end-to-end tests throughout the `ai_workflow.js` test suite.

## Structure

```text
test/fixtures/
└── nodejs-api/          # Minimal Node.js REST API fixture project
    ├── src/             # Express application source
    ├── test/            # Jest test files for the fixture itself
    ├── package.json     # Fixture project manifest
    └── README.md        # Fixture-specific documentation
```

## nodejs-api

A minimal Express-based Node.js REST API project (`fixture-nodejs-api`).
It is used by:

- **Step integration tests** (`test/steps/`) — exercises project-kind
  detection, dependency validation, and workflow step logic against a
  realistic JavaScript project structure.
- **End-to-end tests** (`test/e2e/`) — provides a known-good project for
  full workflow smoke tests and artifact-output assertions.
- **CLI integration tests** (`test/integration/cli/`) — `resume` and
  `status-clean` integration tests point the CLI at this fixture to verify
  command behaviour.
- **Helper utilities** (`test/helpers/integration.js`) — exposes the
  fixture path as a shared constant for other test helpers.

## Adding a new fixture

1. Create a subdirectory under `test/fixtures/` with a descriptive name
   (e.g., `python-cli/`).
2. Add a minimal but realistic project matching the language or framework
   you need to exercise (e.g., `package.json`, `requirements.txt`,
   entry-point sources).
3. Add a `README.md` inside the new fixture directory describing its purpose
   and which tests use it.
4. Update this file to list the new fixture under **Structure** and describe
   when it is used.
