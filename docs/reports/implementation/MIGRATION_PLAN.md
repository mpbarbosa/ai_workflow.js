# Migration Plan: AI Workflow from Shell Script to JavaScript/Node.js

**Version:** 3.0.0 - **REORGANIZED**  
**Document Version:** 3.6.0  
**Last Updated:** February 8, 2026  
**Status:** Active Development - Phase 7 Complete, Phase 8 In Progress

---

## 📋 REORGANIZATION NOTICE

**Version 3.0.0**: Phases reorganized by **dependency order** for better logical flow and clearer implementation path.

**Key Changes:**

- Phases now ordered by what needs to be built first
- File Operations moved earlier (Phase 3) - critical dependency for all features
- Project Detection before Git (Phase 4) - needed for tech stack awareness
- AI Integration before Step Engine (Phase 6) - enables AI-powered steps
- Total phases expanded from 10 to 13 for finer granularity

**Benefit**: Each phase now builds cleanly on previous phases with minimal dependency conflicts.

---

## Document Version History

| Version | Date       | Changes                                                                                                     |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------- |
| 3.6.0   | 2026-02-08 | Updated for source v3.2.7: Workflow profiles, Step 2.5 doc optimization, ML skip prediction, doc templates. |
| 3.5.0   | 2026-02-06 | Updated for source v3.2.0: Git submodule support, intelligent AI model selection, Step 1 optimization.      |
| 3.4.0   | 2026-02-05 | Updated for source v3.1.0 changes: Step 0b added, jq_wrapper, modular step architecture.                    |
| 3.3.0   | 2026-02-02 | Phase 5 complete. All 4 Git Integration modules implemented with v2.0.0 architecture (219 tests).           |
| 3.2.0   | 2026-02-01 | Phase 4 complete. All 4 Project Detection modules implemented with v1.0.0 architecture (167 tests).         |
| 3.1.0   | 2026-01-30 | Phase 3 complete. All 5 File Operations modules implemented with v2.0.0 architecture (354 tests).           |
| 3.0.0   | 2026-01-30 | **REORGANIZATION**: Phases reordered by dependency. File Ops → Project Detection → Git → AI → Steps         |
| 2.1.0   | 2026-01-30 | Phase 2.1 complete. Added semantic versioning to all files. Updated status.                                 |
| 2.0.0   | 2026-01-30 | **MAJOR CORRECTION**: Complete rewrite based on actual source analysis                                      |
| 1.2.0   | 2026-01-29 | ❌ INCORRECT - contained wrong package manager content                                                      |
| 1.1.0   | 2026-01-29 | ❌ INCORRECT - contained wrong package manager content                                                      |
| 1.0.0   | 2026-01-27 | ❌ INCORRECT - contained wrong package manager content                                                      |

---

## Executive Summary

This document outlines the migration of [ai_workflow](https://github.com/mpbarbosa/ai_workflow) from shell script to JavaScript/Node.js.

**Source Repository:** https://github.com/mpbarbosa/ai_workflow (v3.2.7)

**What ai_workflow Actually Is:**

- **20-step AI-powered workflow automation for software development projects**
- Documentation validation, test generation, code quality analysis
- GitHub Copilot integration with 15 specialized AI personas
- Smart execution, parallel processing, ML optimization, AI caching
- Intelligent model selection with 4-tier complexity analysis (NEW v3.1.1+)
- Git submodule lifecycle management (NEW v3.2.0+)
- Workflow profiles with auto-detection and time estimation (NEW v3.2.7+)
- Step 2.5 documentation optimization with duplicate detection (NEW v3.2.7+)
- ML-powered skip prediction engine (Phase 1 foundation) (NEW v3.2.7+)
- Documentation templates and drift checker (NEW v3.2.7+)
- Checkpoint/resume, change detection, metrics tracking
- 73 library modules (~32.7K+ lines) + 20 step modules (~8.2K+ lines)

**What ai_workflow is NOT:**

- ❌ Package manager (apt, pacman, npm, pip)
- ❌ System update tool
- ❌ Application updater
- ❌ Hardware/system diagnostics

---

## Recent Changes in Source Repository (v3.2.0 → v3.2.7)

### Major Additions (7 New Features)

**1. Workflow Profiles (v3.2.7)** - Intelligent execution customization

- New module: `workflow_profiles.sh` (11,301 bytes)
- 5 predefined profiles: docs_only, code_changes, test_changes, infrastructure, full_validation
- Auto-detection based on git change patterns
- Manual profile override support via `WORKFLOW_PROFILE` env variable
- Time estimation and savings calculation (30-43% time savings)
- **Impact**: 71-121 minutes/day saved for 10 workflow runs
- Documentation: `docs/WORKFLOW_PROFILES.md`

**2. Step 2.5: Documentation Optimization (v3.2.7)** - NEW STEP MODULE

- New step module: `step_02_5_doc_optimize.sh` (13,141 bytes)
- 6 submodules in `step_02_5_lib/`: heuristics, git_analysis, version_analysis, ai_analyzer, consolidation, reporting
- **Purpose**: Reduce documentation size and AI prompt context costs
- **Features**:
  - Exact duplicate detection using SHA256 hashing (100% confidence)
  - Similarity analysis with multi-factor scoring (title, content, size)
  - Git history analysis to identify abandoned/outdated files
  - Version reference extraction and gap analysis
  - Safe archiving to `docs/.archive/` with timestamps
  - Comprehensive optimization reporting with metrics
- **Configuration**: Via `.workflow-config.yaml` (threshold tuning, exclude patterns)
- **Safety**: Dry-run mode, user confirmation for deletions, all changes archived
- **Impact**: Expected 10-15% size reduction, ~5,000-10,000 token savings
- **Performance**: Analyzes 200 files in 2-3 minutes
- Documentation: `docs/guides/DOC_OPTIMIZATION.md` (7,756 bytes)

**3. ML-Powered Skip Prediction (v3.2.7)** - Phase 1 Foundation

- New modules: `skip_predictor.sh` (650+ lines), `test_skip_predictor.sh`
- Automatic analysis of git changes (code/documentation/tests)
- Cyclomatic complexity calculation for code files
- Semantic analysis of commit messages
- Predictive intelligence for workflow optimization
- Future: 15-30% additional time savings

**4. Documentation Templates & Drift Checker (v3.2.7)**

- New modules: `doc_section_mapper.sh`, `doc_section_extractor.sh`
- Template-based documentation generation
- Drift detection between templates and actual docs
- Automated section extraction and mapping
- **Impact**: Ensures documentation consistency and completeness

**5. Dependency Caching (v3.2.7)** - Step 8 Optimization

- New module: `dependency_cache.sh` (350+ lines)
- Caches npm audit and npm outdated results
- **Performance**: Reduces Step 8 from ~6-7 minutes to <10 seconds on cache hits
- Cache TTL: 1 hour (dependencies change more frequently than code)
- Automatic cache cleanup of expired entries
- Cache stored in `src/workflow/.dependency_cache/`
- Cache statistics via `get_dependency_cache_stats()`

**6. Enhanced Step 3 Auto-Skip (v2.2.0)** - Project Type Awareness

- Automatic project type detection to skip step for non-shell projects
- Auto-skips for Node.js/JavaScript projects (nodejs_api, nodejs_cli, react_spa, vue_spa)
- Auto-skips for Python projects (python_api, python_cli, python_library)
- Auto-skips for static/documentation projects
- Only runs for shell_automation projects or projects with src/workflow directory
- Clear skip reasons in workflow output and summaries

**7. Enhanced Step 8 Caching (v2.2.0)** - See #5 above

### Module Count Update

- **73 library modules** (was 67+): +6 new modules
  - `dependency_cache.sh`
  - `doc_section_extractor.sh`
  - `doc_section_mapper.sh`
  - `skip_predictor.sh`
  - `test_skip_predictor.sh`
  - `workflow_optimization.sh`
  - `workflow_profiles.sh`
- **20 step modules** (was 18): +2 new modules
  - `step_02_5_doc_optimize.sh` (with 6 submodules)
  - Step 3 v2.1.0 → v2.2.0 (enhanced)
  - Step 8 v2.1.0 → v2.2.0 (enhanced)

### Migration Impact Assessment

**High Priority for Migration:**

1. ✅ **Workflow Profiles** - Already partially implemented via `conditional_executor.js` (Phase 7)
2. ⚠️ **Step 2.5 Doc Optimization** - NEW, requires Phase 9 implementation
3. ⚠️ **Dependency Caching** - Pattern similar to `git_cache.js` (Phase 5), can reuse architecture
4. ⚠️ **ML Skip Prediction** - Advanced feature, defer to Phase 10+
5. ⚠️ **Doc Templates/Drift** - Support infrastructure, defer to Phase 9+

**Medium Priority:**

- Step 3/8 enhancements can be integrated into existing step implementations (Phase 9)

**Low Priority:**

- ML Skip Prediction is Phase 1 foundation only, can be implemented later

---

## Source Repository Structure - ACTUAL

```
ai_workflow/
├── src/workflow/
│   ├── execute_tests_docs_workflow.sh    # Main orchestrator (2,672 lines)
│   ├── lib/                              # 73 library modules (32,723 lines)
│   │   ├── ai_cache.sh                   # AI response caching
│   │   ├── ai_helpers.sh                 # AI integration (~3,500 lines!)
│   │   ├── ai_personas.sh                # 15 AI persona definitions
│   │   ├── ai_prompt_builder.sh          # Dynamic prompt generation
│   │   ├── ai_validation.sh              # AI validation
│   │   ├── analysis_cache.sh             # Analysis caching
│   │   ├── argument_parser.sh            # CLI parsing
│   │   ├── auto_commit.sh                # Auto-commit
│   │   ├── auto_documentation.sh         # Auto-docs
│   │   ├── backlog.sh                    # Execution history
│   │   ├── batch_ai_commit.sh            # Batch AI operations
│   │   ├── change_detection.sh           # Smart change detection
│   │   ├── cleanup_handlers.sh           # Cleanup
│   │   ├── code_changes_optimization.sh  # Code optimizations
│   │   ├── colors.sh                     # Terminal colors
│   │   ├── conditional_execution.sh      # Conditional logic
│   │   ├── config.sh                     # Configuration
│   │   ├── config_wizard.sh              # Interactive config
│   │   ├── dashboard.sh                  # Dashboard
│   │   ├── dependency_cache.sh           # Dependency caching (NEW v3.2.7+)
│   │   ├── dependency_graph.sh           # Dependency analysis
│   │   ├── doc_section_extractor.sh      # Doc section extraction (NEW v3.2.7+)
│   │   ├── doc_section_mapper.sh         # Doc section mapping (NEW v3.2.7+)
│   │   ├── doc_template_validator.sh     # Doc validation
│   │   ├── docs_only_optimization.sh     # Docs optimizations
│   │   ├── edit_operations.sh            # File editing
│   │   ├── enhanced_validations.sh       # Validations
│   │   ├── file_operations.sh            # File operations
│   │   ├── full_changes_optimization.sh  # Full optimizations
│   │   ├── git_automation.sh             # Git automation
│   │   ├── git_cache.sh                  # Git caching
│   │   ├── git_submodule_helpers.sh      # Git submodule mgmt (NEW v3.2.0+)
│   │   ├── health_check.sh               # Health checks
│   │   ├── incremental_analysis.sh       # Incremental analysis (NEW v3.1+)
│   │   ├── jq_wrapper.sh                 # Safe jq wrapper (NEW v3.1+)
│   │   ├── metrics.sh                    # Metrics
│   │   ├── metrics_validation.sh         # Metrics validation
│   │   ├── ml_optimization.sh            # ML-driven optimization
│   │   ├── model_selector.sh             # AI model selection (NEW v3.1.1+)
│   │   ├── multi_stage_pipeline.sh       # Multi-stage pipeline
│   │   ├── performance.sh                # Performance tracking
│   │   ├── performance_monitoring.sh     # Performance monitoring
│   │   ├── precommit_hooks.sh            # Pre-commit hooks (NEW v3.1+)
│   │   ├── project_kind_config.sh        # Project config
│   │   ├── project_kind_detection.sh     # Project detection
│   │   ├── session_manager.sh            # Session management
│   │   ├── skip_predictor.sh             # ML skip prediction (NEW v3.2.7+)
│   │   ├── step_adaptation.sh            # Step adaptation
│   │   ├── step_execution.sh             # Step execution
│   │   ├── step_metadata.sh              # Step metadata
│   │   ├── step_validation_cache.sh      # Validation cache
│   │   ├── summary.sh                    # Summaries
│   │   ├── tech_stack.sh                 # Tech stack detection
│   │   ├── test_skip_predictor.sh        # Test skip predictor (NEW v3.2.7+)
│   │   ├── third_party_exclusion.sh      # Third-party exclusion
│   │   ├── utils.sh                      # Utilities
│   │   ├── version_bump.sh               # Version bumping (NEW v3.1+)
│   │   ├── workflow_optimization.sh      # Workflow optimization (NEW v3.2.7+)
│   │   ├── workflow_profiles.sh          # Workflow profiles (NEW v3.2.7+)
│   │   └── ... (and more)
│   └── steps/                            # 20 step modules (8,186 lines)
│       ├── step_00_analyze.sh            # Project analysis
│       ├── step_01_documentation.sh      # Documentation validation (refactored v3.1+)
│       ├── step_01_lib/                  # Step 1 sub-modules (NEW v3.1+)
│       │   ├── ai_integration.sh         # AI integration (22K lines)
│       │   ├── cache.sh                  # Caching (4K lines)
│       │   ├── file_operations.sh        # File operations (6.7K lines)
│       │   ├── incremental.sh            # Incremental processing (10K lines)
│       │   └── validation.sh             # Validation (10.6K lines)
│       ├── step_02_consistency.sh        # Consistency checks
│       ├── step_02_5_doc_optimize.sh     # Doc optimization (NEW v3.2.7+)
│       ├── step_02_5_lib/                # Step 2.5 sub-modules (NEW v3.2.7+)
│       │   ├── ai_analyzer.sh            # AI analysis for edge cases
│       │   ├── consolidation.sh          # File consolidation
│       │   ├── git_analysis.sh           # Git history analysis
│       │   ├── heuristics.sh             # Duplicate detection heuristics
│       │   ├── reporting.sh              # Optimization reporting
│       │   └── version_analysis.sh       # Version reference extraction
│       ├── step_03_script_refs.sh        # Script references
│       ├── step_04_directory.sh          # Directory validation
│       ├── step_05_test_review.sh        # Test review
│       ├── step_06_test_gen.sh           # Test generation
│       ├── step_07_test_exec.sh          # Test execution
│       ├── step_08_dependencies.sh       # Dependency analysis
│       ├── step_09_code_quality.sh       # Code quality
│       ├── step_0a_version_update.sh     # Version update (alt)
│       ├── step_0b_bootstrap_docs.sh     # Bootstrap documentation (NEW v3.1+)
│       ├── step_10_context.sh            # Context management
│       ├── step_11_git.sh                # Git operations
│       ├── step_12_markdown_lint.sh      # Markdown linting
│       ├── step_13_prompt_engineer.sh    # Prompt engineering
│       ├── step_14_ux_analysis.sh        # UX/accessibility
│       └── step_15_version_update.sh     # Version update
└── tests/                                # 37+ tests
    ├── unit/
    └── integration/
```

---

## Key Features to Migrate

### 1. 20-Step Workflow Pipeline

- **Step 0:** Project analysis and context detection
- **Step 0b:** Bootstrap documentation (gap analysis and generation) _(NEW v3.1+)_
- **Step 1:** Documentation validation and enhancement (optimized v3.2.0+)
- **Step 2:** Consistency checking across files
- **Step 2.5:** Documentation optimization (duplicate detection, archiving) _(NEW v3.2.7+)_
- **Step 3:** Script reference validation (auto-skip for non-shell projects v2.2.0+)
- **Step 4:** Directory structure validation
- **Step 5:** Test review and analysis
- **Step 6:** Test generation
- **Step 7:** Test execution
- **Step 8:** Dependency analysis (with result caching v2.2.0+)
- **Step 9:** Code quality assessment
- **Step 10:** Context management
- **Step 11:** Git automation and validation (with submodule support v2.3.0+)
- **Step 12:** Markdown linting
- **Step 13:** Prompt engineering
- **Step 14:** UX and accessibility analysis

### 2. AI Integration (15 Personas)

- GitHub Copilot CLI integration
- Specialized AI personas:
  - Documentation Expert (Technical Writer)
  - Test Engineer
  - Code Quality Analyst
  - Git Specialist
  - UX Analyst
  - Prompt Engineer
  - Security Expert
  - Performance Engineer
  - Documentation Optimizer (NEW v3.2.7+)
  - And 6 more...
- AI response caching (60-80% token reduction)
- Intelligent model selection (4-tier complexity system) _(NEW v3.1.1+)_
  - Fast (Haiku) → Balanced (Sonnet) → Deep (Opus 4.5) → Agentic (Opus 4.6)
  - 30-50% token reduction with optimized selection
- Dynamic prompt generation
- Batch AI operations

### 3. Performance Optimizations

- **Smart Execution**: Change-based step skipping (40-85% faster)
- **Parallel Execution**: Independent steps run simultaneously (33% faster)
- **AI Caching**: Intelligent response caching (60-80% savings)
- **Intelligent Model Selection**: Complexity-based model tier selection (30-50% token reduction) _(NEW v3.1.1+)_
- **Incremental Analysis**: File-level hash tracking (75-96% faster for Step 1) _(NEW v3.1.1+)_
- **Parallel Processing**: Category-based concurrent AI analysis (71% faster) _(NEW v3.1.1+)_
- **Workflow Profiles**: Auto-detection and time estimation (NEW v3.2.7+)
  - docs_only: 60% faster (~10 min saved)
  - code_changes: 20% faster (~5 min saved)
  - test_changes: 35% faster (~8 min saved)
  - infrastructure: Full validation (safety-first)
  - Expected savings: 30-43% time reduction (71-121 min/day for 10 runs)
- **Dependency Caching**: npm audit/outdated result caching (NEW v3.2.7+)
  - Reduces Step 8 from ~6-7 minutes to <10 seconds on cache hits
  - 1-hour TTL for fresh dependency data
- **ML Skip Prediction**: Intelligent skip prediction engine (Phase 1 foundation) (NEW v3.2.7+)
- **ML Optimization**: Predictive workflow intelligence (15-30% improvement)
- **Multi-Stage Pipeline**: Progressive validation (3 stages)
- **Combined**: Up to 96% faster for simple changes

### 4. Workflow Management

- Checkpoint/resume capability
- Dependency graph analysis
- Conditional step execution
- Step adaptation based on project type
- Execution metrics and monitoring
- Session management
- Health checks

### 5. Project Detection & Configuration

- Automatic tech stack detection
- Project kind/type detection
- Interactive configuration wizard
- Third-party file exclusion
- Target project support

### 6. Git Automation

- Auto-commit workflow artifacts
- Intelligent commit message generation
- Git submodule lifecycle management _(NEW v3.2.0+)_
  - Automatic detection, init, update, commit, push
  - AI-powered commit messages for submodules
  - Parent repository pointer updates
- Change detection and categorization
- Git state caching
- `.gitignore` respect
- Batch AI commit operations
- Git state validation
- Change detection and tracking

---

## Implementation Phases - REORGANIZED BY DEPENDENCY

**Philosophy**: Each phase builds on completed phases. Dependencies flow cleanly from foundation to features.

---

### Phase 1: Foundation & Core Utilities ✅ **COMPLETED**

**Duration**: Week 1 (Completed January 2026)

- [x] Project setup (package.json, ESLint, Prettier, Husky)
- [x] Core utilities: colors.js, logger.js, executor.js, system.js, version.js
- [x] Error handling framework (errors.js)
- [x] Jest testing setup
- [x] ai_workflow_core submodule integration
- [x] Semantic versioning applied to all modules

**Provides**: Foundation for all subsequent work

---

### Phase 2: Configuration & State Management ✅ **COMPLETED**

**Duration**: Week 2 (Completed January 2026)  
**Depends on**: Phase 1

- [x] `lib/config.js` (v2.0.0) - Configuration loading/management
- [x] `lib/backlog.js` (v2.0.0) - Execution history tracking
- [x] `lib/session_manager.js` (v2.0.0) - Session lifecycle
- [x] `lib/metrics.js` (v2.0.0) - Performance metrics
- [x] Comprehensive test suite (89 tests passing)
- [x] CHANGELOG.md created with semantic versioning

**Note**: All modules upgraded to v2.0.0 for referential transparency refactoring (pure functional approach with side effects isolated to wrapper classes).

**Provides**: Configuration system, state management, metrics tracking

---

### Phase 3: File Operations & Utilities ✅ **COMPLETED**

**Duration**: Week 3 (Completed)  
**Depends on**: Phase 1, 2  
**Priority**: **CRITICAL PATH** - Required by almost all subsequent phases

#### Modules (5): ✅ All Complete

- [x] `lib/file_operations.js` (v2.0.0) - File system operations (read, write, exists, list, copy, move, delete) - 54 tests
- [x] `lib/edit_operations.js` (v2.0.0) - File editing utilities (find/replace, insert, append, patch, diff) - 80 tests
- [x] `lib/argument_parser.js` (v2.0.0) - CLI argument parsing with validation and help generation - 61 tests
- [x] `lib/utils.js` (v1.0.0) - General utilities (string, array, object helpers) - 109 tests
- [x] `lib/cleanup_handlers.js` (v2.0.0) - Cleanup operations (temp files, sessions, cache) - 50 tests

**Total**: 354 tests (163 pure function tests + 191 integration tests), 100% pass rate

#### Success Criteria: ✅ All Met

- ✅ All file operations use async/await
- ✅ Comprehensive error handling for I/O failures (FileSystemError)
- ✅ 100% test coverage for all operations
- ✅ Dry-run mode support for all destructive operations
- ✅ Pure functional architecture (v2.0.0) with referential transparency
- ✅ Diff generation and formatting (edit_operations)
- ✅ Cross-realm Date handling (cleanup_handlers)

**Provides**: File I/O foundation needed by Git, Steps, AI, and Orchestrator

---

### Phase 4: Project Detection & Analysis

**Duration**: Week 4 (Estimated 4 days)  
**Depends on**: Phase 1, 2, 3 (file operations)  
**Priority**: **HIGH** - Enables tech-stack-aware features

#### Modules (4):

- [ ] `lib/project_kind_detection.js` - Auto-detect project type (nodejs_api, react_spa, python_app, etc.)
- [ ] `lib/project_kind_config.js` - Load project kind configuration from ai_workflow_core
- [ ] `lib/tech_stack.js` - Tech stack detection (languages, frameworks, tools)
- [ ] `lib/third_party_exclusion.js` - Exclude third-party files (node_modules, vendor, etc.)

#### Detection Strategy:

- Analyze package.json, requirements.txt, Cargo.toml, etc.
- Detect test frameworks, build systems, linters
- Use ai_workflow_core project_kinds.yaml for validation rules

#### Success Criteria:

- Correctly detect 7+ project kinds
- Load validation rules from .workflow_core
- Exclude common third-party patterns
- 95%+ test coverage

**Provides**: Project awareness for smart step adaptation and AI prompts

---

### Phase 5: Git Integration

**Duration**: Week 5 (Estimated 5 days)  
**Depends on**: Phase 1, 2, 3 (file operations)  
**Priority**: **HIGH** - Enables change detection and auto-commit

#### Modules (5):

- [ ] `lib/git_automation.js` - Git operations (status, diff, add, commit, push)
- [ ] `lib/git_cache.js` - Git state caching (avoid repeated git calls)
- [ ] `lib/change_detection.js` - Smart change detection (docs-only, code-only, full)
- [ ] `lib/auto_commit.js` - Auto-commit workflow artifacts
- [ ] `lib/batch_ai_commit.js` - Batch AI commit message generation
- [ ] `lib/git_submodule_helpers.js` - Git submodule lifecycle management (NEW v3.2.0+)

#### Git Features:

- Detect repository root
- Track file changes since last run
- Generate meaningful commit messages
- Cache git state for performance
- Git submodule support (detect, init, update, commit, push) (NEW v3.2.0+)
- Automatic submodule pointer updates in parent repository

#### Success Criteria:

- All git operations async with proper error handling
- Change detection correctly categorizes changes
- Auto-commit respects .gitignore
- 100% test coverage with git mocking

**Provides**: Version control integration for workflow automation

---

### Phase 6: AI Integration

**Duration**: Weeks 6-7 (Estimated 7-10 days)  
**Depends on**: Phase 1, 2, 3, 4 (project detection)  
**Priority**: **HIGH** - Enables AI-powered workflow steps

#### Modules (6):

- [ ] `lib/ai_helpers.js` - AI integration helpers (~3,500 lines from source!)
  - GitHub Copilot CLI integration
  - AI persona management (14 personas including Technical Writer)
  - Prompt template system
  - AI response parsing
  - Intelligent model selection (NEW v3.1.1+)
- [ ] `lib/jq_wrapper.js` - Safe JSON operations wrapper (NEW v3.1+)
- [ ] `lib/ai_personas.js` - AI persona definitions (Documentation Expert, Test Engineer, etc.)
- [ ] `lib/ai_prompt_builder.js` - Dynamic prompt generation (project-aware, context-aware)
- [ ] `lib/ai_cache.js` - AI response caching (60-80% token reduction)
- [ ] `lib/ai_validation.js` - AI validation helpers (schema validation, confidence scoring)
- [ ] `lib/model_selector.js` - Intelligent AI model selection based on complexity (NEW v3.1.1+)

#### AI Features:

- 14 specialized AI personas
- Project-kind-specific prompts
- Response caching with TTL
- Batch AI operations
- Confidence scoring
- Intelligent model selection based on change complexity (NEW v3.1.1+)
  - 4-tier model system (Fast, Balanced, Deep Reasoning, Agentic)
  - Automatic complexity analysis (code, docs, tests)
  - 30-50% token usage reduction with optimized model selection

#### Success Criteria:

- All 14 personas implemented
- Prompt generation uses project context
- Cache reduces redundant AI calls by 60%+
- 90%+ test coverage (mock AI responses)

**Provides**: AI capabilities for intelligent workflow automation

---

### Phase 7: Step Execution Engine

**Duration**: Week 8 (Estimated 6 days)  
**Depends on**: Phase 2, 3, 4, 5 (Git)  
**Priority**: **CRITICAL** - Core workflow orchestration

#### Modules (6):

- [ ] `lib/step_execution.js` - Step execution engine (run, validate, error handling)
- [ ] `lib/step_metadata.js` - Step metadata management (step definitions, requirements)
- [ ] `lib/dependency_graph.js` - Dependency analysis (step dependencies, ordering)
- [ ] `lib/conditional_execution.js` - Conditional step logic (skip, retry, fallback)
- [ ] `lib/step_adaptation.js` - Dynamic step adaptation (project-kind-aware steps)
- [ ] `lib/step_validation_cache.js` - Validation caching (skip unchanged steps)

#### Execution Features:

- Dependency-based step ordering
- Conditional execution (skip if no changes)
- Step adaptation based on project kind
- Validation caching
- Error recovery strategies

#### Success Criteria:

- Correct dependency resolution
- Steps skip when no relevant changes
- Error handling with retry logic
- 100% test coverage

**Provides**: Step orchestration engine for workflow automation

---

### Phase 8: Performance Optimization

**Duration**: Week 9 (Estimated 5 days)  
**Depends on**: Phase 7 (step execution), Phase 6 (AI)  
**Priority**: **MEDIUM** - Performance enhancements

#### Modules (10):

- [ ] `lib/performance.js` - Performance tracking (timing, memory, I/O)
- [ ] `lib/performance_monitoring.js` - Real-time monitoring (warnings, alerts)
- [ ] `lib/ml_optimization.js` - ML-driven optimizations (predictive step skipping)
- [ ] `lib/analysis_cache.js` - Analysis result caching (NEW v3.1+)
- [ ] `lib/incremental_analysis.js` - Incremental analysis (NEW v3.1+)
- [ ] `lib/docs_only_optimization.js` - Fast path for docs-only changes
- [ ] `lib/code_changes_optimization.js` - Smart code change detection
- [ ] `lib/full_changes_optimization.js` - Optimization for full workflow runs
- [ ] `lib/multi_stage_pipeline.js` - Multi-stage pipeline (quick → medium → full)
- [ ] `lib/step1_incremental.js` - File-level hash tracking for Step 1 (NEW v3.1.1+)
- [ ] `lib/step1_parallel.js` - Category-based parallel processing for Step 1 (NEW v3.1.1+)

#### Optimization Strategy:

- 40-85% faster with change-based skipping
- 33% faster with parallel execution
- 60-80% token savings with AI caching
- 15-30% improvement with ML optimization
- 30-50% token reduction with intelligent model selection (NEW v3.1.1+)
- 75-96% faster Step 1 with incremental + parallel processing (NEW v3.1.1+)
- Combined: Up to 90% faster for docs-only

#### Success Criteria:

- Measurable performance improvements
- ML model accuracy >80%
- Multi-stage pipeline correctly escalates
- 90%+ test coverage

**Provides**: Performance optimizations for faster workflows

---

### Phase 9: Workflow Steps Implementation

**Duration**: Weeks 10-13 (Estimated 15-20 days)  
**Depends on**: Phase 6 (AI), Phase 7 (step engine), Phase 8 (optimization)  
**Priority**: **HIGH** - Core functionality

#### 20 Step Modules (1 complete, 19 planned):

- [ ] `steps/step_00_analyze.js` - Project analysis (detect tech stack, project kind)
- [ ] `steps/step_0b_bootstrap_docs.js` - Bootstrap documentation (gap analysis, generation) _(NEW v3.1+)_
- [x] `steps/step_01_documentation.js` (v2.0.0) - Documentation validation (completeness, accuracy) - ✅ Incremental & Parallel processing implemented
- [ ] `steps/step_02_consistency.js` - Consistency checks (naming, formatting, structure)
- [ ] `steps/step_02_5_doc_optimize.js` - Documentation optimization (duplicate detection, archiving) _(NEW v3.2.7+)_
  - 6 submodules: heuristics, git_analysis, version_analysis, ai_analyzer, consolidation, reporting
  - **Purpose**: Reduce doc size by 10-15%, save 5K-10K tokens
  - **Features**: SHA256 duplicate detection, similarity scoring, git history analysis, safe archiving
- [ ] `steps/step_03_script_refs.js` - Script reference validation (v2.2.0: auto-skip for non-shell projects)
- [ ] `steps/step_04_directory.js` - Directory structure validation
- [ ] `steps/step_05_test_review.js` - Test review (coverage, quality, best practices)
- [ ] `steps/step_06_test_gen.js` - Test generation (AI-powered test creation)
- [ ] `steps/step_07_test_exec.js` - Test execution (run tests, report results)
- [ ] `steps/step_08_dependencies.js` - Dependency analysis (security, updates, licenses) (v2.2.0: result caching)
- [ ] `steps/step_09_code_quality.js` - Code quality assessment (linting, complexity)
- [ ] `steps/step_10_context.js` - Context management (workflow context tracking)
- [ ] `steps/step_11_git.js` - Git operations (commit artifacts, push changes) (v2.3.0: submodule support)
- [ ] `steps/step_12_markdown_lint.js` - Markdown linting (style, formatting)
- [ ] `steps/step_13_prompt_engineer.js` - Prompt engineering (optimize AI prompts)
- [ ] `steps/step_14_ux_analysis.js` - UX/accessibility analysis
- [ ] `steps/step_15_version_update.js` - Version update

#### Implementation Strategy:

- Build steps incrementally (2-3 per week)
- Each step has comprehensive tests
- Steps use AI personas where appropriate (e.g., Technical Writer for Step 0b, Documentation Optimizer for Step 2.5)
- Steps adapt to project kind (e.g., Step 3 auto-skips for non-shell projects)
- Complex steps use modular architecture (step*XX_lib/) *(NEW v3.1+)\_
- **NEW**: Step 2.5 is a significant addition (13,141 bytes + 6 submodules)

#### Success Criteria:

- All 20 steps functional (including Step 0b and Step 2.5)
- Each step thoroughly tested
- AI integration works correctly
- Steps adapt to project type
- Modular step architecture implemented for complex steps
- Step 2.5 doc optimization provides 10-15% size reduction
- Step 3 auto-skip logic works for all project types
- Step 8 dependency caching reduces time by 90%+
- Step 11 git submodule support fully functional
- 95%+ test coverage per step

**Provides**: Full 20-step workflow automation capability

**Status**: 🚧 **PLANNED** - Phase 8 must complete first

---

### Phase 10: Main Orchestrator

**Duration**: Week 14 (Estimated 5 days)  
**Depends on**: Phase 7 (step engine), Phase 9 (steps)  
**Priority**: **HIGH** - Workflow coordination

#### Components:

- [ ] `WorkflowOrchestrator` class - Main workflow coordinator
  - Step sequencing and execution
  - Dependency resolution
  - Error handling and recovery
  - Progress tracking
- [ ] Checkpoint/resume functionality - Resume from any step
- [ ] Multi-stage pipeline support - Quick → Medium → Full validation
- [ ] Health checks - Pre-flight validation
- [ ] Progress tracking - Real-time progress updates
- [ ] Dashboard support - Metrics dashboard data

#### Orchestration Features:

- Run full 16-step workflow
- Resume from checkpoint
- Parallel step execution where possible
- Graceful error recovery
- Real-time progress reporting

#### Success Criteria:

- Full workflow runs end-to-end
- Checkpoint/resume works correctly
- Errors handled gracefully
- Progress tracking accurate
- 100% test coverage

**Provides**: Complete workflow orchestration

---

### Phase 11: CLI & Configuration

**Duration**: Week 15 (Estimated 5 days)  
**Depends on**: Phase 10 (orchestrator)  
**Priority**: **HIGH** - User interface

#### Features:

- [ ] CLI commands:
  - `ai-workflow run` - Run full workflow
  - `ai-workflow resume` - Resume from checkpoint
  - `ai-workflow config` - Configure workflow
  - `ai-workflow init` - Initialize new project
  - `ai-workflow status` - Check workflow status
  - `ai-workflow clean` - Clean artifacts
- [ ] Interactive config wizard - Guide users through setup
- [ ] Workflow templates support - Pre-configured workflows
- [ ] Auto-documentation generation - Generate docs from code

#### CLI Features:

- Rich progress indicators
- Colored output
- Interactive prompts
- Verbose and quiet modes
- Help documentation

#### Success Criteria:

- All commands functional
- Config wizard works correctly
- Templates support multiple project types
- Help documentation comprehensive
- 95%+ test coverage

**Provides**: User-friendly command-line interface

---

### Phase 12: Testing & Documentation

**Duration**: Weeks 16-17 (Estimated 8-10 days)  
**Depends on**: All phases  
**Priority**: **HIGH** - Quality assurance

#### Testing:

- [ ] Comprehensive unit tests (target: 500+ tests)
  - All modules thoroughly tested
  - Edge cases covered
  - Error paths tested
- [ ] Integration tests
  - End-to-end workflow tests
  - Multi-step integration tests
  - Real project testing
- [ ] Performance tests
  - Benchmark key operations
  - Regression testing
  - Load testing

#### Documentation:

- [ ] API documentation (JSDoc-generated)
- [ ] User guide (getting started, tutorials, examples)
- [ ] Migration guide from v3.0 (bash → JavaScript)
- [ ] Architecture documentation (design decisions, patterns)
- [ ] Automation scripts:
  - [ ] `scripts/setup.sh` - Development environment setup automation
  - [ ] `scripts/test-integration.sh` - Integration test runner
  - [ ] `scripts/validate.sh` - Full validation pipeline (linting, tests, formatting)

#### Success Criteria:

- 90%+ code coverage
- All integration tests passing
- Documentation complete and accurate
- Migration guide tested with real users
- Automation scripts functional

**Provides**: Quality assurance and comprehensive documentation

---

### Phase 13: Packaging & Release

**Duration**: Week 18 (Estimated 3-5 days)  
**Depends on**: All phases  
**Priority**: **HIGH** - Distribution

#### Deliverables:

- [ ] npm package configuration
  - package.json complete
  - Binary configuration
  - Dependencies optimized
- [ ] CI/CD setup (GitHub Actions)
  - Automated testing
  - Automated releases
  - Security scanning
- [ ] Release automation
  - Version bumping
  - Changelog generation
  - npm publishing
- [ ] Version 1.0.0 release
  - Feature parity with bash v3.0.0
  - Performance benchmarks documented
  - Migration guide validated

#### Success Criteria:

- Package published to npm
- CI/CD pipeline operational
- All tests pass in CI
- Documentation deployed
- v1.0.0 released

**Provides**: Production-ready npm package

---

## Migration Strategy

### JavaScript-First Philosophy

This is **NOT a line-by-line translation**. We will:

1. **Extract features** - understand WHAT each component does
2. **Design JavaScript architecture** - using modern patterns
3. **Implement idiomatically** - ES6+, async/await, classes
4. **Test comprehensively** - 80%+ coverage
5. **Document thoroughly** - JSDoc for all APIs

### Key Architectural Decisions

- **ES6+ modules** throughout
- **Classes** for stateful components (WorkflowOrchestrator, StepExecutor)
- **Async/await** for all I/O operations
- **Event emitters** for workflow events
- **Dependency injection** for testability
- **Strategy pattern** for steps
- **Observer pattern** for monitoring

---

## Success Criteria

- ✅ Feature parity with source v3.1.0
- ✅ All 16 steps implemented (including Step 0b)
- ✅ All 14 AI personas working (including Technical Writer)
- ✅ Checkpoint/resume functional
- ✅ Smart execution working (40%+ faster)
- ✅ 80%+ test coverage
- ✅ Documentation complete
- ✅ Published to npm

---

## Timeline

**Updated for v3.0.0 Reorganization**

- **Week 1:** Phase 1 (Foundation) ✅ **DONE**
- **Week 2:** Phase 2 (Configuration & State) ✅ **DONE**
- **Week 3:** Phase 3 (File Operations) ✅ **DONE**
- **Week 4:** Phase 4 (Project Detection)
- **Week 5:** Phase 5 (Git Integration)
- **Weeks 6-7:** Phase 6 (AI Integration)
- **Week 8:** Phase 7 (Step Execution Engine)
- **Week 9:** Phase 8 (Performance Optimization)
- **Weeks 10-13:** Phase 9 (15 Workflow Steps)
- **Week 14:** Phase 10 (Main Orchestrator)
- **Week 15:** Phase 11 (CLI & Configuration)
- **Weeks 16-17:** Phase 12 (Testing & Documentation)
- **Week 18:** Phase 13 (Packaging & Release)

**Total: ~18 weeks** (4.5 months from current state)

### Dependency Flow:

```
Phase 1 ✅ → Phase 2 ✅ → Phase 3 ✅ (File Ops) → Phase 4 (Project) → Phase 5 (Git)
                                    ↓                ↓
                               Phase 6 (AI) ← ←←←←← ↓
                                    ↓
                               Phase 7 (Step Engine)
                                    ↓
                               Phase 8 (Performance)
                                    ↓
                               Phase 9 (15 Steps)
                                    ↓
                          Phase 10 (Orchestrator)
                                    ↓
                            Phase 11 (CLI)
                                    ↓
                     Phase 12 (Testing & Docs)
                                    ↓
                       Phase 13 (Package & Release)
```

---

## Next Steps (Immediate)

### Phase 4: Project Detection & Analysis

**Priority**: Start immediately (next in dependency chain)

1. Implement `lib/project_type.js`
   - Project kind detection (configuration-library, nodejs-application, etc.)
   - Configuration schema validation
   - Tech stack detection integration
2. Implement `lib/tech_stack_detection.js`
   - Language detection (primary, secondary)
   - Framework detection
   - Build tool detection
   - Testing framework detection
3. Implement `lib/dependency_analysis.js`
   - Dependency file parsing (package.json, requirements.txt, etc.)
   - Dependency tree generation
   - Outdated dependency detection
4. Implement `lib/project_context.js`
   - README parsing
   - Contributing guidelines parsing
   - License detection
   - Documentation structure analysis

**Success Criteria**:

- All 5 modules implemented with v1.0.0
- 100% test coverage
- Comprehensive JSDoc documentation
- All tests passing

---

## Recent Source Changes (v3.2.0)

**Changes since last plan update (Feb 5, 2026):**

### Major Features (v3.2.0 - Feb 6, 2026)

1. **Git Submodule Support** (git_submodule_helpers.sh)
   - 531 lines, 21 functions
   - Full lifecycle management: detect, init, update, commit, push
   - Automatic submodule pointer updates in parent repository
   - AI-powered commit messages for submodule changes
   - Integrated into Step 11 (Git Finalization) as Phase 1.5
   - CLI flag: `--skip-submodules` for opt-out
   - **Impact**: Critical for projects using `.workflow_core` as submodule

### Optimization Features (v3.1.1 - Jan 28, 2026)

2. **Intelligent AI Model Selection** (model_selector.sh)
   - 788 lines, 4-tier model system
   - Automatic complexity analysis (code, docs, tests)
   - Cyclomatic complexity calculation
   - Model tiers: Fast (Haiku) → Balanced (Sonnet) → Deep (Opus 4.5) → Agentic (Opus 4.6)
   - Configuration: `.workflow_core/config/model_selection_rules.yaml`
   - CLI flags: `--force-model`, `--show-model-plan`
   - **Performance**: 30-50% token reduction, 15-25% faster execution
   - **Documentation**: `docs/MODEL_SELECTION.md` (12KB guide)

3. **Step 1 Optimization - Incremental Processing**
   - File-level SHA256 hash tracking (step_01_lib/incremental.sh)
   - Smart change detection: Skip AI for unchanged docs
   - JSON cache: `.ai_cache/doc_hashes.json`
   - **Performance**: 96% faster when no docs changed, 75% on partial changes

4. **Step 1 Optimization - Parallel Processing**
   - Category-based parallel analysis (5 categories)
   - Concurrent AI with job control (max 4 jobs)
   - Auto-threshold: ≥4 files triggers parallel mode
   - **Performance**: 71% faster on concurrent processing
   - **Combined Step 1 improvement**: 14.5 min → 0.5-5 min (75-96% reduction)

### Bug Fixes & Infrastructure (v3.1.0 - Jan 30, 2026)

5. **Step 0b: Bootstrap Documentation**
   - 524 lines, gap analysis & generation
   - Uses Technical Writer AI persona
   - Complements Step 1 (incremental) and Step 2 (consistency)

6. **JQ Wrapper Module** (jq_wrapper.sh)
   - 296 lines, safe JSON operations
   - Prevents jq --argjson errors with validation
   - Logging support with DEBUG mode

7. **Modular Step Architecture**
   - Step 1 refactored with step_01_lib/ (7 sub-modules)
   - Pattern for complex steps: step_XX_lib/ directories

8. **New Library Modules**
   - analysis_cache.sh (571 lines)
   - incremental_analysis.sh (238 lines)
   - version_bump.sh (415 lines)
   - precommit_hooks.sh (521 lines)

**Source Statistics Update:**

- **Version**: v3.1.0 → v3.2.0
- **Steps**: 15 → 16 (added Step 0b)
- **Library modules**: 62 → 70+ (added: jq_wrapper, model_selector, git_submodule_helpers, step optimizations)
- **Total LOC**: ~34K → ~39K+ (15% growth)
- **New patterns**: Modular step_XX_lib/ architecture, intelligent model selection

**Impact on Migration:**

1. **Priority 1 (Critical)**:
   - `git_submodule_helpers.js` - Required for `.workflow_core` integration
   - `model_selector.js` - Significant performance improvement (30-50% token reduction)

2. **Priority 2 (High Performance)**:
   - `step1_incremental.js` - 75-96% Step 1 speed improvement
   - `step1_parallel.js` - Parallel processing for Step 1

3. **Priority 3 (Already Implemented)**:
   - `jq_wrapper.js` - Already completed in Phase 6 (jq_wrapper module)

4. **Module Count Update**:
   - Phase 5 (Git): 4 → 5 modules (add git_submodule_helpers)
   - Phase 6 (AI): 6 → 7 modules (add model_selector)
   - Phase 8 (Performance): 9 → 11 modules (add step1_incremental, step1_parallel)

---

**Migration Status:** Phase 7 complete (329 tests), Phase 8 (Performance Optimization) next  
**Source Version:** v3.2.0  
**Last Updated:** February 6, 2026 (v3.5.0 - Source sync)
