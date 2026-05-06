## API_DOCS_INDEX

# API Documentation Index

**AI Workflow Automation v2.0.0**
**Generated:** 2026-02-07

Complete API reference for all modules in the ai_workflow.js project (Phase 1-7).

---

## Quick Navigation

### Phase 1: Core Modules

- **[colors](./core/colors.md)** - ANSI color codes and terminal color support
- **[logger](./core/logger.md)** - Colored logging with multiple log levels
- **[system](./core/system.md)** - OS detection and system information
- **[version](./core/version.md)** - Semantic version parsing and comparison
- **[executor](./core/executor.md)** - Shell command execution utilities
- **[errors](./utils/errors.md)** - Custom error types

### Phase 2: Configuration & Workflow

- **[config](./lib/config.md)** - Workflow configuration and path management
- **[backlog](./lib/backlog.md)** - Workflow summaries and backlog reports
- **[session_manager](./lib/session_manager.md)** - Session lifecycle management
- **[metrics](./lib/metrics.md)** - Metrics collection and reporting

### Phase 3: File Operations & Utilities

- **[file_operations](./lib/file_operations.md)** - File system operations
- **[edit_operations](./lib/edit_operations.md)** - File content editing utilities
- **[utils](./lib/utils.md)** - General utility functions
- **[argument_parser](./lib/argument_parser.md)** - CLI argument parsing
- **[cleanup_handlers](./lib/cleanup_handlers.md)** - Cleanup operations

### Phase 4: Project Detection

- **[project_kind_detection](./lib/project_kind_detection.md)** - Auto-detect project type
- **[project_kind_config](./lib/project_kind_config.md)** - Load project configs
- **[tech_stack](./lib/tech_stack.md)** - Detect tech stack
- **[third_party_exclusion](./lib/third_party_exclusion.md)** - Filter third-party files

### Phase 5: Git Integration

**⚠️ API documentation pending**

- **git_automation** - Git operations
- **git_cache** - Git caching
- **auto_commit** - Auto-commit artifacts
- **change_detection** - Change detection

### Phase 6: AI Integration

**⚠️ API documentation pending**

- **jq_wrapper** - JSON processing
- **ai_personas** - AI personas
- **ai_validation** - AI validation
- **ai_cache** - AI caching
- **ai_prompt_builder** - Prompt building
- **ai_helpers** - AI helpers

### Phase 7: Orchestrator

- **[workflow_engine](./orchestrator/workflow_engine.md)** - Core workflow orchestration
- **[step_registry](./orchestrator/step_registry.md)** - Step registration and management
- **[dependency_resolver](./orchestrator/dependency_resolver.md)** - Dependency resolution
- **[step_executor](./orchestrator/step_executor.md)** - Step execution with retry
- **[conditional_executor](./orchestrator/conditional_executor.md)** - Conditional execution
- **[checkpoint_manager](./orchestrator/checkpoint_manager.md)** - Checkpoint management

---

## Module Overview by Category

### Core Infrastructure (Phase 1)

**6 Modules | Pure Functions & Classes**

| Module                         | Purpose           | Key Features                                   |
| ------------------------------ | ----------------- | ---------------------------------------------- |
| [colors](./core/colors.md)     | Terminal colors   | ANSI codes, color support detection            |
| [logger](./core/logger.md)     | Logging           | Multi-level logging, quiet/verbose modes       |
| [system](./core/system.md)     | System info       | OS detection, package manager detection        |
| [version](./core/version.md)   | Versioning        | Semver parsing, version comparison             |
| [executor](./core/executor.md) | Command execution | Shell commands, streaming output, sudo support |
| [errors](./utils/errors.md)    | Error handling    | Custom error types with context                |

### Configuration & Workflow (Phase 2)

**4 Modules | Pure Functions + Wrappers**

| Module | Purpose | Key Features |
| ------ | ------- | ------------ |

---

## README

# API Reference

**Version:** 2.3.1
**Last Updated:** February 7, 2026

Complete API documentation for ai_workflow.js modules (Phase 1-8).

**✅ Phase 4 Complete:** Project Detection modules now fully documented!
**✅ Phase 5 Complete:** Git Integration modules now fully documented!
**✅ Phase 6 Complete:** AI Integration modules now fully documented!
**✅ Phase 7 Complete:** Orchestrator modules now fully documented!
**🚧 Phase 8 In Progress:** Performance Optimization (step1_parallel)

## 📦 Module Categories

### Core Modules (Phase 1 - v1.0.0)

Foundation utilities providing basic functionality:

- **[colors](./core/colors.md)** - ANSI color codes with terminal support detection
- **[logger](./core/logger.md)** - Colored logging system with multiple severity levels
- **[system](./core/system.md)** - OS detection and system configuration
- **[version](./core/version.md)** - Semantic version parsing and comparison
- **[executor](./core/executor.md)** - Command execution with async/streaming support

### Library Modules (Phase 2-5 - v2.0.0 or v1.0.0)

Core libraries implementing business logic:

#### Configuration & State Management (Phase 2)

- **[config](./lib/config.md)** - Configuration file management with validation
- **[backlog](./lib/backlog.md)** - Workflow summary and backlog reporting
- **[session_manager](./lib/session_manager.md)** - Session lifecycle management
- **[metrics](./lib/metrics.md)** - Performance metrics collection and reporting

#### File Operations (Phase 3)

- **[file_operations](./lib/file_operations.md)** - File system operations (read, write, copy, etc.)
- **[edit_operations](./lib/edit_operations.md)** - File editing utilities (find, replace, diff, etc.)
- **[utils](./lib/utils.md)** - General utility functions (string, array, object helpers)
- **[argument_parser](./lib/argument_parser.md)** - CLI argument parsing with validation
- **[cleanup_handlers](./lib/cleanup_handlers.md)** - Cleanup operations (temp files, cache, etc.)

### Utility Modules (Phase 1 - v1.0.0)

Helper utilities:

- **[errors](./utils/errors.md)** - Custom error class hierarchy for workflow errors

#### Project Detection (Phase 4 - v1.0.0)

- **[project_kind_detection](./lib/project_kind_detection.md)** - Auto-detect project type from file patterns
- **[project_kind_config](./lib/project_kind_config.md)** - Load/parse project configs from YAML
- **[tech_stack](./lib/tech_stack.md)** - Detect languages, frameworks, tools
- **[third_party_exclusion](./lib/third_party_exclusion.md)** - Filter third-party files from analysis

#### Git Integration (Phase 5 - v2.0.0)

- **[git_automation](./lib/git_automation.md)** - Git operations (status, diff, commit)
- **[git_cache](./lib/git_cache.md)** - Git operation caching with invalidation
- **[auto_commit](./lib/auto_commit.md)** - Automatic artifact commits
- **[change_detection](./lib/change_detection.md)** - File change detection and categorization

#### AI Integration (Phase 6 - v2.0.0)

- **[jq_wrapper](./lib/jq_wrapper.md)** - JSON processing with jq CLI
- **[ai_personas](./lib/ai_personas.md)** - AI persona management
- **[ai_validation](./lib/ai_validation.md)** - AI response validation
- **[ai_cache](./lib/ai_cache.md)** - AI response caching
- **[ai_prompt_builder](./lib/ai_prompt_builder.md)** - AI prompt construction
- **[ai_helpers](./lib/ai_helpers.md)** - AI helper utilities

#### Performance Optimization (Phase 8 - v2.0.0) 🚧

- **[step1_parallel](./lib/step1_parallel.md)** - Parallel documentation validation for Step 1

### Orchestrator Modules (Phase 7 - v2.0.0)

Workflow orchestration and execution management:

- **[workflow_engine](./orchestrator/workflow_engine.md)** - Core workflow orchestration engine
- **[step_registry](./orchestrator/step_registry.md)** - Step definition and registration
- **[dependency_resolver](./orchestrator/dependency_resolver.md)** - Dependency graph and topological sort
- **[step_executor](./orchestrator/step_executor.md)** - Step execution

---

## README

# API Reference

**Version:** 2.3.1
**Last Updated:** February 7, 2026

Complete API documentation for ai_workflow.js modules (Phase 1-8).

**✅ Phase 4 Complete:** Project Detection modules now fully documented!
**✅ Phase 5 Complete:** Git Integration modules now fully documented!
**✅ Phase 6 Complete:** AI Integration modules now fully documented!
**✅ Phase 7 Complete:** Orchestrator modules now fully documented!
**🚧 Phase 8 In Progress:** Performance Optimization (step1_parallel)

## 📦 Module Categories

### Core Modules (Phase 1 - v1.0.0)

Foundation utilities providing basic functionality:

- **[colors](./core/colors.md)** - ANSI color codes with terminal support detection
- **[logger](./core/logger.md)** - Colored logging system with multiple severity levels
- **[system](./core/system.md)** - OS detection and system configuration
- **[version](./core/version.md)** - Semantic version parsing and comparison
- **[executor](./core/executor.md)** - Command execution with async/streaming support

### Library Modules (Phase 2-5 - v2.0.0 or v1.0.0)

Core libraries implementing business logic:

#### Configuration & State Management (Phase 2)

- **[config](./lib/config.md)** - Configuration file management with validation
- **[backlog](./lib/backlog.md)** - Workflow summary and backlog reporting
- **[session_manager](./lib/session_manager.md)** - Session lifecycle management
- **[metrics](./lib/metrics.md)** - Performance metrics collection and reporting

#### File Operations (Phase 3)

- **[file_operations](./lib/file_operations.md)** - File system operations (read, write, copy, etc.)
- **[edit_operations](./lib/edit_operations.md)** - File editing utilities (find, replace, diff, etc.)
- **[utils](./lib/utils.md)** - General utility functions (string, array, object helpers)
- **[argument_parser](./lib/argument_parser.md)** - CLI argument parsing with validation
- **[cleanup_handlers](./lib/cleanup_handlers.md)** - Cleanup operations (temp files, cache, etc.)

### Utility Modules (Phase 1 - v1.0.0)

Helper utilities:

- **[errors](./utils/errors.md)** - Custom error class hierarchy for workflow errors

#### Project Detection (Phase 4 - v1.0.0)

- **[project_kind_detection](./lib/project_kind_detection.md)** - Auto-detect project type from file patterns
- **[project_kind_config](./lib/project_kind_config.md)** - Load/parse project configs from YAML
- **[tech_stack](./lib/tech_stack.md)** - Detect languages, frameworks, tools
- **[third_party_exclusion](./lib/third_party_exclusion.md)** - Filter third-party files from analysis

#### Git Integration (Phase 5 - v2.0.0)

- **[git_automation](./lib/git_automation.md)** - Git operations (status, diff, commit)
- **[git_cache](./lib/git_cache.md)** - Git operation caching with invalidation
- **[auto_commit](./lib/auto_commit.md)** - Automatic artifact commits
- **[change_detection](./lib/change_detection.md)** - File change detection and categorization

#### AI Integration (Phase 6 - v2.0.0)

- **[jq_wrapper](./lib/jq_wrapper.md)** - JSON processing with jq CLI
- **[ai_personas](./lib/ai_personas.md)** - AI persona management
- **[ai_validation](./lib/ai_validation.md)** - AI response validation
- **[ai_cache](./lib/ai_cache.md)** - AI response caching
- **[ai_prompt_builder](./lib/ai_prompt_builder.md)** - AI prompt construction
- **[ai_helpers](./lib/ai_helpers.md)** - AI helper utilities

#### Performance Optimization (Phase 8 - v2.0.0) 🚧

- **[step1_parallel](./lib/step1_parallel.md)** - Parallel documentation validation for Step 1

### Orchestrator Modules (Phase 7 - v2.0.0)

Workflow orchestration and execution management:

- **[workflow_engine](./orchestrator/workflow_engine.md)** - Core workflow orchestration engine
- **[step_registry](./orchestrator/step_registry.md)** - Step definition and registration
- **[dependency_resolver](./orchestrator/dependency_resolver.md)** - Dependency graph and topological sort
- **[step_executor](./orchestrator/step_executor.md)** - Step execution
