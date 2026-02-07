# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-02-07

### Changed

- Updated package.json version to 1.2.0 to reflect project milestones
- Updated all test count references across documentation (1692 passing, 2 known failures)
- Updated phase completion status (Phase 1-7 complete, Phase 8 next)
- Fixed broken internal links in documentation hub (docs/README.md)
- Corrected module counts (36 modules total across 7 phases)
- Updated REFERENTIAL_TRANSPARENCY.md links to point to existing guides
- Synchronized version numbers between package.json and README.md

### Fixed

- Version mismatch between package.json (1.0.0) and README.md (1.2.0)
- Test count discrepancies across multiple documentation files
- Broken anchor links in docs/README.md pointing to DEVELOPER_GUIDE.md
- Outdated phase status references (Phase 5-6 marked as "next" when Phase 7 complete)
- Module directory structure diagram in OVERVIEW.md (added Phase 6-7 modules)

## [Unreleased]

### Added - Phase 5 (COMPLETE)

- **Git Automation** (Module 1/4) - Git operations with referential transparency (v2.0.0)
  - Core Git operations: status, diff, log, commit, add, branch management
  - Repository detection: find .git root, check if repo, validate status
  - Git output parsing: status (porcelain format), diff (unified format), log
  - Branch management: list, create, checkout, get current branch
  - Commit operations: add files, create commits with messages
  - Pure functional core + I/O wrapper (referential transparency)
  - 102 tests (100% passing, 100% coverage) ✅
  - See: `src/lib/git_automation.js`, `test/lib/git_automation.test.js`

- **Git Cache** (Module 2/4) - Git operation caching with TTL invalidation (v2.0.0)
  - TTL-based caching: configurable cache duration (default 5 seconds)
  - Automatic invalidation: clear cache on repository changes
  - Cache key generation: unique keys for different operations
  - Operation support: status, diff, log caching
  - Statistics tracking: hits, misses, invalidations
  - Pure functional core + I/O wrapper (referential transparency)
  - 41 tests (100% passing, 100% coverage) ✅
  - See: `src/lib/git_cache.js`, `test/lib/git_cache.test.js`

- **Auto Commit** (Module 3/4) - Automatic workflow artifact commits (v2.0.0)
  - Automatic commit generation: workflow artifacts with conventional messages
  - Change categorization: docs-only, test-only, code-only, config-only, full
  - Commit message templates: conventional commit format by type
  - File filtering: include/exclude patterns for artifact commits
  - Dry-run support: preview commits without executing
  - Pure functional core + I/O wrapper (referential transparency)
  - 34 tests (100% passing, 100% coverage) ✅
  - See: `src/lib/auto_commit.js`, `test/lib/auto_commit.test.js`

- **Change Detection** (Module 4/4) - File change detection and categorization (v2.0.0)
  - Change type detection: documentation, tests, source code, configuration
  - File categorization: analyze by extension, path, and content patterns
  - Change analysis: count changes by type, calculate percentages
  - Pattern matching: comprehensive file type detection (40+ patterns)
  - Statistics generation: detailed breakdown of changes
  - Pure functional core + I/O wrapper (referential transparency)
  - 42 tests (100% passing, 100% coverage) ✅
  - See: `src/lib/change_detection.js`, `test/lib/change_detection.test.js`

### Phase 5 Status - COMPLETE ✅

- **Module 1**: Git Automation (v2.0.0) - 102 tests, 100% passing ✅
- **Module 2**: Git Cache (v2.0.0) - 41 tests, 100% passing ✅
- **Module 3**: Auto Commit (v2.0.0) - 34 tests, 100% passing ✅
- **Module 4**: Change Detection (v2.0.0) - 42 tests, 100% passing ✅
- **Phase 5 Total**: 219 tests, 100% passing ✅
- **Project Total**: 942 tests passing (100% pass rate)

### Added

- **Pre-commit Test Validation**: Added automatic test execution to Git pre-commit hook
  - Tests run automatically on `git commit` for changed source files (`src/**/*.js`)
  - Uses `--findRelatedTests` to run only affected tests (fast feedback)
  - Uses `--bail` to stop on first failure (fail fast)
  - Integrated with existing Husky + lint-staged setup
  - **Benefit**: Catch test regressions before committing (blocks commits on test failure)
  - **Impact**: CI/CD pipeline protection - no broken tests reach the repository

### Fixed

- **Flaky Test**: Fixed timing-sensitive test in `config.test.js` (`getElapsedTime` test)
  - Changed assertion from `>=50ms` to `>=45ms` to account for event loop timing variance
  - JavaScript's `setTimeout()` is not precise - can complete 1-5ms early due to event loop scheduling
  - Test was intermittently failing with "Expected: >= 50, Received: 49"
  - **Result**: All 723 tests now passing consistently (100% pass rate) ✅

### Added

- **Error Module Tests**: Created comprehensive test suite for `src/utils/errors.js` (28 tests, 100% coverage)
  - Tests all 6 error classes: WorkflowError, SystemError, ExecutionError, ConfigurationError, ValidationError, FileSystemError
  - Verifies proper inheritance chain and error properties
  - Tests error catching and type discrimination
  - Validates default export structure
  - **Result**: Complete test coverage for Phase 1 error handling module ✅

### Fixed

- **Project Kind Detection**: Fixed bug in `detectProjectKind()` where `listDirectoryRecursive()` return values were incorrectly filtered
  - The method was trying to access `.isFile` and `.isDirectory` properties on string paths
  - Now correctly passes file paths directly to `detectByFilePatterns()`
  - Separately lists directories with `includeDirectories: true` option for `detectByDirectoryStructure()`
  - Fixes 2 failing integration tests: "should detect shell script automation" and "should detect configuration library"
  - **Result**: All tests now passing (100% pass rate) ✅

### Removed

- **Empty Directory**: Removed unused `docs/workflow-automation/` directory

### Changed

- **Test Count**: Updated from 695 to 942 total tests (28 error module tests + 219 Phase 5 git integration tests)
- **Phase Status**: Phase 5 (Git Integration) now complete with 4 new modules

## [1.3.0] - 2026-02-01

### Added - Phase 4 (COMPLETE)

- **Project Kind Detection** (Module 1/4) - Auto-detect project type based on file patterns (v1.0.0)
  - Supports 8 project kinds: nodejs_api, react_spa, python_app, shell_script_automation, static_website, client_spa, configuration_library, generic
  - Analyzes package.json for Node.js/React projects
  - Analyzes requirements.txt for Python projects
  - Pattern-based detection (file extensions, directory structure)
  - Confidence scoring with indicator tracking
  - Pure functional core + I/O wrapper (referential transparency)
  - 32 tests (100% passing, 100% coverage) ✅
  - See: `src/lib/project_kind_detection.js`, `test/lib/project_kind_detection.test.js`

- **Project Kind Configuration** (Module 2/4) - Load project configs from ai_workflow_core (v1.0.0)
  - Load configs from `.workflow_core/config/project_kinds.yaml`
  - Parse YAML configurations with js-yaml
  - Extract validation rules, testing config, quality standards, AI guidance
  - Merge user overrides from `.workflow-config.yaml`
  - Validate project structure against rules
  - Configuration caching for performance
  - Pure functional core + I/O wrapper (referential transparency)
  - 42 tests (42 passing, 100% coverage)
  - See: `src/lib/project_kind_config.js`, `test/lib/project_kind_config.test.js`

- **Tech Stack Detection** (Module 3/4) - Detect languages, frameworks, and tools (v1.0.0)
  - Detect programming languages from file extensions (JavaScript, TypeScript, Python, Shell, Go, Rust, Java)
  - Detect frameworks from package.json and requirements.txt (Express, React, Flask, Django, FastAPI, etc.)
  - Detect build systems (npm, yarn, pnpm, cargo, maven, gradle, etc.)
  - Detect test frameworks (jest, vitest, pytest, bash_unit, etc.)
  - Detect linters (eslint, prettier, pylint, shellcheck, black, etc.)
  - Generate human-readable tech stack reports
  - Result caching for performance
  - Pure functional core + I/O wrapper (referential transparency)
  - 52 tests (52 passing, 100% coverage)
  - See: `src/lib/tech_stack.js`, `test/lib/tech_stack.test.js`

- **Third-Party Exclusion** (Module 4/4) - Filter third-party files from analysis (v1.0.0)
  - Auto-exclude node_modules, .git, dist, build, venv, **pycache**, etc.
  - Parse and apply .gitignore patterns
  - Smart glob pattern matching with \*_ (multi-dir), _ (wildcard), ? (single char)
  - Project-kind-specific exclusion patterns (Node.js, Python, React, Shell, etc.)
  - Generate exclusion reports with statistics
  - Merge patterns from multiple sources (defaults, .gitignore, custom)
  - Pure functional core + I/O wrapper (referential transparency)
  - 41 tests (41 passing, 100% coverage)
  - See: `src/lib/third_party_exclusion.js`, `test/lib/third_party_exclusion.test.js`

### Phase 4 Status - COMPLETE ✅

- **Module 1**: Project Kind Detection (v1.0.0) - 32 tests, 100% passing ✅
- **Module 2**: Project Kind Configuration (v1.0.0) - 42 tests, 100% passing
- **Module 3**: Tech Stack Detection (v1.0.0) - 52 tests, 100% passing
- **Module 4**: Third-Party Exclusion (v1.0.0) - 41 tests, 100% passing
- **Phase 4 Total**: 167 tests, 100% passing ✅
- **Project Total**: 723/723 tests passing (100%) ✅

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

**utils.js (v1.0.0)**: General utility functions library (Module 3)

- String utilities: camelCase, kebabCase, snakeCase, pascalCase, capitalize, truncate, sanitize, cleanWhitespace, escapeRegex
- Array utilities: dedupe, chunk, flatten, groupBy, sortBy, intersection, difference, partition
- Object utilities: deepClone, deepMerge, pick, omit, getProperty, setProperty, hasProperty, deepEqual, isEmpty
- All pure functions (no side effects, fully deterministic)
- 109 comprehensive tests covering all utilities
- Reusable across all workflow modules

**argument_parser.js (v2.0.0)**: CLI argument parsing with validation (Module 4)

- Pure functions: parseArguments, validateArguments, validateType, coerceTypes, applyDefaults, generateHelpText, normalizeAliases
- ArgumentParser class with schema-based validation
- Support for flags (--flag, -f), options (--key=value, -k value), and positional arguments
- Automatic alias normalization (short flags to long names)
- Type coercion and validation (string, number, integer, boolean)
- Default values and choices validation
- Auto-generated help text from schema
- 61 comprehensive tests (46 pure + 15 integration)
- Full support for --help/-h flag

**cleanup_handlers.js (v2.0.0)**: Cleanup operations for temp files, sessions, cache (Module 5)

- Pure functions: shouldCleanByAge, shouldCleanBySize, filterByAge, filterBySize, calculateTotalSize, sortByOldest, sortByLargest, selectFilesForSizeLimit, formatDuration, formatSize, generateCleanupSummary
- CleanupManager class for automated cleanup operations
- Age-based cleanup (clean files older than threshold)
- Size-based cleanup (clean files larger than threshold)
- Directory size limit enforcement (delete oldest files to meet limit)
- Empty directory removal
- Pattern-based cleanup (regex/string matching)
- Dry-run mode support
- 50 comprehensive tests (33 pure + 17 integration)
- Cross-realm Date handling for Jest VM modules

**errors.js**: Added `FileSystemError` class for file I/O error handling

**Total Phase 3 Progress**: ✅ 5 of 5 modules complete (100%), 354 tests (was 174, now 528 total)

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
