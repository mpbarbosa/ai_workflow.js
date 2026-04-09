## FUNCTIONAL_REQUIREMENTS

# Functional Requirements: Foundation & Configuration Layers

**Project:** ai_workflow.js
**Phases:** 1, 2, 3, 4, 5 - Foundation, Configuration/State Management, File Operations, Project Detection, Git Integration
<<<<<<< HEAD
**Version:** 2.0.0
=======
**Version:** 2.0.0

> > > > > > > a4c4d4d (chore(workflow): update docs and metrics [skip ci])
> > > > > > > **Date:** February 2, 2026
> > > > > > > **Status:** Active

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Module Requirements](#3-module-requirements)
   - [3.1 Phase 1: Core Foundation Modules](#31-phase-1-core-foundation-modules)
     - [3.1.1 colors.js](#311-colorsjs---terminal-color-support)
     - [3.1.2 logger.js](#312-loggerjs---logging-system)
     - [3.1.3 errors.js](#313-errorsjs---error-handling)
     - [3.1.4 system.js](#314-systemjs---system-detection)
     - [3.1.5 version.js](#315-versionjs---version-management)
     - [3.1.6 executor.js](#316-executorjs---command-execution)
     - [3.1.7 index.js](#317-indexjs---module-exports)
   - [3.2 Phase 2: Configuration & State Management](#32-phase-2-configuration--state-management)
     - [3.2.1 config.js](#321-configjs---configuration-management)
     - [3.2.2 backlog.js](#322-backlogjs---backlog-reporting)
     - [3.2.3 session_manager.js](#323-session_managerjs---session-lifecycle)
     - [3.2.4 metrics.js](#324-metricsjs---performance-metrics)
   - [3.3 Phase 3 & 4: Later Phases](#33-phase-3--4-later-phases)
4. [Integration Requirements](#4-integration-requirements)
5. [Quality Requirements](#5-quality-requirements)
6. [Testing Strategy](#6-testing-strategy)
7. [Future Considerations](#7-future-considerations)
8. [Appendices](#appendices)

---

## 1. Overview

### 1.1 Purpose

This document defines the functional requirements for the foundational layers of ai_workflow.js: core foundation (Phase 1), configuration/state management (Phase 2), file operations (Phase 3), and project detection & analysis (Phase 4).

For requirements related to later phases (Git Integration, AI Integration, Workflow Engine, etc.), see the [MIGRATION_PLAN.md](reports/implementation/MIGRATION_PLAN.md).

### 1.2 Scope

This document covers the requirements for **23 core modules** implemented in Phases 1-5:

- **Phase 1 (Foundation):** 7 modules - colors, logger, errors, system, version, executor, index
- **Phase 2 (Configuration):** 4 modules - config, backlog, session_manager, metrics
- **Phase 3 (File Operations):** 5 modules - file_operations, edit_operations, utils, argument_parser, cleanup_handlers
- **Phase 4 (Project Detection):** 4 modules - project_kind_detection, project_kind_config, tech_stack, third_party_exclusion
- **Phase 5 (Git Integration):** 4 modules - git_automation, git_cache, auto_commit, change_detection

Detailed specifications for each module are provided in the sections below.

#### Phase 1: Core Foundation Modules

| Module                 | Version | Lines of Code | Purpose                                            |
| ---------------------- | ------- | ------------- | -------------------------------------------------- |
| `src/core/colors.js`   | v1.0.0  | ~56           | ANSI color codes and terminal support detection    |
| `src/core/logger.js`   | v1.0.0  | ~106          | Logging system with multiple severity levels       |
| `src/utils/errors.js`  | v1.0.0  | ~85           | Custom error class hierarchy                       |
| `src/core/system.js`   | v1.0.0  | ~137          | Operating system and package manager detection     |
| `src/core/version.js`  | v1.0.0  | ~117          | Semantic version parsing and comparison            |
| `src/core/executor.js` | v1.0.0  | ~112          | Command execution with async and streaming support |
| `src/index.js`         | v1.1.0  | ~209          | Module exports and public API                      |

**Phase 1 Total:** ~822 lines of code (excluding comments and blank lines)

#### Phase 2: Conf

---

## FUNCTIONAL_REQUIREMENTS

# Functional Requirements: Foundation & Configuration Layers

**Project:** ai_workflow.js
**Phases:** 1, 2, 3, 4, 5 - Foundation, Configuration/State Management, File Operations, Project Detection, Git Integration
**Version:** 2.0.0
**Date:** February 2, 2026
**Status:** Active

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Module Requirements](#3-module-requirements)
   - [3.1 Phase 1: Core Foundation Modules](#31-phase-1-core-foundation-modules)
     - [3.1.1 colors.js](#311-colorsjs---terminal-color-support)
     - [3.1.2 logger.js](#312-loggerjs---logging-system)
     - [3.1.3 errors.js](#313-errorsjs---error-handling)
     - [3.1.4 system.js](#314-systemjs---system-detection)
     - [3.1.5 version.js](#315-versionjs---version-management)
     - [3.1.6 executor.js](#316-executorjs---command-execution)
     - [3.1.7 index.js](#317-indexjs---module-exports)
   - [3.2 Phase 2: Configuration & State Management](#32-phase-2-configuration--state-management)
     - [3.2.1 config.js](#321-configjs---configuration-management)
     - [3.2.2 backlog.js](#322-backlogjs---backlog-reporting)
     - [3.2.3 session_manager.js](#323-session_managerjs---session-lifecycle)
     - [3.2.4 metrics.js](#324-metricsjs---performance-metrics)
   - [3.3 Phase 3 & 4: Later Phases](#33-phase-3--4-later-phases)
4. [Integration Requirements](#4-integration-requirements)
5. [Quality Requirements](#5-quality-requirements)
6. [Testing Strategy](#6-testing-strategy)
7. [Future Considerations](#7-future-considerations)
8. [Appendices](#appendices)

---

## 1. Overview

### 1.1 Purpose

This document defines the functional requirements for the foundational layers of ai_workflow.js: core foundation (Phase 1), configuration/state management (Phase 2), file operations (Phase 3), and project detection & analysis (Phase 4).

For requirements related to later phases (Git Integration, AI Integration, Workflow Engine, etc.), see the [MIGRATION_PLAN.md](reports/implementation/MIGRATION_PLAN.md).

### 1.2 Scope

This document covers the requirements for **23 core modules** implemented in Phases 1-5:

- **Phase 1 (Foundation):** 7 modules - colors, logger, errors, system, version, executor, index
- **Phase 2 (Configuration):** 4 modules - config, backlog, session_manager, metrics
- **Phase 3 (File Operations):** 5 modules - file_operations, edit_operations, utils, argument_parser, cleanup_handlers
- **Phase 4 (Project Detection):** 4 modules - project_kind_detection, project_kind_config, tech_stack, third_party_exclusion
- **Phase 5 (Git Integration):** 4 modules - git_automation, git_cache, auto_commit, change_detection

Detailed specifications for each module are provided in the sections below.

#### Phase 1: Core Foundation Modules

| Module                 | Version | Lines of Code | Purpose                                            |
| ---------------------- | ------- | ------------- | -------------------------------------------------- |
| `src/core/colors.js`   | v1.0.0  | ~56           | ANSI color codes and terminal support detection    |
| `src/core/logger.js`   | v1.0.0  | ~106          | Logging system with multiple severity levels       |
| `src/utils/errors.js`  | v1.0.0  | ~85           | Custom error class hierarchy                       |
| `src/core/system.js`   | v1.0.0  | ~137          | Operating system and package manager detection     |
| `src/core/version.js`  | v1.0.0  | ~117          | Semantic version parsing and comparison            |
| `src/core/executor.js` | v1.0.0  | ~112          | Command execution with async and streaming support |
| `src/index.js`         | v1.1.0  | ~209          | Module exports and public API                      |

**Phase 1 Total:** ~822 lines of code (excluding comments and blank lines)

#### Phase 2: Configuration & State Management Modules

| Module | Version | Lines of Code | Purpose

## Roadmap — Minor Issues

> Populated by the `fix-log-issues` skill. Each item was verified against
> the live codebase before being marked done.

| ID     | Source step                 | Description                                                                                                                                                            | File / Path                                                                             | Priority | Status |
| ------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------- | ------ |
| RI-001 | step_20 / step_22 / step_23 | AI cache keys containing absolute paths caused ENOENT errors — added `_safeKey()` to sanitize keys                                                                     | `src/lib/ai_cache.js`                                                                   | Medium   | done   |
| RI-002 | step_05                     | `test/integration/cross-step/` had no README explaining its purpose                                                                                                    | `test/integration/cross-step/README.md`                                                 | Low      | done   |
| RI-003 | step_05                     | `.github/skills/` had no README documenting the skills system                                                                                                          | `.github/skills/README.md`                                                              | Low      | done   |
| RI-004 | step_02                     | README.md linked to missing `docs/guides/VALIDATE.md` — created stub                                                                                                   | `docs/guides/VALIDATE.md`                                                               | Medium   | done   |
| RI-005 | step_02                     | README.md linked to missing `docs/guides/PREPARE_RELEASE.md` — created stub                                                                                            | `docs/guides/PREPARE_RELEASE.md`                                                        | Medium   | done   |
| RI-006 | step_02                     | README.md linked to missing `docs/guides/CLEANUP_ARTIFACTS.md` — created stub                                                                                          | `docs/guides/CLEANUP_ARTIFACTS.md`                                                      | Medium   | done   |
| RI-007 | step_10                     | `ErrorDetailPanel.js:47` accessed `error.stack` without null guard — changed to `error?.stack ?? ''`                                                                   | `src/cli/tui/components/ErrorDetailPanel.js`                                            | Medium   | done   |
| RI-008 | step_10 / step_0b           | Duplicate `error_resilience_prompt` key in `.workflow_core/config/ai_helpers.yaml` caused YAML parse failure and 63+ test failures — removed older duplicate block     | `.workflow_core/config/ai_helpers.yaml`                                                 | Medium   | done   |
| RI-009 | step_05                     | `ROOT_ALLOWED_FILES` missing `ROADMAP.md` and `SECURITY.md` caused false-positive "misplaced docs" warnings every run                                                  | `src/steps/step_05_directory.js`                                                        | Low      | done   |
| RI-010 | step_08 / test suite        | `require()` inside `jest.spyOn()` calls in step_0d tests invalid in ES module context — replaced with constructor dependency injection                                 | `test/steps/step_0d_docker_preflight.test.js` / `src/steps/step_0d_docker_preflight.js` | Medium   | done   |
| RI-011 | step_05                     | `test/fixtures/` had no README explaining its purpose or how to add fixtures                                                                                           | `test/fixtures/README.md`                                                               | Medium   | done   |
| RI-012 | step_07                     | `src/types/public-api.d.ts` had no corresponding test — created `test/types/public-api.d.test.js` verifying all key exported symbols                                   | `test/types/public-api.d.test.js`                                                       | Low      | done   |
| RI-013 | step_03                     | `.test-e2e/step-02-*/package.json` missing `"name"` field — added `"name"` to fixture package.json (file is gitignored; fix applied on disk)                           | `.test-e2e/step-02-1771697742634-nc47xngdjgp/package.json`                              | Low      | done   |
| RI-014 | step_13                     | `fix-markdown.js` npm scripts (`lint:md`, `lint:md:fix`, `fix:md`) not documented in `scripts/README.md`                                                               | `scripts/README.md`                                                                     | Low      | done   |
| RI-015 | step_13                     | `run-tests-docker.sh` and its npm scripts (`test:docker`, `test:docker:coverage`, `test:docker:e2e`) not documented in `scripts/README.md`                             | `scripts/README.md`                                                                     | Low      | done   |
| RI-016 | step_13                     | Five utility scripts (`analyze-jsdoc-coverage.js`, `security-audit.js`, `smoke-test-copilot-sdk.js`, `colors.sh`, `postinstall`) not documented in `scripts/README.md` | `scripts/README.md`                                                                     | Low      | done   |
