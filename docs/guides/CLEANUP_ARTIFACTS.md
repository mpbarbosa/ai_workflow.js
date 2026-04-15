# Cleanup Artifacts Guide

Use `scripts/cleanup_artifacts.sh` to remove old workflow artifacts from the
repository.

## What it cleans

- logs
- metrics
- backlog reports
- cache files

## Usage

```bash
bash scripts/cleanup_artifacts.sh --logs --dry-run
bash scripts/cleanup_artifacts.sh --all --older-than 7 --yes
```

## Options

| Option | Meaning |
| --- | --- |
| `--all` | Enable all cleanup targets. |
| `--logs` | Remove log files only. |
| `--metrics` | Remove metrics files only. |
| `--backlog` | Remove backlog reports only. |
| `--cache` | Remove cache files only. |
| `--older-than DAYS` | Limit deletion to artifacts older than the given age. |
| `--dry-run` | Show what would be deleted without removing anything. |
| `--yes` | Skip confirmation prompts. |
| `--help` | Show the built-in help text. |

## Related docs

- [Scripts Reference](../../scripts/README.md)
- [Architecture Overview](../ARCHITECTURE.md)
