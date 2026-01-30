# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-30

### Added

#### Phase 3: File Operations & Utilities

**file_operations.js (v2.0.0)**: Complete file system operations module (Module 1)

- Pure functions for path validation, filtering, sorting, and metadata building
- `FileOperations` wrapper class for I/O operations (read, write, exists, stat, list, copy, move, delete)
- Directory operations (create, delete, list recursive)
- Dry-run mode support for all destructive operations
- Comprehensive error handling with `FileSystemError`
- 54 tests (24 pure function tests + 30 integration tests)
- All operations async/await for performance
- Automatic parent directory creation

**edit_operations.js (v2.0.0)**: File content editing utilities (Module 2)

- Pure functions for text manipulation: findMatches, replaceAll, replaceFirst, insertAtLine, appendText, prependText, deleteLines, extractLines, getLineRange, replaceLineRange
- Diff generation and formatting: generateDiff, formatDiff
- `EditOperations` wrapper class for file editing (find/replace, insert, append, prepend, delete lines, line range operations)
- Preview mode to show changes before applying
- Transformation function support (applyTransform)
- Dry-run mode for all operations
- 80 tests (40 pure function tests + 40 integration tests)
- All operations integrate with FileOperations for I/O

**errors.js**: Added `FileSystemError` class for file I/O error handling

**Total Phase 3 Progress**: 2 of 5 modules complete, 134 tests (was 174, now 308 total)

### Changed

#### Referential Transparency Refactoring

**backlog.js (v2.0.0)**: Refactored to pure functional approach

- Extracted pure functions: `getStatusEmoji`, `formatExecutionMode`, `buildStepStatusList`, `buildChangeAnalysisSection`, `generateSummaryContent`, `generateStepReportContent`
- All markdown generation logic is now referentially transparent
- Timestamp injection moved to wrapper methods
- Console logging isolated to wrapper class
- File I/O isolated to wrapper class

**session_manager.js (v2.0.0)**: Complete refactoring to follow referential transparency principles

- Extracted pure functions: `generateSessionId`, `createSessionEntry`, `registerSession`, `addToCleanupQueue`, `unregisterSession`, `removeFromCleanupQueue`, `getSession`, `getActiveSessions`, `getSessionAge`, `isSessionActive`, `getSessionCount`
- All core logic is now referentially transparent (deterministic, no side effects, immutable)
- Time dependencies injected as parameters instead of using `Date.now()` internally
- Random dependencies injected as parameters instead of using `crypto.randomBytes()` internally
- State transformations return new values instead of mutating existing state
- Console logging isolated to wrapper class methods (side effects at boundaries)
- `SessionManager` class now acts as impure wrapper around pure functions

#### Testing

- **metrics.test.js (v2.0.0)**: Added 22 pure function tests, 46 total (22 pure + 24 integration)
- **config.test.js (v2.0.0)**: Added 19 pure function tests, 51 total (19 pure + 32 integration)
- **backlog.test.js (v2.0.0)**: Added 18 pure function tests, 27 total (18 pure + 9 integration)
- **session_manager.test.js (v2.0.0)**: Complete test rewrite with 50 tests (27 pure + 23 integration)
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
