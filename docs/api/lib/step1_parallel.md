# step1_parallel - Step 1 Parallel Processing

**Module:** `src/lib/step1_parallel.js`
**Version:** v2.3.0
**Phase:** 8 (Performance Optimization)
**Architecture:** Referential Transparency (Pure Functions + Impure Wrapper)

## Overview

Parallel documentation validation for Step 1 (Documentation Validation). Validates multiple documentation categories concurrently for maximum throughput with configurable execution strategies.

**Key Features:**

- 🔄 **4 Execution Strategies**: SEQUENTIAL, PARALLEL, PRIORITY_BASED, BALANCED
- 📊 **Task Distribution**: Intelligent task scheduling based on priority
- ⚡ **Parallel Execution**: Up to 4 concurrent validation tasks (configurable)
- ⏱️ **Timeout & Retry**: Resilient validation with timeout and error handling
- 📈 **Performance Metrics**: Speedup calculation and efficiency tracking
- 🎯 **Priority-Based**: High-priority categories (README, API) validated first

## Architecture

```
┌──────────────────────────────────────────────┐
│  Step1ParallelProcessor (Impure Wrapper)     │
│  - Async execution & process management      │
│  - I/O operations (validation callbacks)     │
│  - State management (tasks, timing)          │
└───────────────┬──────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│  Pure Functions                              │
│  - createValidationTask()                    │
│  - sortTasksByPriority()                     │
│  - determineExecutionStrategy()              │
│  - splitIntoBatches()                        │
│  - mergeValidationResults()                  │
│  - calculateSpeedup()                        │
└──────────────────────────────────────────────┘
```

## Installation

```javascript
import {
  Step1ParallelProcessor,
  EXECUTION_STRATEGY,
  TASK_STATUS,
  createValidationTask,
  mergeValidationResults,
} from 'ai-workflow/lib/step1_parallel';
```

## Pure Functions

### createValidationTask(category, files, priority)

Create validation task for a category.

**Parameters:**

- `category` (string): Category from DOC_CATEGORIES
- `files` (Array<string>): Files in this category
- `priority` (number): Validation priority

**Returns:** (Object) Task object with status, result, timing fields

**Example:**

```javascript
const task = createValidationTask('api', ['docs/api/index.md'], 3);
// {
//   id: 'task_api_1234567890',
//   category: 'api',
//   files: ['docs/api/index.md'],
//   priority: 3,
//   status: 'pending',
//   result: null,
//   error: null
// }
```

### createValidationTasks(files, getPriority)

Group files into validation tasks by category.

**Parameters:**

- `files` (Array<string>): Documentation files
- `getPriority` (Function): Function to get priority for category

**Returns:** (Array<Object>) Validation tasks

### sortTasksByPriority(tasks, categoryOrder)

Sort tasks by priority (high to low) and category order.

**Parameters:**

- `tasks` (Array<Object>): Validation tasks
- `categoryOrder` (Array<string>): Preferred category order

**Returns:** (Array<Object>) Sorted tasks (new array, non-mutating)

### determineExecutionStrategy(tasks, criticalThreshold)

Determine optimal execution strategy based on task priorities.

**Parameters:**

- `tasks` (Array<Object>): Validation tasks
- `criticalThreshold` (number): Priority threshold (default: VALIDATION_PRIORITY.CRITICAL)

**Returns:** (string) Recommended strategy from EXECUTION_STRATEGY

**Logic:**

- Empty/single task → SEQUENTIAL
- All critical → SEQUENTIAL (avoid parallel errors)
- All non-critical → PARALLEL
- Mixed priorities → BALANCED

### splitIntoBatches(tasks, batchSize)

Split tasks into batches for parallel execution.

**Parameters:**

- `tasks` (Array<Object>): Validation tasks
- `batchSize` (number): Max tasks per batch

**Returns:** (Array<Array<Object>>) Task batches

### mergeValidationResults(tasks)

Merge validation results from multiple tasks into a unified result.

**Parameters:**

- `tasks` (Array<Object>): Completed tasks

**Returns:** (Object) Merged results with success status, categories, errors, file counts

### calculateSpeedup(sequentialTime, parallelTime)

Calculate speedup from parallel execution.

**Parameters:**

- `sequentialTime` (number): Estimated sequential execution time (ms)
- `parallelTime` (number): Actual parallel execution time (ms)

**Returns:** (Object) Speedup analysis with speedup ratio, efficiency, time saved

### isValidTask(task)

Validate task structure before execution.

**Parameters:**

- `task` (Object): Validation task

**Returns:** (boolean) True if task is valid

## Constants

### DEFAULT_CONFIG

Default configuration for parallel processor:

```javascript
{
  maxConcurrency: 4,        // Max parallel tasks
  categoryOrder: [...],      // Category execution order
  timeout: 300000,          // 5 minutes per category
  retryAttempts: 2
}
```

### EXECUTION_STRATEGY

Parallel execution strategies:

```javascript
{
  SEQUENTIAL: 'sequential',        // One at a time
  PARALLEL: 'parallel',            // All at once (up to maxConcurrency)
  PRIORITY_BASED: 'priority_based', // High priority first, then parallel
  BALANCED: 'balanced'             // Sequential (critical) + parallel (others)
}
```

### TASK_STATUS

Task status values:

```javascript
{
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
  CANCELLED: 'cancelled'
}
```

## Class: Step1ParallelProcessor

Manages parallel validation of documentation categories.

### Constructor

```javascript
new Step1ParallelProcessor(config);
```

**Parameters:**

- `config` (Object, optional): Configuration options (merged with DEFAULT_CONFIG)

**Example:**

```javascript
const processor = new Step1ParallelProcessor({
  maxConcurrency: 8,
  timeout: 600000, // 10 minutes
});
```

### validate(files, validator, options)

Validate files in parallel by category.

**Parameters:**

- `files` (Array<string>): Documentation files to validate
- `validator` (Function): Validation function `(category, files) => Promise<Object>`
- `options` (Object, optional):
  - `strategy` (string): Force specific execution strategy
  - `getPriority` (Function): Custom priority function `(category) => number`
  - `onProgress` (Function): Progress callback `(task) => void`

**Returns:** (Promise<Object>) Validation results

**Example:**

```javascript
const processor = new Step1ParallelProcessor();

const files = ['README.md', 'docs/api/index.md', 'docs/guide.md', 'CHANGELOG.md'];

const validator = async (category, categoryFiles) => {
  // Validate files in this category
  console.log(`Validating ${category}: ${categoryFiles.length} files`);
  return { valid: true, issues: [] };
};

const results = await processor.validate(files, validator, {
  strategy: EXECUTION_STRATEGY.PARALLEL,
  getPriority: (cat) => (cat === 'readme' ? 4 : 2),
  onProgress: (task) => console.log(`Completed: ${task.category}`),
});

console.log(`Validated ${results.validatedFiles}/${results.totalFiles} files`);
console.log(`Success: ${results.success}`);
```

### getStatistics()

Get execution statistics including speedup analysis.

**Returns:** (Object) Statistics with total, completed, failed, avgDuration, speedup

**Example:**

```javascript
const stats = processor.getStatistics();
console.log(`Success Rate: ${stats.successRate}%`);
console.log(`Speedup: ${stats.speedup.speedup}x`);
console.log(`Time Saved: ${stats.speedup.timeSaved}ms`);
```

### cancel()

Cancel all pending and running tasks.

**Returns:** (Promise<void>)

**Example:**

```javascript
await processor.cancel();
console.log('All tasks cancelled');
```

### reset()

Reset processor state (clear tasks, timing).

**Example:**

```javascript
processor.reset();
```

## Usage Examples

### Basic Parallel Validation

```javascript
import { Step1ParallelProcessor } from 'ai-workflow/lib/step1_parallel';

const processor = new Step1ParallelProcessor();

const files = ['README.md', 'docs/api/index.md', 'docs/guide.md'];

const validator = async (category, categoryFiles) => {
  // Your validation logic
  return { valid: true, issues: [] };
};

const results = await processor.validate(files, validator);

if (results.success) {
  console.log('All validations passed!');
} else {
  console.error('Validation errors:', results.errors);
}
```

### Custom Priority Function

```javascript
import { VALIDATION_PRIORITY } from 'ai-workflow/lib/step1_incremental';

const getPriority = (category) => {
  if (category === 'readme') return VALIDATION_PRIORITY.CRITICAL;
  if (category === 'api') return VALIDATION_PRIORITY.HIGH;
  return VALIDATION_PRIORITY.MEDIUM;
};

await processor.validate(files, validator, { getPriority });
```

### Progress Tracking

```javascript
const progressBar = { completed: 0, total: 0 };

await processor.validate(files, validator, {
  onProgress: (task) => {
    progressBar.completed++;
    console.log(
      `[${progressBar.completed}/${progressBar.total}] ${task.category} - ${task.status}`
    );
  },
});
```

### Force Specific Strategy

```javascript
import { EXECUTION_STRATEGY } from 'ai-workflow/lib/step1_parallel';

// Always use sequential execution (no parallelism)
await processor.validate(files, validator, {
  strategy: EXECUTION_STRATEGY.SEQUENTIAL,
});
```

### Speedup Analysis

```javascript
const results = await processor.validate(files, validator, {
  strategy: EXECUTION_STRATEGY.PARALLEL,
});

const stats = processor.getStatistics();

console.log('Execution Performance:');
console.log(`  Speedup: ${stats.speedup.speedup}x`);
console.log(`  Efficiency: ${stats.speedup.efficiency}%`);
console.log(`  Time Saved: ${stats.speedup.timeSaved}ms`);
console.log(`  Parallel Time: ${stats.speedup.parallelTime}ms`);
console.log(`  Sequential Time: ${stats.speedup.sequentialTime}ms`);
```

## Testing

### Pure Function Tests (Deterministic)

```javascript
import {
  createValidationTask,
  sortTasksByPriority,
  mergeValidationResults,
} from 'ai-workflow/lib/step1_parallel';

describe('Pure Functions', () => {
  test('createValidationTask is deterministic', () => {
    const task = createValidationTask('api', ['file1.md'], 3);
    expect(task.category).toBe('api');
    expect(task.priority).toBe(3);
  });

  test('sortTasksByPriority does not mutate', () => {
    const tasks = [
      { priority: 1, category: 'a' },
      { priority: 3, category: 'b' },
    ];
    const sorted = sortTasksByPriority(tasks, []);
    expect(tasks[0].priority).toBe(1); // Original unchanged
    expect(sorted[0].priority).toBe(3); // Sorted correctly
  });
});
```

### Integration Tests (with real I/O)

```javascript
describe('Step1ParallelProcessor', () => {
  test('validates files in parallel', async () => {
    const processor = new Step1ParallelProcessor();
    const validator = async (cat, files) => ({ category: cat });

    const results = await processor.validate(['README.md'], validator);

    expect(results.success).toBe(true);
    expect(results.totalFiles).toBe(1);
  });
});
```

## Error Handling

```javascript
try {
  const results = await processor.validate(files, validator);

  if (!results.success) {
    // Handle validation errors
    results.errors.forEach((err) => {
      console.error(`${err.category}: ${err.error}`);
    });
  }
} catch (error) {
  // Handle processor errors
  console.error('Processor error:', error.message);
}
```

## Performance Considerations

1. **Concurrency Limit**: Default 4 parallel tasks - adjust based on CPU cores
2. **Timeout**: 5 minutes per category - increase for large documentation sets
3. **Strategy Selection**: Use BALANCED for mixed-priority workloads
4. **Memory Usage**: Each parallel task requires separate memory for validation results

## Related Modules

- **[step1_incremental](./step1_incremental.md)** - Incremental documentation processing
- **[file_operations](./file_operations.md)** - File system operations
- **[ai_validation](./ai_validation.md)** - AI response validation

## References

- Architecture: [Referential Transparency](../../architecture/DESIGN_PRINCIPLES.md)
- Testing: [Testing Guide](../../guides/TESTING_GUIDE.md)
- Source: `src/lib/step1_parallel.js`
- Tests: `test/lib/step1_parallel.test.js` (646 tests, 628 passing, 18 skipped)

---

**Last Updated:** February 7, 2026
**Status:** Phase 8 (In Progress)
