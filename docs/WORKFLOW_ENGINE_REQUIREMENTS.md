# Workflow Engine Requirements (Phase 7)

**Status:** 📋 Planning - Not Yet Implemented  
**Target Phase:** Phase 7 - Workflow Orchestration  
**Dependencies:** Phases 1-6 Complete  
**Document Version:** 1.0.0  
**Last Updated:** February 2, 2026

---

## Overview

This document outlines requirements for the **Workflow Engine** (Phase 7), which will orchestrate the 15-step AI-powered development workflow pipeline. The engine will coordinate between configuration, project analysis, AI integration, and execution steps.

**Note:** The JavaScript workflow engine is planned but not yet implemented. The source shell-based workflow (mpbarbosa/ai_workflow v3.0.0) provides the reference implementation.

---

## Core Requirements

### 1. **Test Regression Detection**

**Priority:** 🔴 Critical  
**Phase:** 7  
**Status:** Planned

#### Requirement

Execute tests at critical workflow checkpoints to prevent committing broken code.

#### Suggested Implementation

```yaml
# Step 11: Post-validation Test Check
- name: 'Test Regression Check'
  command: 'npm test -- --passWithNoTests'
  validation:
    - exit_code: 0
    - pass_rate: '100%'
  on_failure: 'block_commit'
  priority: 'critical'
  timing: 'post-validation' # After code changes, before commit

# Alternative: Quick check with coverage
- name: 'Quick Test Verification'
  command: 'npm test -- --bail --onlyChanged'
  timeout: 30s
  validation:
    - exit_code: 0
  on_failure: 'warn_and_continue' # Less strict for dev workflow
```

#### Benefits

- ✅ Catch regressions before committing
- ✅ Prevent CI/CD pipeline failures
- ✅ Fast feedback loop for developers
- ✅ Blocks broken code from reaching repository

#### Current Workaround

Git pre-commit hook via Husky + lint-staged:

```json
// .lintstagedrc.json
{
  "src/**/*.js": ["npm test -- --bail --findRelatedTests --passWithNoTests"]
}
```

---

### 2. **Workflow Step Orchestration**

**Priority:** 🔴 Critical  
**Phase:** 7  
**Status:** Planned

#### Requirements

- Sequential step execution with dependency management
- Step validation and error handling
- Progress tracking and logging
- Checkpoint creation and recovery
- Dry-run mode support

#### Planned Architecture

```javascript
class WorkflowEngine {
  constructor(config) {
    this.config = config;
    this.steps = [];
    this.currentStep = null;
    this.checkpoints = new Map();
  }

  async execute(workflow) {
    // Load workflow definition
    // Validate prerequisites
    // Execute steps sequentially
    // Handle failures and recovery
    // Generate summary
  }

  async executeStep(step) {
    // Pre-step validation
    // Execute step command
    // Post-step validation
    // Create checkpoint
    // Log results
  }
}
```

---

### 3. **Step Validation Framework**

**Priority:** 🟠 High  
**Phase:** 7  
**Status:** Planned

#### Requirements

- Pre-condition checking (dependencies, file existence)
- Post-condition validation (exit codes, output patterns)
- Timeout management
- Resource verification (disk space, memory)

#### Example Validations

```yaml
pre_conditions:
  - file_exists: 'package.json'
  - command_available: 'npm'
  - disk_space: '>1GB'

post_conditions:
  - exit_code: 0
  - output_contains: 'Tests passed'
  - files_created: ['dist/bundle.js']
  - test_pass_rate: '>=95%'
```

---

### 4. **AI Integration Points**

**Priority:** 🟠 High  
**Phase:** 7 (depends on Phase 6)  
**Status:** Planned

#### Requirements

- GitHub Copilot SDK integration
- AI-powered code review
- Automated test generation
- Documentation validation
- Code quality suggestions

#### Workflow Steps with AI

```yaml
steps:
  - name: 'AI Code Review'
    ai_agent: 'copilot-code-review'
    inputs: ['git diff --cached']
    outputs: ['review_report.md']

  - name: 'AI Test Generation'
    ai_agent: 'copilot-test-generator'
    inputs: ['src/**/*.js']
    outputs: ['test/**/*.test.js']
```

---

### 5. **Error Handling & Recovery**

**Priority:** 🟠 High  
**Phase:** 7  
**Status:** Planned

#### Requirements

- Graceful degradation on step failure
- Retry logic with exponential backoff
- Checkpoint-based recovery
- Rollback capabilities
- Error classification (fatal vs. recoverable)

#### Error Handling Strategy

```javascript
const errorHandling = {
  test_failure: {
    action: 'block_commit',
    retry: false,
    notify: true,
  },
  lint_warning: {
    action: 'warn_and_continue',
    retry: false,
    notify: false,
  },
  network_error: {
    action: 'retry',
    max_retries: 3,
    backoff: 'exponential',
  },
};
```

---

### 6. **Metrics & Telemetry**

**Priority:** 🟡 Medium  
**Phase:** 7  
**Status:** Planned

#### Requirements

- Step execution timing
- Success/failure rates
- Resource usage tracking
- Performance bottleneck identification
- Historical trend analysis

#### Metrics to Collect

```javascript
const metrics = {
  workflow_duration: 'total_ms',
  step_timings: { step1: 'ms', step2: 'ms', ... },
  test_results: { total: 723, passed: 723, failed: 0 },
  resource_usage: { cpu: 'percent', memory: 'mb' },
  ai_api_calls: { count: 42, tokens_used: 15000 }
};
```

---

### 7. **Dry-Run Mode**

**Priority:** 🟡 Medium  
**Phase:** 7  
**Status:** Planned (already implemented in library modules)

#### Current Implementation

All Phase 2-5 modules support `dryRun` mode:

- `FileOperations` - simulates file operations
- `EditOperations` - shows what would be changed
- `CleanupHandlers` - previews cleanup actions
- `ConfigManager` - validates without writing

#### Workflow Engine Integration

```javascript
const engine = new WorkflowEngine({
  dryRun: true, // Simulate workflow without side effects
  verbose: true, // Show detailed output
});

await engine.execute(workflow);
// Output: "Would execute: npm test"
// Output: "Would commit: git commit -m 'message'"
```

---

### 8. **Parallel Step Execution**

**Priority:** 🟢 Low  
**Phase:** 8 (future optimization)  
**Status:** Future Enhancement

#### Requirements

- Identify independent steps (no dependencies)
- Execute in parallel for faster workflow
- Aggregate results
- Handle partial failures

#### Example

```yaml
parallel_steps:
  - [lint, test, type_check] # All independent, run simultaneously
  - [build] # Depends on above, runs after all complete
  - [deploy_staging, deploy_production] # Conditional parallel
```

---

## Implementation Plan

### Phase 7 Milestones

1. **M1: Basic Step Execution** (Week 1)
   - Sequential step orchestration
   - Command execution via `Executor` (already implemented)
   - Basic logging and progress tracking

2. **M2: Validation Framework** (Week 2)
   - Pre/post-condition checking
   - Exit code validation
   - Output pattern matching
   - Test regression detection

3. **M3: Error Handling** (Week 3)
   - Retry logic
   - Checkpoint/recovery system
   - Graceful degradation
   - Error classification

4. **M4: AI Integration** (Week 4)
   - Depends on Phase 6 (AI Integration)
   - Copilot SDK workflow integration
   - AI-powered code review
   - Automated test generation

5. **M5: Metrics & Reporting** (Week 5)
   - Performance metrics collection
   - Workflow summaries
   - Historical tracking
   - Trend analysis

---

## Testing Strategy

### Unit Tests

- Test each workflow step in isolation
- Mock file system and network operations
- Validate error handling paths
- Test dry-run mode

### Integration Tests

- Test step sequencing
- Test dependency resolution
- Test checkpoint/recovery
- Test metrics collection

### End-to-End Tests

- Full workflow execution
- Real project scenarios
- Performance benchmarks
- Regression testing

---

## Migration from Shell Workflow

### Source Reference

**Repository:** mpbarbosa/ai_workflow v3.0.0  
**Language:** Bash  
**Structure:**

- `steps/` - 15 step implementations (4,777 lines)
- `lib/` - 33+ library modules (14,993 lines)
- `orchestrator.sh` - Main workflow orchestrator

### Migration Strategy

1. **Extract patterns** from shell orchestrator
2. **Preserve behavior** while modernizing architecture
3. **Add improvements** (error handling, metrics, dry-run)
4. **Maintain compatibility** with existing configurations

---

## Dependencies

### Required Phases (Must Complete First)

- ✅ Phase 1: Core Foundation (COMPLETE)
- ✅ Phase 2: Configuration & State (COMPLETE)
- ✅ Phase 3: File Operations (COMPLETE)
- ✅ Phase 4: Project Detection (COMPLETE)
- 🚧 Phase 5: Git Integration (NEXT)
- 🚧 Phase 6: AI Integration (FUTURE)

### External Dependencies

- `@github/copilot-sdk` (already installed)
- Node.js 18+ (already required)
- Git (system dependency)
- npm/package manager (system dependency)

---

## Success Criteria

### Phase 7 Complete When:

- ✅ 15-step workflow executes end-to-end
- ✅ Test regression detection implemented
- ✅ Error handling and recovery working
- ✅ Dry-run mode fully functional
- ✅ Metrics collection and reporting
- ✅ 95%+ test coverage for workflow engine
- ✅ Documentation complete (API, guides, examples)

---

## References

- **Source Implementation:** [ai_workflow v3.0.0](https://github.com/mpbarbosa/ai_workflow) (orchestrator.sh)
- **Phase 1-5 Modules:** Already implemented with referential transparency
- **Configuration:** `.workflow-config.yaml` structure defined
- **Metrics:** `MetricsCollector` class ready for integration
- **Backlog:** `BacklogManager` ready for workflow summaries

---

## Future Enhancements (Post-Phase 7)

### Phase 8: Parallel Execution

- Run independent steps simultaneously
- Resource-aware scheduling
- Load balancing

### Phase 9: Cloud Integration

- Remote execution support
- Distributed workflows
- Cloud storage for artifacts

### Phase 10: Web UI

- Visual workflow designer
- Real-time progress monitoring
- Historical analytics dashboard

---

**Document Status:** Living document - will be updated as Phase 7 implementation progresses.

**Last Updated:** February 2, 2026  
**Next Review:** When Phase 5 (Git Integration) completes
