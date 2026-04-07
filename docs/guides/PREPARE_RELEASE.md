# PREPARE_RELEASE.md — Release Preparation Script

Run `scripts/prepare-release.sh` to prepare a versioned release: it validates
the version format, runs all tests, bumps `package.json`, runs security audits,
and generates a changelog entry.

## Usage

```bash
./scripts/prepare-release.sh [VERSION]
```

- `VERSION` — target version in `x.y.z` format (e.g. `1.10.0`). If omitted,
  the script prompts for it.

## What it does

1. **Validates** the version string format
2. **Runs all tests** — `npm test`
3. **Updates** `version` in `package.json`
4. **Validates exports and versions** — `npm run validate`
5. **Security audit** — `npm audit --audit-level=moderate`
6. **Generates** a changelog entry in `CHANGELOG.md`

## Examples

```bash
# Prepare a patch release
./scripts/prepare-release.sh 1.9.8

# Interactive mode (prompts for version)
./scripts/prepare-release.sh
```

## Exit codes

| Code | Meaning                            |
| ---- | ---------------------------------- |
| `0`  | Release prepared successfully      |
| `1`  | Validation, test, or audit failure |

## See also

- [`VALIDATE.md`](./VALIDATE.md) — full validation pipeline
- [`CHANGELOG.md`](../../CHANGELOG.md) — version history
