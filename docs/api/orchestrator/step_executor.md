# Step Executor API

**Module:** `orchestrator/step_executor`  
**Version:** 2.0.0  
**Architecture:** Referential Transparency (Pure Functions + Impure Wrapper)

## Overview

The Step Executor provides step execution with timeout handling, retry logic, input/output validation, and progress reporting. It extends EventEmitter for real-time execution monitoring and supports both sequential and parallel execution.

### Key Features

- **Timeout Handling**: Configurable timeouts with automatic failure
- **Retry Logic**: Exponential backoff retry for transient failures
- **Validation**: Input/output validation against schemas
- **Progress Reporting**: Real-time events for monitoring
- **Parallel Execution**: Execute multiple steps concurrently
- **Execution History**: Track all executions with statistics
- **Error Formatting**: Rich error messages with context

### Architecture

**Pure Functions:**

- `validateStepInput()` - Validate step input against schema
- `validateStepOutput()` - Validate step output against schema
- `calculateTimeout()` - Calculate timeout from step configuration
- `shouldRetryStep()` - Determine if step should be retried
- `calculateRetryDelay()` - Calculate exponential backoff delay
- `formatStepResult()` - Format execution result consistently
- `createExecutionContext()` - Build context from step and global context
- `isTimedOut()` - Check if execution has timed out
- `buildErrorMessage()` - Build detailed error message

**Impure Wrapper:**

- `StepExecutor` class (extends EventEmitter) - Step execution with side effects

---

## Installation

```javascript
import {
  StepExecutor,
  validateStepInput,
  validateStepOutput,
  calculateTimeout,
  shouldRetryStep,
} from 'ai_workflow.js/orchestrator/step_executor';
```

---

## Pure Functions

### `validateStepInput(input, schema = null)`

Validates step input data against optional schema with required fields, type checking, and custom validators.

**Parameters:**

- `input` (any) - Input data to validate
- `schema` (Object, optional) - Validation schema

**Schema Structure:**

- `requiredFields` (Array<string>) - Required field names
- `types` (Object) - Field name → expected type mapping
- `validate` (Function) - Custom validation function

**Returns:** Object with:

- `valid` (boolean) - True if valid
- `errors` (Array<string>) - Validation error messages

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const schema = {
  requiredFields: ['projectPath', 'config'],
  types: { projectPath: 'string', config: 'object' },
};

const result = validateStepInput({ projectPath: '/tmp/project', config: {} }, schema);
// => { valid: true, errors: [] }
```

---

### `validateStepOutput(output, schema = null)`

Validates step output data against optional schema.

**Parameters:**

- `output` (any) - Output data to validate
- `schema` (Object, optional) - Validation schema

**Schema Structure:**

- `requiredFields` (Array<string>) - Required output fields
- `requireSuccess` (boolean) - Must have `success: true`
- `validate` (Function) - Custom validation function

**Returns:** Object with `valid` and `errors`

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const schema = {
  requiredFields: ['result'],
  requireSuccess: true,
};

const result = validateStepOutput({ success: true, result: 'done' }, schema);
// => { valid: true, errors: [] }
```

---

### `calculateTimeout(step, baseTimeout = 300)`

Calculates timeout for step execution in milliseconds.

**Parameters:**

- `step` (Object) - Step definition with optional `timeout` field
- `baseTimeout` (number) - Default timeout in seconds (default: 300)

**Returns:** number - Timeout in milliseconds

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const step = { id: 'test', timeout: 600 };
const timeout = calculateTimeout(step, 300);
// => 600000 (10 minutes in ms)
```

---

### `shouldRetryStep(error, attempt, maxRetries = 3)`

Determines if a failed step should be retried based on error type and attempt count.

**Parameters:**

- `error` (Error) - Error that occurred
- `attempt` (number) - Current attempt number (0-indexed)
- `maxRetries` (number) - Maximum retry attempts

**Returns:** boolean - True if should retry

**Pure:** ✅ Deterministic, no side effects

**Retry Conditions:**

- Network errors (ECONNREFUSED, ETIMEDOUT, etc.)
- Temporary file system errors (EBUSY, EAGAIN)
- Rate limiting (429, 503 status codes)
- NOT retried: Validation errors, critical errors, permanent failures

**Example:**

```javascript
const error = new Error('ECONNREFUSED');
if (shouldRetryStep(error, 0, 3)) {
  // Retry after delay
}
```

---

### `calculateRetryDelay(attempt, baseDelay = 1000)`

Calculates exponential backoff delay for retry attempts.

**Parameters:**

- `attempt` (number) - Current attempt number (0-indexed)
- `baseDelay` (number) - Base delay in milliseconds

**Returns:** number - Delay in milliseconds

**Formula:** `baseDelay * 2^attempt`

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
calculateRetryDelay(0, 1000); // => 1000ms (1s)
calculateRetryDelay(1, 1000); // => 2000ms (2s)
calculateRetryDelay(2, 1000); // => 4000ms (4s)
```

---

### `formatStepResult(step, execution)`

Formats step execution result into consistent structure.

**Parameters:**

- `step` (Object) - Step definition
- `execution` (Object) - Execution data with `success`, `duration`, `output`, `error`, `timestamp`

**Returns:** Object with:

- `stepId` (string)
- `stepName` (string)
- `success` (boolean)
- `duration` (number) - Milliseconds
- `output` (any) - Step output
- `error` (string) - Error message if failed
- `timestamp` (number) - Execution start time

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const result = formatStepResult(step, {
  success: true,
  duration: 1234,
  output: { data: 'test' },
  timestamp: Date.now(),
});
```

---

### `createExecutionContext(step, globalContext = {}, previousResults = {})`

Builds execution context by merging step-specific, global, and previous results.

**Parameters:**

- `step` (Object) - Step definition
- `globalContext` (Object) - Global workflow context
- `previousResults` (Object) - Results from previous steps

**Returns:** Object - Merged execution context

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const context = createExecutionContext(
  { id: 'test', config: { foo: 'bar' } },
  { projectPath: '/tmp' },
  { step1: { output: 'data' } }
);
// => { projectPath: '/tmp', config: { foo: 'bar' }, step1: { output: 'data' } }
```

---

### `isTimedOut(startTime, timeout)`

Checks if execution has exceeded timeout duration.

**Parameters:**

- `startTime` (number) - Start timestamp in milliseconds
- `timeout` (number) - Timeout duration in milliseconds

**Returns:** boolean - True if timed out

**Pure:** ✅ Deterministic (when current time is passed explicitly)

**Example:**

```javascript
const start = Date.now();
// ... some time passes ...
if (isTimedOut(start, 5000)) {
  // Execution took more than 5 seconds
}
```

---

### `buildErrorMessage(step, error, attempts)`

Builds detailed error message with step context and attempt information.

**Parameters:**

- `step` (Object) - Step definition
- `error` (Error) - Error that occurred
- `attempts` (number) - Number of attempts made

**Returns:** string - Formatted error message

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const msg = buildErrorMessage(step, new Error('Network timeout'), 3);
// => "Step 'test_step' failed after 3 attempts: Network timeout"
```

---

## StepExecutor Class

Wrapper for step execution with timeout, retry, validation, and event emission.

### Constructor

```javascript
const executor = new StepExecutor(options);
```

**Options:**

- `baseTimeout` (number) - Default timeout in seconds (default: 300)
- `maxRetries` (number) - Maximum retry attempts (default: 3)
- `retryDelay` (number) - Base retry delay in ms (default: 1000)
- `validateInputs` (boolean) - Enable input validation (default: true)
- `validateOutputs` (boolean) - Enable output validation (default: true)

**Example:**

```javascript
const executor = new StepExecutor({
  baseTimeout: 600,
  maxRetries: 5,
  retryDelay: 2000,
});
```

---

### Events

The StepExecutor emits the following events:

#### `step:start`

Emitted when step execution starts.

**Payload:** `{ stepId, name }`

#### `step:complete`

Emitted when step completes successfully.

**Payload:** Execution result object

#### `step:error`

Emitted when step fails.

**Payload:** `{ ...result, error }`

#### `step:retry`

Emitted before retry attempt.

**Payload:** `{ stepId, attempt, delay }`

#### `step:timeout`

Emitted when step execution times out.

**Payload:** `{ timeout }`

#### `step:validation:error`

Emitted when input/output validation fails.

**Payload:** `{ stepId, errors }`

**Example:**

```javascript
executor.on('step:start', ({ stepId, name }) => {
  console.log(`Starting: ${name}`);
});

executor.on('step:complete', (result) => {
  console.log(`Completed in ${result.duration}ms`);
});

executor.on('step:error', ({ stepId, error }) => {
  console.error(`Failed: ${error.message}`);
});
```

---

### Methods

#### `async execute(step, context = {})`

Executes a single step with validation and timeout.

**Parameters:**

- `step` (Object) - Step definition with `id`, `name`, `handler` function
- `context` (Object) - Execution context

**Returns:** Promise<Object> - Execution result

**Throws:**

- `ValidationError` if validation fails
- `SystemError` if execution fails or times out

**Side Effects:**

- Calls step handler function
- Emits events (start, complete, error, timeout, validation:error)
- Updates execution history
- Logs execution details

**Example:**

```javascript
const step = {
  id: 'analyze',
  name: 'Analyze Code',
  handler: async (ctx) => {
    // Step logic here
    return { filesAnalyzed: 42 };
  },
  inputSchema: {
    requiredFields: ['projectPath'],
  },
  timeout: 120,
};

const result = await executor.execute(step, { projectPath: '/tmp/project' });
console.log(`Analyzed ${result.output.filesAnalyzed} files`);
```

---

#### `async executeWithRetry(step, context = {}, maxRetries = null)`

Executes step with automatic retry on transient failures.

**Parameters:**

- `step` (Object) - Step definition
- `context` (Object) - Execution context
- `maxRetries` (number, optional) - Override default max retries

**Returns:** Promise<Object> - Execution result (includes `attempts` field)

**Throws:** `SystemError` if all retries exhausted

**Side Effects:**

- Calls `execute()` multiple times
- Emits retry events
- Sleeps between retries

**Example:**

```javascript
try {
  const result = await executor.executeWithRetry(step, context, 5);
  console.log(`Succeeded after ${result.attempts} attempts`);
} catch (error) {
  console.error('All retries failed');
}
```

---

#### `async executeInParallel(steps, context = {})`

Executes multiple steps concurrently with shared context.

**Parameters:**

- `steps` (Array<Object>) - Array of step definitions
- `context` (Object) - Shared execution context

**Returns:** Promise<Array<Object>> - Array of execution results

**Note:** Does not fail fast - collects all results even if some fail

**Side Effects:**

- Executes steps concurrently
- Emits events for each step
- Updates execution history

**Example:**

```javascript
const parallelSteps = [
  { id: 'lint', name: 'Lint', handler: lintHandler },
  { id: 'test', name: 'Test', handler: testHandler },
];

const results = await executor.executeInParallel(parallelSteps, context);

const allSucceeded = results.every((r) => r.success);
console.log(`Parallel execution: ${results.filter((r) => r.success).length}/${results.length} succeeded`);
```

---

#### `validateExecution(step, result)`

Validates execution result against step expectations.

**Parameters:**

- `step` (Object) - Step definition with optional `critical`, `expectedOutput`
- `result` (Object) - Execution result

**Returns:** Object with `valid` and `errors`

**Example:**

```javascript
const validation = executor.validateExecution(step, result);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

---

#### `getHistory()`

Gets complete execution history.

**Returns:** Array<Object> - Copy of execution history

**Example:**

```javascript
const history = executor.getHistory();
console.log(`Executed ${history.length} steps`);
```

---

#### `getStats()`

Gets execution statistics.

**Returns:** Object with:

- `total` (number) - Total steps executed
- `successful` (number) - Successful executions
- `failed` (number) - Failed executions
- `successRate` (number) - Success rate percentage
- `totalDuration` (number) - Total execution time (ms)
- `averageDuration` (number) - Average execution time (ms)

**Example:**

```javascript
const stats = executor.getStats();
console.log(`Success rate: ${stats.successRate.toFixed(1)}%`);
console.log(`Average duration: ${stats.averageDuration}ms`);
```

---

#### `clearHistory()`

Clears execution history.

**Side Effects:** Resets internal history array

**Example:**

```javascript
executor.clearHistory();
```

---

## Usage Examples

### Basic Step Execution

```javascript
import { StepExecutor } from 'ai_workflow.js/orchestrator/step_executor';

const executor = new StepExecutor({
  baseTimeout: 300,
  maxRetries: 3,
});

const step = {
  id: 'validate',
  name: 'Validate Configuration',
  handler: async (context) => {
    // Validation logic
    return { valid: true, warnings: [] };
  },
};

const result = await executor.execute(step, { config: myConfig });
if (result.success) {
  console.log('Validation passed');
}
```

### Step with Input/Output Validation

```javascript
const step = {
  id: 'process',
  name: 'Process Data',
  inputSchema: {
    requiredFields: ['data', 'options'],
    types: { data: 'object', options: 'object' },
  },
  outputSchema: {
    requiredFields: ['result'],
    requireSuccess: true,
  },
  handler: async (context) => {
    // Processing logic
    return { success: true, result: processedData };
  },
};

try {
  const result = await executor.execute(step, { data: rawData, options: {} });
} catch (error) {
  console.error('Validation failed:', error.message);
}
```

### Retry with Exponential Backoff

```javascript
const unreliableStep = {
  id: 'api_call',
  name: 'Call External API',
  handler: async (context) => {
    const response = await fetch(context.apiUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  },
};

const result = await executor.executeWithRetry(unreliableStep, { apiUrl: 'https://api.example.com' }, 5);
// Automatically retries with delays: 1s, 2s, 4s, 8s, 16s
```

### Parallel Execution

```javascript
const analysisSteps = [
  { id: 'lint', name: 'Lint', handler: lintCode },
  { id: 'typecheck', name: 'Type Check', handler: typeCheck },
  { id: 'complexity', name: 'Complexity', handler: analyzeComplexity },
];

const results = await executor.executeInParallel(analysisSteps, { projectPath: '/tmp/project' });

// Check results
results.forEach((result) => {
  console.log(`${result.stepName}: ${result.success ? '✓' : '✗'} (${result.duration}ms)`);
});
```

### Monitoring with Events

```javascript
const executor = new StepExecutor();

executor.on('step:start', ({ stepId }) => {
  console.log(`▶ Starting ${stepId}`);
});

executor.on('step:complete', ({ stepId, duration }) => {
  console.log(`✓ Completed ${stepId} in ${duration}ms`);
});

executor.on('step:retry', ({ stepId, attempt, delay }) => {
  console.log(`⟳ Retrying ${stepId} (attempt ${attempt + 1}) in ${delay}ms`);
});

executor.on('step:error', ({ stepId, error }) => {
  console.error(`✗ Failed ${stepId}: ${error.message}`);
});

await executor.executeWithRetry(step, context);
```

### Execution Statistics

```javascript
// After running multiple steps
const stats = executor.getStats();

console.log(`
Execution Summary:
  Total Steps: ${stats.total}
  Successful: ${stats.successful}
  Failed: ${stats.failed}
  Success Rate: ${stats.successRate.toFixed(1)}%
  Total Time: ${(stats.totalDuration / 1000).toFixed(1)}s
  Average Time: ${stats.averageDuration.toFixed(0)}ms
`);
```

---

## Related Modules

- **workflow_engine** - Uses StepExecutor for step execution
- **step_registry** - Provides step definitions
- **dependency_resolver** - Determines execution order
- **conditional_executor** - Decides which steps to execute

---

## Notes

- **Timeout Handling**: Uses Promise.race with timer for reliable timeouts
- **Retry Strategy**: Exponential backoff with configurable base delay
- **Event-Driven**: Extends EventEmitter for real-time monitoring
- **History Tracking**: Maintains complete execution history for debugging
- **Validation**: Optional but recommended for production workflows
- **Parallel Execution**: Uses Promise.all, does not fail fast

---

**Last Updated:** 2026-02-07  
**Author:** AI Workflow Team
