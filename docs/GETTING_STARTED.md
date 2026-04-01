# Getting Started with ai_workflow_core

Welcome to **ai_workflow_core**! This guide will help you install, configure, and run your first workflow.

## Prerequisites

- Node.js >= 20.0.0
- npm >= 9.0.0

## Installation

```bash
npm install
```

## Quick Start

1. Copy the config template:
   ```bash
   cp .workflow_core/config/.workflow-config.yaml.template .workflow-config.yaml
   ```
2. Create artifact directories:
   ```bash
   mkdir -p .ai_workflow/{backlog,summaries,logs,metrics,checkpoints,prompts,ml_models,.incremental_cache}
   ```
3. Run the workflow:
   ```bash
   npm run workflow
   ```

## Project Structure

- `src/` — Source code modules
- `test/` — Test suite
- `docs/` — Documentation
- `.ai_workflow/` — Workflow artifacts

See [docs/guides/USER_GUIDE.md] for more details.
