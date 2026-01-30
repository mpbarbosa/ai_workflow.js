# Migration Plan: AI Workflow from Shell Script to JavaScript/Node.js

**Version:** 3.0.0 - **REORGANIZED**  
**Document Version:** 3.0.0  
**Last Updated:** January 30, 2026  
**Status:** Active Development - Phase 2 Complete

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

| Version | Date       | Changes                                                                                             |
| ------- | ---------- | --------------------------------------------------------------------------------------------------- |
| 3.0.0   | 2026-01-30 | **REORGANIZATION**: Phases reordered by dependency. File Ops → Project Detection → Git → AI → Steps |
| 2.1.0   | 2026-01-30 | Phase 2.1 complete. Added semantic versioning to all files. Updated status.                         |
| 2.0.0   | 2026-01-30 | **MAJOR CORRECTION**: Complete rewrite based on actual source analysis                              |
| 1.2.0   | 2026-01-29 | ❌ INCORRECT - contained wrong package manager content                                              |
| 1.1.0   | 2026-01-29 | ❌ INCORRECT - contained wrong package manager content                                              |
| 1.0.0   | 2026-01-27 | ❌ INCORRECT - contained wrong package manager content                                              |

---

## Executive Summary

This document outlines the migration of [ai_workflow](https://github.com/mpbarbosa/ai_workflow) from shell script to JavaScript/Node.js.

**Source Repository:** https://github.com/mpbarbosa/ai_workflow (v3.0.0)

**What ai_workflow Actually Is:**

- **15-step AI-powered workflow automation for software development projects**
- Documentation validation, test generation, code quality analysis
- GitHub Copilot integration with 14 specialized AI personas
- Smart execution, parallel processing, ML optimization, AI caching
- Checkpoint/resume, change detection, metrics tracking
- 62 library modules (~28K lines) + 17 step modules (~6K lines)

**What ai_workflow is NOT:**

- ❌ Package manager (apt, pacman, npm, pip)
- ❌ System update tool
- ❌ Application updater
- ❌ Hardware/system diagnostics

---

## Source Repository Structure - ACTUAL

```
ai_workflow/
├── src/workflow/
│   ├── execute_tests_docs_workflow.sh    # Main orchestrator (2,672 lines)
│   ├── lib/                              # 62 library modules (27,902 lines)
│   │   ├── ai_cache.sh                   # AI response caching
│   │   ├── ai_helpers.sh                 # AI integration (~3,500 lines!)
│   │   ├── ai_personas.sh                # 14 AI persona definitions
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
│   │   ├── dependency_graph.sh           # Dependency analysis
│   │   ├── doc_template_validator.sh     # Doc validation
│   │   ├── docs_only_optimization.sh     # Docs optimizations
│   │   ├── edit_operations.sh            # File editing
│   │   ├── enhanced_validations.sh       # Validations
│   │   ├── file_operations.sh            # File operations
│   │   ├── full_changes_optimization.sh  # Full optimizations
│   │   ├── git_automation.sh             # Git automation
│   │   ├── git_cache.sh                  # Git caching
│   │   ├── health_check.sh               # Health checks
│   │   ├── incremental_analysis.sh       # Incremental analysis
│   │   ├── metrics.sh                    # Metrics
│   │   ├── metrics_validation.sh         # Metrics validation
│   │   ├── ml_optimization.sh            # ML-driven optimization
│   │   ├── multi_stage_pipeline.sh       # Multi-stage pipeline
│   │   ├── performance.sh                # Performance tracking
│   │   ├── performance_monitoring.sh     # Performance monitoring
│   │   ├── project_kind_config.sh        # Project config
│   │   ├── project_kind_detection.sh     # Project detection
│   │   ├── session_manager.sh            # Session management
│   │   ├── step_adaptation.sh            # Step adaptation
│   │   ├── step_execution.sh             # Step execution
│   │   ├── step_metadata.sh              # Step metadata
│   │   ├── step_validation_cache.sh      # Validation cache
│   │   ├── summary.sh                    # Summaries
│   │   ├── tech_stack.sh                 # Tech stack detection
│   │   ├── third_party_exclusion.sh      # Third-party exclusion
│   │   ├── utils.sh                      # Utilities
│   │   └── ... (and more)
│   └── steps/                            # 17 step modules (6,119 lines)
│       ├── step_00_analyze.sh            # Project analysis
│       ├── step_01_documentation.sh      # Documentation validation
│       ├── step_02_consistency.sh        # Consistency checks
│       ├── step_03_script_refs.sh        # Script references
│       ├── step_04_directory.sh          # Directory validation
│       ├── step_05_test_review.sh        # Test review
│       ├── step_06_test_gen.sh           # Test generation
│       ├── step_07_test_exec.sh          # Test execution
│       ├── step_08_dependencies.sh       # Dependency analysis
│       ├── step_09_code_quality.sh       # Code quality
│       ├── step_0a_version_update.sh     # Version update (alt)
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

### 1. 15-Step Workflow Pipeline

- **Step 0:** Project analysis and context detection
- **Step 1:** Documentation validation and enhancement
- **Step 2:** Consistency checking across files
- **Step 3:** Script reference validation
- **Step 4:** Directory structure validation
- **Step 5:** Test review and analysis
- **Step 6:** Test generation
- **Step 7:** Test execution
- **Step 8:** Dependency analysis
- **Step 9:** Code quality assessment
- **Step 10:** Context management
- **Step 11:** Git automation and validation
- **Step 12:** Markdown linting
- **Step 13:** Prompt engineering
- **Step 14:** UX and accessibility analysis

### 2. AI Integration (14 Personas)

- GitHub Copilot CLI integration
- Specialized AI personas:
  - Documentation Expert
  - Test Engineer
  - Code Quality Analyst
  - Git Specialist
  - UX Analyst
  - Prompt Engineer
  - Security Expert
  - Performance Engineer
  - And 6 more...
- AI response caching (60-80% token reduction)
- Dynamic prompt generation
- Batch AI operations

### 3. Performance Optimizations

- **Smart Execution**: Change-based step skipping (40-85% faster)
- **Parallel Execution**: Independent steps run simultaneously (33% faster)
- **AI Caching**: Intelligent response caching (60-80% savings)
- **ML Optimization**: Predictive workflow intelligence (15-30% improvement)
- **Multi-Stage Pipeline**: Progressive validation (3 stages)
- **Combined**: Up to 90% faster for simple changes

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

### Phase 3: File Operations & Utilities 🔄 **NEXT**

**Duration**: Week 3 (Estimated 5 days)  
**Depends on**: Phase 1, 2  
**Priority**: **CRITICAL PATH** - Required by almost all subsequent phases

#### Modules (5):

- [ ] `lib/file_operations.js` - File system operations (read, write, exists, list, copy, move, delete)
- [ ] `lib/edit_operations.js` - File editing utilities (find/replace, insert, append, patch)
- [ ] `lib/argument_parser.js` - CLI argument parsing with validation
- [ ] `lib/utils.js` - General utilities (string, array, object helpers)
- [ ] `lib/cleanup_handlers.js` - Cleanup operations (temp files, sessions, cache)

#### Success Criteria:

- All file operations use async/await
- Comprehensive error handling for I/O failures
- 100% test coverage for file operations
- Dry-run mode support for all destructive operations

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

#### Git Features:

- Detect repository root
- Track file changes since last run
- Generate meaningful commit messages
- Cache git state for performance

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

#### Modules (5):

- [ ] `lib/ai_helpers.js` - AI integration helpers (~3,500 lines from source!)
  - GitHub Copilot CLI integration
  - AI persona management (14 personas)
  - Prompt template system
  - AI response parsing
- [ ] `lib/ai_personas.js` - AI persona definitions (Documentation Expert, Test Engineer, etc.)
- [ ] `lib/ai_prompt_builder.js` - Dynamic prompt generation (project-aware, context-aware)
- [ ] `lib/ai_cache.js` - AI response caching (60-80% token reduction)
- [ ] `lib/ai_validation.js` - AI validation helpers (schema validation, confidence scoring)

#### AI Features:

- 14 specialized AI personas
- Project-kind-specific prompts
- Response caching with TTL
- Batch AI operations
- Confidence scoring

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

#### Modules (8):

- [ ] `lib/performance.js` - Performance tracking (timing, memory, I/O)
- [ ] `lib/performance_monitoring.js` - Real-time monitoring (warnings, alerts)
- [ ] `lib/ml_optimization.js` - ML-driven optimizations (predictive step skipping)
- [ ] `lib/analysis_cache.js` - Analysis result caching
- [ ] `lib/docs_only_optimization.js` - Fast path for docs-only changes
- [ ] `lib/code_changes_optimization.js` - Smart code change detection
- [ ] `lib/full_changes_optimization.js` - Optimization for full workflow runs
- [ ] `lib/multi_stage_pipeline.js` - Multi-stage pipeline (quick → medium → full)

#### Optimization Strategy:

- 40-85% faster with change-based skipping
- 33% faster with parallel execution
- 60-80% token savings with AI caching
- 15-30% improvement with ML optimization
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

#### 15 Step Modules:

- [ ] `steps/step_00_analyze.js` - Project analysis (detect tech stack, project kind)
- [ ] `steps/step_01_documentation.js` - Documentation validation (completeness, accuracy)
- [ ] `steps/step_02_consistency.js` - Consistency checks (naming, formatting, structure)
- [ ] `steps/step_03_script_refs.js` - Script reference validation
- [ ] `steps/step_04_directory.js` - Directory structure validation
- [ ] `steps/step_05_test_review.js` - Test review (coverage, quality, best practices)
- [ ] `steps/step_06_test_gen.js` - Test generation (AI-powered test creation)
- [ ] `steps/step_07_test_exec.js` - Test execution (run tests, report results)
- [ ] `steps/step_08_dependencies.js` - Dependency analysis (security, updates, licenses)
- [ ] `steps/step_09_code_quality.js` - Code quality assessment (linting, complexity)
- [ ] `steps/step_10_context.js` - Context management (workflow context tracking)
- [ ] `steps/step_11_git.js` - Git operations (commit artifacts, push changes)
- [ ] `steps/step_12_markdown_lint.js` - Markdown linting (style, formatting)
- [ ] `steps/step_13_prompt_engineer.js` - Prompt engineering (optimize AI prompts)
- [ ] `steps/step_14_ux_analysis.js` - UX/accessibility analysis

#### Implementation Strategy:

- Build steps incrementally (2-3 per week)
- Each step has comprehensive tests
- Steps use AI personas where appropriate
- Steps adapt to project kind

#### Success Criteria:

- All 15 steps functional
- Each step thoroughly tested
- AI integration works correctly
- Steps adapt to project type
- 95%+ test coverage per step

**Provides**: Full 15-step workflow automation capability

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

- Run full 15-step workflow
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

- ✅ Feature parity with source v3.0.0
- ✅ All 15 steps implemented
- ✅ All 14 AI personas working
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
- **Week 3:** Phase 3 (File Operations) - **NEXT**
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
Phase 1 ✅ → Phase 2 ✅ → Phase 3 (File Ops) → Phase 4 (Project) → Phase 5 (Git)
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

### Phase 3: File Operations & Utilities

**Priority**: Start immediately (critical path dependency)

1. Implement `lib/file_operations.js`
   - Async file I/O (read, write, exists, list, copy, move, delete)
   - Error handling for all file operations
   - Dry-run mode support
2. Implement `lib/edit_operations.js`
   - Find/replace with regex
   - Line insertion/appending
   - File patching
3. Implement `lib/argument_parser.js`
   - CLI argument parsing
   - Validation and type coercion
   - Help text generation
4. Implement `lib/utils.js`
   - String helpers (camelCase, kebab-case, sanitize)
   - Array helpers (dedupe, chunk, flatten)
   - Object helpers (merge, clone, pick)
5. Implement `lib/cleanup_handlers.js`
   - Temp file cleanup
   - Session cleanup
   - Cache cleanup

**Success Criteria**:

- All 5 modules implemented with v1.0.0
- 100% test coverage
- Comprehensive JSDoc documentation
- All tests passing

---

**Migration Status:** Phase 2 complete, Phase 3 (File Operations) next  
**Last Updated:** January 30, 2026 (v3.0.0 Reorganization)  
**Last Updated:** January 30, 2026
