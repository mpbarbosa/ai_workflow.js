## VALIDATE

## VALIDATE

# Validation Guide

Use `scripts/validate.sh` for the repository validation pipeline.

## Usage

```bash
bash scripts/validate.sh
```

## What It Runs

- linting
- formatting checks
- tests
- version and export validation

## Related Docs

- [Validation Scripts](./VALIDATION_SCRIPTS.md)
- [Scripts Reference](../../scripts/README.md)


---

## VALIDATE

# Validation Guide

Use `scripts/validate.sh` for the repository validation pipeline.

## Usage

```bash
bash scripts/validate.sh
```

## What It Runs

- linting
- formatting checks
- tests
- version and export validation

## Related Docs

- [Validation Scripts](./VALIDATION_SCRIPTS.md)
- [Scripts Reference](../../scripts/README.md)


---

## VALIDATE

# Validate Guide

Use `scripts/validate.sh` to run the shell-based validation pipeline for the
repository.

## What it does

- runs ESLint
- checks formatting, or fixes it when `--fix` is passed
- validates version consistency
- validates public exports
- runs the Jest test suite unless `--skip-tests` is used

## Usage

```bash
bash scripts/validate.sh
bash scripts/validate.sh --fix
bash scripts/validate.sh --skip-tests
```

## Options

| Option | Meaning |
| --- | --- |
| `--fix` | Apply linting and formatting fixes where the script supports them. |
| `--skip-tests` | Skip the test run for a faster validation pass. |
| `--help` | Show the built-in help text. |

## Related docs

- [Scripts Reference](../../scripts/README.md)
- [Validation Scripts](./VALIDATION_SCRIPTS.md)
