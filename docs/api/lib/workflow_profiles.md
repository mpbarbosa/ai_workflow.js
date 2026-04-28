# workflow_profiles — Workflow Profile Management

**Module:** `src/lib/workflow_profiles.js`
**Version:** v2.2.16
**Phase:** 8 (Performance Optimization)
**Architecture:** Referential Transparency (Pure Functions + Impure Wrapper)

## Overview

Intelligent workflow customization based on detected change patterns. Defines execution profiles that skip unnecessary steps and focus on relevant validation for different change types, delivering 20–60% time savings per run.

**Key Features:**

- 🔍 **Auto-detection**: Categorises git changes to select the optimal profile
- ⚡ **Time savings**: 20–60% reduction in execution time depending on profile
- 🎯 **5 built-in profiles**: `docs_only`, `code_changes`, `test_changes`, `infrastructure`, `full_validation`
- 🔧 **Manual override**: Set `WORKFLOW_PROFILE` env var to force a profile
- 📊 **Savings calculation**: Estimates minutes saved vs. full-validation baseline

**Source:** Migrated from `ai_workflow` v3.2.7 `workflow_profiles.sh`

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  WorkflowProfileManager (Impure Wrapper)            │
│  - Git integration for change detection             │
│  - Environment variable access                      │
│  - Profile lifecycle management                     │
└───────────────┬─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│  Pure Functions (Exported)                          │
│  - matchesPattern()                                 │
│  - categorizeChanges()                              │
│  - selectProfile()                                  │
│  - getProfile() / getSkipSteps() / getFocusSteps()  │
│  - calculateSavings()                               │
│  - isValidProfile() / getAllProfiles()              │
│  - formatProfileInfo()                              │
└─────────────────────────────────────────────────────┘
```

## Constants

### `WORKFLOW_PROFILES`

Profile definitions keyed by profile name.

```javascript
export const WORKFLOW_PROFILES = {
  docs_only: {
    name: 'docs_only',
    description: 'Documentation changes only',
    skipSteps: [7, 8],
    focusSteps: [1, 2, 4, 10],
    estimatedTime: '8-12 minutes',
    savingsPercent: 60,
  },
  code_changes: {
    name: 'code_changes',
    description: 'Source code modifications',
    skipSteps: [2],
    focusSteps: [7, 8, 9, 13],
    estimatedTime: '20-25 minutes',
    savingsPercent: 20,
  },
  test_changes: {
    name: 'test_changes',
    description: 'Test modifications only',
    skipSteps: [2, 4],
    focusSteps: [7, 9],
    estimatedTime: '15-18 minutes',
    savingsPercent: 35,
  },
  infrastructure: {
    name: 'infrastructure',
    description: 'CI/CD and dependencies',
    skipSteps: [2, 4],
    focusSteps: [8, 9, 14],
    estimatedTime: '25-30 minutes',
    savingsPercent: 0,
  },
  full_validation: {
    name: 'full_validation',
    description: 'Complete workflow validation',
    skipSteps: [],
    focusSteps: 'all',
    estimatedTime: '23-28 minutes',
    savingsPercent: 0,
  },
};
```

### `PROFILE_PATTERNS`

RegExp arrays keyed by profile name used to classify changed file paths into categories (`docs_only`, `code_changes`, `test_changes`, `infrastructure`).

## Pure Functions

### `matchesPattern(filePath, patterns)`

Tests whether a file path matches any pattern in an array.

```javascript
/**
 * @param {string} filePath - File path to test
 * @param {RegExp[]} patterns - Array of regular expressions
 * @returns {boolean} True if any pattern matches
 */
```

**Example:**

```javascript
import { matchesPattern, PROFILE_PATTERNS } from './workflow_profiles.js';

matchesPattern('docs/README.md', PROFILE_PATTERNS.docs_only); // true
matchesPattern('src/lib/config.js', PROFILE_PATTERNS.docs_only); // false
```

---

### `categorizeChanges(files)`

Categorises changed file paths into profile counts. Each file is counted exactly once in the most specific matching category (priority: test > infrastructure > code > docs > other).

```javascript
/**
 * @param {string[]} files - Array of changed file paths
 * @returns {{ docs: number, code: number, tests: number, infrastructure: number, other: number, total: number }}
 */
```

**Example:**

```javascript
import { categorizeChanges } from './workflow_profiles.js';

const counts = categorizeChanges(['docs/README.md', 'src/lib/config.js']);
// { docs: 1, code: 1, tests: 0, infrastructure: 0, other: 0, total: 2 }
```

---

### `selectProfile(counts)`

Selects the most appropriate profile name from category counts.

```javascript
/**
 * @param {{ docs: number, code: number, tests: number, infrastructure: number, total: number }} counts
 * @returns {string} Profile name
 */
```

**Selection logic:**

| Condition                        | Profile           |
| -------------------------------- | ----------------- |
| No changes (`total === 0`)       | `full_validation` |
| Infrastructure + (code or tests) | `full_validation` |
| Infrastructure only              | `infrastructure`  |
| Docs only (no code/tests)        | `docs_only`       |
| Tests only (no code/docs)        | `test_changes`    |
| Any code changes                 | `code_changes`    |
| Mixed/unknown                    | `full_validation` |

---

### `getProfile(profileName)`

Returns the full profile configuration object, or `null` if not found.

```javascript
/**
 * @param {string} profileName
 * @returns {Object|null}
 */
```

---

### `getSkipSteps(profileName)`

Returns the array of step numbers to skip for the given profile.

```javascript
/**
 * @param {string} profileName
 * @returns {number[]}
 */
```

---

### `getFocusSteps(profileName)`

Returns the focus steps for the given profile (`'all'` for full validation).

```javascript
/**
 * @param {string} profileName
 * @returns {number[]|'all'}
 */
```

---

### `calculateSavings(profileName, baselineMinutes?)`

Calculates estimated time savings relative to a full-validation baseline.

```javascript
/**
 * @param {string} profileName
 * @param {number} [baselineMinutes=25]
 * @returns {{ baselineMinutes: number, estimatedMinutes: number, savedMinutes: number, savingsPercent: number }}
 */
```

**Example:**

```javascript
import { calculateSavings } from './workflow_profiles.js';

calculateSavings('docs_only', 25);
// { baselineMinutes: 25, estimatedMinutes: 10, savedMinutes: 15, savingsPercent: 60 }
```

---

### `isValidProfile(profileName)`

Returns `true` if the profile name is one of the five built-in profiles.

```javascript
/**
 * @param {string} profileName
 * @returns {boolean}
 */
```

---

### `getAllProfiles()`

Returns an array of all built-in profile names.

```javascript
/**
 * @returns {string[]}
 */

getAllProfiles();
// ['docs_only', 'code_changes', 'test_changes', 'infrastructure', 'full_validation']
```

---

### `formatProfileInfo(profileName)`

Returns a human-readable summary string for a profile.

```javascript
/**
 * @param {string} profileName
 * @returns {string}
 */

console.log(formatProfileInfo('docs_only'));
// Profile: docs_only
// Description: Documentation changes only
// Estimated Time: 8-12 minutes
// Time Savings: 60%
// Skip Steps: 7, 8
// Focus Steps: 1, 2, 4, 10
```

---

## Impure Wrapper Class

### `WorkflowProfileManager`

Detects and manages the workflow profile for the current run, integrating with git change detection and environment variables.

#### Constructor

```javascript
/**
 * @param {Object} [options]
 * @param {Object} [options.gitAutomation] - GitAutomation instance for change detection
 * @param {Object} [options.env=process.env] - Environment variable map
 */
const manager = new WorkflowProfileManager({ gitAutomation });
```

#### Methods

| Method                | Returns           | Description                                      |
| --------------------- | ----------------- | ------------------------------------------------ |
| `detectProfile()`     | `Promise<string>` | Detects profile from git changes or env override |
| `getCurrentProfile()` | `string\|null`    | Returns the last detected profile name           |
| `getChangeCounts()`   | `Object\|null`    | Returns category counts from last detection      |

#### Environment Variables

| Variable                 | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `WORKFLOW_PROFILE`       | Force a specific profile (skips detection)      |
| `SKIP_PROFILE_DETECTION` | Set to `'true'` to always use `full_validation` |

#### Example

```javascript
import { WorkflowProfileManager } from './workflow_profiles.js';
import { GitAutomation } from './git_automation.js';

const git = new GitAutomation();
const manager = new WorkflowProfileManager({ gitAutomation: git });

const profile = await manager.detectProfile();
console.log(profile); // 'docs_only'

const skipped = manager.getProfile().skipSteps;
// [7, 8]
```

## Usage

```javascript
import {
  categorizeChanges,
  selectProfile,
  getSkipSteps,
  calculateSavings,
  WorkflowProfileManager,
} from './workflow_profiles.js';

// Pure function usage
const files = ['docs/README.md', 'CHANGELOG.md'];
const counts = categorizeChanges(files);
const profile = selectProfile(counts);
const skip = getSkipSteps(profile);
const savings = calculateSavings(profile);

console.log(profile); // 'docs_only'
console.log(skip); // [7, 8]
console.log(savings); // { ..., savingsPercent: 60 }
```

## Related Modules

- **[performance_monitoring](./performance_monitoring.md)** - Real-time step monitoring
- **[performance](./performance.md)** - Base metrics collection
- **[workflow_engine](../orchestrator/workflow_engine.md)** - Consumes profile skip/focus lists
- **[Architecture: Design Principles](../../architecture/DESIGN_PRINCIPLES.md)**
