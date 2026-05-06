# Conditional Executor API

**Module:** `orchestrator/conditional_executor`
**Version:** 2.3.1
**Architecture:** Referential Transparency (Pure Functions + Impure Wrapper)

## Overview

The Conditional Executor provides smart step execution based on change detection, impact analysis, and project context. It determines which steps to execute or skip based on file changes, impact levels, and step requirements.

### Key Features

- **Smart Execution**: Skip non-critical steps for low-impact changes
- **Change Detection**: Analyze file changes and categorize by type
- **Impact Analysis**: Calculate impact levels (none, low, medium, high)
- **Project Adaptation**: Adapt steps based on project kind
- **Condition Evaluation**: Support multiple condition types (boolean, function, object)
- **Pattern Matching**: File pattern matching with glob-like syntax
- **Priority Calculation**: Prioritize steps based on changes and impact
- **Skip Tracking**: Track and report skipped steps with reasons

### Architecture

**Pure Functions:**

- `shouldSkipStep()` - Determine if step should be skipped
- `adaptStepToProjectKind()` - Adapt step configuration for project type
- `calculateChangeImpact()` - Calculate impact from file changes
- `evaluateCondition()` - Evaluate conditional expressions
- `buildSkipReason()` - Format skip reason messages
- `matchesPattern()` - Check if file matches pattern
- `filterFilesByPattern()` - Filter files by patterns
- `doesChangeAffectStep()` - Check if changes affect specific step
- `calculateStepPriority()` - Calculate step execution priority

**Impure Wrapper:**

- `ConditionalExecutor` class - Conditional execution with state management

---

## Installation

```javascript
import {
  ConditionalExecutor,
  shouldSkipStep,
  calculateChangeImpact,
  evaluateCondition,
  adaptStepToProjectKind,
} from 'ai_workflow.js/orchestrator/conditional_executor';
```

---

## Pure Functions

### `shouldSkipStep(step, changes = {}, impact = 'medium')`

Determines if a step should be skipped based on changes, impact, and step configuration.

**Parameters:**

- `step` (Object) - Step definition with optional `skip`, `enabled`, `critical`, `smartExecution`, `skipConditions`
- `changes` (Object) - Change information with `files` array
- `impact` (string) - Impact level: 'none', 'low', 'medium', 'high'

**Returns:** Object with:

- `shouldSkip` (boolean) - True if step should be skipped
- `reason` (string | null) - Skip reason if applicable

**Pure:** ✅ Deterministic, no side effects

**Skip Logic:**

1. Step has `skip: true` → skip
2. Step has `enabled: false` → skip
3. No changes and not critical → skip
4. Low impact and not critical/analysis → skip (smart execution)
5. Skip conditions met → skip
6. Otherwise → execute

**Example:**

```javascript
const step = {
  id: 'test',
  critical: false,
  smartExecution: true,
};

const result = shouldSkipStep(step, { files: ['README.md'] }, 'low');
// => { shouldSkip: true, reason: 'Low impact changes (low)' }
```

---

### `adaptStepToProjectKind(step, projectKind)`

Adapts step configuration based on project type (e.g., nodejs_api, react_spa).

**Parameters:**

- `step` (Object) - Step definition with optional `projectAdaptations` object
- `projectKind` (string) - Project kind identifier

**Returns:** Object - Adapted step definition

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const step = {
  id: 'test',
  timeout: 300,
  projectAdaptations: {
    nodejs_api: { timeout: 600, critical: true },
    react_spa: { timeout: 900 },
  },
};

const adapted = adaptStepToProjectKind(step, 'nodejs_api');
// => { id: 'test', timeout: 600, critical: true, metadata: { adaptedFor: 'nodejs_api' } }
```

---

### `calculateChangeImpact(changes = {})`

Calculates impact level from file changes by categorizing files.

**Parameters:**

- `changes` (Object) - Change information with `files` array

**Returns:** string - Impact level: 'none', 'low', 'medium', 'high'

**Pure:** ✅ Deterministic, no side effects

**Impact Levels:**

- **high**: >10 code files OR >5 config files
- **medium**: Any code files OR >5 test files OR any config files
- **low**: Any test files OR any docs
- **none**: No changes

**File Categories:**

- **docs**: `.md`, `.txt`, `.rst`, `.adoc`
- **tests**: `.test.js`, `.spec.ts`, etc.
- **code**: `.js`, `.ts`, `.py`, `.go`, `.java`, `.c`, `.cpp`, `.rs`, `.php`
- **config**: `.json`, `.yaml`, `.yml`, `.toml`, `.ini`, `.cfg`, `.conf`

**Example:**

```javascript
const impact = calculateChangeImpact({
  files: ['src/index.js', 'src/utils.js', 'README.md'],
});
// => 'medium' (2 code files)
```

---

### `evaluateCondition(condition, context = {})`

Evaluates a condition against context. Supports multiple condition types.

**Parameters:**

- `condition` (boolean | function | object) - Condition to evaluate
- `context` (Object) - Evaluation context

**Returns:** boolean - True if condition is met

**Pure:** ✅ Deterministic, no side effects (for boolean/object conditions)

**Condition Types:**

1. **Boolean**: Returns directly
2. **Function**: Calls function with context, returns true if result is true
3. **Object**: Evaluates based on `type` field:

- `impact`: Match context.impact === value
- `filePattern`: Match files against regex
- `phase`: Match context.step.phase === value
- `projectKind`: Match context.projectKind === value

**Example:**

```javascript
// Boolean condition
evaluateCondition(true, {}); // => true

// Function condition
evaluateCondition((ctx) => ctx.impact === 'high', { impact: 'high' }); // => true

// Object condition
evaluateCondition({ type: 'impact', value: 'low' }, { impact: 'low' }); // => true

evaluateCondition(
  { type: 'filePattern', value: '\\.test\\.js$' },
  { changes: { files: ['test.test.js'] } }
); // => true
```

---

### `buildSkipReason(step, context = {})`

Builds formatted skip reason message from step and context.

**Parameters:**

- `step` (Object) - Step definition
- `context` (Object) - Skip context with optional `reason`, `impact`, `changes`

**Returns:** string - Formatted skip reason

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
buildSkipReason({ id: 'test' }, { reason: 'No changes', impact: 'none' });
// => 'No changes'

buildSkipReason({ id: 'test' }, { impact: 'low', changes: { files: ['README.md'] } });
// => "Step 'test' skipped - impact: low - 1 files changed"
```

---

### `matchesPattern(file, pattern)`

Checks if file path matches pattern (glob-like or regex).

**Parameters:**

- `file` (string) - File path
- `pattern` (string | RegExp) - Pattern to match

**Returns:** boolean - True if file matches

**Pure:** ✅ Deterministic, no side effects

**Pattern Syntax:**

- `*` matches any characters
- `?` matches single character
- `.` matches literal dot
- RegExp for complex patterns

**Example:**

```javascript
matchesPattern('src/test.js', '*.js'); // => true
matchesPattern('src/utils/helper.js', 'src/**/*.js'); // => true
matchesPattern('README.md', /\.md$/); // => true
```

---

### `filterFilesByPattern(files, patterns)`

Filters file list by pattern(s).

**Parameters:**

- `files` (Array<string>) - File paths
- `patterns` (string | RegExp | Array) - Pattern(s) to match

**Returns:** Array<string> - Filtered files

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const files = ['src/index.js', 'test/test.js', 'README.md'];

filterFilesByPattern(files, '*.js');
// => ['src/index.js', 'test/test.js']

filterFilesByPattern(files, ['*.js', '*.md']);
// => ['src/index.js', 'test/test.js', 'README.md']
```

---

### `doesChangeAffectStep(step, changes = {})`

Determines if changes affect a specific step based on file patterns.

**Parameters:**

- `step` (Object) - Step definition with optional `affectedBy` patterns
- `changes` (Object) - Change information with `files` array

**Returns:** boolean - True if changes affect step

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const step = {
  id: 'test',
  affectedBy: ['src/**/*.js', 'test/**/*.js'],
};

doesChangeAffectStep(step, { files: ['src/index.js'] }); // => true
doesChangeAffectStep(step, { files: ['README.md'] }); // => false
```

---

### `calculateStepPriority(step, changes = {}, impact = 'medium')`

Calculates execution priority for step based on changes and impact.

**Parameters:**

- `step` (Object) - Step definition with optional `priority`, `critical`
- `changes` (Object) - Change information
- `impact` (string) - Impact level

**Returns:** number - Priority score (higher = more important)

**Pure:** ✅ Deterministic, no side effects

**Priority Factors:**

- Base priority from step.priority or 50
- Critical steps: +100
- High impact: +30
- Medium impact: +20
- Low impact: +10
- Changes affect step: +20

**Example:**

```javascript
const step = { id: 'test', critical: true, priority: 60 };
const priority = calculateStepPriority(step, { files: ['src/index.js'] }, 'high');
// => 210 (60 base + 100 critical + 30 high impact + 20 affects step)
```

---

## ConditionalExecutor Class

Wrapper for conditional step execution with state management.

### Constructor

```javascript
const executor = new ConditionalExecutor(options);
```

**Options:**

- `smartExecution` (boolean) - Enable smart execution (default: true)
- `projectKind` (string) - Project kind for adaptation (default: null)

**Example:**

```javascript
const executor = new ConditionalExecutor({
  smartExecution: true,
  projectKind: 'nodejs_api',
});
```

---

### Methods

#### `evaluateStep(step, context = {})`

Evaluates if a single step should be executed.

**Parameters:**

- `step` (Object) - Step definition
- `context` (Object) - Evaluation context with optional `changes`, `impact`

**Returns:** Object with:

- `execute` (boolean) - True if should execute
- `reason` (string | null) - Skip reason if not executing
- `step` (Object) - Adapted step definition
- `impact` (string) - Calculated impact level

**Side Effects:**

- Updates skip history if skipped
- Logs evaluation results

**Example:**

```javascript
const evaluation = executor.evaluateStep(step, {
  changes: { files: ['src/index.js'] },
  impact: 'medium',
});

if (evaluation.execute) {
  await executeStep(evaluation.step);
} else {
  console.log(`Skipped: ${evaluation.reason}`);
}
```

---

#### `evaluateSteps(steps, context = {})`

Evaluates multiple steps and returns execution plan.

**Parameters:**

- `steps` (Array<Object>) - Array of step definitions
- `context` (Object) - Evaluation context

**Returns:** Object with:

- `execute` (Array) - Steps to execute with `step` and `priority`
- `skip` (Array) - Steps to skip with `step` and `reason`

**Side Effects:**

- Updates skip history for all skipped steps
- Logs execution plan summary

**Example:**

```javascript
const plan = executor.evaluateSteps(allSteps, {
  changes: { files: changedFiles },
});

console.log(`Will execute ${plan.execute.length} steps`);
console.log(`Skipping ${plan.skip.length} steps`);

// Execute in priority order
for (const { step } of plan.execute) {
  await executeStep(step);
}
```

---

#### `getImpact(files)`

Calculates change impact from file list.

**Parameters:**

- `files` (Array<string>) - Changed file paths

**Returns:** string - Impact level

**Side Effects:** Logs impact calculation

**Example:**

```javascript
const impact = executor.getImpact(['src/index.js', 'test/test.js']);
// => 'medium'
```

---

#### `shouldSkip(step, context = {})`

Checks if step should be skipped.

**Parameters:**

- `step` (Object) - Step definition
- `context` (Object) - Context with changes and impact

**Returns:** boolean - True if should skip

**Example:**

```javascript
if (executor.shouldSkip(step, { changes: { files: [] } })) {
  console.log('Skipping step - no changes');
}
```

---

#### `getSkipHistory()`

Gets history of skipped steps.

**Returns:** Array<Object> - Skip history with `stepId`, `reason`, `timestamp`

**Example:**

```javascript
const history = executor.getSkipHistory();
console.log(`Skipped ${history.length} steps this run`);
```

---

#### `getStats()`

Gets skip statistics.

**Returns:** Object with:

- `total` (number) - Total steps skipped
- `byReason` (Object) - Count by skip reason
- `mostCommonReason` (string) - Most common skip reason

**Example:**

```javascript
const stats = executor.getStats();
console.log(`Most common skip reason: ${stats.mostCommonReason}`);
```

---

#### `clearHistory()`

Clears skip history.

**Side Effects:** Resets internal skip history

**Example:**

```javascript
executor.clearHistory();
```

---

## Usage Examples

### Basic Conditional Execution

```javascript
import { ConditionalExecutor } from 'ai_workflow.js/orchestrator/conditional_executor';

const executor = new ConditionalExecutor({
  smartExecution: true,
  projectKind: 'nodejs_api',
});

const steps = [
  { id: 'lint', name: 'Lint', critical: false },
  { id: 'test', name: 'Test', critical: true },
  { id: 'build', name: 'Build', critical: true },
];

const changedFiles = ['README.md', 'docs/api.md'];

const plan = executor.evaluateSteps(steps, { changes: { files: changedFiles } });

console.log(`Executing ${plan.execute.length} critical steps`);
console.log(`Skipping ${plan.skip.length} non-critical steps (low impact)`);
```

### Project-Specific Adaptation

```javascript
const step = {
  id: 'test',
  timeout: 300,
  projectAdaptations: {
    nodejs_api: { timeout: 600, maxRetries: 5 },
    react_spa: { timeout: 900, maxRetries: 3 },
  },
};

const executorNode = new ConditionalExecutor({ projectKind: 'nodejs_api' });
const executorReact = new ConditionalExecutor({ projectKind: 'react_spa' });

const evalNode = executorNode.evaluateStep(step, {});
console.log(evalNode.step.timeout); // => 600

const evalReact = executorReact.evaluateStep(step, {});
console.log(evalReact.step.timeout); // => 900
```

### Impact-Based Execution

```javascript
const changes = {
  files: ['src/api/users.js', 'src/api/auth.js', 'test/users.test.js'],
};

const impact = executor.getImpact(changes.files);
console.log(`Impact: ${impact}`); // => 'medium'

const evaluation = executor.evaluateStep(
  {
    id: 'deploy',
    critical: false,
    smartExecution: true,
  },
  { changes, impact }
);

if (evaluation.execute) {
  console.log('Deploying due to code changes');
} else {
  console.log(`Skipping deployment: ${evaluation.reason}`);
}
```

### Custom Skip Conditions

```javascript
const step = {
  id: 'integration_test',
  skipConditions: [
    { type: 'impact', value: 'low', reason: 'Low impact - skip integration tests' },
    { type: 'filePattern', value: '^docs/', reason: 'Documentation-only changes' },
    {
      type: 'custom',
      evaluate: (ctx) => !ctx.hasBackend,
      reason: 'No backend changes',
    },
  ],
};

const result = executor.evaluateStep(step, {
  changes: { files: ['docs/README.md'] },
  impact: 'low',
});
// => { execute: false, reason: 'Documentation-only changes' }
```

### Priority-Based Execution Order

```javascript
const steps = [
  { id: 'lint', priority: 30 },
  { id: 'test', priority: 80, critical: true },
  { id: 'build', priority: 50 },
  { id: 'deploy', priority: 20 },
];

const plan = executor.evaluateSteps(steps, {
  changes: { files: ['src/index.js'] },
});

// Execution order: test (180), build (50), lint (30), deploy (20)
for (const { step, priority } of plan.execute) {
  console.log(`${step.id}: priority ${priority}`);
}
```

### File Pattern Filtering

```javascript
import {
  filterFilesByPattern,
  matchesPattern,
} from 'ai_workflow.js/orchestrator/conditional_executor';

const files = [
  'src/api/users.js',
  'src/api/auth.js',
  'src/utils/helpers.js',
  'test/api/users.test.js',
  'docs/README.md',
];

// Filter API files
const apiFiles = filterFilesByPattern(files, 'src/api/**/*.js');
// => ['src/api/users.js', 'src/api/auth.js']

// Check if specific file affected
if (matchesPattern('src/api/users.js', 'src/api/**/*.js')) {
  console.log('API file changed - run integration tests');
}
```

---

## Related Modules

- **workflow_engine** - Uses ConditionalExecutor for step filtering
- **step_executor** - Executes steps that pass conditional evaluation
- **change_detection** (lib) - Provides change detection for evaluation
- **dependency_resolver** - Works with execution plans

---

## Notes

- **Smart Execution**: Enabled by default, can be disabled per-executor
- **Impact Calculation**: Conservative approach - prefers execution over skipping
- **Critical Steps**: Always executed regardless of impact (unless explicitly disabled)
- **Project Adaptation**: Allows same workflow to work across project types
- **Pattern Matching**: Supports glob-like patterns and regular expressions
- **Priority System**: Higher priority steps execute first

---

**Last Updated:** 2026-02-07
**Author:** AI Workflow Team
