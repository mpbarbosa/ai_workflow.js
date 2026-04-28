# Architecture Overview: ai_workflow.js

`ai_workflow.js` is a Node.js CLI package for AI-assisted workflow execution.
The repository uses a layered structure centered on CLI entry points,
orchestration, workflow steps, and reusable library modules.

## Main layers

- **CLI** - command entry points, help output, prompts, and the Ink-based TUI
- **Orchestrator** - workflow engine, dependency resolution, execution flow, and checkpoints
- **Steps** - individual workflow-step implementations executed by the orchestrator
- **Library modules** - config, git, AI integration, caching, parsing, and analysis
- **Core and utils** - low-level logging, execution, colors, versioning, and shared errors

## Repository structure

| Path                 | Purpose                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `src/core/`          | Foundational runtime helpers such as logging, colors, system, executor, and version utilities     |
| `src/utils/`         | Small shared helpers and error types                                                              |
| `src/lib/`           | Main reusable domain logic: config, AI helpers, caching, git automation, parsing, and analysis    |
| `src/orchestrator/`  | Workflow engine and orchestration primitives                                                      |
| `src/steps/`         | Individual workflow-step implementations                                                          |
| `src/cli/`           | CLI commands, prompt handling, output helpers, and TUI components                                 |
| `scripts/`           | Developer automation scripts for setup, validation, testing, release preparation, and maintenance |
| `test/`              | Unit, integration, fixture, and step-level coverage that mirrors the source layout                |
| `docs/architecture/` | Architecture references, including this overview and dependency rules                             |
| `.workflow_core/`    | Shared workflow templates and helper configuration maintained as a submodule                      |
| `.workflow_fspec/`   | Functional specification submodule                                                                |
| `.ai_workflow/`      | Runtime artifacts such as logs, checkpoints, metrics, cache, and summaries                        |

## Execution flow

```text
bin/ai-workflow.js
        |
        v
src/cli/
        |
        v
src/orchestrator/workflow_engine.js
        |
        v
src/steps/step_*.js
        |
        v
src/lib/ + src/core/ + src/utils/
```

## Notes on boundaries

- CLI code should keep user interaction concerns in `src/cli/`.
- The orchestrator owns workflow sequencing and checkpoint behavior.
- Steps are executable units, but reusable logic should live in `src/lib/`.
- Core and utils should stay low-level and broadly reusable.

## Related references

- [Top-level architecture summary](../ARCHITECTURE.md)
- [Dependency graph](./DEPENDENCY_GRAPH.md)
- [Design principles](./DESIGN_PRINCIPLES.md)
