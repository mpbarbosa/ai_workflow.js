# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.12] - 2026-02-25

### Fixed

- **`workflowDir` resolved against CWD instead of `projectRoot`** (`src/orchestrator/main_orchestrator.js`): When the CLI was invoked from a directory other than the target project (e.g. from the `ai_workflow.js` repo itself), all workflow artifacts — logs, checkpoints, summaries, commit history — were written into the CWD's `.ai_workflow/` folder instead of into the target project's `.ai_workflow/` folder. The fix resolves `projectRoot` first and then anchors any relative `workflowDir` to it via `path.join(this.projectRoot, rawWorkflowDir)`. See [`docs/reports/bugfixes/BUGFIX_WORKFLOWDIR_RESOLUTION_2026_02_21.md`](docs/reports/bugfixes/BUGFIX_WORKFLOWDIR_RESOLUTION_2026_02_21.md) for full details.

- **Step 2 – version detection fallback** (`src/steps/step_02_consistency.js`): `getExpectedVersion` now falls back to reading `project.version` from `.workflow-config.yaml` when `package.json` is absent or has no `version` field. This fixes the `Expected version: not found` log message that appeared for non-Node.js projects (e.g. shell automation projects) that only define a version in the workflow config.

- **`modifiedFiles` not propagated from CommitHistory to `executionContext`** (`src/orchestrator/main_orchestrator.js`, `src/lib/workflow_profiles.js`): When git-status showed 0 staged/unstaged changes (all changes already committed), `modifiedFiles` was never populated in `executionContext`. Steps relying on it (step_01, step_15, step_16) would silently skip processing. Fixed by hoisting `allChangedFiles` before the try-block and adding `refreshWithFiles()` to `WorkflowProfileManager` to re-derive the profile from CommitHistory when git-status returns 0 files.

- **step_02_5 report saved to relative path** (`src/steps/step_02_5_doc_optimize.js`): `reportPath` and `archiveDir` were constructed with a relative path from `consolidation.archiveRoot`, causing `ENOENT: Only absolute paths are allowed` errors when the workflow ran from a different CWD. Fixed to use the absolute `archiveRoot` value directly.

- **tsconfig.json JSONC false-positive in step_10** (`src/steps/step_10_code_quality.js`): The native JSON linter flagged `tsconfig*.json` and `jsconfig*.json` files as invalid JSON because they use JSONC syntax (comments allowed). These files are now skipped by `_lintJsonNative()`.

- **step_07 untested files did not soft-block step_12 push** (`src/steps/step_12_git_finalization.js`): When step_07 identified files lacking test coverage, step_12 would push to remote without warning. A soft-block section now checks `context.results.step_07` for untested files and emits a warning before proceeding with the push.

- **step_15 UX analysis skipped for `location_based_service` projects** (`src/steps/step_15_ux_analysis.js`): step_15 only ran for project kinds in `UI_PROJECT_TYPES`. Projects like `location_based_service` that have Vue/React UI files were silently skipped. Fixed by adding a fallback `discoverFiles()` probe that activates when the project kind is not in `UI_PROJECT_TYPES`, allowing step_15 to run if UI files are found.

- **step_10 only reviewed 1 partition when change set was large** (`src/steps/step_10_code_quality.js`): On large change sets (>50 files), step_10 was still using the partition-based reviewer and only reviewing the current 1/N partition. A full-scan override now activates when `modifiedFiles.length > 50`, bypassing partition logic to review all changed files in one pass.

- **C4 compliance: `promptsDir` not passed to `AiHelper` in 6 steps** (`src/steps/step_02_consistency.js`, `step_03_script_refs.js`, `step_04_config_validation.js`, `step_06_test_review.js`, `step_08_test_exec.js`, `step_09_dependencies.js`): These steps constructed `new AiHelper()` without forwarding the `promptsDir` option injected by the orchestrator, so AI prompt-response pairs were never saved for those steps. Fixed by passing `{ promptsDir: options.promptsDir || null }` to each constructor.

## [1.0.0] - 2026-02-17

### 🎉 STABLE RELEASE - Production Ready

This is the first stable release of **ai_workflow.js**, a complete JavaScript/Node.js implementation of AI-powered workflow automation for software development. This release marks **feature parity** with the original shell-based ai_workflow v3.0.0, with enhanced architecture and maintainability.

#### Summary

- **67 modules** across 7 phases (Phases 1-13 complete)
- **3,708 passing tests** (99.5% pass rate, 19 skipped)
- **86.79% code coverage** (95.43% orchestrator coverage)
- **0 security vulnerabilities**
- **Referentially transparent architecture** (pure functions + impure wrappers)
- **20 workflow steps** fully implemented

#### What's Included

**Core Foundation (Phase 1):**

- Colors, Logger, System detection, Version handling, Command executor
- Custom error class hierarchy

**Configuration & State (Phase 2):**

- Configuration management with YAML parsing
- Session lifecycle management
- Performance metrics collection
- Backlog reporting

**File Operations (Phase 3):**

- File system operations with dry-run support
- Advanced text editing with diff generation
- CLI argument parsing
- Cleanup handlers with age/size/pattern filters
- General utility functions

**Project Detection (Phase 4):**

- Auto-detect 8 project types (nodejs_api, react_spa, python_app, etc.)
- Tech stack detection (7 languages, 10+ frameworks)
- Third-party exclusion with .gitignore parsing

**Git Integration (Phase 5):**

- Git operations (status, diff, log, commit, branch management)
- Caching system with TTL and invalidation
- Auto-commit for workflow artifacts
- Change detection and categorization

**AI Integration (Phase 6):**

- JSON processing with jq wrapper
- 14 AI personas for workflow tasks
- Response validation with confidence scoring
- Token-efficient caching
- Structured prompt building

**Workflow Orchestration (Phase 7):**

- Workflow execution engine with parallel steps
- Step registry with dependencies
- Dependency resolution with topological sort
- Step execution with timeout/retry
- Conditional execution based on project kind
- Checkpoint system for pause/resume

**Performance Optimization (Phase 8):**

- Parallel documentation validation
- 4 execution strategies (sequential, parallel, priority-based, balanced)
- Configurable concurrency limits
- Speedup metrics and efficiency analysis

**Workflow Steps (Phase 9):**

- 20 complete workflow steps (step_00 through step_17, plus step_02_5 and step_0b)
- Documentation validation, code analysis, test generation
- Quality checks, dependency management, git automation
- Linting, building, UX/accessibility checks
- Context management, AI prompts, cleanup, finalization

**Main Orchestrator (Phase 10):**

- Main workflow orchestrator integrating all phases
- Event system with lifecycle hooks
- Health checks and error recovery
- Progress tracking and reporting

**CLI Layer (Phase 11):**

- 6 commands: init, run, status, resume, clean, config
- 4 utilities: progress, output, error, validation
- Interactive prompts with inquirer
- Colored output with chalk
- Progress indicators with ora

**Testing & Security (Phase 12):**

- Fixed all failing tests (race condition in checkpoint_manager)
- Improved orchestrator coverage to 95.43%
- Created 5 automation scripts (setup, test-integration, validate, security-audit, analyze-jsdoc-coverage)
- Fixed command injection vulnerability in jq_wrapper
- 0 security vulnerabilities

**Packaging & Release (Phase 13):**

- Production-ready npm package configuration
- Automated CI/CD with GitHub Actions (6-stage release pipeline)
- Multi-platform testing (Ubuntu, macOS, Windows × Node 18, 20, 22)
- Release automation script (prepare-release.sh)
- Community documentation (SECURITY.md, CODE_OF_CONDUCT.md)

#### Installation

```bash
# Global installation
npm install -g ai-workflow

# Project installation
npm install --save-dev ai-workflow

# Verify installation
ai-workflow --version
```

#### Quick Start

```bash
# Initialize in your project
ai-workflow init

# Run the workflow
ai-workflow run

# Check workflow status
ai-workflow status
```

#### Migration from v0.x

See [docs/guides/MIGRATION_V1.md](docs/guides/MIGRATION_V1.md) for migration guide from pre-release versions.

#### Breaking Changes from Pre-Release

- Configuration file format updated (see `.workflow-config.yaml` template)
- Some module exports renamed for consistency
- CLI command structure finalized (no more breaking changes expected)

#### Known Limitations

- 18 integration tests skipped (parallel execution scenarios)
- Documentation JSDoc coverage at 80.57% (target: 90%+)

#### Credits

This project is a complete JavaScript reimplementation of [ai_workflow](https://github.com/mpbarbosa/ai_workflow) (Shell/Bash v3.0.0) with enhanced architecture and maintainability.

**Contributors:**

- mpbarbosa (Lead Developer)
- GitHub Copilot (AI Pair Programming Assistant)

---

## [1.4.0] - 2026-02-10 (Pre-Release)

### Added

- **✅ Phase 9 COMPLETE!** - Step 17: Workflow Summary Implementation
  - `steps/step_17_summary.js` (715 lines) - Workflow summary and reporting
    - Pure functions for result aggregation and metrics calculation
    - Execution timeline generation with phase grouping
    - Bottleneck detection and cache efficiency analysis
    - Improvement recommendations engine
    - Markdown report formatting with executive summary
    - Integration tests with end-to-end workflow validation
  - 56 comprehensive tests (all passing)
    - 46 pure function tests
    - 10 integration tests
    - Edge case coverage
  - Complete v2.0.0 referential transparency architecture
  - WorkflowSummary class for file I/O orchestration
  - Support for dry-run mode and custom workflow directories

### Changed

- Test suite expanded from 3,417 to 3,473 passing tests (56 new tests for Step 17)
- All 20 workflow steps now complete (~11,025 total lines of step code)
- Migration plan updated to Phase 9 COMPLETE status
- README updated with Phase 9 completion milestone
- Project version bumped to 1.4.0

### Status

- **Phase 1-9**: COMPLETE ✅ (67 modules, 3,473 tests, 100% passing)
- **Phase 10**: Main Orchestrator - NEXT
- **Test Coverage**: 99.5% pass rate (18 skipped tests)

## [1.3.12] - 2026-02-09

### Completed

- **Phase 9: Workflow Steps Implementation** - All 20 steps complete (~10,310 lines)
  - `steps/step_00_analyze.js` (473 lines) - Project analysis
  - `steps/step_01_documentation.js` (377 lines) - Documentation validation
  - `steps/step_02_consistency.js` (473 lines) - Consistency checks
  - `steps/step_02_5_doc_optimize.js` (514 lines) - Doc optimization
  - `steps/step_03_script_refs.js` (443 lines) - Script references
  - `steps/step_04_config_validation.js` (518 lines) - Config validation
  - `steps/step_05_directory.js` (527 lines) - Directory structure
  - `steps/step_06_test_review.js` (538 lines) - Test review
  - `steps/step_07_test_gen.js` (489 lines) - Test generation
  - `steps/step_08_test_exec.js` (534 lines) - Test execution
  - `steps/step_09_dependencies.js` (579 lines) - Dependency analysis
  - `steps/step_0b_bootstrap_docs.js` (500 lines) - Bootstrap docs
  - `steps/step_10_code_quality.js` (552 lines) - Code quality
  - `steps/step_11_context.js` (494 lines) - Context management
  - `steps/step_12_git_finalization.js` (692 lines) - Git operations
  - `steps/step_13_markdown_lint.js` (683 lines) - Markdown linting
  - `steps/step_14_prompt_engineer.js` (611 lines) - Prompt engineering
  - `steps/step_15_ux_analysis.js` (563 lines) - UX/accessibility
  - `steps/step_16_version_update.js` (504 lines) - Version update
  - All steps have comprehensive test coverage (25 test suites)

- **Phase 8: Performance Optimization** - All 11 modules complete
  - `lib/performance.js` - Performance tracking (timing, memory, I/O)
  - `lib/performance_monitoring.js` - Real-time monitoring (warnings, alerts)
  - `lib/ml_optimization.js` - ML-driven optimizations (predictive step skipping)
  - `lib/analysis_cache.js` - Analysis result caching
  - `lib/incremental_analysis.js` - Incremental analysis
  - `lib/docs_only_optimization.js` - Fast path for docs-only changes
  - `lib/code_changes_optimization.js` - Smart code change detection
  - `lib/full_changes_optimization.js` - Optimization for full workflow runs
  - `lib/multi_stage_pipeline.js` - Multi-stage pipeline (quick → medium → full)
  - `lib/step1_incremental.js` - File-level hash tracking for Step 1
  - `lib/step1_parallel.js` - Category-based parallel processing for Step 1
- All modules have comprehensive test coverage
- All modules properly exported in src/index.js
- 3,417 tests passing (18 skipped, 0 failures)

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

### Added

- **Conditional Execution Strategy** - Intelligent CI/CD step execution (NEW)
  - `scripts/analyze-change-impact.js` - Change impact analyzer with pattern matching
  - Four execution strategies: docs-only, unit-only, selective, run-all
  - File pattern matching with impact scoring (critical, high, medium, low)
  - Branch policy integration (feature vs main branch)
  - New npm scripts: `analyze:changes`, `analyze:changes:verbose`, `analyze:changes:json`
  - CI/CD integration: Conditional job execution based on changed files
  - New documentation: `docs/guides/CONDITIONAL_EXECUTION.md`
  - **Impact**: 40-60% CI/CD time reduction for low-impact changes
    - Docs-only changes: ~10 seconds (95% faster)
    - Unit-only changes: ~5 minutes (87% faster)
    - Selective execution: ~20 minutes (50% faster)
    - Estimated daily savings: 400-500 minutes (50-60%)

- **Validation Scripts** - Prevent common bugs (NEW)
  - `scripts/validate-exports.js` - Validate export names match actual modules
  - `scripts/check-version-consistency.js` - Check version consistency across docs
  - New npm scripts: `validate`, `validate:exports`, `validate:versions`
  - Integrated into CI/CD build-check job
  - **Impact**: Catches export mismatches and version inconsistencies automatically

- **Test Splitting Strategy** - CI/CD optimization
  - New npm scripts: `test:fast`, `test:slow`, `test:integration`, `test:ci`
  - Split tests into fast (unit) and slow (integration) tiers
  - Fast tests: 1,328 tests in ~2-3 seconds (always run)
  - Slow tests: 366 tests with coverage (only on main/PR to main)
  - New documentation: `docs/guides/TEST_SPLITTING.md`
  - **Impact**: Save 35-40 minutes per feature branch push (99.7% time reduction)

### Changed

- **GitHub Actions CI Workflow** - Intelligent conditional execution
  - Added `analyze-changes` job to determine execution strategy
  - Updated `test` job to conditionally run based on changed files
  - Updated `integration-tests` job with dual conditions (change impact + branch policy)
  - Updated `lint-staged` job to skip when no code changes
  - Updated `all-checks-pass` job to handle conditional skips correctly
  - CI now runs change impact analysis and outputs strategy to logs
  - Docs-only changes skip all test execution (95% time saved)
  - Unit-only changes skip integration tests (87% time saved)
  - Large changesets and CI config changes trigger full suite

- **GitHub Actions CI Workflow** - Conditional integration testing
  - Updated `.github/workflows/ci.yml` with split test jobs
  - Added `integration-tests` job that runs conditionally
  - Fast tests run on all branches with 5-minute timeout
  - Slow tests run only on main branch or PRs targeting main (30-minute timeout)
  - Updated `all-checks-pass` job to handle optional integration tests

- **Package Scripts** - Enhanced test execution options
  - `test:unit` - Run only unit tests (exclude orchestrator)
  - `test:integration` - Run only integration tests (orchestrator)
  - `test:fast` - Alias for `test:unit`
  - `test:slow` - Run integration tests with coverage
  - `test:ci` - Sequential execution of fast then slow tests
  - `analyze:changes` - Display change impact analysis
  - `analyze:changes:verbose` - Detailed analysis with file matches
  - `analyze:changes:json` - JSON output for CI/CD integration

### Fixed

- **Index.js Export Names** - Critical bug fix
  - `ConfigManager` → `Config` (matches actual export in config.js)
  - `BacklogManager` → `Backlog` (matches actual export in backlog.js)
  - `MetricsCollector` → `Metrics` (matches actual export in metrics.js)
  - Updated 19 documentation files to use correct class names
  - All 205 exports now accessible
  - Resolves import failures for Phase 2.1 classes

## [1.2.0] - 2026-02-07

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

## [1.3.12] - 2026-02-01

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
