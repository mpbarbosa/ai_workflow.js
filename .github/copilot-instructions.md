# GitHub Copilot Instructions: ai_workflow.js

> 🎯 **Project Context**: This is a **JavaScript/Node.js implementation** of AI-powered workflow automation for software development projects. It is a complete migration from the shell-based [ai_workflow](https://github.com/mpbarbosa/ai_workflow) repository, reimagining the architecture with modern JavaScript best practices while maintaining feature parity.

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture & Design Principles](#architecture--design-principles)
- [Current Implementation Status](#current-implementation-status)
- [Module Structure](#module-structure)
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

**ai_workflow.js** is a Node.js implementation of an AI-powered workflow automation system for software development. It provides a comprehensive 15-step pipeline for documentation validation, test generation, code quality analysis, and CI/CD integration with GitHub Copilot.

**Key Characteristics:**

- **Workflow Automation Engine**: Orchestrates 15-step AI-powered development workflows
- **Cross-Platform**: Works on Linux, macOS, and Windows via Node.js
- **Modern JavaScript**: ES6+ modules, async/await, pure functional patterns
- **Referentially Transparent**: v2.0.0 modules follow functional programming principles
- **Comprehensive Testing**: 3416 of 3435 tests passing (18 skipped, 1 known failure) ✅

**Version**: 1.2.0 (Project) / 1.0.0 (Phase 1, 4 modules) / 2.0.0 (Phase 2, 3, 5, 7 modules)  
**License**: MIT  
**Source Repository**: [mpbarbosa/ai_workflow](https://github.com/mpbarbosa/ai_workflow) (Shell/Bash v3.0.0)

**Migration Note**: This is NOT a line-by-line shell-to-JavaScript translation. It's a complete architectural redesign extracting behaviors and features from the original shell scripts while building idiomatic JavaScript code with modern best practices.

---

## Architecture & Design Principles

### Core Architectural Patterns

1. **Referential Transparency (v2.0.0)**
   - Pure functions for core logic (deterministic, no side effects)
   - Impure wrapper classes for I/O and state management
   - Time and random dependencies injected as parameters
   - Immutable data transformations throughout
   - Isolated side effects at system boundaries

2. **Layered Architecture**

   ```
   ┌─────────────────────────────────────┐
   │  CLI Layer (future Phase 11)        │
   ├─────────────────────────────────────┤
   │  Workflow Engine (Phase 7)          │  ← Complete: v2.0.0
   ├─────────────────────────────────────┤
   │  AI Integration (Phase 6)           │  ← Complete: v2.0.0 (3 test failures)
   ├─────────────────────────────────────┤
   │  Git Operations (Phase 5)           │  ← Complete: v2.0.0
   ├─────────────────────────────────────┤
   │  Project Detection (Phase 4)        │  ← Complete: v1.0.0
   ├─────────────────────────────────────┤
   │  File Operations (Phase 3)          │  ← Complete: v2.0.0
   ├─────────────────────────────────────┤
   │  Configuration & State (Phase 2)    │  ← Complete: v2.0.0
   ├─────────────────────────────────────┤
   │  Core Foundation (Phase 1)          │  ← Complete: v1.0.0
   └─────────────────────────────────────┘
   ```

3. **Module Organization**
   - **src/core/**: Foundation utilities (colors, logger, system, version, executor)
   - **src/utils/**: Helper functions (errors)
   - **src/lib/**: Core libraries (config, backlog, session_manager, metrics, file_operations, edit_operations, utils, argument_parser, cleanup_handlers, project_kind_detection, project_kind_config, tech_stack, third_party_exclusion, git_automation, git_cache, auto_commit, change_detection, jq_wrapper, ai_personas, ai_validation, ai_cache, ai_prompt_builder, ai_helpers)
   - **src/orchestrator/**: Workflow orchestration (workflow_engine, step_registry, dependency_resolver, step_executor, conditional_executor, checkpoint_manager)
   - **test/**: Comprehensive test suite mirroring src/ structure
   - **docs/**: Architecture, requirements, and migration documentation

4. **Dependency Management**
   - Minimal external dependencies (@github/copilot-sdk only for production)
   - No heavy frameworks - lightweight and focused
   - Dev dependencies for testing (jest) and code quality (eslint, prettier)

5. **Configuration Management**
   - Uses `.workflow_core/` submodule for shared configuration templates
   - Project-specific config in `.workflow-config.yaml`
   - Workflow artifacts in `.ai_workflow/` directory (logs, metrics, backlog, summaries)

---

## Current Implementation Status

### Current Implementation Status

**✅ Phase 1: Core Foundation (v1.0.0) - COMPLETE**

**Modules Implemented (7 modules, ~822 LOC):**

| Module                 | Version | LOC | Purpose                                              |
| ---------------------- | ------- | --- | ---------------------------------------------------- |
| `src/core/colors.js`   | v1.0.0  | 54  | ANSI color codes with terminal support detection     |
| `src/core/logger.js`   | v1.0.0  | 99  | Colored logging system with multiple severity levels |
| `src/utils/errors.js`  | v1.0.0  | 68  | Custom error class hierarchy for workflow errors     |
| `src/core/system.js`   | v1.0.0  | 130 | OS detection and system configuration                |
| `src/core/version.js`  | v1.0.0  | 114 | Semantic version parsing and comparison              |
| `src/core/executor.js` | v1.0.0  | 105 | Command execution with async/streaming support       |
| `src/index.js`         | v1.1.0  | 209 | Module exports and public API                        |

**Testing:** 113 tests (85 original + 28 error tests), 100% coverage, 100% pass rate ✅

### ✅ Phase 2: Configuration & State Management (v2.0.0) - COMPLETE

**Modules Implemented (4 modules, ~1,379 LOC):**

| Module                       | Version | LOC | Purpose                          | Architecture             |
| ---------------------------- | ------- | --- | -------------------------------- | ------------------------ |
| `src/lib/config.js`          | v2.0.0  | 315 | Configuration management         | Pure functions + wrapper |
| `src/lib/backlog.js`         | v2.0.0  | 195 | Workflow summary/backlog reports | Pure functions + wrapper |
| `src/lib/session_manager.js` | v2.0.0  | 220 | Session lifecycle management     | Pure functions + wrapper |
| `src/lib/metrics.js`         | v2.0.0  | 475 | Performance metrics collection   | Pure functions + wrapper |

**Testing:** 174 tests (86 pure function tests + 88 integration tests), 100% coverage, 100% pass rate

**Referential Transparency Refactoring:**

- All Phase 2 modules refactored to v2.0.0 with pure functional architecture
- Core logic extracted as pure functions (deterministic, no side effects, immutable)
- Side effects isolated in wrapper classes (I/O, console logging, state management)
- Time/random dependencies injected as parameters instead of internal calls
- Comprehensive testing: 86 deterministic tests for pure functions, 88 tests for integration

### ✅ Phase 3: File Operations & Utilities (v2.0.0) - COMPLETE

**Modules Implemented (5 modules, ~2,772 LOC):**

| Module                        | Version | LOC | Purpose                                           | Architecture             |
| ----------------------------- | ------- | --- | ------------------------------------------------- | ------------------------ |
| `src/lib/file_operations.js`  | v2.0.0  | 295 | File system operations (read, write, copy, etc.)  | Pure functions + wrapper |
| `src/lib/edit_operations.js`  | v2.0.0  | 380 | File editing utilities (find/replace, diff, etc.) | Pure functions + wrapper |
| `src/lib/utils.js`            | v1.0.0  | 289 | General utilities (string, array, object helpers) | Pure functions only      |
| `src/lib/argument_parser.js`  | v2.0.0  | 344 | CLI argument parsing with validation              | Pure functions + wrapper |
| `src/lib/cleanup_handlers.js` | v2.0.0  | 326 | Cleanup operations (temp files, sessions, cache)  | Pure functions + wrapper |

**Testing:** 354 tests (163 pure function tests + 191 integration tests), 100% coverage, 100% pass rate

**Key Features:**

- All modules follow v2.0.0 referential transparency architecture (except utils.js which is pure-only)
- Comprehensive file operations with async/await, dry-run mode, error handling
- Advanced text editing with diff generation and formatting
- CLI parsing with schema validation, type coercion, auto-generated help
- Utilities library with string, array, and object helpers (all pure functions)
- Cleanup handlers with age/size/pattern-based cleanup, cross-realm Date handling

### ✅ Phase 4: Project Detection & Analysis (v1.0.0) - COMPLETE

**Modules Implemented (4 modules, ~1,851 LOC):**

| Module                              | Version | LOC | Purpose                                     | Architecture             |
| ----------------------------------- | ------- | --- | ------------------------------------------- | ------------------------ |
| `src/lib/project_kind_detection.js` | v1.0.0  | 270 | Auto-detect project type from file patterns | Pure functions + wrapper |
| `src/lib/project_kind_config.js`    | v1.0.0  | 310 | Load/parse project configs from YAML        | Pure functions + wrapper |
| `src/lib/tech_stack.js`             | v1.0.0  | 385 | Detect languages, frameworks, tools         | Pure functions + wrapper |
| `src/lib/third_party_exclusion.js`  | v1.0.0  | 360 | Filter third-party files from analysis      | Pure functions + wrapper |

**Testing:** 167 tests (100% passing), 100% coverage ✅

**Key Features:**

- Detects 8 project kinds: nodejs_api, react_spa, python_app, shell_script_automation, static_website, client_spa, configuration_library, generic
- Analyzes package.json, requirements.txt, and file patterns for detection
- Loads project configs from `.workflow_core/config/project_kinds.yaml`
- Detects tech stack: languages (7), frameworks (10+), build systems, test frameworks, linters
- Auto-excludes third-party directories: node_modules, .git, dist, build, venv, **pycache**
- Parses and applies .gitignore patterns with smart glob matching
- All modules follow v1.0.0 architecture with pure functional core

### ✅ Phase 5: Git Integration (v2.0.0) - COMPLETE

**Modules Implemented (4 modules, ~1,944 LOC):**

| Module                        | Version | LOC | Purpose                                  | Architecture             |
| ----------------------------- | ------- | --- | ---------------------------------------- | ------------------------ |
| `src/lib/git_automation.js`   | v2.0.0  | 523 | Git operations (status, diff, commit)    | Pure functions + wrapper |
| `src/lib/git_cache.js`        | v2.0.0  | 377 | Git operation caching with invalidation  | Pure functions + wrapper |
| `src/lib/auto_commit.js`      | v2.0.0  | 504 | Automatic artifact commits               | Pure functions + wrapper |
| `src/lib/change_detection.js` | v2.0.0  | 540 | File change detection and categorization | Pure functions + wrapper |

**Testing:** 219 tests (100% passing), 100% coverage ✅

**Key Features:**

- Git operations: status, diff, log, commit, add, branch management
- Git output parsing: status, diff, log with structured results
- Repository detection: find .git root, check if repo, validate status
- Caching system: TTL-based cache with automatic invalidation
- Auto-commit: workflow artifact commits with conventional messages
- Change detection: categorize changes by type (docs, tests, code, config)
- All modules follow v2.0.0 architecture with pure functional core

### ✅ Phase 6: AI Integration (v2.0.0) - COMPLETE (3 test failures)

**Modules Implemented (6 modules, ~2,839 LOC):**

| Module                         | Version | LOC | Purpose                     | Architecture             |
| ------------------------------ | ------- | --- | --------------------------- | ------------------------ |
| `src/lib/jq_wrapper.js`        | v2.0.0  | 349 | JSON processing with jq CLI | Pure functions + wrapper |
| `src/lib/ai_personas.js`       | v2.0.0  | 285 | AI persona management       | Pure functions + wrapper |
| `src/lib/ai_validation.js`     | v2.0.0  | 380 | AI response validation      | Pure functions + wrapper |
| `src/lib/ai_cache.js`          | v2.0.0  | 425 | AI response caching         | Pure functions + wrapper |
| `src/lib/ai_prompt_builder.js` | v2.0.0  | 850 | AI prompt construction      | Pure functions + wrapper |
| `src/lib/ai_helpers.js`        | v2.0.0  | 550 | AI helper utilities         | Pure functions + wrapper |

**Testing:** 424 tests (421 passing, 3 failures), high coverage ⚠️

**Key Features:**

- JSON processing with jq command-line tool wrapper
- 14 AI personas for different workflow tasks
- Response validation with confidence scoring
- Token-efficient caching with TTL and invalidation
- Structured prompt building with templates
- AI helper utilities for parsing and formatting

**Known Issues:** 3 test failures related to jq wrapper edge cases

### ✅ Phase 7: Workflow Orchestration (v2.0.0) - COMPLETE

**Modules Implemented (6 modules, ~3,457 LOC):**

| Module                                     | Version | LOC | Purpose                               | Architecture             |
| ------------------------------------------ | ------- | --- | ------------------------------------- | ------------------------ |
| `src/orchestrator/workflow_engine.js`      | v2.0.0  | 612 | Workflow execution engine             | Pure functions + wrapper |
| `src/orchestrator/step_registry.js`        | v2.0.0  | 455 | Step definition and registration      | Pure functions + wrapper |
| `src/orchestrator/dependency_resolver.js`  | v2.0.0  | 580 | Dependency graph and topological sort | Pure functions + wrapper |
| `src/orchestrator/step_executor.js`        | v2.0.0  | 510 | Step execution with retry logic       | Pure functions + wrapper |
| `src/orchestrator/conditional_executor.js` | v2.0.0  | 792 | Conditional step execution            | Pure functions + wrapper |
| `src/orchestrator/checkpoint_manager.js`   | v2.0.0  | 508 | Checkpoint save/resume functionality  | Pure functions + wrapper |

**Testing:** 329 tests (100% passing), 100% coverage ✅

**Key Features:**

- Workflow execution engine with parallel step support
- Step registry with metadata and dependencies
- Dependency resolution with circular detection
- Step execution with timeout and retry logic
- Conditional execution based on project kind and changes
- Checkpoint system for pause/resume and error recovery
- All modules follow v2.0.0 architecture with pure functional core

### 🚧 Phase 8: Performance Optimization (v2.0.0) - IN PROGRESS

**Modules Implemented (1 module, ~570 LOC):**

| Module                      | Version | LOC | Purpose                           | Architecture             |
| --------------------------- | ------- | --- | --------------------------------- | ------------------------ |
| `src/lib/step1_parallel.js` | v2.0.0  | 570 | Parallel documentation validation | Pure functions + wrapper |

**Testing:** 646 tests (628 passing, 18 skipped integration tests), 97% pass rate ⚠️

**Key Features:**

- Parallel documentation validation by category (README, API, guides, etc.)
- 4 execution strategies: SEQUENTIAL, PARALLEL, PRIORITY_BASED, BALANCED
- Task distribution with priority-based scheduling
- Configurable concurrency limits (default: 4 parallel tasks)
- Timeout and retry logic for resilience
- Result merging with comprehensive statistics
- Speedup calculation and efficiency metrics
- All pure functions follow v2.0.0 referential transparency pattern

**Known Issues:** 18 integration tests marked as skipped for parallel execution scenarios

### 🚧 Phase 9-11: Future Phases (PLANNED)

---

## Module Structure

### Directory Layout

```
ai_workflow.js/
├── src/
│   ├── core/                    # Phase 1: Foundation utilities (v1.0.0)
│   │   ├── colors.js            # ANSI color codes
│   │   ├── logger.js            # Logging system
│   │   ├── system.js            # OS detection
│   │   ├── version.js           # Semver handling
│   │   └── executor.js          # Command execution
│   ├── utils/                   # Phase 1: Helper utilities (v1.0.0)
│   │   └── errors.js            # Custom error classes
│   ├── lib/                   # Phase 2-6: Core libraries (v2.0.0+)
│   │   ├── config.js          # ✅ Configuration management (v2.0.0)
│   │   ├── backlog.js         # ✅ Backlog reporting (v2.0.0)
│   │   ├── session_manager.js # ✅ Session lifecycle (v2.0.0)
│   │   ├── metrics.js         # ✅ Performance metrics (v2.0.0)
│   │   ├── file_operations.js # ✅ File system operations (v2.0.0)
│   │   ├── edit_operations.js # ✅ File editing utilities (v2.0.0)
│   │   ├── utils.js           # ✅ General utilities (v1.0.0)
│   │   ├── argument_parser.js # ✅ CLI argument parsing (v2.0.0)
│   │   ├── cleanup_handlers.js# ✅ Cleanup operations (v2.0.0)
│   │   ├── project_kind_detection.js # ✅ Project detection (v1.0.0)
│   │   ├── project_kind_config.js    # ✅ Project config (v1.0.0)
│   │   ├── tech_stack.js             # ✅ Tech stack detection (v1.0.0)
│   │   ├── third_party_exclusion.js  # ✅ Third-party exclusion (v1.0.0)
│   │   ├── git_automation.js    # ✅ Git operations (v2.0.0)
│   │   ├── git_cache.js         # ✅ Git caching (v2.0.0)
│   │   ├── auto_commit.js       # ✅ Auto-commit (v2.0.0)
│   │   ├── change_detection.js  # ✅ Change detection (v2.0.0)
│   │   ├── jq_wrapper.js        # ✅ JSON processing (v2.0.0)
│   │   ├── ai_personas.js       # ✅ AI personas (v2.0.0)
│   │   ├── ai_validation.js     # ✅ AI validation (v2.0.0)
│   │   ├── ai_cache.js          # ✅ AI caching (v2.0.0)
│   │   ├── ai_prompt_builder.js # ✅ Prompt building (v2.0.0)
│   │   ├── ai_helpers.js        # ✅ AI helpers (v2.0.0)
│   │   ├── step1_incremental.js # ✅ Step 1 incremental processing (v2.0.0)
│   │   └── step1_parallel.js    # 🚧 Step 1 parallel processing (v2.0.0)
│   ├── orchestrator/            # Phase 7: Workflow orchestration (v2.0.0)
│   │   ├── workflow_engine.js   # ✅ Workflow execution (v2.0.0)
│   │   ├── step_registry.js     # ✅ Step registry (v2.0.0)
│   │   ├── dependency_resolver.js # ✅ Dependency resolution (v2.0.0)
│   │   ├── step_executor.js     # ✅ Step execution (v2.0.0)
│   │   ├── conditional_executor.js # ✅ Conditional execution (v2.0.0)
│   │   └── checkpoint_manager.js # ✅ Checkpoint management (v2.0.0)
│   ├── cli/                     # Phase 11: CLI (future)
│   └── index.js                 # Public API exports
├── test/                        # Comprehensive test suite
│   ├── core/                    # Phase 1 core tests (85 tests)
│   ├── utils/                   # Phase 1 utils tests (28 tests)
│   ├── lib/                     # Phase 2-8 tests (1715 tests, 1695 passing, 18 skipped, 2 failures) ⚠️
│   └── orchestrator/            # Phase 7 tests (329 tests, 100% passing) ✅
├── docs/                        # Documentation
│   ├── FUNCTIONAL_REQUIREMENTS.md
│   ├── reports/
│   │   ├── implementation/
│   │   │   └── MIGRATION_PLAN.md
│   │   └── analysis/
│   │       └── CORRECTION_REPORT.md
│   └── misc/
├── .workflow_core/              # Config templates submodule
├── .ai_workflow/                # Workflow artifacts
│   ├── backlog/                 # Execution reports
│   ├── summaries/               # AI summaries
│   ├── logs/                    # Execution logs
│   └── metrics/                 # Performance data
├── .github/
│   ├── copilot-instructions.md  # This file
│   └── REFERENTIAL_TRANSPARENCY.md
├── .workflow-config.yaml        # Project configuration
├── package.json                 # Node.js project metadata
├── jest.config.json             # Jest configuration
├── eslint.config.mjs            # ESLint configuration
├── README.md                    # Project overview
├── CHANGELOG.md                 # Version history
├── CONTRIBUTING.md              # Contribution guidelines
└── LICENSE                      # MIT License
```

### Module Dependency Graph (Phase 1-7)

```
┌──────────────────────────────────────────────────────────┐
│        Phase 7: orchestrator/ (v2.0.0)                   │
│                                                           │
│  ┌────────────────┐  ┌────────────────┐                 │
│  │workflow_engine │  │checkpoint_     │                 │
│  │                │  │manager         │                 │
│  └───────┬────────┘  └────────┬───────┘                 │
│          │                    │                          │
│   ┌──────▼──────┐   ┌────────▼──────┐                  │
│   │step_registry│   │step_executor  │                  │
│   └──────┬──────┘   └────────┬──────┘                  │
│          │                    │                          │
│   ┌──────▼──────────┐  ┌─────▼────────────┐            │
│   │dependency_      │  │conditional_      │            │
│   │resolver         │  │executor          │            │
│   └─────────────────┘  └──────────────────┘            │
└───────────────────────┬──────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────┐
│           Phase 6: lib/ (v2.0.0)                         │
│                                                           │
│  ┌───────────────┐  ┌────────────────┐                  │
│  │jq_wrapper     │  │ai_personas     │                  │
│  └───────┬───────┘  └────────┬───────┘                  │
│          │                   │                           │
│    ┌─────▼─────┐   ┌────────▼──────┐                   │
│    │ai_        │   │ai_cache       │                   │
│    │validation │   │               │                   │
│    └───────────┘   └───────────────┘                   │
│                                                           │
│    ┌─────────────────┐   ┌────────────────┐            │
│    │ai_prompt_       │   │ai_helpers      │            │
│    │builder          │   │                │            │
│    └─────────────────┘   └────────────────┘            │
└───────────────────────┬──────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────┐
│           Phase 5: lib/ (v2.0.0)                         │
│                                                           │
│  ┌───────────────┐  ┌────────────────┐                  │
│  │git_automation │  │git_cache       │                  │
│  └───────┬───────┘  └────────┬───────┘                  │
│          │                   │                           │
│          │    ┌──────────────┴───────┐                  │
│          │    │                      │                  │
│    ┌─────▼────▼──────┐    ┌─────────▼────────┐        │
│    │ auto_commit     │    │change_detection   │        │
│    │                 │    │                   │        │
│    └─────────────────┘    └───────────────────┘        │
└───────────────────────┬──────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────┐
│           Phase 4: lib/ (v1.0.0)                         │
│                                                           │
│  ┌───────────────┐  ┌────────────────┐                  │
│  │project_kind_  │  │project_kind_   │                  │
│  │detection      │  │config          │                  │
│  └───────┬───────┘  └────────┬───────┘                  │
│          │                   │                           │
│          │    ┌──────────────┴───────┐                  │
│          │    │                      │                  │
│    ┌─────▼────▼──────┐    ┌─────────▼────────┐        │
│    │ tech_stack      │    │third_party_       │        │
│    │                 │    │exclusion          │        │
│    └─────────────────┘    └───────────────────┘        │
└───────────────────────┬──────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────┐
│              Phase 3: lib/ (v2.0.0)                      │
│                                                           │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────┐     │
│  │file_operations│  │edit_operations│ │cleanup_   │     │
│  │              │  │               │  │handlers   │     │
│  └──────┬───────┘  └──────┬────────┘  └────┬──────┘     │
│         │                 │                │             │
│         └─────────────────┴────────────────┘             │
│                          │                               │
│         ┌────────────────┴───────────────┐               │
│         │                                │               │
│    ┌────▼──────┐               ┌────────▼─────┐        │
│    │ utils     │               │argument_parser│        │
│    │(pure only)│               │               │        │
│    └───────────┘               └───────────────┘        │
└───────────────────────┬──────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────┐
│         Phase 2: lib/ (v2.0.0)                           │
│   ┌──────────┐  ┌──────────┐                            │
│   │ config   │  │ backlog  │                            │
│   └────┬─────┘  └────┬─────┘                            │
│        │             │                                   │
│   ┌────┴─────┐  ┌───┴──────┐                            │
│   │ session_ │  │ metrics  │                            │
│   │ manager  │  │          │                            │
│   └────┬─────┘  └────┬─────┘                            │
└─────────┼─────────────┼────────────────────────────────-┘
          │             │
          ▼             ▼
┌──────────────────────────────────────────────────────────┐
│       Phase 1: core/ (v1.0.0)                            │
│                                                           │
│   ┌────────┐  ┌────────┐  ┌────────┐                   │
│   │ logger │  │ system │  │executor│                   │
│   └────┬───┘  └────┬───┘  └────┬───┘                   │
│        │           │           │                         │
│        └───────────┴───────────┘                         │
│                    │                                     │
│              ┌─────▼─────┐                              │
│              │  colors   │                              │
│              └───────────┘                              │
│                                                           │
│         ┌──────────┐  ┌──────────┐                     │
│         │ version  │  │  errors  │                     │
│         └──────────┘  └──────────┘                     │
└──────────────────────────────────────────────────────────┘
```

**Dependency Rules:**

- Phase 1 modules have no dependencies on Phase 2+ modules
- Phase 2 modules depend only on Phase 1 core utilities
- Phase 3 modules depend on Phase 1 + 2 foundation
- Phase 4 modules depend on Phase 1-3 foundation
- Phase 5 modules depend on Phase 1-4 foundation
- Phase 6 modules depend on Phase 1-5 foundation
- Phase 7 modules depend on Phase 1-6 foundation
- Future phases (8-11) will depend on Phase 1-7 foundation

---

## Referential Transparency Pattern (v2.0.0)

### Overview

Phase 2 modules (v2.0.0) follow a **referential transparency architecture** separating pure functions from side effects:

```javascript
// ✅ Pure Functions - Exported for testing and reuse
export function generateSessionId(randomBytes) {
  return randomBytes.toString('hex'); // Deterministic given input
}

export function createSessionEntry(sessionId, currentTime, metadata) {
  return { id: sessionId, startTime: currentTime, ...metadata }; // Immutable
}

// ❌ Impure Wrapper - Handles side effects
export class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  createSession(metadata = {}) {
    // Inject dependencies (time, randomness)
    const randomBytes = crypto.randomBytes(16);
    const sessionId = generateSessionId(randomBytes); // Pure function
    const entry = createSessionEntry(sessionId, Date.now(), metadata); // Pure function

    this.sessions.set(sessionId, entry); // Side effect: state mutation
    logger.info(`Session created: ${sessionId}`); // Side effect: I/O
    return sessionId;
  }
}
```

### Design Principles

1. **Pure Functions (Referentially Transparent)**
   - Always produce same output for same input (deterministic)
   - No observable side effects (no mutation, I/O, global state)
   - Time/random dependencies passed as parameters
   - Immutable data transformations
   - Easy to test (no mocks needed)

2. **Impure Wrappers (Side Effect Boundaries)**
   - Handle I/O operations (file system, console, network)
   - Manage mutable state (in-memory caches, sessions)
   - Inject time (`Date.now()`) and randomness (`crypto.randomBytes()`)
   - Call pure functions for business logic
   - Isolate side effects at system boundaries

3. **Benefits**
   - **Testability**: Pure functions have deterministic tests, no setup/teardown
   - **Predictability**: Same inputs always produce same outputs
   - **Composability**: Pure functions can be freely combined
   - **Maintainability**: Clear separation of concerns
   - **Debugging**: Side effects are obvious and isolated

### Architecture Pattern

```
┌──────────────────────────────────────────────┐
│         APPLICATION LAYER (Impure)           │
│  SessionManager, ConfigManager, etc.         │
│  - File I/O, Console logging                 │
│  - State management, Time/Random injection   │
└──────────────┬───────────────────────────────┘
               │ calls
               ▼
┌──────────────────────────────────────────────┐
│         BUSINESS LOGIC (Pure Functions)      │
│  generateSessionId, createSessionEntry, etc. │
│  - Deterministic calculations                │
│  - Immutable transformations                 │
│  - No side effects                           │
└──────────────────────────────────────────────┘
```

### Testing Strategy

**Pure Functions** (86 tests across Phase 2 modules):

```javascript
describe('Pure Functions', () => {
  test('generateSessionId is deterministic', () => {
    const bytes = Buffer.from('test1234test1234');
    expect(generateSessionId(bytes)).toBe('7465737431323334746573743132333');
    expect(generateSessionId(bytes)).toBe('7465737431323334746573743132333'); // Always same
  });
});
```

**Integration Tests** (88 tests across Phase 2 modules):

```javascript
describe('SessionManager Integration', () => {
  test('createSession generates unique IDs', () => {
    const manager = new SessionManager();
    const id1 = manager.createSession();
    const id2 = manager.createSession();
    expect(id1).not.toBe(id2); // Non-deterministic (uses crypto.randomBytes)
  });
});
```

### Modules Using This Pattern

| Module                  | Pure Functions                                         | Wrapper Class            | Benefits                            |
| ----------------------- | ------------------------------------------------------ | ------------------------ | ----------------------------------- |
| config.js               | `parseYamlSync`, `validateConfig`, etc.                | `ConfigManager`          | Configuration parsing is testable   |
| backlog.js              | `getStatusEmoji`, `generateSummaryContent`, etc.       | `BacklogManager`         | Markdown generation is pure         |
| session_manager.js      | `generateSessionId`, `createSessionEntry`, etc.        | `SessionManager`         | Session logic is deterministic      |
| metrics.js              | `calculateDuration`, `formatMetrics`, etc.             | `MetricsCollector`       | Metric calculations are pure        |
| file_operations.js      | `validatePath`, `filterByExtension`, etc.              | `FileOperations`         | Path validation is testable         |
| edit_operations.js      | `findMatches`, `replaceAll`, `generateDiff`, etc.      | `EditOperations`         | Text manipulation is pure           |
| argument_parser.js      | `parseArguments`, `validateArguments`, etc.            | `ArgumentParser`         | CLI parsing logic is testable       |
| cleanup_handlers.js     | `filterByAge`, `calculateTotalSize`, etc.              | `CleanupManager`         | Cleanup decisions are deterministic |
| utils.js                | All functions (no wrapper class)                       | N/A (pure only)          | Reusable pure utilities             |
| git_automation.js       | `parseGitStatus`, `parseGitDiff`, etc.                 | `GitAutomation`          | Git output parsing is testable      |
| git_cache.js            | `isCacheValid`, `calculateCacheKey`, etc.              | `GitCache`               | Cache validation is deterministic   |
| auto_commit.js          | `generateCommitMessage`, `shouldCommitFile`, etc.      | `AutoCommit`             | Commit logic is testable            |
| change_detection.js     | `categorizeFile`, `analyzeChanges`, etc.               | `ChangeDetector`         | Change categorization is pure       |
| jq_wrapper.js           | `validateJson`, `buildJqCommand`, etc.                 | `JqWrapper`              | JSON processing logic is testable   |
| ai_personas.js          | `getPersonaById`, `validatePersona`, etc.              | N/A (pure only)          | Persona lookup is deterministic     |
| ai_validation.js        | `validateResponse`, `calculateConfidenceScore`, etc.   | N/A (pure only)          | Validation logic is testable        |
| ai_cache.js             | `isCacheValid`, `calculateCacheStats`, etc.            | `AiCache`                | Cache logic is deterministic        |
| ai_prompt_builder.js    | `buildPromptFromTemplate`, `formatCodeBlock`, etc.     | `PromptBuilder`          | Prompt generation is testable       |
| ai_helpers.js           | `parseAiResponse`, `shouldRetry`, etc.                 | `AiHelper`               | Response parsing is testable        |
| step1_parallel.js       | `createValidationTask`, `mergeValidationResults`, etc. | `Step1ParallelProcessor` | Parallel validation is testable     |
| workflow_engine.js      | `validateWorkflowConfig`, `buildExecutionPlan`, etc.   | `WorkflowEngine`         | Workflow logic is testable          |
| step_registry.js        | `createStepDefinition`, `validateStepMetadata`, etc.   | `StepRegistry`           | Step management is deterministic    |
| dependency_resolver.js  | `buildDependencyGraph`, `topologicalSort`, etc.        | `DependencyResolver`     | Graph algorithms are testable       |
| step_executor.js        | `validateStepInput`, `calculateTimeout`, etc.          | `StepExecutor`           | Execution logic is testable         |
| conditional_executor.js | `shouldSkipStep`, `evaluateCondition`, etc.            | `ConditionalExecutor`    | Conditional logic is testable       |
| checkpoint_manager.js   | `createCheckpointData`, `validateCheckpoint`, etc.     | `CheckpointManager`      | Checkpoint logic is testable        |

**See:** `.github/REFERENTIAL_TRANSPARENCY.md` for complete guide and examples.

---

## Coding Standards & Conventions

### Documentation Standards

From project conventions:

- **File paths**: Always use inline code: `` `config/.workflow-config.yaml.template` ``
- **Commands**: Use code blocks or inline code: `` `git submodule add ...` ``
- **Configuration values**: Use inline code: `` `primary_language: "bash"` ``
- **Status indicators**: Use emoji: ✅ ❌ ⚠️ 🚧
- **Placeholders**: Keep `{{PLACEHOLDER}}` format in templates

### Template File Standards

**Template Naming:**

- Use `.template` extension for files that need customization
- Users copy without extension and replace placeholders

**Placeholder Format:**

```yaml
# In templates (ai_workflow_core):
project:
  name: "{{PROJECT_NAME}}"
  language: "{{LANGUAGE}}"

# In user projects (after customization):
project:
  name: "My Actual Project"
  language: "javascript"
```

**YAML Standards:**

- 2-space indentation
- Quote string values
- Comment complex sections
- Group related configurations
- Document required vs optional fields

### Script Standards (for templates)

For `.template` scripts:

```bash
#!/usr/bin/env bash
# Script name and purpose
# Placeholders: {{PROJECT_ROOT}}, {{ARTIFACT_DIR}}

set -euo pipefail

# Configuration with placeholders
readonly PROJECT_ROOT="{{PROJECT_ROOT}}"
readonly ARTIFACT_DIR="{{ARTIFACT_DIR}}"
```

### Commit Message Convention

Format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:

```
feat(config): Add TypeScript project kind

- Add typescript_app to project_kinds.yaml
- Define linting with tslint/eslint
- Set coverage threshold to 80%

Closes #123
```

---

## Key Documentation References

When assisting with this project, reference these critical documents:

### Essential Reading

1. **README.md**: Project overview and current implementation status
2. **CHANGELOG.md**: Version history and notable changes
3. **docs/README.md**: Documentation index and navigation guide
4. **docs/api/README.md**: Complete API reference for all modules (Phases 1-5)
5. **docs/FUNCTIONAL_REQUIREMENTS.md**: Detailed module requirements and specifications

### Getting Started

6. **docs/getting-started/QUICK_START.md**: Get up and running in 5 minutes
7. **docs/getting-started/INSTALLATION.md**: Detailed installation for all platforms
8. **docs/getting-started/FIRST_WORKFLOW.md**: Build your first workflow step-by-step

### Guides

9. **docs/guides/DEVELOPER_GUIDE.md**: Contributing and development workflow
10. **docs/guides/USER_GUIDE.md**: End-user documentation
11. **docs/guides/CONFIGURATION_GUIDE.md**: Configuration options and patterns
12. **docs/guides/TESTING_GUIDE.md**: Testing patterns and best practices

### Architecture Documentation (Phase D - NEW)

13. **docs/architecture/OVERVIEW.md**: High-level system design and layered architecture
14. **docs/architecture/DESIGN_PRINCIPLES.md**: Design patterns and referential transparency
15. **docs/architecture/MODULE_STRUCTURE.md**: Module organization across 5 phases
16. **docs/architecture/DEPENDENCY_GRAPH.md**: Module dependencies with visual diagrams

### Reference Materials (Phase D - NEW)

17. **docs/reference/ERROR_CODES.md**: Complete error reference (6 categories, 23 codes)
18. **docs/reference/CONFIGURATION_SCHEMA.md**: Configuration file schema with JSON Schema
19. **docs/reference/CLI_REFERENCE.md**: Command-line interface reference (future Phase 11)

### Examples (Phase D - NEW)

20. **docs/examples/basic/README.md**: 5 basic workflow examples
21. **docs/examples/advanced/README.md**: 5 advanced patterns with complex workflows
22. **docs/examples/integration/README.md**: 6 integration examples (GitHub, GitLab, Jenkins, Docker, etc.)

### Implementation Documentation

23. **docs/reports/implementation/MIGRATION_PLAN.md**: Comprehensive migration strategy from shell to JavaScript
24. **docs/WORKFLOW_ENGINE_REQUIREMENTS.md**: Phase 7 planning and orchestration specifications
25. **docs/PHASE_D_COMPLETION_SUMMARY.md**: Phase D documentation completion summary
26. **docs/guides/PHASE_C_COMPLETION_SUMMARY.md**: Phase C guides completion summary

### Project Files

27. **CONTRIBUTING.md**: Guidelines for contributing to the project
28. **LICENSE**: MIT License
29. **.workflow-config.yaml**: Project-specific configuration (dogfooding example)

---

## Development Workflow

### Working on Core Modules

When adding or modifying modules in `src/`:

1. Follow the referential transparency pattern (v2.0.0): pure functions + impure wrapper
2. Write comprehensive tests (both pure function tests and integration tests)
3. Update API documentation in `docs/api/` if adding new public methods
4. Add JSDoc comments for all exported functions and classes
5. Run linters and formatters: `npm run lint` and `npm run format`
6. Ensure 100% test pass rate: `npm test`
7. Update CHANGELOG.md for significant changes

### Adding New Modules

When creating a new module:

1. Determine which phase it belongs to (Phase 1-13)
2. Follow the module template from existing modules
3. Extract pure functions first, then create wrapper class
4. Write tests before implementation (TDD)
5. Add module to `src/index.js` exports
6. Create API documentation in `docs/api/`
7. Update dependency graph in `docs/architecture/DEPENDENCY_GRAPH.md`
8. Update module list in README.md and copilot-instructions.md

### Working on Documentation

When creating or updating documentation:

1. Follow existing structure in `docs/` directory
2. Use professional technical writing style
3. Include code examples and usage patterns
4. Cross-reference related documentation
5. Update `docs/README.md` navigation links
6. Run validation: `npm run lint:docs` (if available)
7. Keep "Last Updated" dates current

### Testing Changes

For this implementation repository:

1. **Unit tests**: Run `npm test` (all 1694 tests passing)
2. **Code coverage**: Maintain high coverage across all modules
3. **Linting**: Run `npm run lint` (ESLint 9.x)
4. **Formatting**: Run `npm run format` (Prettier 3.x)
5. **Integration tests**: Verify wrapper classes work with real I/O
6. **Documentation tests**: Ensure all examples compile and run

### Documentation Updates

When updating documentation:

- Follow documentation conventions (inline code for paths, commands, config values)
- Update table of contents for long documents
- Include examples for complex concepts
- Test all commands and code examples if applicable
- Keep "Last Updated" dates current
- **Remember**: Some docs in `docs/guides/` reference parent ai_workflow features

---

## Common Assistance Patterns

### When Helping with Configuration Files

- Always preserve `{{PLACEHOLDER}}` syntax in template files
- Don't replace placeholders with specific values in core templates
- Validate YAML syntax (proper indentation, quoting)
- Check against existing project kind schemas in `config/project_kinds.yaml`
- Consider backward compatibility with existing integrations
- Document any new placeholders in README.md

### When Helping with Documentation

- Use inline code for file paths: `` `config/.workflow-config.yaml.template` ``
- Follow markdown conventions consistently
- Add examples for complex concepts
- Link to related configuration files or examples
- Keep language clear and concise
- Be aware some docs reference parent ai_workflow features

### When Helping with Script Templates

- Keep `.template` extension on template files
- Document required placeholder substitutions in comments
- Ensure cross-platform compatibility where possible (bash vs. platform-specific)
- Add usage examples in script header comments or accompanying README
- Use placeholder format: `{{PLACEHOLDER_NAME}}`

### When Helping with Integration

- Understand this project is used as a Git submodule, not standalone
- Guide through: add submodule → copy template → replace placeholders → create directories
- Reference appropriate example project (`examples/shell/` or `examples/nodejs/`)
- Explain `.ai_workflow/` directory purpose and `.gitignore` patterns
- Clarify this repo provides templates, not execution capabilities

### When Helping with Project Kinds

- Reference existing definitions in `config/project_kinds.yaml`
- Understand the schema: validation, testing, quality, dependencies, build, deployment, ai_guidance
- Know which linters and frameworks are standard for each project type
- Be aware of language-specific best practices in `ai_guidance` sections
- Consider test coverage thresholds (varies by project type: 0-80%)

### When Helping with GitHub Workflows

- Reference existing workflow files in `github/workflows/`
- Current workflows: `code-quality.yml`, `validate-docs.yml`, `validate-tests.yml`
- These are templates that projects can copy and customize
- Workflows assume the target project structure, not this repo's structure
- Workflows are language-agnostic and can be adapted for different project types

---

## Important Context

### This is a JavaScript/Node.js Implementation

**What this repository IS:**

- A Node.js implementation of AI workflow automation
- Complete migration from shell-based ai_workflow to JavaScript
- 46 modules (5 Core + 1 Utils + 34 Library + 6 Orchestrator) + 17 workflow steps with 3416 of 3435 tests passing
- Referentially transparent architecture (pure functions + impure wrappers)
- Comprehensive documentation (48+ files in docs/ directory)
- Active development with 7 of 13 phases complete (Phases 1-7 done) + 17 Phase 9 steps

**What this repository IS NOT:**

- A simple shell-to-JavaScript translation (it's a complete redesign)
- A finished product (Phases 8-13 are still in development)
- A template or configuration library (it's a full implementation)

**Key Points:**

- **ai_workflow.js** = This repository (JavaScript implementation in progress)
- **ai_workflow** = Source repository (Shell/Bash v3.0.0, fully functional)
- **Migration approach**: Extract behaviors from shell scripts, redesign in modern JavaScript
- **Architecture**: Referential transparency with pure functions and impure wrappers
- **Testing**: All 1694 tests passing, high code coverage

### Documentation Context

All documentation in `docs/` is specifically for **ai_workflow.js** (this repository):

- **Architecture docs**: Describe the JavaScript implementation's design
- **API docs**: Document the Node.js modules and their APIs
- **Guides**: Cover development and usage of this JavaScript implementation
- **Examples**: Show workflows for the JavaScript version (future Phase 7+)
- **Reference**: Error codes, configuration schema, CLI reference for this implementation

### Development Status

**Completed (Phases 1-7):**

- ✅ Phase 1: Core Foundation (v1.0.0) - 7 modules, 113 tests
- ✅ Phase 2: Configuration & State Management (v2.0.0) - 4 modules, 174 tests
- ✅ Phase 3: File Operations & Utilities (v2.0.0) - 5 modules, 354 tests
- ✅ Phase 4: Project Detection & Analysis (v1.0.0) - 4 modules, 167 tests
- ✅ Phase 5: Git Integration (v2.0.0) - 4 modules, 219 tests
- ✅ Phase 6: AI Integration (v2.0.0) - 6 modules, 424 tests (3 failures)
- ✅ Phase 7: Workflow Orchestration (v2.0.0) - 6 modules, 329 tests

**In Progress:**

- 🚧 Phase 8: Performance Optimization (v2.0.0) - 1 module (step1_parallel), 646 tests (628 passing, 18 skipped)

**Planned:**

- 📋 Phase 9-11: Future phases (CLI, monitoring, deployment, etc.)

### Dual Development Context

When working on this repository, you might be:

1. **Implementing new modules**: Adding Phase 6+ functionality
2. **Improving existing modules**: Refactoring, optimizing, bug fixes
3. **Writing documentation**: API docs, guides, examples
4. **Writing tests**: Unit tests, integration tests
5. **Dogfooding**: Using ai_workflow.js to develop itself (via `.workflow-config.yaml`)

Always clarify which context applies to the current task.

### Version Information

- **Project version**: 1.2.0
- **Phase 1, 4 modules**: v1.0.0
- **Phase 2, 3, 5, 6, 7, 8 modules**: v2.0.0 (referentially transparent)
- **Node.js requirement**: >= 18.0.0
- **npm requirement**: >= 9.0.0
- **Test suite**: All 1694 tests passing

### Repository Scope

**This repository contains:**

- **Source code** (46 modules + 17 workflow steps in `src/`):
  - Core foundation (5 modules: colors, logger, system, version, executor)
  - Utils layer (1 module: errors)
  - Library modules (34 modules: config, backlog, session_manager, metrics, file operations, git automation, AI integration, step1_parallel, etc.)
  - Orchestrator modules (6 modules: workflow_engine, step_registry, dependency_resolver, step_executor, conditional_executor, checkpoint_manager)
  - Step implementations (17 workflow steps)
  - Entry point (1 module: index.js)
- **Comprehensive test suite** (67 test files in `test/`): 3416 of 3435 tests passing (18 skipped, 1 known failure) ⚠️
- **Documentation** (48 files in `docs/`): API reference, guides, architecture, reference, examples
- **Configuration files**: `.workflow-config.yaml`, `package.json`, `jest.config.json`, `eslint.config.mjs`
- **GitHub integration**: `.github/copilot-instructions.md`, workflows
- **Submodule**: `.workflow_core/` (configuration templates from ai_workflow_core project)

**This repository does NOT yet contain:**

- CLI layer (Phase 11 - future)
- Monitoring and observability (Phase 8 - future)
- Advanced CI/CD integrations (Phase 9-10 - future)

**Terminology Standards:**

- Module versions: v1.0.0 (Phase 1, 4) or v2.0.0 (Phase 2, 3, 5)
- Architecture pattern: Pure functions + impure wrappers (referential transparency)
- Testing: Jest framework with AAA pattern (Arrange, Act, Assert)
- Naming: camelCase for functions/variables, PascalCase for classes
- Code style: ESLint 9.x + Prettier 3.x

---

## Quick Reference

### Common Commands

```bash
# Install dependencies
npm install

# Run tests (1694 tests)
npm test

# Run linting
npm run lint

# Run formatting
npm run format

# Check test coverage
npm test -- --coverage
cp .workflow_core/config/.workflow-config.yaml.template .workflow-config.yaml

# Create artifact directories
mkdir -p .ai_workflow/{backlog,summaries,logs,metrics,checkpoints,prompts,ml_models,.incremental_cache}

# Run validation script
python3 scripts/validate_context_blocks.py docs/
```

### Placeholder Substitution Pattern

```bash
# Don't do this in core templates:
❌ name: "My Project"

# Do this in core templates:
✅ name: "{{PROJECT_NAME}}"

# Users do this in their projects:
✅ name: "My Actual Project"
```

---

## Contact & Resources

- **Repository**: [github.com/mpbarbosa/ai_workflow_core](https://github.com/mpbarbosa/ai_workflow_core)
- **Issues**: [GitHub Issues](https://github.com/mpbarbosa/ai_workflow_core/issues)
- **Original Project**: [github.com/mpbarbosa/ai_workflow](https://github.com/mpbarbosa/ai_workflow)
- **License**: MIT (see docs/LICENSE)

---

**Last Updated**: 2026-01-29  
**Document Version**: 1.0.0  
**For**: GitHub Copilot assistance within ai_workflow_core repository
