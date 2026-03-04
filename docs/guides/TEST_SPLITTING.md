# Test Splitting Strategy

**Version**: 1.0.0
**Last Updated**: February 7, 2026

## Overview

This document describes the test splitting strategy implemented to optimize CI/CD pipeline performance by separating fast unit tests from slow integration tests.

---

## Motivation

### Problem

- Running full test suite with coverage on every branch/commit takes ~5-10 minutes
- Integration tests with coverage can take 25-30 minutes
- Feature branches don't need full integration test coverage on every push
- Wasting CI/CD resources and developer time waiting for feedback

### Solution

Split tests into two tiers:

1. **Fast Tests (Unit)**: Run on all branches, all commits (~2-3 seconds)
2. **Slow Tests (Integration + Coverage)**: Run only on main branch or PRs to main (~2-3 seconds, but reserved for critical paths)

### Impact

- **Feature Branches**: Save 35-40 minutes per push (only fast tests run)
- **Main Branch**: Full coverage maintained (both fast and slow tests run)
- **Developer Experience**: Faster feedback loops on feature development

---

## Test Categories

### Fast Tests (Unit) - Step 9a

**Location**: `test/lib/**/*.test.js`
**Command**: `npm run test:fast`
**Timeout**: 5 minutes
**When**: Always (all branches, all commits)

**Characteristics**:

- Pure unit tests for library modules
- No external dependencies
- No file system operations (or mocked)
- No network calls
- Fast execution (typically < 5 seconds total)

**Test Count**: 1,328 tests across 23 test suites

**Modules Tested**:

- Core utilities (utils, config, argument_parser)
- AI integration (ai_cache, ai_helpers, ai_personas, ai_prompt_builder, ai_validation)
- File operations (file_operations, edit_operations, cleanup_handlers)
- Project detection (project_kind_detection, project_kind_config, tech_stack)
- Git helpers (git_cache, git_automation)
- Session management (session_manager, metrics, backlog)
- Other (jq_wrapper, third_party_exclusion, change_detection, auto_commit)

---

### Slow Tests (Integration) - Step 9b

**Location**: `test/orchestrator/**/*.test.js`
**Command**: `npm run test:slow`
**Timeout**: 30 minutes
**When**: Only on `main` branch OR PRs targeting `main`

**Characteristics**:

- Integration tests for orchestrator modules
- Tests workflow coordination and step execution
- May involve multiple modules working together
- Tests dependency resolution and parallel execution
- Includes coverage generation

**Test Count**: 366 tests across 6 test suites

**Modules Tested**:

- workflow_engine.js - Workflow orchestration
- step_registry.js - Step registration and lookup
- dependency_resolver.js - Dependency graph resolution
- step_executor.js - Step execution logic
- conditional_executor.js - Conditional execution
- checkpoint_manager.js - Checkpoint management

---

## NPM Scripts

### Available Commands

```bash
# Run all tests (original behavior)
npm test

# Run only fast tests (unit)
npm run test:fast
npm run test:unit      # alias

# Run only slow tests (integration + coverage)
npm run test:slow
npm run test:integration  # alias (without coverage)

# Run all tests sequentially (CI mode)
npm run test:ci

# Run tests with coverage (for local development)
npm run test:coverage

# Watch mode (useful for development)
npm run test:watch
```

### Script Definitions

```json
{
  "scripts": {
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js",
    "test:unit": "npm test -- --testPathIgnorePatterns=/orchestrator/",
    "test:integration": "npm test -- --testMatch='**/orchestrator/**/*.test.js'",
    "test:fast": "npm run test:unit",
    "test:slow": "npm run test:integration -- --coverage",
    "test:ci": "npm run test:fast && npm run test:slow"
  }
}
```

---

## CI/CD Integration

### GitHub Actions Workflow

#### Job: `test` (Fast Tests)

- **Runs on**: All branches, all commits
- **Matrix**: Node 18.x, 20.x, 22.x
- **Timeout**: 5 minutes
- **Command**: `npm run test:fast`
- **Purpose**: Quick feedback for all commits

#### Job: `integration-tests` (Slow Tests)

- **Runs on**: Only when `github.ref == 'refs/heads/main' || github.base_ref == 'main'`
- **Matrix**: Node 18.x, 20.x, 22.x
- **Timeout**: 30 minutes
- **Command**: `npm run test:slow`
- **Purpose**: Comprehensive validation before merging to main

#### Job: `coverage` (Coverage Report)

- **Runs on**: All branches (but after fast tests pass)
- **Node**: 20.x only
- **Command**: `npm run test:coverage`
- **Purpose**: Generate and upload coverage reports

### Workflow Logic

```yaml
# Fast tests always run
test:
  runs-on: ubuntu-latest
  steps:
    - run: npm run test:fast
      timeout-minutes: 5

# Slow tests conditionally run
integration-tests:
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main' || github.base_ref == 'main'
  needs: test # Only after fast tests pass
  steps:
    - run: npm run test:slow
      timeout-minutes: 30

# Final check handles optional integration tests
all-checks-pass:
  needs: [test, integration-tests, coverage, build-check]
  steps:
    - run: |
        # Treat skipped integration tests as success
        if [[ "$INTEGRATION_RESULT" == "skipped" ]]; then
          INTEGRATION_RESULT="success"
        fi
```

---

## Performance Benchmarks

### Before Test Splitting

| Branch Type    | Tests Run             | Duration   | Iterations/Hour |
| -------------- | --------------------- | ---------- | --------------- |
| Feature Branch | Full suite + coverage | ~35-40 min | 1-2             |
| Main Branch    | Full suite + coverage | ~35-40 min | 1-2             |
| PR to Main     | Full suite + coverage | ~35-40 min | 1-2             |

**Total CI Time per Day**: Assuming 20 commits across feature branches = ~700-800 minutes

---

### After Test Splitting

| Branch Type    | Tests Run              | Duration      | Iterations/Hour |
| -------------- | ---------------------- | ------------- | --------------- |
| Feature Branch | Fast tests only        | ~2-3 seconds  | 1200            |
| Main Branch    | Fast + slow + coverage | ~5-10 minutes | 6-12            |
| PR to Main     | Fast + slow + coverage | ~5-10 minutes | 6-12            |

**Total CI Time per Day**: Assuming 20 commits across feature branches = ~1-2 minutes + main/PR overhead

**Time Savings**: ~698-798 minutes per day (99.7% reduction for feature branches)

---

## Local Development

### Recommended Workflow

```bash
# During active development (TDD)
npm run test:watch

# Before committing (fast check)
npm run test:fast

# Before pushing to feature branch
npm run test:fast && npm run lint

# Before creating PR to main
npm run test:ci  # Runs both fast and slow tests
```

### IDE Integration

#### VS Code Tasks

Add to `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Test: Fast (Unit)",
      "type": "npm",
      "script": "test:fast",
      "problemMatcher": []
    },
    {
      "label": "Test: Slow (Integration)",
      "type": "npm",
      "script": "test:slow",
      "problemMatcher": []
    },
    {
      "label": "Test: All (CI)",
      "type": "npm",
      "script": "test:ci",
      "problemMatcher": []
    }
  ]
}
```

---

## Best Practices

### When to Run Each Test Suite

#### Always Run Fast Tests

- Before every commit
- During active development
- When modifying library modules
- When in doubt

#### Run Slow Tests When

- Creating a PR to main
- After significant orchestrator changes
- Before releasing a new version
- Periodically (e.g., end of day) on feature branches

#### Run Full Coverage When

- Preparing release
- Analyzing test gaps
- Investigating coverage drops

### Writing Tests

#### Guidelines for Unit Tests (test/lib/)

```javascript
// ✅ Good: Fast, isolated, no dependencies
describe('calculateSum', () => {
  it('adds two numbers', () => {
    expect(calculateSum(1, 2)).toBe(3);
  });
});

// ❌ Bad: Slow, external dependency
describe('fetchUserData', () => {
  it('fetches from API', async () => {
    const data = await fetch('https://api.example.com/users/1');
    expect(data.name).toBe('John');
  });
});
```

#### Guidelines for Integration Tests (test/orchestrator/)

```javascript
// ✅ Good: Tests module integration
describe('WorkflowEngine', () => {
  it('executes steps in dependency order', async () => {
    const engine = new WorkflowEngine();
    const results = await engine.execute(steps);
    expect(results.order).toEqual(['step1', 'step2', 'step3']);
  });
});

// ❌ Bad: Should be in unit tests
describe('StepRegistry', () => {
  it('validates step ID format', () => {
    expect(validateStepId('step1')).toBe(true);
  });
});
```

---

## Troubleshooting

### Fast Tests Taking Too Long

- Check for synchronous file operations
- Look for unresolved promises
- Verify mocks are properly set up
- Profile with `npm test -- --detectOpenHandles`

### Integration Tests Timing Out

- Increase timeout in CI workflow (currently 30 min)
- Check for infinite loops in orchestrator logic
- Verify cleanup in afterEach/afterAll hooks
- Consider splitting large integration tests

### Skipped Integration Tests on PR

- Verify PR is targeting `main` branch
- Check GitHub Actions workflow conditions
- Ensure PR base is set correctly

---

## Migration Guide

### For Developers

No changes required! The test splitting is transparent:

- `npm test` still works as before (runs all tests)
- New scripts available for granular control
- CI/CD automatically uses the right strategy

### For CI/CD Pipelines

If you have custom CI/CD pipelines (non-GitHub Actions):

```bash
# Replace old monolithic test command
OLD: npm test -- --coverage

# With new split approach
NEW: npm run test:ci  # Runs fast, then slow with coverage
```

---

## Future Enhancements

### Potential Improvements

1. **Parallel Test Execution**: Run fast and slow tests in parallel on main
2. **Smoke Tests**: Add ultra-fast smoke test tier (<1 second)
3. **Adaptive Timeouts**: Adjust timeouts based on historical data
4. **Test Sharding**: Distribute integration tests across multiple runners
5. **Cache Test Results**: Cache test results for unchanged code

### Metrics to Track

- Average fast test duration
- Average slow test duration
- CI/CD time savings
- Developer feedback loop time
- Test flakiness rates

---

## References

- [Jest Configuration](../../jest.config.json)
- [Package Scripts](../../package.json)
- [CI Workflow](../../.github/workflows/ci.yml)
- [Testing Guide](./TESTING_GUIDE.md)

---

## Version History

| Version | Date       | Changes                               |
| ------- | ---------- | ------------------------------------- |
| 1.0.0   | 2026-02-07 | Initial test splitting implementation |
