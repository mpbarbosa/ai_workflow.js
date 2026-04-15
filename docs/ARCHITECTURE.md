# Architecture Overview: ai_workflow.js

`ai_workflow.js` is a Node.js automation project for AI-assisted software
workflow execution. The repository is organized around a layered CLI and
orchestration architecture, with supporting documentation, scripts, and
workflow artifacts kept alongside the source.

## Main layers

- **CLI** - command entry points, help output, prompts, and the Ink-based TUI
- **Orchestrator** - workflow engine, dependency resolution, execution flow, and checkpoints
- **Library modules** - config, git, AI integration, analysis, caching, and helpers
- **Core and utils** - low-level logging, colors, execution, versioning, and shared errors

## Repository structure

| Path | Purpose |
| --- | --- |
| `src/core/` | Foundational runtime helpers such as logging, colors, system, executor, and version utilities. |
| `src/utils/` | Small shared helpers and error types. |
| `src/lib/` | Main business logic: config, AI helpers, caching, git automation, parsing, and analysis. |
| `src/orchestrator/` | Workflow engine and orchestration primitives. |
| `src/steps/` | Individual workflow-step implementations. |
| `src/cli/` | CLI commands, prompt handling, output helpers, and TUI components. |
| `scripts/` | Developer automation scripts for setup, validation, testing, release preparation, and maintenance. |
| `test/` | Unit, integration, fixture, and step-level coverage that mirrors the source layout. |
| `docs/architecture/` | Detailed architecture references, including design principles and dependency graphs. |
| `.workflow_core/` | Shared workflow templates and helper configuration maintained as a submodule. |
| `.workflow_fspec/` | Functional specification submodule. |
| `.ai_workflow/` | Runtime artifacts such as logs, checkpoints, metrics, cache, and summaries. |

## Runtime artifact directories

The repository also creates several gitignored working directories during local
development and test runs:

- `.ai_workflow/` - workflow outputs, logs, summaries, metrics, and cache
- `.test-cache/` - Jest transform and module cache
- `.test-e2e/` - temporary end-to-end test work directories
- `.test-step-11-5/` - isolated fixtures for step 11.5 tests
- `coverage/` - generated Jest coverage output

## Detailed references

- [Architecture Overview](./architecture/OVERVIEW.md)
- [Design Principles](./architecture/DESIGN_PRINCIPLES.md)
- [Dependency Graph](./architecture/DEPENDENCY_GRAPH.md)
- [Workflow Engine Requirements](./WORKFLOW_ENGINE_REQUIREMENTS.md)
