# Integration Test Runner

**Script:** `scripts/test-integration.sh`
**Last Updated:** 2026-03-03

## Overview

Runs integration tests, generates coverage reports, and validates coverage thresholds.

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Dependencies installed (`./scripts/setup.sh`)

## Usage

```bash
./scripts/test-integration.sh [--coverage] [--verbose]
```

## Permissions

```bash
chmod +x scripts/test-integration.sh
```

## Options

| Option      | Description                        |
| ----------- | ---------------------------------- |
| `--coverage` | Generate code coverage report     |
| `--verbose`  | Show detailed test output          |
| `--help`     | Show usage information             |

## Examples

```bash
# Run integration tests
./scripts/test-integration.sh

# Run with coverage report
./scripts/test-integration.sh --coverage

# Run with verbose output
./scripts/test-integration.sh --verbose

# Run with coverage and verbose
./scripts/test-integration.sh --coverage --verbose
```

## Output

- Pass/fail summary for each test suite
- Total tests: passed, failed, skipped counts
- Coverage report written to `coverage/` directory (when `--coverage` used)
- Warning if skipped tests are detected

## Exit Codes

| Code | Meaning |
| ---- | ------- |
| `0`  | All tests passed |
| `1`  | One or more tests failed or unknown option |

## CI/CD Integration

```yaml
# GitHub Actions example
- name: Run integration tests
  run: ./scripts/test-integration.sh --coverage
```

## Troubleshooting

- **Tests fail unexpectedly**: Run with `--verbose` to see detailed output.
- **Coverage report missing**: Ensure `--coverage` flag is passed and `jest` is configured with `coverageDirectory`.
- **Permission denied**: Run `chmod +x scripts/test-integration.sh`.

## Related

- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Full testing documentation
- [VALIDATE.md](./VALIDATE.md) - Full validation pipeline
