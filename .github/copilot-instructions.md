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

**ai-workflow** is a Node.js package (`ai-workflow`, version `2.2.6`) for AI-powered workflow automation in software development projects, with GitHub Copilot integration.

**Package Metadata:**

- **Name**: `ai-workflow`
- **Version**: `2.2.6`
- **Description**: AI-powered workflow automation for software development projects with GitHub Copilot integration
- **License**: MIT

**Key Characteristics:**

- **Workflow Automation Engine**: Orchestrates a multi-step, AI-driven development workflow.
- **Cross-Platform**: Runs on Linux, macOS, and Windows via Node.js.
- **Modern JavaScript**: Uses ES modules and async/await.
- **Layered Architecture**: Organizes code under `src/core/`, `src/utils/`, `src/lib/`, `src/orchestrator/`, `src/cli/`, and `src/steps/`.
- **Repository Documentation**: Maintains guides, API docs, architecture notes, examples, and references under `docs/`.
- **Migration Context**: This repository is the JavaScript/Node.js reimplementation of the original shell-based [`ai_workflow`](https://github.com/mpbarbosa/ai_workflow) project.

---

## Architecture & Design Principles

### Core Architectural Patterns

1. **Layered Architecture**
   - Core primitives live in `src/core/` and `src/utils/`
   - Shared domain logic lives in `src/lib/`
   - Workflow orchestration lives in `src/orchestrator/`
   - User-facing CLI and TUI code lives in `src/cli/`
   - Executable workflow steps live in `src/steps/`

2. **Referential Transparency**
   - Prefer pure functions for business logic
   - Isolate I/O, mutable state, and environment access at boundaries
   - Pass time, randomness, and filesystem/process dependencies through wrappers when practical

3. **Configuration-Driven Workflow**
   - Project-local configuration lives in `.workflow-config.yaml`
   - Shared templates and helper assets live in `.workflow_core/`
   - Workflow output and runtime artifacts live in `.ai_workflow/`

4. **Documentation as an Operational Surface**
   - `README.md`, `docs/`, and `.github/copilot-instructions.md` are treated as maintained runtime guidance
   - Public-surface changes should keep exports, CLI docs, and reference docs in sync

### Layered View
