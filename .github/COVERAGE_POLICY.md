# Coverage Policy

## Overview

This project maintains strict code coverage thresholds to ensure code quality and reliability. Coverage is automatically enforced in CI/CD pipelines via Jest configuration.

## Current Coverage Status

Coverage metrics change as source and tests evolve. Generate a fresh report with
`npm run test:coverage`, then treat `coverage/coverage-summary.json` and the
HTML report under `coverage/lcov-report/` as the source of truth for current
numbers.

---

## Coverage Thresholds

### Enforced Thresholds (`jest.config.json`)

```json
{
  "coverageThreshold": {
    "global": {
      "statements": 83,
      "branches": 64,
      "functions": 90,
      "lines": 83
    },
    "./src/cli/": {
      "statements": 38,
      "branches": 40,
      "functions": 58,
      "lines": 38
    },
    "./src/lib/": {
      "statements": 85,
      "branches": 83,
      "functions": 93,
      "lines": 85
    },
    "./src/orchestrator/": {
      "statements": 87,
      "branches": 82,
      "functions": 75,
      "lines": 87
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

| Threshold Level          | Target                                                | Reason                                                      |
| ------------------------ | ----------------------------------------------------- | ----------------------------------------------------------- |
| **Global**               | 83% statements, 64% branches, 90% functions           | Baseline gate for the overall repository coverage run       |
| **CLI (src/cli/)**       | 38% statements, 40% branches, 58% functions           | Transitional threshold while legacy JS and TS command paths coexist |
| **Libraries (src/lib/)** | 85% statements, 83% branches, 93% functions           | Core business logic - high coverage required                |
| **Orchestrator**         | 87% statements, 82% branches, 75% functions           | Critical workflow engine with realistic branch/function targets |
| **Utils**                | 90% statements, 75% branches, 83% functions           | Stable utilities - moderate coverage acceptable             |

---

## Coverage Scope

The current coverage gate focuses on the directories with explicit thresholds:

- `src/cli/`
- `src/lib/`
- `src/orchestrator/`
- `src/utils/`

Core runtime modules under `src/core/` are currently outside the enforced
coverage gate via `collectCoverageFrom` exclusions and
`coveragePathIgnorePatterns` in `jest.config.json`. Use a fresh
`npm run test:coverage` run to inspect file-level results before changing that
policy.

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

Coverage reports can be posted as PR comments in this format:

```markdown
## 📊 Coverage Report

| Metric     | Coverage    | Status |
| ---------- | ----------- | ------ |
| Statements | <generated> | 🟢/🟡/🔴 |
| Branches   | <generated> | 🟢/🟡/🔴 |
| Functions  | <generated> | 🟢/🟡/🔴 |
| Lines      | <generated> | 🟢/🟡/🔴 |

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
| `src/cli/`          | ≥38% statements         |
| `src/lib/`          | ≥85% statements         |
| `src/orchestrator/` | ≥87% statements         |
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
