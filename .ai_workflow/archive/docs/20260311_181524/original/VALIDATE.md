# Full Validation Pipeline

**Script:** `scripts/validate.sh`
**Last Updated:** 2026-03-03

## Overview

Runs the complete validation pipeline: linting, formatting checks, tests, and version consistency validation. Use this before committing or opening a pull request.

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Dependencies installed (`./scripts/setup.sh`)

## Usage

```bash
./scripts/validate.sh [--fix] [--skip-tests]
```

## Permissions

```bash
chmod +x scripts/validate.sh
```

## Options

| Option          | Description                                       |
| --------------- | ------------------------------------------------- |
| `--fix`         | Auto-fix linting and formatting issues            |
| `--skip-tests`  | Skip running tests (faster validation)            |
| `--help`        | Show usage information                            |

## Examples

```bash
# Full validation
./scripts/validate.sh

# Validate and auto-fix issues
./scripts/validate.sh --fix

# Quick validation (skip tests)
./scripts/validate.sh --skip-tests

# Fix issues then skip tests
./scripts/validate.sh --fix --skip-tests
```

## Pipeline Steps

1. **ESLint** — checks code style (`npm run lint` or `npm run lint:fix` with `--fix`)
2. **Prettier** — checks formatting (`npm run format:check` or `npm run format` with `--fix`)
3. **Jest** — runs full test suite (`npm test`) — skipped with `--skip-tests`
4. **Version consistency** — validates version numbers across files

## Exit Codes

| Code | Meaning |
| ---- | ------- |
| `0`  | All checks passed |
| `1`  | One or more checks failed or unknown option |

## CI/CD Integration

```yaml
# GitHub Actions example
- name: Validate
  run: ./scripts/validate.sh
```

## Troubleshooting

- **Lint failures**: Run `./scripts/validate.sh --fix` to auto-fix, then review remaining errors.
- **Formatting failures**: Run `./scripts/validate.sh --fix` to auto-format.
- **Test failures**: Run `npm test` for full output; use `--skip-tests` to validate everything else first.
- **Permission denied**: Run `chmod +x scripts/validate.sh`.

## Related

- [TEST_INTEGRATION.md](./TEST_INTEGRATION.md) - Integration test runner
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Full testing documentation
- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - Development workflow
