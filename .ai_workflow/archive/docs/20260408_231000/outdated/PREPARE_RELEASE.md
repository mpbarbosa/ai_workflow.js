## PREPARE_RELEASE

## PREPARE_RELEASE

# Release Preparation

**Script:** `scripts/prepare-release.sh`
**Last Updated:** 2026-03-03

## Overview

Prepares the project for a versioned release. Validates the version format, runs the full test suite, updates `package.json`, validates exports and version consistency, runs a security audit, and generates a changelog entry.

## Prerequisites

- Node.js >= 20.0.0
- npm >= 9.0.0
- git (clean working tree required)
- Dependencies installed (`./scripts/setup.sh`)

## Usage

```bash
./scripts/prepare-release.sh <version>
```

## Permissions

```bash
chmod +x scripts/prepare-release.sh
```

## Arguments

| Argument  | Description                                         | Required |
| --------- | --------------------------------------------------- | -------- |
| `version` | Semantic version to release (e.g. `1.2.0`, `2.0.0-beta.1`) | Yes |

## Examples

```bash
# Prepare a patch release
./scripts/prepare-release.sh 1.2.1

# Prepare a minor release
./scripts/prepare-release.sh 1.3.0

# Prepare a pre-release
./scripts/prepare-release.sh 2.0.0-beta.1
```

## Release Pipeline Steps

1. **Validate version format** — must match `MAJOR.MINOR.PATCH[-prerelease]`
2. **Check git status** — working tree must be clean (no uncommitted changes)
3. **Run linting** — `npm run lint`
4. **Run tests** — `npm test`
5. **Validate exports** — `npm run validate:exports`
6. **Validate version consistency** — `npm run validate:versions`
7. **Security audit** — `npm audit`
8. **Update `package.json`** — sets the new version
9. **Generate changelog entry** — appends entry to `CHANGELOG.md`

## Exit Codes

| Code | Meaning |
| ---- | ------- |
| `0`  | Release preparation complete |
| `1`  | Validation failed (bad version, dirty git, test failure, etc.) |

## Environment Variables

None required. All configuration is derived from `package.json` and the version argument.

## CI/CD Integration

```yaml
# GitHub Actions release workflow example
- name: Prepare release
  run: ./scripts/prepare-release.sh ${{ github.event.inputs.version }}
```

## Troubleshooting

- **"Invalid version format"**: Use semver format — e.g. `1.2.3` or `1.2.3-beta.1`.
- **"Uncommitted changes"**: Commit or stash all changes before running.
- **Lint/test failure**: Fix errors reported by the pipeline, then re-run.
- **Security audit failure**: Review `npm audit` output and patch vulnerabilities.
- **Permission denied**: Run `chmod +x scripts/prepare-release.sh`.

## Related

- [VALIDATE.md](./VALIDATE.md) - Full validation pipeline
- [CHANGELOG.md](../../CHANGELOG.md) - Version history


---

## PREPARE_RELEASE

# Release Preparation

**Script:** `scripts/prepare-release.sh`
**Last Updated:** 2026-03-03

## Overview

Prepares the project for a versioned release. Validates the version format, runs the full test suite, updates `package.json`, validates exports and version consistency, runs a security audit, and generates a changelog entry.

## Prerequisites

- Node.js >= 20.0.0
- npm >= 9.0.0
- git (clean working tree required)
- Dependencies installed (`./scripts/setup.sh`)

## Usage

```bash
./scripts/prepare-release.sh <version>
```

## Permissions

```bash
chmod +x scripts/prepare-release.sh
```

## Arguments

| Argument  | Description                                         | Required |
| --------- | --------------------------------------------------- | -------- |
| `version` | Semantic version to release (e.g. `1.2.0`, `2.0.0-beta.1`) | Yes |

## Examples

```bash
# Prepare a patch release
./scripts/prepare-release.sh 1.2.1

# Prepare a minor release
./scripts/prepare-release.sh 1.3.0

# Prepare a pre-release
./scripts/prepare-release.sh 2.0.0-beta.1
```

## Release Pipeline Steps

1. **Validate version format** — must match `MAJOR.MINOR.PATCH[-prerelease]`
2. **Check git status** — working tree must be clean (no uncommitted changes)
3. **Run linting** — `npm run lint`
4. **Run tests** — `npm test`
5. **Validate exports** — `npm run validate:exports`
6. **Val

---

## PREPARE_RELEASE

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
./scripts/prepare-release.sh 1.9.10

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
