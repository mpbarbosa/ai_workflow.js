# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-30

### Changed

#### Referential Transparency Refactoring

- **session_manager.js (v2.0.0)**: Complete refactoring to follow referential transparency principles
  - Extracted pure functions: `generateSessionId`, `createSessionEntry`, `registerSession`, `addToCleanupQueue`, `unregisterSession`, `removeFromCleanupQueue`, `getSession`, `getActiveSessions`, `getSessionAge`, `isSessionActive`, `getSessionCount`
  - All core logic is now referentially transparent (deterministic, no side effects, immutable)
  - Time dependencies injected as parameters instead of using `Date.now()` internally
  - Random dependencies injected as parameters instead of using `crypto.randomBytes()` internally
  - State transformations return new values instead of mutating existing state
  - Console logging isolated to wrapper class methods (side effects at boundaries)
  - `SessionManager` class now acts as impure wrapper around pure functions

#### Testing

- **session_manager.test.js (v2.0.0)**: Complete test rewrite with 50 tests
  - 27 tests for pure functions (deterministic, no mocking needed)
  - 23 tests for wrapper class integration (non-deterministic behavior)
  - Removed Jest-specific mocking (incompatible with VM modules)
  - All 50 tests passing

### Added

- `.ai_workflow/backlog/referential_transparency_analysis.md`: Comprehensive analysis document
  - Detailed violation analysis with code examples
  - Before/after comparisons
  - Benefits of pure functional programming
  - Testing improvements
  - Migration strategy

## [1.0.0] - 2026-01-30

### Added

#### Phase 2.1: Configuration & State Management

- **config.js (v1.0.0)**: Configuration management with auto-detect project root, workflow run IDs, execution modes, analysis context, and step status tracking
- **backlog.js (v1.0.0)**: Workflow summary and backlog report generation with markdown output
- **session_manager.js (v1.0.0)**: Session lifecycle management with unique ID generation, registration/cleanup, and timeout handling
- **metrics.js (v1.0.0)**: Performance metrics collection with step timing, workflow-level metrics, JSON/JSONL export, and markdown summaries

#### Core Modules (Phase 1)

- **colors.js (v1.0.0)**: ANSI color codes with terminal support detection
- **logger.js (v1.0.0)**: Colored logging utilities with multiple log levels
- **executor.js (v1.0.0)**: Shell command execution with dry-run support
- **system.js (v1.0.0)**: OS detection and system configuration utilities
- **version.js (v1.0.0)**: Semantic version comparison utilities
- **errors.js (v1.0.0)**: Custom error classes (WorkflowError, SystemError, ExecutionError, ConfigurationError, ValidationError)

#### Testing

- Comprehensive test suite with 89 tests (100% passing)
- Test coverage for all Phase 1 and Phase 2.1 modules
- config.test.js: 37 tests
- backlog.test.js: 12 tests
- session_manager.test.js: 20 tests
- metrics.test.js: 20 tests

#### Documentation

- MIGRATION_PLAN.md v2.0.0 (corrected) - complete rewrite based on actual source analysis
- CORRECTION_REPORT.md - documenting incorrect package manager implementation removal
- README.md v1.1.0 - updated with Phase 2.1 completion status
- Semantic versioning applied to all code and test files

### Changed

- Updated .gitignore to allow `src/lib/` directory (was incorrectly ignored)
- Updated eslint.config.mjs to include Jest globals for test files
- Migration plan completely rewritten to reflect actual ai_workflow features

### Fixed

- Removed incorrect package manager implementation (~6,000 lines)
- Corrected migration plan phases to match actual source repository structure
- Fixed test timing issues with more tolerant assertions

### Removed

- Package manager code (apt, pacman, npm, pip managers)
- System diagnostics and hardware monitoring code
- Incorrect Phase 2-3 completion reports

## [0.1.0] - 2026-01-27

### Added

- Initial project setup with package.json
- ESLint and Prettier configuration
- Jest testing framework
- Husky pre-commit hooks
- Basic README and migration plan
- ai_workflow_core submodule integration

---

**Legend:**

- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Vulnerability fixes
