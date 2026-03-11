# Development Environment Setup

**Script:** `scripts/setup.sh`
**Last Updated:** 2026-03-03

## Overview

Sets up the development environment for ai_workflow.js. Installs dependencies, initializes submodules, and creates required directories.

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- git (required for submodule initialization)

## Usage

```bash
./scripts/setup.sh
```

## Permissions

```bash
chmod +x scripts/setup.sh
```

## What It Does

1. Installs npm dependencies (`npm install`)
2. Initializes and updates git submodules (`.workflow_core/`)
3. Creates `.ai_workflow/` artifact directories (logs, metrics, backlog, summaries, checkpoints, prompts)
4. Updates `.gitignore` with required entries

## Output

Colored status messages indicating success (✓), warnings (⚠), or errors (✗) for each step.

## Exit Codes

| Code | Meaning |
| ---- | ------- |
| `0`  | Success |
| `1`  | Error (missing dependency, failed install, permission issue) |

## Integration

Run once after cloning the repository, or again after pulling changes that add new submodules or directories.

```bash
# After first clone
git clone <repo-url> && cd ai_workflow.js
./scripts/setup.sh

# After pulling changes
git pull && ./scripts/setup.sh
```

## Troubleshooting

- **npm install fails**: Ensure Node.js >= 18.0.0 and npm >= 9.0.0 are installed.
- **Submodule init fails**: Ensure git is installed and you have network access.
- **Permission denied**: Run `chmod +x scripts/setup.sh` before executing.

## Related

- [CONTRIBUTING.md](../../CONTRIBUTING.md) - Development workflow
- [CLEANUP_ARTIFACTS.md](./CLEANUP_ARTIFACTS.md) - Cleaning up workflow artifacts
