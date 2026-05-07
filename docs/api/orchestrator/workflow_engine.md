# Workflow Engine API

**Module:** `orchestrator/workflow_engine`
**Version:** 2.3.2
**Architecture:** Referential Transparency (Pure Functions + Impure Wrapper)

## Overview

The Workflow Engine is the core orchestration component for executing the 15-step AI-powered development pipeline. It manages workflow execution, dependency resolution, error recovery, checkpoints, and event emission.

### Key Features

- **Dependency Management**: Automatic step ordering based on dependencies
- **Error Recovery**: Retry logic, fallback strategies, and checkpoint restoration
- **Event-Driven**: Emits events for progress tracking and logging
- **Conditional Execution**: Skip steps based on conditions or context
- **Progress Tracking**: Calculate and report workflow progress
- **Checkpoint Support**: Save/resume workflow state

### Architecture

**Pure Functions:**

- `validateWorkflowConfig()` - Validate workflow configuration structure
- `buildExecutionPlan()` - Create ordered execution plan from steps
- `shouldExecuteStep()` - Determine if step should execute based on conditions
- `mergeStepResults()` - Merge results from multiple step executions
- `calculateProgress()` - Calculate workflow progress percentage

**Impure Wrapper:**

- `WorkflowEngine` class - Manages execution, state, and events

---

## Installation

```javascript
import {
  WorkflowEngine,
  validateWorkflowConfig,
  buildExecutionPlan,
} from 'ai_workflow.js/orchestrator/workflow_engine';
```

---

## Pure Functions

### `validateWorkflowConfig(config)`

Validates workflow configuration structure and required fields.

**Parameters:**

- `config` (Object): Workflow configuration object

**Returns:** `{ isValid: boolean, errors: string[] }`

**Pure:** ✅ Yes - Deterministic, no side effects

**Example:**

```javascript
const config = {
  name: 'My Workflow',
  version: '1.0.0',
  steps: [
    { id: 'step1', name: 'First Step' },
    { id: 'step2', name: 'Second Step', dependencies: ['step1'] },
  ],
};

const result = validateWorkflowConfig(config);
// => { isValid: true, errors: [] }

// Invalid config
const invalid = { name: 'Test' }; // missing version and steps
const result2 = validateWorkflowConfig(invalid);
// => { isValid: false, errors: ['Workflow version is required', 'Steps must be an array'] }
```

**Validation Rules:**

- `name` (required string) - Workflow name
- `version` (required string) - Workflow version
- `steps` (required array, non-empty) - Array of step definitions
- Each step must have `id` and `name`
- Step dependencies must be arrays if present

---

### `buildExecutionPlan(steps)`

Builds execution plan from steps based on dependencies using topological sort.

**Parameters:**

- `steps` (Array<Object>): Array of step definitions with `id` and `dependencies`

**Returns:** `Array<Object>` - Ordered steps for sequential execution

**Pure:** ✅ Yes - Deterministic, creates new array

**Throws:** `ValidationError` - If circular dependency detected

**Example:**

```javascript
const steps = [
  { id: 'step3', name: 'Third', dependencies: ['step2'] },
  { id: 'step1', name: 'First', dependencies: [] },
  { id: 'step2', name: 'Second', dependencies: ['step1'] },
];

const plan = buildExecutionPlan(steps);
// => [
//   { id: 'step1', name: 'First', ... },
//   { id: 'step2', name: 'Second', ... },
//   { id: 'step3', name: 'Third', ... }
// ]

// Circular dependency
const circular = [
  { id: 'a', dependencies: ['b'] },
  { id: 'b', dependencies: ['a'] },
];
// Throws: ValidationError('Circular dependency detected in workflow steps')
```

**Algorithm:** Kahn's topological sort with cycle detection

---

### `shouldExecuteStep(step, context)`

Determines if a step should be executed based on conditions and flags.

**Parameters:**

- `step` (Object): Step definition with optional `skip`, `enabled`, `condition`
- `context` (Object): Execution context for condition evaluation

**Returns:** `boolean` - True if step should execute

**Pure:** ✅ Yes - Deterministic given same inputs

**Example:**

```javascript
// Normal execution
shouldExecuteStep({ id: 'step1', name: 'Test' }, {});
// => true

// Explicitly skipped
shouldExecuteStep({ id: 'step1', skip: true }, {});
// => false

// Disabled
shouldExecuteStep({ id: 'step1', enabled: false }, {});
// => false

// With condition function
shouldExecuteStep(
  {
    id: 'step1',
    condition: (ctx) => ctx.hasChanges,
  },
  { hasChanges: true }
);
// => true

// With condition string
shouldExecuteStep(
  {
    id: 'step1',
    condition: 'hasChanges',
  },
  { hasChanges: true }
);
// => true
```

**Condition Types:**

- `step.skip: true` - Always skip
- `step.enabled: false` - Step disabled
- `step.condition: function` - Custom condition function
- `step.condition: string` - Simple context property check

---

### `mergeStepResults(results)`

Merges results from multiple step executions into summary statistics.

**Parameters:**

- `results` (Array<Object>): Array of step execution results

**Returns:** `Object` - Merged summary with counts and details

**Pure:** ✅ Yes - Creates new object from inputs

**Example:**

```javascript
const results = [
  { stepId: 'step1', success: true, duration: 100 },
  { stepId: 'step2', success: true, duration: 150 },
  { stepId: 'step3', success: false, error: 'Failed', duration: 50 },
  { stepId: 'step4', skipped: true },
];

const summary = mergeStepResults(results);
// => {
//   total: 4,
//   succeeded: 2,
//   failed: 1,
//   skipped: 1,
//   totalDuration: 300,
//   results: [...],
//   errors: [{ stepId: 'step3', error: 'Failed' }]
// }
```

**Output Fields:**

- `total` - Total steps
- `succeeded` - Successfully executed steps
- `failed` - Failed steps
- `skipped` - Skipped steps
- `totalDuration` - Combined duration in milliseconds
- `results` - Original results array
- `errors` - Array of errors from failed steps

---

### `calculateProgress(completedSteps, totalSteps)`

Calculates workflow progress percentage.

**Parameters:**

- `completedSteps` (number): Number of completed steps
- `totalSteps` (number): Total number of steps

**Returns:** `number` - Progress percentage (0-100)

**Pure:** ✅ Yes - Simple calculation

**Example:**

```javascript
calculateProgress(5, 15); // => 33.33
calculateProgress(15, 15); // => 100
calculateProgress(0, 15); // => 0
```

---

## WorkflowEngine Class

Main workflow execution engine with state management and event emission.

### Constructor

```javascript
const engine = new WorkflowEngine(options);
```

**Parameters:**

- `options` (Object):
  - `name` (string): Workflow name
  - `version` (string): Workflow version
  - `steps` (Array): Step definitions
  - `checkpointDir` (string): Directory for checkpoint files
  - `enableCheckpoints` (boolean): Enable checkpoint support (default: true)
  - `maxRetries` (number): Max retry attempts per step (default: 3)
  - `timeout` (number): Default step timeout in seconds (default: 300)

**Example:**

```javascript
const engine = new WorkflowEngine({
  name: 'AI Development Workflow',
  version: '1.0.0',
  steps: [
    { id: 'step_00_analyze', name: 'Analyze Documentation', handler: analyzeHandler },
    {
      id: 'step_01_validate',
      name: 'Validate Tests',
      handler: validateHandler,
      dependencies: ['step_00_analyze'],
    },
  ],
  checkpointDir: '.ai_workflow/checkpoints',
  enableCheckpoints: true,
  maxRetries: 3,
});
```

---

### Methods

#### `async execute(context = {})`

Executes the workflow with the given context.

**Parameters:**

- `context` (Object): Execution context available to all steps

**Returns:** `Promise<Object>` - Execution results with summary

**Events Emitted:**

- `workflow:start` - Before execution begins
- `workflow:complete` - After successful execution
- `workflow:error` - On workflow-level error
- `step:start` - Before each step executes
- `step:complete` - After each step completes
- `step:error` - On step error
- `step:skip` - When step is skipped
- `checkpoint:save` - After checkpoint saved

**Example:**

```javascript
const context = {
  projectPath: '/path/to/project',
  config: {
    /* ... */
  },
};

const results = await engine.execute(context);
// => {
//   success: true,
//   total: 15,
//   succeeded: 14,
//   failed: 0,
//   skipped: 1,
//   duration: 45000,
//   steps: [...]
// }
```

---

#### `async executeStep(step, context)`

Executes a single step with retry logic and error handling.

**Parameters:**

- `step` (Object): Step definition with handler
- `context` (Object): Execution context

**Returns:** `Promise<Object>` - Step execution result

**Example:**

```javascript
const step = {
  id: 'step_00_analyze',
  name: 'Analyze Documentation',
  handler: async (ctx) => {
    // Step logic here
    return {
      success: true,
      data: {
        /* ... */
      },
    };
  },
};

const result = await engine.executeStep(step, context);
// => { stepId: 'step_00_analyze', success: true, duration: 1500, data: {...} }
```

---

#### `async saveCheckpoint(stepId)`

Saves workflow checkpoint after step completion.

**Parameters:**

- `stepId` (string): ID of completed step

**Returns:** `Promise<string>` - Checkpoint file path

**Example:**

```javascript
const checkpointPath = await engine.saveCheckpoint('step_05_generate_tests');
// => '.ai_workflow/checkpoints/checkpoint_step_05_generate_tests.json'
```

---

#### `async resumeFromCheckpoint(checkpointPath)`

Resumes workflow execution from saved checkpoint.

**Parameters:**

- `checkpointPath` (string): Path to checkpoint file

**Returns:** `Promise<Object>` - Execution results

**Example:**

```javascript
const results = await engine.resumeFromCheckpoint(
  '.ai_workflow/checkpoints/checkpoint_step_05.json'
);
```

---

#### `on(event, handler)`

Registers event listener for workflow events.

**Parameters:**

- `event` (string): Event name
- `handler` (Function): Event handler

**Returns:** `WorkflowEngine` - For chaining

**Events:**

- `workflow:start` - `(workflowName) => {}`
- `workflow:complete` - `(results) => {}`
- `workflow:error` - `(error) => {}`
- `step:start` - `(stepId, stepName) => {}`
- `step:complete` - `(result) => {}`
- `step:error` - `(stepId, error) => {}`
- `step:skip` - `(stepId, reason) => {}`
- `checkpoint:save` - `(checkpointPath) => {}`

**Example:**

```javascript
engine
  .on('workflow:start', (name) => {
    console.log(`Starting workflow: ${name}`);
  })
  .on('step:complete', (result) => {
    console.log(`Step ${result.stepId} completed in ${result.duration}ms`);
  })
  .on('workflow:error', (error) => {
    console.error('Workflow failed:', error);
  });
```

---

### Properties

#### `state` (Object)

Current workflow state.

```javascript
engine.state;
// => {
//   status: 'running',        // idle, running, completed, failed, paused
//   currentStep: 'step_03',
//   completedSteps: ['step_00', 'step_01', 'step_02'],
//   results: [...],
//   startTime: 1609459200000,
//   context: {...}
// }
```

#### `config` (Object)

Workflow configuration.

```javascript
engine.config;
// => {
//   name: 'AI Development Workflow',
//   version: '1.0.0',
//   steps: [...],
//   checkpointDir: '.ai_workflow/checkpoints',
//   enableCheckpoints: true,
//   maxRetries: 3
// }
```

---

## Usage Examples

### Basic Workflow Execution

```javascript
import { WorkflowEngine } from 'ai_workflow.js/orchestrator/workflow_engine';

// Define steps
const steps = [
  {
    id: 'step_00_analyze',
    name: 'Analyze Documentation',
    handler: async (context) => {
      // Analyze docs
      return { success: true, analysis: {...} };
    }
  },
  {
    id: 'step_01_generate_tests',
    name: 'Generate Tests',
    dependencies: ['step_00_analyze'],
    handler: async (context) => {
      // Generate tests based on analysis
      return { success: true, tests: [...] };
    }
  }
];

// Create engine
const engine = new WorkflowEngine({
  name: 'AI Workflow',
  version: '1.0.0',
  steps
});

// Execute
const results = await engine.execute({
  projectPath: '/path/to/project'
});

console.log(`Completed ${results.succeeded}/${results.total} steps`);
```

---

### With Event Listeners

```javascript
const engine = new WorkflowEngine({ name: 'Test', version: '1.0.0', steps });

// Track progress
let completed = 0;
engine.on('step:complete', (result) => {
  completed++;
  const progress = (completed / engine.config.steps.length) * 100;
  console.log(`Progress: ${progress.toFixed(1)}%`);
});

// Handle errors
engine.on('step:error', (stepId, error) => {
  console.error(`Step ${stepId} failed:`, error.message);
});

// Execute
await engine.execute(context);
```

---

### Checkpoint and Resume

```javascript
// Enable checkpoints
const engine = new WorkflowEngine({
  name: 'Long Workflow',
  version: '1.0.0',
  steps,
  checkpointDir: '.ai_workflow/checkpoints',
  enableCheckpoints: true,
});

// Start execution (may fail partway)
try {
  await engine.execute(context);
} catch (error) {
  console.log('Workflow interrupted, checkpoint saved');
}

// Resume later
const checkpointPath = '.ai_workflow/checkpoints/checkpoint_step_05.json';
const results = await engine.resumeFromCheckpoint(checkpointPath);
```

---

### Conditional Step Execution

```javascript
const steps = [
  {
    id: 'step_lint',
    name: 'Lint Code',
    condition: (ctx) => ctx.hasCodeChanges,
    handler: async (ctx) => {
      /* ... */
    },
  },
  {
    id: 'step_test',
    name: 'Run Tests',
    condition: 'hasCodeChanges', // String condition
    handler: async (ctx) => {
      /* ... */
    },
  },
  {
    id: 'step_deploy',
    name: 'Deploy',
    skip: true, // Always skip
    handler: async (ctx) => {
      /* ... */
    },
  },
];

const engine = new WorkflowEngine({ name: 'Workflow', version: '1.0.0', steps });
await engine.execute({ hasCodeChanges: false }); // Skips lint and test
```

---

## Error Handling

### Validation Errors

```javascript
import { validateWorkflowConfig } from 'ai_workflow.js/orchestrator/workflow_engine';

const config = { name: 'Test' }; // Invalid - missing version, steps
const result = validateWorkflowConfig(config);

if (!result.isValid) {
  console.error('Validation errors:', result.errors);
  // => ['Workflow version is required', 'Steps must be an array']
}
```

### Circular Dependencies

```javascript
import { buildExecutionPlan } from 'ai_workflow.js/orchestrator/workflow_engine';
import { ValidationError } from 'ai_workflow.js/utils/errors';

const steps = [
  { id: 'a', dependencies: ['b'] },
  { id: 'b', dependencies: ['a'] },
];

try {
  const plan = buildExecutionPlan(steps);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Circular dependency detected');
  }
}
```

### Step Execution Errors

```javascript
engine.on('step:error', (stepId, error, attempt) => {
  console.error(`Step ${stepId} failed (attempt ${attempt}/${engine.config.maxRetries})`);

  if (error.code === 'TIMEOUT') {
    console.log('Step timed out');
  }
});

// Critical step failures stop workflow
engine.on('workflow:error', (error) => {
  console.error('Workflow failed:', error.message);
  // Checkpoint saved automatically
});
```

---

## Related Modules

- **[step_registry](./step_registry.md)** - Manages step definitions and metadata
- **[dependency_resolver](./dependency_resolver.md)** - Resolves dependencies and execution order
- **[step_executor](./step_executor.md)** - Executes individual steps with retry logic
- **[conditional_executor](./conditional_executor.md)** - Handles conditional step execution
- **[checkpoint_manager](./checkpoint_manager.md)** - Checkpoint save/restore functionality

---

## Version History

- **2.0.0** (Current) - Referential transparency architecture
  - Pure functions extracted for testability
  - Event-driven design
  - Checkpoint support
  - Conditional execution

---

**Last Updated:** February 6, 2026
**Module Version:** 2.0.0
