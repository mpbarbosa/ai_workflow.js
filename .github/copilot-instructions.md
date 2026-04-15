# GitHub Copilot Instructions: ai-workflow

> 🎯 **Project Context**: This is the authoritative Copilot guidance file for the `ai-workflow` repository. Keep it aligned with the live repository structure, scripts, workflows, architecture, and documentation.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture & Design Principles](#architecture--design-principles)
- [Implementation Status](#implementation-status)
- [Module & Directory Structure](#module--directory-structure)
- [Dependency Flow](#dependency-flow)
- [Workflow Steps](#workflow-steps)
- [CLI Commands](#cli-commands)
- [GitHub Actions Workflows](#github-actions-workflows)
- [Referential Transparency Pattern](#referential-transparency-pattern)
- [Coding Standards & Conventions](#coding-standards--conventions)
- [Key Documentation References](#key-documentation-references)
- [Development Workflow](#development-workflow)
- [Testing Strategy](#testing-strategy)
- [Common Assistance Patterns](#common-assistance-patterns)
- [Migration Context](#migration-context)
- [Quick Reference](#quick-reference)
- [Contact & Resources](#contact--resources)

---

## Project Overview

**ai-workflow** is a Node.js package for AI-powered workflow automation in software development projects, with GitHub Copilot integration.

**Package Metadata:**

- **Name**: `ai-workflow`
- **Version**: `2.2.8`
- **Description**: AI-powered workflow automation for software development projects with GitHub Copilot integration
- **License**: MIT

**Key Characteristics:**

- Orchestrates a multi-step, AI-driven development workflow.
- Cross-platform: Linux, macOS, and Windows via Node.js.
- Modern JavaScript: ES modules and async/await.
- Layered architecture: code organized under `src/core/`, `src/utils/`, `src/lib/`, `src/orchestrator/`, `src/cli/`, and `src/steps/`.
- Repository documentation: guides, API docs, architecture notes, and references under `docs/`.
- Migration context: JavaScript/Node.js reimplementation of the original shell-based [`ai_workflow`](https://github.com/mpbarbosa/ai_workflow) project.

---

## Architecture & Design Principles

### Core Architectural Patterns

1. **Layered Architecture**
   - Core primitives: `src/core/`
   - Utilities: `src/utils/`
   - Shared domain logic: `src/lib/`
   - Workflow orchestration: `src/orchestrator/`
   - CLI and TUI code: `src/cli/`
   - Executable workflow steps: `src/steps/`

2. **Referential Transparency**
   - Prefer pure functions for business logic.
   - Isolate I/O, mutable state, and environment access at boundaries.
   - Pass time, randomness, and filesystem/process dependencies through wrappers when practical.

3. **Configuration-Driven Workflow**
   - Project-local configuration: `.workflow-config.yaml`
   - Shared templates and helper assets: `.workflow_core/`
   - Workflow output and runtime artifacts: `.ai_workflow/`

4. **Documentation as an Operational Surface**
   - `README.md`, `docs/`, and `.github/copilot-instructions.md` are maintained as runtime guidance.
   - Public-surface changes should keep exports, CLI docs, and reference docs in sync.

---

## Implementation Status

- **Workflow step files**: 32
- **CLI commands**: 8
- **GitHub Actions workflows**: 7
- **Documentation**: 118 markdown files in `docs/`, plus root docs (`CHANGELOG.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `README.md`, `ROADMAP.md`)

---

## Module & Directory Structure

- `src/core/` — Core primitives (6 modules)
- `src/utils/` — Utilities (3 modules)
- `src/lib/` — Shared domain logic (46 modules)
- `src/orchestrator/` — Workflow orchestration (8 modules)
- `src/cli/` — CLI and TUI code (27 modules)
- `src/steps/` — Executable workflow steps (32 files)
- `docs/` — Documentation (118 markdown files)

---

## Dependency Flow

- Core and utility modules are used by orchestrator, CLI, and step modules.
- Workflow steps are executed by the orchestrator and may depend on shared logic in `src/lib/`.
- CLI commands invoke orchestrator logic and steps.

---

## Workflow Steps

**Step file count:** 32
**Step IDs:**

- `step_00_analyze`
- `step_0b_bootstrap_docs`
- `step_0d_docker_preflight`
- `step_0f_commit_artifacts`
- `step_01_5_copilot_instructions`
- `step_01_documentation`
- `step_02_5_doc_optimize`
- `step_02_consistency`
- `step_03_script_refs`
- `step_04_config_validation`
- `step_05_directory`
- `step_06_test_review`
- `step_07_test_gen`
- `step_08_test_exec`
- `step_09_dependencies`
- `step_10_code_quality`
- `step_11_5_aws_lbs_validation`
- `step_11_6_aws_serverless_review`
- `step_11_context`
- `step_12_git_finalization`
- `step_13_markdown_lint`
- `step_14_prompt_engineer`
- `step_15_ux_analysis`
- `step_16_version_update`
- `step_17_summary`
- `step_18_debugging`
- `step_19_typescript_review`
- `step_20_async_perf_review`
- `step_21_doc_consolidation`
- `step_22_accessibility_review`
- `step_23_perf_review`
- `step_contract`

---

## CLI Commands

**Command count:** 8
**Commands:**

- `clean`
- `config`
- `deploy`
- `fix_log_issues`
- `init`
- `resume`
- `run`
- `status`

---

## GitHub Actions Workflows

**Workflow file count:** 7
**Workflow files:**

- `.github/workflows/ci.yml`
- `.github/workflows/codeql.yml`
- `.github/workflows/coverage-comment.yml`
- `.github/workflows/dependency-review.yml`
- `.github/workflows/release.yml`
- `.github/workflows/test-docker.yml`
- `.github/workflows/update-pajussara.yml`

---

## Referential Transparency Pattern

- Business logic is implemented as pure functions where possible.
- I/O, state, and environment access are isolated at boundaries.
- Time, randomness, and filesystem/process dependencies are passed through wrappers when practical.

---

## Coding Standards & Conventions

- Modern JavaScript (ES modules, async/await)
- Layered architecture
- Configuration-driven workflow
- Documentation and code kept in sync
- Linting and formatting via `eslint` and `prettier`
- Testing via `jest` and custom scripts

---

## Key Documentation References

- Root documentation: `README.md`, `CHANGELOG.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `ROADMAP.md`
- `docs/`: 118 markdown files with guides, API docs, and references

---

## Development Workflow

- Use the CLI commands to initialize, run, and manage workflows.
- Configuration is managed via `.workflow-config.yaml`.
- Workflow steps are executed in sequence by the orchestrator.
- Artifacts and logs are stored in `.ai_workflow/`.

---

## Testing Strategy

- Unit and integration tests via `jest`
- Test scripts:
  - `test`
  - `test:watch`
  - `test:coverage`
  - `test:unit`
  - `test:integration`
  - `test:fast`
  - `test:slow`
  - `test:ci`
  - `test:docker`
  - `test:docker:coverage`
  - `test:docker:e2e`
  - `test:e2e`
- Linting: `lint`, `lint:fix`, `lint:md`, `lint:md:fix`, `fix:md`
- Formatting: `format`, `format:check`
- Validation: `validate`, `validate:exports`, `validate:versions`
- Analysis: `analyze:readability`, `analyze:changes`, `analyze:changes:verbose`, `analyze:changes:json`
- Build: `build`, `build:ts`, `type:check`

---

## Common Assistance Patterns

- Keep `.github/copilot-instructions.md` aligned with the live repository.
- Use authoritative repo facts for all Copilot-assisted development.
- Update documentation and code together to maintain consistency.
- Reference this file for Copilot guidance and workflow automation.

---

## Migration Context

This repository is a JavaScript/Node.js reimplementation of the original shell-based [`ai_workflow`](https://github.com/mpbarbosa/ai_workflow) project.

---

## Quick Reference

- **Package**: `ai-workflow` (v2.2.8)
- **Workflow steps**: 32
- **CLI commands**: 8
- **GitHub Actions workflows**: 7
- **Documentation**: 118 markdown files in `docs/`, plus root docs

---

## Contact & Resources

- See `README.md` and `docs/` for usage, architecture, and contribution guidelines.
- For issues or questions, refer to the repository's issue tracker.

---
