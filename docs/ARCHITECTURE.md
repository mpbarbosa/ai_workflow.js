# Architecture Overview

**Version:** 2.2.17
**Last Updated:** April 27, 2026

This document gives the high-level architecture for `ai_workflow.js`. The
current repository is organized around stable source layers rather than the old
phase-based module map.

## Main layers

| Layer        | Path                | Responsibility                                                                                               |
| ------------ | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| CLI          | `src/cli/`          | Command entry points, prompts, help output, and Ink-based TUI code                                           |
| Orchestrator | `src/orchestrator/` | Workflow engine, dependency resolution, step scheduling, and checkpoints                                     |
| Steps        | `src/steps/`        | Executable workflow-step implementations invoked by the orchestrator                                         |
| Library      | `src/lib/`          | Reusable domain logic such as config loading, git automation, AI integration, caching, parsing, and analysis |
| Core         | `src/core/`         | Foundational runtime helpers such as logging, execution, colors, system detection, and version helpers       |
| Utils        | `src/utils/`        | Shared low-level helpers and error types                                                                     |

## Data flow

```text
CLI commands / TUI
        |
        v
WorkflowEngine + orchestrator helpers
        |
        v
Step execution (src/steps/)
        |
        v
Library modules (config, git, AI, cache, parsing, analysis)
        |
        v
Core + utils + Node.js platform APIs
```

## Repository surfaces around the source tree

| Path                    | Purpose                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| `bin/ai-workflow.js`    | Published CLI executable                                                   |
| `src/index.js`          | Public API barrel                                                          |
| `.workflow-config.yaml` | Project-local workflow configuration                                       |
| `.workflow_core/`       | Shared workflow templates and helper assets                                |
| `.workflow_fspec/`      | Functional specification submodule                                         |
| `.ai_workflow/`         | Runtime artifacts such as logs, checkpoints, metrics, cache, and summaries |
| `docs/`                 | User-facing guides, architecture references, API docs, and reports         |

## Design rules

- Keep business logic in pure functions where practical.
- Keep filesystem, process, network, and environment access at layer boundaries.
- Prefer reusing helpers inside the owning layer over reaching across layers.
- Keep user-facing docs aligned with real behavior and exported entry points.

## Related documents

- [Detailed repository overview](./architecture/OVERVIEW.md)
- [Dependency graph and dependency rules](./architecture/DEPENDENCY_GRAPH.md)
- [CLI usage guide](./CLI_USAGE_GUIDE.md)
- [Migration guide](./guides/MIGRATION_GUIDE.md)
