# CLEANUP_ARTIFACTS.md — Workflow Artifact Cleanup Script

Run `scripts/cleanup_artifacts.sh` to remove old workflow execution artifacts
(logs, metrics, backlog reports, AI cache files) and free disk space.

## Usage

```bash
./scripts/cleanup_artifacts.sh [OPTIONS]
```

### Options

| Option              | Description                                                   |
| ------------------- | ------------------------------------------------------------- |
| `--all`             | Remove all artifact types                                     |
| `--logs`            | Remove log files only                                         |
| `--metrics`         | Remove metrics files only                                     |
| `--backlog`         | Remove backlog reports only                                   |
| `--cache`           | Remove AI cache files only                                    |
| `--older-than DAYS` | Restrict removal to artifacts older than N days (default: 30) |
| `--dry-run`         | Preview what would be deleted without deleting                |
| `--yes`             | Skip confirmation prompts                                     |
| `-h, --help`        | Show help                                                     |

## Examples

```bash
# Remove all artifacts older than 7 days (with confirmation)
./scripts/cleanup_artifacts.sh --all --older-than 7

# Preview log cleanup without deleting
./scripts/cleanup_artifacts.sh --logs --dry-run

# Remove metrics files without prompting
./scripts/cleanup_artifacts.sh --metrics --yes
```

## What gets cleaned

| Flag        | Target path             |
| ----------- | ----------------------- |
| `--logs`    | `.ai_workflow/logs/`    |
| `--metrics` | `.ai_workflow/metrics/` |
| `--backlog` | `.ai_workflow/backlog/` |
| `--cache`   | `.ai_workflow/cache/`   |

## Exit codes

| Code | Meaning                                 |
| ---- | --------------------------------------- |
| `0`  | Cleanup completed (or dry-run finished) |
| `1`  | Error during cleanup                    |

## See also

- [`VALIDATE.md`](./VALIDATE.md) — full validation pipeline
- [`.ai_workflow/` directory](../../.ai_workflow/) — artifact storage root
