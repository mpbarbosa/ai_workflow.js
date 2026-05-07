# Dependency Graph

**Version:** 2.3.2
**Last Updated:** 2026-04-27
**Audience:** Architects, Developers

This document describes the current dependency direction for `ai_workflow.js`.
The repository no longer uses the old phase-based dependency map; the active
architecture is layer-based.

## Layer graph

```text
CLI (src/cli/)
  |
  +--> Orchestrator (src/orchestrator/)
  |       |
  |       +--> Steps (src/steps/)
  |               |
  |               +--> Library modules (src/lib/)
  |
  +--> Library modules (src/lib/) for command-specific helpers
          |
          +--> Core (src/core/)
          +--> Utils (src/utils/)
          +--> Node.js built-ins / package dependencies
```

## Dependency rules

### Allowed

- `src/cli/` -> `src/orchestrator/`, `src/lib/`, `src/core/`, `src/utils/`
- `src/orchestrator/` -> `src/steps/`, `src/lib/`, `src/core/`, `src/utils/`
- `src/steps/` -> `src/lib/`, `src/core/`, `src/utils/`
- `src/lib/` -> `src/core/`, `src/utils/`
- `src/core/` -> `src/utils/` when the dependency stays low-level

### Avoid

- `src/core/` depending on `src/lib/`, `src/orchestrator/`, `src/steps/`, or `src/cli/`
- `src/utils/` depending on higher-level business logic
- Step-specific logic being copied into CLI or orchestrator layers instead of shared through `src/lib/`
- Cross-layer shortcuts that bypass the orchestrator for workflow sequencing concerns

## Practical reading guide

When tracing behavior:

1. Start at `bin/ai-workflow.js` or the matching command under `src/cli/`.
2. Follow orchestration through `src/orchestrator/workflow_engine.js` and related helpers.
3. Inspect the relevant `src/steps/step_*.js` implementation.
4. Trace shared behavior into `src/lib/`.
5. Finish at `src/core/`, `src/utils/`, and Node.js/platform APIs.

## Notes

- The exact call graph varies by command and step.
- Some CLI code calls library helpers directly for lightweight commands.
- The orchestrator remains the authoritative owner of workflow sequencing and checkpoint flow.

## Related references

- [Architecture overview](../ARCHITECTURE.md)
- [Detailed repository overview](./OVERVIEW.md)
