## FUNCTIONAL_REQUIREMENTS

## FUNCTIONAL_REQUIREMENTS

# Functional Requirements: Foundation & Configuration Layers

**Project:** ai_workflow.js
**Phases:** 1, 2, 3, 4, 5 - Foundation, Configuration/State Management, File Operations, Project Detection, Git Integration
**Version:** 2.5.0
**Date:** 2026-04-09
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

This document defines the functional requirements for the foundational layers of ai_workflow.js: core foundation (Phase 1), configuration/state management (Phase 2), file operations (Phase 3), project detection & analysis (Phase 4), and git integration (Phase 5). Phases 6–11 (AI Integration, Workflow Orchestration, Performance, Steps, CLI) are complete but documented separately in the [MIGRATION_PLAN.md](reports/implementation/MIGRATION_PLAN.md).

## Roadmap — Minor Issues

> Populated by the `fix-log-issues` skill. Each item was verified against
> the live codebase before being marked done.

| ID     | Source step | Description                                                                                          | File / Path                                          | Priority | Status |
| ------ | ----------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------- | ------ |
| RI-021 | step_01_5   | Require explicit repo-fact support before classifying a finding as `supported guidance`.             | .workflow_core/config/ai_helpers/workflow_steps.yaml | Medium   | done   |
| RI-022 | step_01_5   | Forbid invented repo-fact headings or labels in Step 1.5 finding evidence.                           | .workflow_core/config/ai_helpers/workflow_steps.yaml | Medium   | done   |
| RI-023 | step_01_5   | Require Step 1.5 findings to map to visible current-file sections or explicitly requested omissions. | .workflow_core/config/ai_helpers/workflow_steps.yaml | Medium   | done   |
| RI-024 | step_08     | Treat custom silent verification commands as `validation-script` analysis instead of unit-test runs. | src/steps/step_08_test_exec.js                       | Medium   | done   |
| RI-025 | step_08     | Only surface a coverage threshold in step_08 prompts when the target repo explicitly configures one. | src/steps/step_08_test_exec.js                       | Low      | done   |
| RI-026 | step_08     | Forbid silent validation-script prompts from recommending speculative test-discovery fixes.          | .workflow_core/config/ai_helpers.yaml                | Medium   | done   |

### 1.2 Scope

This document covers the requirements for **23 core modules** implemented in Phases 1–5 of the full 60+ module, 11-phase implementation:

- **Phase 1 (Foundation):** 7 modules — colors, logger, errors, system, version, executor, index
- **Phase 2 (Configuration):** 4 modules — config, backlog, session_manager, metrics
- **Phase 3 (File Operations):** 5 modules — file_operations, edit_operations, utils, argument_parser, cleanup_handlers
- **Phase 4 (Project Detection):** 4 modules — project_kind_detection, project_kind_config, tech_stack, third_party_exclusion
- **Phase 5 (Git Integration):** 4 modules — git_automation, git_cache, auto_commit, change_detection

Phases 6–11 add a further 37+ modules (AI integration, workflow orchestration, performance optimisation, 20 workflow steps, CLI). See the project [README.md](../README.md) for the complete module inventory.

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

| `src/index.js`

---

## FUNCTIONAL_REQUIREMENTS

## FUNCTIONAL_REQUIREMENTS

# Functional Requirements: Foundation & Configuration Layers

**Project:** ai_workflow.js
**Phases:** 1, 2, 3, 4, 5 - Foundation, Configuration/State Management, File Operations, Project Detection, Git Integration
**Version:** 2.5.0
**Date:** 2026-04-09
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

This document defines the functional requirements for the foundational layers of ai_workflow.js: core foundation (Phase 1), configuration/state management (Phase 2), file operations (Phase 3), project detection & analysis (Phase 4), and git integration (Phase 5). Phases 6–11 (AI Integration, Workflow Orchestration, Performance, Steps, CLI) are complete but documented separately in the [MIGRATION_PLAN.md](reports/implementation/MIGRATION_PLAN.md).

### 1.2 Scope

This document covers the requirements for **23 core modules** implemented in Phases 1–5 of the full 60+ module, 11-phase implementation:

- **Phase 1 (Foundation):** 7 modules — colors, logger, errors, system, version, executor, index
- **Phase 2 (Configuration):** 4 modules — config, backlog, session_manager, metrics
- **Phase 3 (File Operations):** 5 modules — file_operations, edit_operations, utils, argument_parser, cleanup_handlers
- **Phase 4 (Project Detection):** 4 modules — project_kind_detection, project_kind_config, tech_stack, third_party_exclusion
- **Phase 5 (Git Integration):** 4 modules — git_automation, git_cache, auto_commit, change_detection

Phases 6–11 add a further 37+ modules (AI integration, workflow orchestration, performance optimisation, 20 workflow steps, CLI). See the project [README.md](../README.md) for the complete module inventory.

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

| `src/index.js`
