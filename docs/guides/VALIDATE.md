# VALIDATE.md — Full Validation Pipeline

Run `scripts/validate.sh` to execute the complete validation pipeline: linting,
markdown checks, formatting, tests, and version consistency — all in one command.

## Usage

```bash
./scripts/validate.sh [OPTIONS]
```

### Options

| Option         | Description                                             |
| -------------- | ------------------------------------------------------- |
| `--fix`        | Auto-fix lint and formatting violations before checking |
| `--skip-tests` | Run lint and format checks only; skip the test suite    |

## What it does

1. **Lint** — runs `npm run lint` (ESLint)
2. **Markdown lint** — runs `npm run lint:md`
3. **Format check** — runs `npm run format:check` (Prettier)
4. **Tests** — runs `npm test`
5. **Version consistency** — runs `npm run validate:versions`

## Examples

```bash
# Full validation (default)
./scripts/validate.sh

# Auto-fix issues, then validate
./scripts/validate.sh --fix

# Lint and format only (no tests)
./scripts/validate.sh --skip-tests
```

## Exit codes

| Code | Meaning                   |
| ---- | ------------------------- |
| `0`  | All checks passed         |
| `1`  | One or more checks failed |

## See also

- [`PREPARE_RELEASE.md`](./PREPARE_RELEASE.md) — prepare a versioned release
- [`TEST_INTEGRATION.md`](./TEST_INTEGRATION.md) — run integration tests
