# Conditional Execution Strategy

**Version:** 1.3.0  
**Status:** ✅ Implemented  
**Impact:** 40-60% reduction in CI/CD time for low-impact changes

## Overview

The conditional execution system intelligently determines which CI/CD steps should run based on **change impact analysis**. It uses file pattern matching, impact scoring, and branch policies to skip unnecessary tests and checks.

## Key Features

### 1. Change Impact Analysis

Analyzes git changes to determine execution strategy:

- **Docs-Only**: Skip all tests, run documentation checks only (~90% time saved)
- **Unit-Only**: Skip integration tests (~50% time saved)
- **Selective**: Run only affected test suites (~40% time saved)
- **Run-All**: Execute full test suite (CI config changes, large changesets)

### 2. File Pattern Matching

Steps are conditionally executed based on changed files:

```yaml
unit-tests:
  patterns:
    - src/**/*.js
    - test/lib/**/*.test.js
    - package.json

integration-tests:
  patterns:
    - src/orchestrator/**/*.js
    - test/orchestrator/**/*.test.js
    - src/index.js

documentation:
  patterns:
    - **/*.md
    - docs/**/*
```

### 3. Impact Levels

Each change is scored by impact:

- **Critical** (3): Core functionality, breaking changes
- **High** (2): Feature code, test modifications
- **Medium** (1): Configuration changes
- **Low** (0): Documentation, comments

### 4. Branch Policies

Different strategies for different branches:

- **Feature branches**: Skip integration tests (unless orchestrator changed)
- **Main branch**: Always run full suite
- **PRs to main**: Run integration tests + coverage

## Usage

### Local Development

```bash
# Analyze current changes
npm run analyze:changes

# Verbose output with file details
npm run analyze:changes:verbose

# JSON output for scripting
npm run analyze:changes:json
```

### Example Output

```
🔍 Change Impact Analysis

Strategy: unit-only
Reason: Unit test code changes only

📋 Step Execution Plan:

✓ unit-tests           [RUN]
⊘ integration-tests    [SKIP]
✓ linting              [RUN]
⊘ documentation        [SKIP]

============================================================
Running 2/4 steps based on change impact
```

## Implementation Details

### Analysis Script

**File:** `scripts/analyze-change-impact.js`

Key functions:

- `getChangedFiles()` - Detects changes vs main branch
- `matchPattern()` - Glob pattern matching
- `analyzeChangeImpact()` - Impact scoring
- `determineExecutionStrategy()` - Strategy selection

### CI/CD Integration

**File:** `.github/workflows/ci.yml`

```yaml
jobs:
  analyze-changes:
    name: Analyze Changes
    outputs:
      strategy: ${{ steps.analyze.outputs.strategy }}
      run_unit_tests: ${{ steps.analyze.outputs.run_unit_tests }}
      run_integration_tests: ${{ steps.analyze.outputs.run_integration_tests }}
    steps:
      - name: Analyze change impact
        id: analyze
        run: |
          ANALYSIS=$(node scripts/analyze-change-impact.js --json)
          # Extract and set outputs...

  test:
    needs: analyze-changes
    if: needs.analyze-changes.outputs.run_unit_tests == 'true'
    # ... test steps

  integration-tests:
    needs: [analyze-changes, test]
    if: |
      needs.analyze-changes.outputs.run_integration_tests == 'true' &&
      (github.ref == 'refs/heads/main' || github.base_ref == 'main')
    # ... integration test steps
```

## Execution Strategies

### Strategy 1: Docs-Only

**Trigger:** Only markdown/documentation files changed

**Execution:**

- ⊘ Skip: Unit tests
- ⊘ Skip: Integration tests
- ⊘ Skip: Linting
- ✓ Run: Documentation checks

**Time:** ~10 seconds (was 40+ minutes)  
**Savings:** ~95%

### Strategy 2: Unit-Only

**Trigger:** Only library code changed (not orchestrator)

**Execution:**

- ✓ Run: Unit tests
- ⊘ Skip: Integration tests
- ✓ Run: Linting
- ✓ Run: Documentation (if changed)

**Time:** ~5 minutes (was 40+ minutes)  
**Savings:** ~87%

### Strategy 3: Selective

**Trigger:** Mixed changes with clear boundaries

**Execution:**

- ✓ Run: Affected test suites only
- ✓ Run: Related checks
- ⊘ Skip: Unrelated steps

**Time:** ~15-20 minutes (was 40+ minutes)  
**Savings:** ~50%

### Strategy 4: Run-All

**Trigger:** CI config changes, large changesets (>100 files), core changes

**Execution:**

- ✓ Run: All tests
- ✓ Run: All checks
- ✓ Run: Full validation

**Time:** ~40 minutes (baseline)  
**Savings:** 0% (necessary for safety)

## Performance Metrics

### Before Conditional Execution

- **Every commit:** 40-45 minutes full CI run
- **Daily (20 commits):** 800+ minutes
- **Wasted cycles:** ~60% (docs/minor changes)

### After Conditional Execution

- **Docs-only:** ~10 seconds (95% faster)
- **Unit-only:** ~5 minutes (87% faster)
- **Selective:** ~20 minutes (50% faster)
- **Run-all:** ~40 minutes (baseline)

**Estimated daily savings:** 400-500 minutes (50-60%)

## Pattern Matching Rules

### Critical Patterns (Always Run All)

```javascript
// These trigger full test suite
'.github/**/*'; // CI config changes
'package.json'; // Dependency changes
'jest.config.json'; // Test config changes
```

### Source Code Patterns

```javascript
// Triggers unit tests
'src/lib/**/*.js'; // Library modules
'src/utils/**/*.js'; // Utility functions
'src/core/**/*.js'; // Core modules

// Triggers integration tests
'src/orchestrator/**/*.js'; // Orchestrators
'src/index.js'; // Main export file
```

### Test Patterns

```javascript
// Triggers matching test suite
'test/lib/**/*.test.js'; // Unit tests
'test/orchestrator/**/*.test.js'; // Integration tests
```

### Documentation Patterns

```javascript
// Skips all tests
'**/*.md'; // Markdown files
'docs/**/*'; // Documentation directory
'README.md'; // Project README
'CHANGELOG.md'; // Version history
```

## Configuration

### Adding New Patterns

Edit `scripts/analyze-change-impact.js`:

```javascript
const STEP_PATTERNS = {
  'my-new-step': {
    description: 'My new validation step',
    patterns: ['src/my-module/**/*.js', 'test/my-module/**/*.test.js'],
    impactLevel: 'medium',
  },
};
```

### Adjusting Impact Levels

```javascript
const IMPACT_LEVELS = {
  critical: 3, // Core functionality
  high: 2, // Feature code
  medium: 1, // Configuration
  low: 0, // Documentation
};
```

## Best Practices

### 1. Add Patterns for New Features

When adding new code modules, update pattern matching:

```javascript
'src/new-feature/**/*.js',
'test/new-feature/**/*.test.js',
```

### 2. Use Appropriate Impact Levels

- `critical`: Breaking changes, core logic
- `high`: New features, major refactoring
- `medium`: Config changes, minor features
- `low`: Docs, comments, formatting

### 3. Test Pattern Changes

```bash
# Make some test changes
git add src/lib/config.js

# Verify pattern matching
npm run analyze:changes:verbose

# Should show unit-tests: [RUN]
```

### 4. Monitor CI Performance

Track execution time by strategy:

- Docs-only: Should be <30 seconds
- Unit-only: Should be <10 minutes
- Selective: Should be <25 minutes
- Run-all: 40-45 minutes is expected

## Troubleshooting

### Issue: Tests Skipped When They Shouldn't Be

**Solution 1:** Check pattern matching

```bash
npm run analyze:changes:verbose
# Review "Matched files" for each step
```

**Solution 2:** Verify file paths

```bash
git diff --name-only origin/main...HEAD
# Ensure paths match your patterns
```

**Solution 3:** Force full run

```bash
# Touch a CI config file to trigger run-all
touch .github/workflows/ci.yml
git add .github/workflows/ci.yml
```

### Issue: Too Many Steps Running

**Symptom:** Expected docs-only, got unit-only

**Cause:** package.json or config file also changed

**Solution:** Review all changed files

```bash
npm run analyze:changes:verbose
# Check "Changed files" section
```

### Issue: Integration Tests Not Running on Main

**Cause:** Change analysis says skip + branch policy conflict

**Solution:** Check both conditions

```yaml
if: |
  needs.analyze-changes.outputs.run_integration_tests == 'true' &&
  (github.ref == 'refs/heads/main' || github.base_ref == 'main')
```

### Issue: Analysis Fails in CI

**Symptom:** "Could not detect git changes"

**Cause:** Shallow clone missing history

**Solution:** Ensure full git fetch

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0 # Fetch all history
```

## Related Documentation

- **Test Splitting Guide:** [docs/guides/TEST_SPLITTING.md](./TEST_SPLITTING.md)
- **Validation Scripts:** [docs/guides/VALIDATION_SCRIPTS.md](./VALIDATION_SCRIPTS.md)
- **CI/CD Configuration:** [.github/workflows/ci.yml](../../.github/workflows/ci.yml)

## Metrics & Monitoring

### Daily CI Time (20 commits/day)

**Before:**

- 20 commits × 40 min = 800 minutes
- All commits run full suite
- 60% unnecessary

**After (Estimated):**

- 8 docs-only × 0.2 min = 1.6 minutes
- 6 unit-only × 5 min = 30 minutes
- 4 selective × 20 min = 80 minutes
- 2 run-all × 40 min = 80 minutes
- **Total: ~192 minutes**
- **Savings: 608 minutes (76%)**

### Success Metrics

Track these in your CI/CD:

1. **Skip rate:** % of jobs skipped by strategy
2. **Time savings:** Baseline vs actual execution time
3. **False negatives:** Tests that should have run but didn't
4. **Strategy distribution:** docs-only vs unit-only vs run-all

### Monitoring Query (GitHub Actions)

```bash
# Show strategy distribution over last 50 runs
gh run list --limit 50 --json displayTitle,conclusion,createdAt \
  --jq '.[] | select(.conclusion == "success") | .displayTitle'
```

## Future Enhancements

### Phase 2: ML-Driven Predictions

Train model on historical data to predict:

- Test failure probability by file pattern
- Optimal test execution order
- Estimated runtime per strategy

### Phase 3: Dynamic Parallelization

Adjust parallelization based on:

- Changed file count
- Historical execution times
- Available CI resources

### Phase 4: Smart Test Selection

Run only tests that cover changed code:

- Code coverage mapping
- Test-to-code dependency graph
- Mutation testing integration

## Changelog

### [1.3.0] - 2026-02-07

- ✨ Initial implementation of conditional execution
- ✨ Change impact analyzer script
- ✨ CI/CD integration with GitHub Actions
- ✨ Four execution strategies (docs-only, unit-only, selective, run-all)
- ✨ File pattern matching with glob support
- ✨ Impact level scoring
- ✨ Branch policy integration
- 📚 Comprehensive documentation

---

**Maintained by:** AI Workflow Team  
**Last Updated:** 2026-02-07  
**Related Issues:** #18 (CI/CD Optimization)
