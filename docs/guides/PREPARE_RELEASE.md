## PREPARE_RELEASE

# Release Preparation Guide

Use `scripts/prepare-release.sh` to run the repository's release-preparation
checks for a specific version.

## What it does

- validates the requested version string
- runs linting, tests, export validation, and version checks
- runs dependency and custom security audits
- updates `package.json` to the requested version
- creates a release commit and annotated git tag

## Usage

```bash
bash scripts/prepare-release.sh 2.5.0
```

## Notes

- the script prompts if the worktree is not clean
- it expects to run from a git checkout
- it creates a commit and tag as part of the flow

## Related docs

- [Scripts Reference](../../scripts/README.md)
- [CHANGELOG.md](../../CHANGELOG.md)
