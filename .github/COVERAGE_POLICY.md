# Coverage Policy

## Overview

This project maintains strict code coverage thresholds to ensure code quality and reliability. Coverage is automatically enforced in CI/CD pipelines via Jest configuration.

## Current Coverage Status

**Overall:** 83.87% statements | 64.28% branches | 95% functions | 83.87% lines

| Directory             | Statements            | Branches | Functions | Lines  | Status                          |
| --------------------- | --------------------- | -------- | --------- | ------ | ------------------------------- |
| **src/lib/**          | 86.92%                | 85.37%   | 94.59%    | 86.85% | ✅ Exceeds threshold            |
| **src/orchestrator/** | 96.88%                | 90.95%   | 99.37%    | 97.06% | ✅ Excellent                    |
| **src/utils/**        | 90.47%                | 75.00%   | 83.33%    | 90.47% | ✅ Good                         |
| **src/core/**         | 100% (colors, logger) | -        | -         | -      | ⚠️ Partial (3 modules untested) |

---

## Coverage Thresholds

### Enforced Thresholds (`jest.config.json`)

```json
{
  "coverageThreshold": {
    "global": {
      "statements": 83,
      "branches": 64,
      "functions": 95,
      "lines": 83
    },
    "./src/lib/": {
      "statements": 85,
      "branches": 83,
      "functions": 93,
      "lines": 85
    },
    "./src/orchestrator/": {
      "statements": 95,
      "branches": 85,
      "functions": 99,
      "lines": 95
    },
    "./src/utils/": {
      "statements": 90,
      "branches": 75,
      "functions": 83,
      "lines": 90
    }
  }
}
```

### Threshold Rationale

| Threshold Level          | Target                       | Reason                                               |
| ------------------------ | ---------------------------- | ---------------------------------------------------- |
| **Global**               | 83% statements, 64% branches | Current baseline with untested core modules excluded |
| **Libraries (src/lib/)** | 85% statements, 83% branches | Core business logic - high coverage required         |
| **Orchestrator**         | 95% statements, 85% branches | Critical workflow engine - highest coverage          |
| **Utils**                | 90% statements, 75% branches | Stable utilities - moderate coverage acceptable      |

---

## Excluded Modules

The following modules are **excluded from coverage collection** until tests are implemented:

| Module                 | Reason                                          | Priority | Estimated Lines |
| ---------------------- | ----------------------------------------------- | -------- | --------------- |
| `src/core/executor.js` | Command execution - requires subprocess mocking | HIGH     | ~105            |
| `src/core/system.js`   | OS detection - requires environment mocking     | MEDIUM   | ~130            |
| `src/core/version.js`  | Semver utilities - stable, low risk             | LOW      | ~114            |

**Total excluded:** ~349 lines (~8% of codebase)

**Inclusion plan:** These modules will be tested in Phase 8 (Testing Infrastructure Enhancement)

---

## Module-Level Coverage Details

### 🟢 High Coverage (>90%)

| Module                      | Coverage | Notes               |
| --------------------------- | -------- | ------------------- |
| `config.js`                 | 100%     | ✅ Perfect coverage |
| `session_manager.js`        | 100%     | ✅ Perfect coverage |
| `metrics.js`                | 99.09%   | ✅ Near-perfect     |
| `ai_validation.js`          | 98.41%   | ✅ Excellent        |
| `argument_parser.js`        | 98.33%   | ✅ Excellent        |
| `backlog.js`                | 97.91%   | ✅ Excellent        |
| `git_cache.js`              | 97.43%   | ✅ Excellent        |
| `utils.js`                  | 97.32%   | ✅ Excellent        |
| `ai_personas.js`            | 96.15%   | ✅ Excellent        |
| `change_detection.js`       | 94.24%   | ✅ Very good        |
| `auto_commit.js`            | 91.38%   | ✅ Good             |
| `tech_stack.js`             | 91.08%   | ✅ Good             |
| `project_kind_detection.js` | 90.66%   | ✅ Good             |
| `edit_operations.js`        | 90.33%   | ✅ Good             |
| `ai_cache.js`               | 90.05%   | ✅ Good             |

**Total:** 15 modules with >90% coverage

---

### 🟡 Moderate Coverage (70-89%)

| Module                     | Coverage | Known Gaps                | Action Plan |
| -------------------------- | -------- | ------------------------- | ----------- |
| `project_kind_config.js`   | 88.48%   | YAML error handling       | Phase 8     |
| `third_party_exclusion.js` | 87.96%   | Gitignore edge cases      | Phase 8     |
| `jq_wrapper.js`            | 82.81%   | Command execution errors  | Phase 8     |
| `file_operations.js`       | 81.86%   | File I/O error paths      | Phase 8     |
| `cleanup_handlers.js`      | 79.33%   | Edge cases, dry-run modes | Phase 8     |

**Total:** 5 modules with moderate coverage

---

### 🔴 Low Coverage (<70%)

| Module              | Coverage | Root Cause                                           | Priority |
| ------------------- | -------- | ---------------------------------------------------- | -------- |
| `git_automation.js` | 71.98%   | GitAutomation wrapper class untested (lines 508-690) | MEDIUM   |
| `ai_helpers.js`     | 25.13%   | AiHelper wrapper class untested (lines 313-683)      | HIGH     |

**Critical Issue: ai_helpers.js**

- Pure functions (lines 1-312): 100% coverage ✅
- Wrapper class (lines 313-683): 0% coverage ❌
- **Reason:** Requires @github/copilot-sdk mocking or integration tests
- **Action:** Add tests in Phase 8 with SDK mocking strategy

**GitAutomation Issue:**

- Core functions tested (status, diff parsing): ~90% coverage
- GitAutomation wrapper class partially tested
- **Action:** Complete integration tests in Phase 8

---

## CI/CD Integration

### Coverage Enforcement in CI

The CI pipeline (`ci.yml`) automatically enforces coverage thresholds:

```yaml
- name: Generate coverage report
  run: npm run test:coverage
# Jest automatically fails if thresholds not met
# Exit code 1 → CI fails → PR blocked
```

**Behavior:**

- ✅ Coverage meets thresholds → CI passes → PR mergeable
- ❌ Coverage below thresholds → CI fails → PR blocked
- ⚠️ Codecov upload fails → CI continues (not blocking)

### Coverage Reports on PRs

Coverage reports are automatically posted as PR comments:

```markdown
## 📊 Coverage Report

| Metric     | Coverage | Status |
| ---------- | -------- | ------ |
| Statements | 83.87%   | 🟢     |
| Branches   | 64.28%   | 🟡     |
| Functions  | 95.00%   | 🟢     |
| Lines      | 83.87%   | 🟢     |

Coverage Status Guide:

- 🟢 Excellent (≥90%)
- 🟡 Good (70-89%)
- 🔴 Needs Improvement (<70%)
```

---

## Developer Guidelines

### Running Coverage Locally

```bash
# Generate full coverage report
npm run test:coverage

# Coverage report saved to: coverage/lcov-report/index.html
```

### Interpreting Coverage Reports

**Statements:** Each code statement executed
**Branches:** Each conditional path tested (if/else, switch, ternary)
**Functions:** Each function called at least once
**Lines:** Each line of code executed

### When Adding New Code

**Rule:** New code must meet or exceed directory-level thresholds

| Directory           | Required Coverage       |
| ------------------- | ----------------------- |
| `src/lib/`          | ≥85% statements         |
| `src/orchestrator/` | ≥95% statements         |
| `src/utils/`        | ≥90% statements         |
| `src/core/`         | ≥90% (when tests added) |

**Example:**

- Adding new function to `src/lib/config.js`?
- Must add tests achieving ≥85% statement coverage
- Must test ≥83% branch coverage

### Handling Low Coverage

**If your PR reduces coverage below threshold:**

1. **Add missing tests** (preferred)

   ```bash
   npm test -- --coverage --collectCoverageFrom='src/lib/mymodule.js'
   ```

2. **Test error paths**
   - File I/O failures
   - Invalid inputs
   - Edge cases

3. **Test edge cases**
   - Empty arrays
   - Null/undefined
   - Boundary conditions

4. **Document untestable code** (rare)
   - Add `/* istanbul ignore next */` comment
   - Explain why in PR description

### Coverage Exceptions

**When is low coverage acceptable?**

1. **External dependencies** (requires real I/O)
   - Subprocess execution
   - Network calls
   - File system operations

   **Solution:** Mock dependencies or mark as integration tests

2. **Error handling** (hard to trigger)
   - System-level errors (ENOMEM, etc.)
   - Race conditions

   **Solution:** Use Jest mocks to force error paths

3. **Defensive programming** (should-never-happen cases)
   - Fallback error handlers
   - Sanity checks

   **Solution:** Document with comments, consider `/* istanbul ignore */`

---

## Roadmap

### Phase 8: Testing Infrastructure Enhancement

**Goal:** Achieve 90%+ global coverage

**Planned Improvements:**

1. **Add core module tests**
   - `test/core/executor.test.js` (HIGH priority)
   - `test/core/system.test.js` (MEDIUM priority)
   - `test/core/version.test.js` (LOW priority)
   - **Impact:** +349 lines covered, global coverage → ~88%

2. **Test wrapper classes**
   - `ai_helpers.js` AiHelper class (lines 313-683)
   - `git_automation.js` GitAutomation class (lines 508-690)
   - **Impact:** +555 lines covered, global coverage → ~93%

3. **Improve error path coverage**
   - File I/O errors in `file_operations.js`
   - Command execution errors in `jq_wrapper.js`
   - YAML parsing errors in `project_kind_config.js`
   - **Impact:** +150 lines covered, global coverage → ~95%

**Expected Outcome:** 95%+ global coverage by end of Phase 8

---

### Future Threshold Adjustments

As coverage improves, thresholds will be raised:

| Phase        | Target       | Global | Lib | Orchestrator |
| ------------ | ------------ | ------ | --- | ------------ |
| **Current**  | Baseline     | 83%    | 85% | 95%          |
| **Phase 8**  | Enhanced     | 88%    | 90% | 95%          |
| **Phase 9**  | Excellent    | 90%    | 92% | 97%          |
| **Phase 10** | Near-perfect | 93%    | 95% | 98%          |

**Final Goal:** 95%+ global coverage with 98%+ in critical modules (orchestrator)

---

## Troubleshooting

### Coverage Below Threshold in CI

**Error:**

```
Jest: "global" coverage threshold for statements (83%) not met: 80.5%
```

**Solutions:**

1. **Check what's missing:**

   ```bash
   npm run test:coverage | grep "not met"
   ```

2. **View detailed report:**

   ```bash
   npm run test:coverage
   open coverage/lcov-report/index.html
   ```

3. **Find untested files:**

   ```bash
   npm run test:coverage | grep -E "^\s+\w+\.js.*\|.*[0-7][0-9]\."
   ```

4. **Add tests for uncovered code:**
   - Red lines in HTML report = not executed
   - Yellow lines = only one branch executed
   - Green lines = fully tested

---

### Codecov Upload Failures

**Not blocking** - CI continues even if Codecov upload fails

**Common causes:**

1. Missing `CODECOV_TOKEN` secret
2. Codecov service downtime
3. Network issues

**Fix:**

1. Add `CODECOV_TOKEN` to repository secrets
2. Verify token at https://codecov.io
3. If persistent, set `fail_ci_if_error: true` in workflow

---

## Related Documentation

- **Testing Guide:** `docs/guides/TESTING_GUIDE.md`
- **Contributing Guide:** `CONTRIBUTING.md`
- **CI Workflows:** `.github/workflows/README.md`
- **Jest Configuration:** `jest.config.json`

---

**Last Updated:** February 7, 2026
**Version:** 1.0.0
**Maintained by:** ai_workflow.js contributors
