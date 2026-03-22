# Architecture Overview

**Version:** 1.9.0
**Last Updated:** February 8, 2026

This document provides a high-level overview of the ai_workflow.js architecture, design patterns, and module organization.

## Table of Contents

- [System Architecture](#system-architecture)
- [Design Principles](#design-principles)
- [Referential Transparency Architecture](#referential-transparency-architecture)
- [Module Organization](#module-organization)
- [Dependency Management](#dependency-management)
- [Data Flow](#data-flow)
- [Extension Points](#extension-points)

## System Architecture

### Layered Architecture

ai_workflow.js follows a layered architecture with clear separation of concerns:

```
┌──────────────────────────────────────────────────┐
│         CLI Layer (Phase 11 - Future)            │
│  - Command-line interface                        │
│  - User interaction                              │
│  - Progress indicators                           │
└─────────────────┬────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────┐
│     Workflow Engine (Phase 7 - Complete ✅)      │
│  - Step orchestration                            │
│  - Dependency management                         │
│  - Parallel execution                            │
│  - Checkpoint/resume                             │
└─────────────────┬────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────┐
│      AI Integration (Phase 6 - Complete ✅)      │
│  - GitHub Copilot integration                    │
│  - AI personas                                   │
│  - Response caching                              │
│  - Prompt engineering                            │
└─────────────────┬────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────┐
│     Git Integration (Phase 5 - Complete)         │
│  - Git operations                                │
│  - Git caching                                   │
│  - Auto-commit                                   │
│  - Change detection                              │
└─────────────────┬────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────┐
│   Project Detection (Phase 4 - Complete)         │
│  - Project type detection                        │
│  - Tech stack analysis                           │
│  - Dependency analysis                           │
│  - Third-party exclusion                         │
└─────────────────┬────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────┐
│   File Operations Layer (Phase 3 - Complete)     │
│  - File system operations                        │
│  - File editing utilities                        │
│  - Cleanup handlers                              │
│  - General utilities                             │
└─────────────────┬────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────┐
│  Configuration & State (Phase 2 - Complete)      │
│  - Configuration management                      │
│  - Session lifecycle                             │
│  - Metrics collection                            │
│  - Backlog reporting                             │
└─────────────────┬────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────┐
│    Core Foundation (Phase 1 - Complete)          │
│  - Logging system                                │
│  - OS detection                                  │
│  - Command execution                             │
│  - Version handling                              │
│  - Error management                              │
└──────────────────────────────────────────────────┘
```

### Current Implementation Status

**✅ Complete Layers:**

- **Phase 1**: Core Foundation (v1.0.0) - 7 modules
- **Phase 2**: Configuration & State (v2.0.0) - 4 modules
- **Phase 3**: File Operations (v2.0.0) - 5 modules
- **Phase 4**: Project Detection (v1.0.0) - 4 modules
- **Phase 5**: Git Integration (v2.0.0) - 4 modules

**🚧 Upcoming Layers:**

- Phase 6: AI Integration
- Phase 7: Workflow Engine
- Phase 11: CLI Layer

## Design Principles

### 1. Separation of Concerns

Each module has a single, well-defined responsibility:

- **Core modules** provide foundational utilities
- **Library modules** implement business logic
- **CLI modules** (future) handle user interaction
- **Orchestrator modules** (future) coordinate workflows

### 2. Referential Transparency (v2.0.0)

Phase 2, 3, and 5 modules follow a pure functional architecture:

```javascript
// Pure functions - Exported for testing
export function generateSessionId(randomBytes) {
  return randomBytes.toString('hex');
}

export function createSessionEntry(sessionId, currentTime, metadata) {
  return { id: sessionId, startTime: currentTime, ...metadata };
}

// Impure wrapper - Handles side effects
export class SessionManager {
  createSession(metadata = {}) {
    const randomBytes = crypto.randomBytes(16); // Side effect
    const sessionId = generateSessionId(randomBytes); // Pure
    const entry = createSessionEntry(sessionId, Date.now(), metadata); // Pure
    this.sessions.set(sessionId, entry); // Side effect
    return sessionId;
  }
}
```

**Benefits:**

- **Testability**: Pure functions have deterministic tests
- **Predictability**: Same inputs always produce same outputs
- **Composability**: Functions can be freely combined
- **Maintainability**: Side effects are isolated and obvious

### 3. Minimal Dependencies

- Single production dependency: `@github/copilot-sdk`
- No heavy frameworks
- Focused dev dependencies (jest, eslint, prettier)
- Standard library usage where possible

### 4. Cross-Platform Compatibility

- Works on Linux, macOS, and Windows
- Node.js >= 20.0.0
- Platform-specific code isolated in `system.js`
- Path handling with Node.js `path` module

### 5. Comprehensive Testing

- 3435 tests (3417 passing, 18 skipped)
- Unit tests for pure functions (deterministic)
- Integration tests for side effects
- High code coverage (>95%)
- Test structure mirrors source structure

## Referential Transparency Architecture

### Pattern Structure

```text
┌────────────────────────────────────────────────┐
│     Application Layer (Impure Classes)        │
│  - File I/O, console logging                  │
│  - State management                           │
│  - Time/random injection                      │
├────────────────────────────────────────────────┤
│           Pure Functions Layer                │
│  - Business logic                             │
│  - Data transformations                       │
│  - Calculations                               │
│  - No side effects                            │
└────────────────────────────────────────────────┘
```

### Implementation Example

**Module: config.js (v2.0.0)**

```javascript
// ========================================
// PURE FUNCTIONS - Exported for testing
// ========================================

export function parseYamlSync(yamlContent) {
  return yaml.parse(yamlContent);
}

export function validateConfig(config, schema) {
  // Validation logic (pure)
  return { valid: true, errors: [] };
}

export function mergeConfigs(base, override) {
  // Deep merge logic (pure, immutable)
  return { ...base, ...override };
}

// ========================================
// IMPURE WRAPPER - Side effects isolated
// ========================================

export class Config {
  constructor() {
    this.config = null; // State
  }

  async loadConfig(filePath) {
    const content = await fs.readFile(filePath, 'utf8'); // Side effect: I/O
    const parsed = parseYamlSync(content); // Pure function
    const validated = validateConfig(parsed, schema); // Pure function

    if (!validated.valid) {
      throw new ConfigError(validated.errors); // Side effect: throw
    }

    this.config = parsed; // Side effect: state mutation
    logger.info(`Config loaded: ${filePath}`); // Side effect: logging
    return this.config;
  }
}
```

### Modules Using This Pattern

| Module                    | Pure Functions                        | Wrapper Class       |
| ------------------------- | ------------------------------------- | ------------------- |
| config.js                 | parseYamlSync, validateConfig, merge  | Config              |
| backlog.js                | getStatusEmoji, generateContent       | Backlog             |
| session_manager.js        | generateSessionId, createEntry        | SessionManager      |
| metrics.js                | calculateDuration, formatMetrics      | Metrics             |
| file_operations.js        | validatePath, filterByExtension       | FileOperations      |
| edit_operations.js        | findMatches, replaceAll, generateDiff | EditOperations      |
| argument_parser.js        | parseArguments, validateArguments     | ArgumentParser      |
| cleanup_handlers.js       | filterByAge, calculateTotalSize       | CleanupManager      |
| project_kind_detection.js | detectFromFiles, scoreConfidence      | ProjectKindDetector |
| project_kind_config.js    | parseProjectKind, mergeOverrides      | ProjectKindConfig   |
| tech_stack.js             | detectLanguages, detectFrameworks     | TechStackDetector   |
| third_party_exclusion.js  | parseGitignore, applyPatterns         | ThirdPartyExcluder  |
| utils.js                  | All functions (no wrapper)            | N/A (pure only)     |

## Module Organization

### Directory Structure

**Project root:**

```text
ai_workflow.js/
├── src/                   # Application source code
├── test/                  # Jest test suite (mirrors src/ structure)
├── docs/                  # Project documentation
├── scripts/               # Automation shell and Node.js scripts
├── .github/               # GitHub configuration and Copilot instructions
├── .workflow_core/        # Git submodule — shared config templates and docs
├── .ai_workflow/          # Runtime artifacts (gitignored): logs, metrics, backlog, cache
├── .test-cache/           # Jest transform/module cache (auto-generated, gitignored, safe to delete)
├── .test-e2e/             # End-to-end test run artifacts — temp dirs created per test session
│   ├── detect-*/          #   Project-detection test working directories
│   ├── step-02-*/         #   Step-02 consistency test working directories
│   └── step-02-artefacts-*/ # Step-02 output artefact snapshots used for assertions
├── .test-step-11-5/       # Step-11-5 (AWS LBS) isolated test fixtures (auto-generated, gitignored)
└── coverage/              # Jest coverage output (gitignored)
```

**`src/` tree:**

```text
src/
├── core/                  # Phase 1: Foundation (v1.0.0)
│   ├── colors.js          # ANSI color codes
│   ├── logger.js          # Logging system
│   ├── system.js          # OS detection
│   ├── version.js         # Semantic versioning
│   └── executor.js        # Command execution
├── utils/                 # Phase 1: Helpers (v1.0.0)
│   └── errors.js          # Custom error classes
├── lib/                   # Phase 2-8: Core libraries (v2.0.0/v1.0.0)
│   ├── config.js                  # Configuration management
│   ├── backlog.js                 # Workflow reporting
│   ├── session_manager.js         # Session lifecycle
│   ├── metrics.js                 # Performance metrics
│   ├── file_operations.js         # File system operations
│   ├── edit_operations.js         # File editing utilities
│   ├── utils.js                   # General utilities (pure)
│   ├── argument_parser.js         # CLI argument parsing
│   ├── cleanup_handlers.js        # Cleanup operations
│   ├── project_kind_detection.js  # Project type detection
│   ├── project_kind_config.js     # Project configuration
│   ├── tech_stack.js              # Tech stack detection
│   └── third_party_exclusion.js   # Third-party filtering
├── steps/                 # Phase 9: Workflow step implementations
│   ├── step_02_5_lib/     # Helper modules for step_02_5 (doc optimization)
│   │   ├── ai_analyzer.js         # AI-powered analysis helpers
│   │   ├── consolidation.js       # Result consolidation logic
│   │   ├── git_analysis.js        # Git diff analysis for docs
│   │   ├── heuristics.js          # Heuristic scoring functions
│   │   ├── reporting.js           # Report generation
│   │   └── version_analysis.js    # Version consistency analysis
│   └── step_*.js          # Individual step implementations
├── cli/                   # Phase 11: CLI commands and utilities
├── orchestrator/          # Phase 7: Workflow orchestration (COMPLETE)
│   ├── workflow_engine.js
│   ├── step_registry.js
│   ├── dependency_resolver.js
│   ├── step_executor.js
│   ├── conditional_executor.js
│   └── checkpoint_manager.js
└── index.js               # Public API exports
```

**`docs/` tree:**

```text
docs/
├── architecture/          # System design and architectural decisions
├── api/                   # Module API reference (auto-generated + manual)
│   ├── core/              # Phase 1 core module docs
│   ├── lib/               # Phase 2-8 library module docs
│   ├── orchestrator/      # Phase 7 orchestrator docs
│   ├── steps/             # Phase 9 workflow step docs
│   └── utils/             # Utility module docs
├── guides/                # How-to guides and tutorials
├── reference/             # Reference material (schemas, error codes, CLI)
├── reports/
│   ├── analysis/          # Code and architecture analysis reports
│   ├── bugfixes/          # Bug fix documentation and root cause analyses
│   └── implementation/    # Migration and implementation planning docs
├── tutorials/             # Step-by-step tutorials for new users
├── workflow-automation/   # Workflow automation usage documentation
└── misc/                  # Miscellaneous documentation artefacts
```

**`.workflow_core/` submodule tree (relevant subdirs):**

```text
.workflow_core/
├── config/                # Shared configuration templates (project_kinds.yaml, ai_helpers.yaml)
├── templates/
│   └── debugging/         # Prompt and config templates for debugging scenarios
├── workflow-templates/    # Reusable workflow definition templates
└── docs/
    ├── developers/        # Developer-facing documentation for workflow_core contributors
    └── workflow-automation/ # Workflow automation integration guides
```

> **Artefact directories** (`.test-cache`, `.test-e2e`, `.test-step-11-5`, `.ai_workflow/`) are auto-generated at runtime and are safe to delete. All are covered by `.gitignore`.

### Module Versioning

- **v1.0.0**: Phase 1 modules (basic architecture) + Phase 4 modules (project detection)
- **v2.0.0**: Phase 2, 3, 5 modules (referential transparency)
- **v3.0.0**: Future modules (full workflow capabilities)

## Dependency Management

### Dependency Graph

```text
┌───────────────────────────────────────┐
│  Phase 4: Project Detection           │
│  project_kind_detection               │
│  project_kind_config                  │
│  tech_stack, third_party_exclusion    │
└──────────────┬────────────────────────┘
               │
┌──────────────▼────────────────────────┐
│     Phase 3: File Operations          │
│  file_operations, edit_operations     │
│  cleanup_handlers, argument_parser    │
└──────────────┬────────────────────────┘
               │
┌──────────────▼────────────────────────┐
│    Phase 2: Configuration & State     │
│  config, session_manager, metrics     │
│  backlog                              │
└──────────────┬────────────────────────┘
               │
┌──────────────▼────────────────────────┐
│     Phase 1: Core Foundation          │
│  logger, system, version, executor    │
│  colors, errors                       │
└───────────────────────────────────────┘
```

**Dependency Rules:**

- Phase 1 modules have no dependencies on Phase 2+
- Phase 2 modules depend only on Phase 1
- Phase 3 modules depend on Phase 1-2
- Phase 4 modules depend on Phase 1-3
- No circular dependencies
- Future phases build on completed phases

### External Dependencies

**Production:**

- `@github/copilot-sdk` (^0.1.18) - GitHub Copilot integration

**Development:**

- `jest` (^30.2.0) - Testing framework
- `eslint` (^9.39.2) - Code linting
- `prettier` (^3.8.1) - Code formatting
- `husky` (^9.1.7) - Git hooks

## Data Flow

### Configuration Flow

```text
.workflow-config.yaml
        ↓
   Config.loadConfig()
        ↓
   parseYamlSync() [pure]
        ↓
   validateConfig() [pure]
        ↓
   In-memory config object
        ↓
   Application modules
```

### Session Flow

```text
User request
     ↓
SessionManager.createSession()
     ↓
generateSessionId() [pure]
     ↓
createSessionEntry() [pure]
     ↓
In-memory session storage
     ↓
Session operations
     ↓
SessionManager.endSession()
     ↓
Session archived
```

### Metrics Flow

```text
Operation start
     ↓
Metrics.startOperation()
     ↓
Operation execution
     ↓
Metrics.endOperation()
     ↓
calculateDuration() [pure]
     ↓
formatMetrics() [pure]
     ↓
Metrics report/export
```

## Extension Points

### Adding New Modules

1. Follow referential transparency pattern
2. Implement pure functions for business logic
3. Create wrapper class for side effects
4. Add comprehensive tests (pure + integration)
5. Update exports in `src/index.js`
6. Document in appropriate API doc

### Adding New Features

1. Identify layer (core, lib, cli, orchestrator)
2. Check dependencies and avoid circular refs
3. Follow existing code conventions
4. Add tests with >95% coverage
5. Update documentation

### Integrating External Services

1. Create adapter in appropriate layer
2. Isolate side effects in wrapper classes
3. Mock in tests for deterministic behavior
4. Handle errors gracefully
5. Add configuration options

## Automation Scripts

The `scripts/` directory contains shell and Node.js scripts for development and release automation. They integrate with the workflow engine and CI/CD pipeline.

| Script                         | Purpose                                                                    | When to use                             |
| ------------------------------ | -------------------------------------------------------------------------- | --------------------------------------- |
| `scripts/setup.sh`             | Install deps, init submodules, create `.ai_workflow/` artifact directories | First-time setup or after cloning       |
| `scripts/validate.sh`          | Full pipeline: lint → format → tests → version consistency                 | Before every commit or PR               |
| `scripts/test-integration.sh`  | Integration tests; accepts `--coverage` flag                               | Before releases or on CI                |
| `scripts/prepare-release.sh`   | Version bump, CHANGELOG update, full validation                            | When creating a new release             |
| `scripts/cleanup_artifacts.sh` | Remove stale logs, metrics, cache from `.ai_workflow/`                     | Routine maintenance or after large runs |

**Execution order for a release:**

```
setup.sh → validate.sh → test-integration.sh → prepare-release.sh
```

All scripts are idempotent and exit with code 0 on success, non-zero on failure.

## See Also

- [Design Principles](./DESIGN_PRINCIPLES.md) - Detailed design patterns
- [Module Structure](./MODULE_STRUCTURE.md) - Module organization details
- [Dependency Graph](./DEPENDENCY_GRAPH.md) - Dependency visualization
- [Developer Guide](../guides/DEVELOPER_GUIDE.md) - Development workflow
- [API Reference](../api/README.md) - Complete API documentation
