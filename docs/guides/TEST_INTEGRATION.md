# Test Integration Guide

Use `scripts/test-integration.sh` when you want a shell wrapper around the
integration test flow.

## What it does

- runs the repository test suite
- optionally enables coverage reporting
- can print more detailed output with `--verbose`
- reports skipped-test counts after execution

## Usage

```bash
bash scripts/test-integration.sh
bash scripts/test-integration.sh --coverage
bash scripts/test-integration.sh --coverage --verbose
```

## Options

| Option | Meaning |
| --- | --- |
| `--coverage` | Generate coverage output alongside the run. |
| `--verbose` | Show detailed Jest output instead of the quieter mode. |
| `--help` | Show the built-in help text. |

## Related docs

- [Scripts Reference](../../scripts/README.md)
- [Testing Guide](./TESTING_GUIDE.md)
