# GitHub Copilot Instructions: ai-workflow

> This file provides durable, high-signal guidance for Copilot-assisted development in this repository. Keep it focused on stable architecture, design principles, documentation sync rules, and validation commands. Link to authoritative docs for detailed or volatile reference material.

---

## Purpose

`ai-workflow` is an AI-powered workflow automation package for software development projects, integrating with GitHub Copilot. This file guides Copilot to make high-quality, context-aware edits.

## What to include

- Stable architectural boundaries and source structure
- Design and coding principles that shape edits
- Documentation sync rules for user-facing changes
- Standard validation commands for code changes
- Pointers to authoritative reference documents

## What to exclude

Do **not** duplicate:

- Implementation status, version snapshots, or numeric inventories
- Exhaustive lists of modules, steps, workflows, or commands
- Installation walkthroughs, migration procedures, or deep reference material

Instead, link to the relevant document in `README.md` or `docs/`.

---

## Architecture and Source Layers

- `src/core/` – Foundational runtime helpers
- `src/utils/` – Shared low-level utilities
- `src/lib/` – Reusable workflow domain logic
- `src/orchestrator/` – Workflow execution and sequencing
- `src/cli/` – CLI commands, prompts, and TUI code
- `src/steps/` – Executable workflow-step implementations

Supporting surfaces:

- `.workflow-config.yaml` – Project-local workflow configuration
- `.workflow_core/` – Shared workflow templates and helper assets
- `.workflow_fspec/` – Functional specification submodule
- `.ai_workflow/` – Runtime artifacts, cache, and checkpoints

## Design Principles

- Prefer pure functions for business logic where practical
- Keep I/O (filesystem, process, environment) at the boundaries
- Reuse helpers and respect module boundaries
- Keep documentation and public surfaces aligned with behavior

## Documentation and Change Coordination

- Sync user-facing CLI changes with `README.md` and CLI/reference docs
- Update `docs/ARCHITECTURE.md` for architecture or layout changes
- Align package exports and entry points with `package.json` and API docs
- Prefer linking to authoritative docs over duplicating volatile details

## Validation Commands

For substantive code changes, always validate with:

- `npm run lint`
- `npm test`
- `npm run build`

Use narrower scripts from `package.json` only for intentionally scoped tasks.

## Authoritative References

Consult these documents for detailed or volatile information:

- `README.md` – Project overview, installation, usage
- `docs/ARCHITECTURE.md` – Repository layout and architecture
- `docs/CLI_USAGE_GUIDE.md` – CLI command and option reference
- `docs/guides/MIGRATION_GUIDE.md` – Migration context
- `CHANGELOG.md`, `CONTRIBUTING.md`
- `package.json` – Package metadata, scripts, exports

---
