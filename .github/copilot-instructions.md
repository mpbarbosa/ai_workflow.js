# Copilot Instructions: ai-workflow

> Durable, high-signal guidance for Copilot-assisted development in this repository. Focus on stable architecture, design principles, documentation sync, and validation. Link to authoritative docs for details.

---

## Purpose

This file guides Copilot to make high-quality, context-aware edits for `ai-workflow`, an AI-powered workflow automation package for software development with GitHub Copilot integration.

## Scope

- Define stable architectural boundaries and source structure
- State design and coding principles that shape edits
- Specify documentation sync rules for user-facing changes
- List standard validation commands for code changes
- Point to authoritative reference documents

Avoid duplicating implementation status, inventories, installation, or migration details—link to docs instead.

---

## Architecture and Source Layers

- `src/core/` – Foundational runtime helpers
- `src/utils/` – Shared low-level utilities
- `src/lib/` – Reusable workflow domain logic
- `src/orchestrator/` – Workflow execution and sequencing
- `src/cli/` – CLI commands, prompts, and TUI code
- `src/steps/` – Executable workflow-step implementations

Supporting workflow surfaces:

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
- Link to authoritative docs for volatile or detailed information

## Validation Commands

For substantive code changes, always validate with:

- `npm run lint`
- `npm test`
- `npm run build`

Use narrower scripts from `package.json` only for intentionally scoped tasks.

## Authoritative References

Consult these documents for details:

- [README.md](../README.md) – Project overview, installation, usage
- [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) – Repository layout and architecture
- [docs/CLI_USAGE_GUIDE.md](../docs/CLI_USAGE_GUIDE.md) – CLI command and option reference
- [docs/guides/MIGRATION_GUIDE.md](../docs/guides/MIGRATION_GUIDE.md) – Migration context
- `CHANGELOG.md`, `CONTRIBUTING.md`
- `package.json` – Package metadata, scripts, exports

---
