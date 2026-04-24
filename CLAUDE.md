# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What This Project Does

`ai-workflow` is a Node.js CLI package that runs a 30+ step AI-powered workflow pipeline (documentation validation, test generation, code quality, git automation, CI/CD) against a target software project. It uses GitHub Copilot via `@github/copilot-sdk` and 14 specialized AI personas.

---

## Commands

### Validation (run after substantive changes)

```bash
npm run lint        # ESLint
npm test            # Full Jest test suite
npm run build       # TypeScript compilation
```

### Testing

```bash
npm run test:unit            # Fast unit tests only (excludes orchestrator/)
npm run test:integration     # Orchestrator integration tests
npm run test:ci              # Both: unit then integration

# Single file
npm test -- test/lib/config.test.js

# Single test case
npm test -- test/lib/config.test.js -t "should load config"

# Watch mode
npm run test:watch -- test/lib/config.test.js
```

### Other useful scripts

```bash
npm run lint:fix             # Auto-fix ESLint issues
npm run format               # Prettier format all files
npm run type:check           # TypeScript check without emit
npm run validate             # Check package exports + version consistency
npm run test:coverage        # Coverage report
```

---

## Architecture

The codebase is organized into strict layers — respect source boundaries when editing:

| Layer | Path | Role |
|-------|------|------|
| CLI | `src/cli/` | Commands (`run`, `resume`, `init`, `status`, `config`, `clean`, `deploy`, `fix_log_issues`), Ink/React TUI |
| Orchestrator | `src/orchestrator/` | Workflow engine, dependency resolution, step execution, checkpoints |
| Library | `src/lib/` | Reusable domain logic: config, git, AI integration, caching, parsing |
| Steps | `src/steps/` | 32 executable workflow step implementations (`step_00_*.js` … `step_23_*.js`, plus `step_01_5`, `step_0b/0d/0f`, `step_11_5/11_6`) |
| Core | `src/core/` | Foundational runtime: logger, executor, colors, system detection, versioning |
| Utils | `src/utils/` | Shared low-level helpers |

**Data flow:** CLI commands → `WorkflowEngine` (orchestrator) → topological step ordering → step execution via `src/steps/` → each step calls lib modules (config, git, AI, cache).

**Entry points:**
- `bin/ai-workflow.js` — CLI executable
- `src/index.js` — Full public API barrel (~200 exports)
- Narrower entry points: `ai-workflow/core`, `ai-workflow/lib`, `ai-workflow/orchestrator`, `ai-workflow/steps`, `ai-workflow/cli/*`

**Key orchestrator files:**
- `workflow_engine.js` — Core execution engine
- `dependency_resolver.js` — Topological sort of step dependencies
- `step_executor.js` — Validates and runs each step
- `checkpoint_manager.js` — Resumability (supports `ai-workflow resume`)

**Key lib modules:**
- `config.js` — Loads `.workflow-config.yaml`
- `ai_prompt_builder.js`, `ai_personas.ts`, `ai_cache.ts` — AI/Copilot integration
- `git_automation.js` — High-level git operations (commit, push, PR)
- `session_manager.js`, `metrics.js` — Workflow session state

---

## Design Principles

- Prefer pure functions for business logic; keep I/O (filesystem, process, environment) at layer boundaries.
- Reuse helpers and respect module boundaries — don't reach across layers.
- Keep CLI-visible behavior in sync with `README.md` and `docs/CLI_USAGE_GUIDE.md`.
- Update `docs/ARCHITECTURE.md` for architecture or layout changes.

---

## Git Submodules

```bash
# Update submodules after clone or when out of date
git submodule update --init --remote
```

- `.workflow_core/` — Shared workflow templates, config, helper scripts (`mpbarbosa/ai_workflow_core`)
- `.workflow_fspec/` — Functional specification (`mpbarbosa/ai_workflow_fspec`)

Runtime artifacts written to `.ai_workflow/` (gitignored): logs, checkpoints, metrics, cache.

---

## TypeScript

Some `src/lib/` files (e.g., `ai_cache.ts`, `ai_personas.ts`, `copilot_sdk_wrapper.ts`) are TypeScript. Run `npm run build` to compile them. `npm run type:check` validates without emitting.

---

## Authoritative References

- `docs/ARCHITECTURE.md` — Repository layout and layer descriptions
- `docs/CLI_USAGE_GUIDE.md` — Full CLI command and option reference
- `docs/guides/MIGRATION_GUIDE.md` — Migration context (Shell → JS rewrite)
- `package.json` — Scripts, exports, and entry points
