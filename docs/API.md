# API Reference: ai_workflow_core

This document provides an overview of the public API for ai_workflow_core. For detailed module and function documentation, see `docs/api/`.

## Modules

- `src/core/` — Foundation utilities
- `src/lib/` — Core libraries
- `src/orchestrator/` — Workflow orchestration
- `src/cli/` — CLI commands

## Example Usage

```js
import { WorkflowEngine } from './src/orchestrator/workflow_engine.js';
const engine = new WorkflowEngine();
engine.run();
```

## For full API details, see the JSDoc in each module and `docs/api/`
