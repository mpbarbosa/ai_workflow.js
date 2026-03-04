# Checkpoint Manager API

**Module:** `orchestrator/checkpoint_manager`
**Version:** 2.0.0
**Architecture:** Referential Transparency (Pure Functions + Impure Wrapper)

## Overview

The Checkpoint Manager provides workflow state checkpoint management for pause/resume and error recovery. It enables saving workflow progress at any point, resuming from saved checkpoints, and automatic cleanup of old checkpoints.

### Key Features

- **Save/Resume**: Save workflow state and resume from checkpoints
- **Validation**: Comprehensive checkpoint data validation
- **State Merging**: Intelligent merging of checkpoint and current state
- **Age Calculation**: Track checkpoint age for cleanup
- **Filtering**: Filter checkpoints by workflow ID
- **Sorting**: Sort checkpoints by timestamp
- **Auto Cleanup**: Automatic removal of old checkpoints
- **Error Recovery**: Resume workflows after failures

### Architecture

**Pure Functions:**

- `createCheckpointData()` - Create checkpoint from workflow state
- `validateCheckpoint()` - Validate checkpoint structure
- `mergeCheckpointState()` - Merge checkpoint with current state
- `calculateCheckpointAge()` - Calculate age in milliseconds
- `shouldCleanupCheckpoint()` - Determine if checkpoint should be cleaned up
- `generateCheckpointId()` - Generate unique checkpoint identifier
- `parseCheckpointId()` - Parse checkpoint ID components
- `filterCheckpointsByWorkflow()` - Filter by workflow ID
- `sortCheckpointsByTime()` - Sort by timestamp

**Impure Wrapper:**

- `CheckpointManager` class - File I/O and persistence management

---

## Installation

```javascript
import {
  CheckpointManager,
  createCheckpointData,
  validateCheckpoint,
  mergeCheckpointState,
  calculateCheckpointAge,
} from 'ai_workflow.js/orchestrator/checkpoint_manager';
```

---

## Pure Functions

### `createCheckpointData(workflow, currentState = {})`

Creates checkpoint data structure from workflow definition and current state.

**Parameters:**

- `workflow` (Object) - Workflow definition with `id`, `name`, `version`, `steps`
- `currentState` (Object) - Current execution state

**State Structure:**

- `currentStep` (string) - Current step ID
- `completedSteps` (Array<string>) - Completed step IDs
- `failedSteps` (Array<string>) - Failed step IDs
- `skippedSteps` (Array<string>) - Skipped step IDs
- `results` (Object) - Step results map
- `context` (Object) - Execution context
- `timestamp` (number) - State timestamp
- `progress` (number) - Progress percentage
- `metadata` (Object) - Additional metadata

**Returns:** Object - Checkpoint data with version, workflow info, state, metadata

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const checkpoint = createCheckpointData(workflow, {
  currentStep: 'step5',
  completedSteps: ['step1', 'step2', 'step3', 'step4'],
  failedSteps: [],
  results: { step1: { output: 'done' } },
  timestamp: Date.now(),
  progress: 40,
});

console.log(checkpoint.workflowId); // workflow.id
console.log(checkpoint.state.completedSteps.length); // 4
```

---

### `validateCheckpoint(data)`

Validates checkpoint data structure and required fields.

**Parameters:**

- `data` (Object) - Checkpoint data to validate

**Returns:** Object with:

- `valid` (boolean) - True if valid
- `errors` (Array<string>) - Validation error messages

**Pure:** ✅ Deterministic, no side effects

**Validation Rules:**

- Must be an object
- Must have `version`, `workflowId`, `timestamp`, `state`
- `state.completedSteps` must be array
- `state.results` must be object (if present)

**Example:**

```javascript
const result = validateCheckpoint({
  version: '1.0.0',
  workflowId: 'test',
  timestamp: Date.now(),
  state: {
    completedSteps: ['step1'],
    results: {},
  },
});

if (!result.valid) {
  console.error('Invalid checkpoint:', result.errors);
}
```

---

### `mergeCheckpointState(currentState = {}, savedState = {})`

Merges checkpoint state with current state, combining arrays and objects intelligently.

**Parameters:**

- `currentState` (Object) - Current execution state
- `savedState` (Object) - Saved checkpoint state

**Returns:** Object - Merged state

**Pure:** ✅ Deterministic, no side effects

**Merge Strategy:**

- Arrays: Concatenate (deduplicated)
- Objects: Deep merge (saved takes precedence)
- Primitives: Saved value takes precedence if exists

**Example:**

```javascript
const current = {
  completedSteps: ['step5'],
  results: { step5: { output: 'new' } },
};

const saved = {
  currentStep: 'step4',
  completedSteps: ['step1', 'step2', 'step3'],
  results: { step1: { output: 'old' } },
};

const merged = mergeCheckpointState(current, saved);
// => {
//   currentStep: 'step4',
//   completedSteps: ['step1', 'step2', 'step3', 'step5'],
//   results: { step1: { output: 'old' }, step5: { output: 'new' } }
// }
```

---

### `calculateCheckpointAge(checkpoint, now = Date.now())`

Calculates age of checkpoint in milliseconds.

**Parameters:**

- `checkpoint` (Object) - Checkpoint data with `timestamp`
- `now` (number, optional) - Current time in milliseconds (default: Date.now())

**Returns:** number - Age in milliseconds (Infinity if no timestamp)

**Pure:** ✅ Deterministic when `now` is provided

**Example:**

```javascript
const checkpoint = { timestamp: Date.now() - 3600000 }; // 1 hour ago
const age = calculateCheckpointAge(checkpoint);
console.log(`Checkpoint is ${Math.floor(age / 60000)} minutes old`);
```

---

### `shouldCleanupCheckpoint(checkpoint, maxAge, now = Date.now())`

Determines if checkpoint should be cleaned up based on age.

**Parameters:**

- `checkpoint` (Object) - Checkpoint with `timestamp`
- `maxAge` (number) - Maximum age in milliseconds
- `now` (number, optional) - Current time

**Returns:** boolean - True if should be cleaned up

**Pure:** ✅ Deterministic when `now` is provided

**Example:**

```javascript
const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
const checkpoint = { timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000 }; // 10 days ago

if (shouldCleanupCheckpoint(checkpoint, maxAge)) {
  console.log('Checkpoint is too old, should be cleaned up');
}
```

---

### `generateCheckpointId(workflowId, timestamp)`

Generates unique checkpoint identifier.

**Parameters:**

- `workflowId` (string) - Workflow identifier
- `timestamp` (number) - Timestamp in milliseconds

**Returns:** string - Format: `{workflowId}_{timestamp}`

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const id = generateCheckpointId('my_workflow', 1704150000000);
// => 'my_workflow_1704150000000'
```

---

### `parseCheckpointId(checkpointId)`

Parses checkpoint ID into components.

**Parameters:**

- `checkpointId` (string) - Checkpoint ID to parse

**Returns:** Object with:

- `workflowId` (string) - Workflow identifier
- `timestamp` (number) - Timestamp in milliseconds

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const parsed = parseCheckpointId('my_workflow_1704150000000');
// => { workflowId: 'my_workflow', timestamp: 1704150000000 }
```

---

### `filterCheckpointsByWorkflow(checkpoints, workflowId)`

Filters checkpoint list by workflow ID.

**Parameters:**

- `checkpoints` (Array<Object>) - Array of checkpoint metadata
- `workflowId` (string) - Workflow ID to filter by

**Returns:** Array<Object> - Filtered checkpoints

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const filtered = filterCheckpointsByWorkflow(allCheckpoints, 'test_workflow');
console.log(`Found ${filtered.length} checkpoints for test_workflow`);
```

---

### `sortCheckpointsByTime(checkpoints)`

Sorts checkpoints by timestamp (newest first).

**Parameters:**

- `checkpoints` (Array<Object>) - Array of checkpoint metadata with `timestamp`

**Returns:** Array<Object> - Sorted checkpoints

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const sorted = sortCheckpointsByTime(checkpoints);
console.log(`Latest checkpoint: ${sorted[0].id}`);
```

---

## CheckpointManager Class

Wrapper for checkpoint persistence with file I/O operations.

### Constructor

```javascript
const manager = new CheckpointManager(options);
```

**Options:**

- `checkpointDir` (string) - Directory for checkpoint files (default: '.ai_workflow/checkpoints')
- `maxAge` (number) - Maximum checkpoint age in ms (default: 7 days)
- `autoCleanup` (boolean) - Enable automatic cleanup (default: true)

**Example:**

```javascript
const manager = new CheckpointManager({
  checkpointDir: '.ai_workflow/checkpoints',
  maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
  autoCleanup: true,
});
```

---

### Methods

#### `async save(workflow, currentState = {})`

Saves a checkpoint to disk.

**Parameters:**

- `workflow` (Object) - Workflow definition
- `currentState` (Object) - Current execution state

**Returns:** Promise<string> - Checkpoint ID

**Throws:**

- `ValidationError` if checkpoint data invalid
- `SystemError` if file I/O fails

**Side Effects:**

- Creates checkpoint directory if needed
- Writes JSON file to disk
- Triggers auto cleanup if enabled
- Logs save operation

**Example:**

```javascript
const checkpointId = await manager.save(workflow, {
  currentStep: 'step5',
  completedSteps: ['step1', 'step2', 'step3', 'step4'],
  failedSteps: [],
  results: { step1: { output: 'data' } },
  timestamp: Date.now(),
  progress: 40,
});

console.log(`Checkpoint saved: ${checkpointId}`);
```

---

#### `async load(checkpointId)`

Loads a checkpoint from disk.

**Parameters:**

- `checkpointId` (string) - Checkpoint identifier

**Returns:** Promise<Object> - Checkpoint data

**Throws:**

- `ValidationError` if checkpoint not found or invalid
- `SystemError` if file read fails

**Side Effects:**

- Reads from disk
- Logs load operation

**Example:**

```javascript
try {
  const checkpoint = await manager.load('my_workflow_1704150000000');
  console.log(`Loaded checkpoint from ${new Date(checkpoint.timestamp)}`);
} catch (error) {
  console.error('Failed to load checkpoint:', error.message);
}
```

---

#### `async list(filter = {})`

Lists all checkpoints with optional filtering.

**Parameters:**

- `filter` (Object, optional):
  - `workflowId` (string) - Filter by workflow ID

**Returns:** Promise<Array<Object>> - Array of checkpoint metadata

**Metadata Structure:**

- `id` (string) - Checkpoint ID
- `workflowId` (string) - Workflow identifier
- `timestamp` (number) - Creation timestamp
- `age` (number) - Age in milliseconds
- `state` (Object):
  - `currentStep` (string)
  - `completedSteps` (number) - Count
  - `progress` (number) - Progress percentage

**Side Effects:**

- Reads directory
- Logs warnings for invalid checkpoints

**Example:**

```javascript
// List all checkpoints
const all = await manager.list();

// Filter by workflow
const workflowCheckpoints = await manager.list({ workflowId: 'test_workflow' });

console.log(`Found ${workflowCheckpoints.length} checkpoints for test_workflow`);
```

---

#### `async delete(checkpointId)`

Deletes a checkpoint from disk.

**Parameters:**

- `checkpointId` (string) - Checkpoint identifier

**Returns:** Promise<boolean> - True if deleted, false if not found

**Throws:** `SystemError` if deletion fails (other than ENOENT)

**Side Effects:**

- Deletes file from disk
- Logs deletion

**Example:**

```javascript
const deleted = await manager.delete('old_checkpoint_123');
if (deleted) {
  console.log('Checkpoint deleted');
} else {
  console.log('Checkpoint not found');
}
```

---

#### `async cleanup(maxAge = null)`

Cleans up old checkpoints based on age.

**Parameters:**

- `maxAge` (number, optional) - Override max age in milliseconds

**Returns:** Promise<number> - Number of checkpoints cleaned up

**Throws:** `SystemError` if cleanup fails

**Side Effects:**

- Lists and deletes old checkpoints
- Logs cleanup results

**Example:**

```javascript
// Use default max age (from constructor)
const cleaned = await manager.cleanup();
console.log(`Cleaned up ${cleaned} old checkpoints`);

// Use custom max age
const cleaned7d = await manager.cleanup(7 * 24 * 60 * 60 * 1000);
console.log(`Cleaned up ${cleaned7d} checkpoints older than 7 days`);
```

---

#### `async validate(checkpointId)`

Validates a checkpoint without loading full state.

**Parameters:**

- `checkpointId` (string) - Checkpoint identifier

**Returns:** Promise<Object> - Validation result with `valid` and `errors`

**Example:**

```javascript
const validation = await manager.validate('test_checkpoint_123');
if (!validation.valid) {
  console.error('Invalid checkpoint:', validation.errors);
}
```

---

#### `async getLatest(workflowId)`

Gets the most recent checkpoint for a workflow.

**Parameters:**

- `workflowId` (string) - Workflow identifier

**Returns:** Promise<Object | null> - Latest checkpoint data or null if none found

**Side Effects:**

- Lists and filters checkpoints
- Loads latest checkpoint

**Example:**

```javascript
const latest = await manager.getLatest('my_workflow');
if (latest) {
  console.log(`Latest checkpoint from ${new Date(latest.timestamp)}`);
  console.log(`Progress: ${latest.metadata.progress}%`);
} else {
  console.log('No checkpoints found');
}
```

---

#### `async resume(checkpointId, currentState = {})`

Resumes workflow from checkpoint by merging states.

**Parameters:**

- `checkpointId` (string) - Checkpoint identifier
- `currentState` (Object, optional) - Current state to merge with

**Returns:** Promise<Object> with:

- `checkpoint` (Object) - Original checkpoint data
- `state` (Object) - Merged state for resuming

**Side Effects:**

- Loads checkpoint from disk
- Logs resume operation

**Example:**

```javascript
const { checkpoint, state } = await manager.resume('my_workflow_1704150000000');

console.log(`Resuming from step: ${state.currentStep}`);
console.log(`Already completed: ${state.completedSteps.length} steps`);

// Continue workflow with merged state
await continueWorkflow(state);
```

---

## Usage Examples

### Basic Save/Resume

```javascript
import { CheckpointManager } from 'ai_workflow.js/orchestrator/checkpoint_manager';

const manager = new CheckpointManager({
  checkpointDir: '.ai_workflow/checkpoints',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

// Save checkpoint during workflow execution
const checkpointId = await manager.save(workflow, {
  currentStep: 'step5',
  completedSteps: ['step1', 'step2', 'step3', 'step4'],
  results: {
    step1: { output: 'data1' },
    step2: { output: 'data2' },
  },
  timestamp: Date.now(),
  progress: 40,
});

// Resume later
const { checkpoint, state } = await manager.resume(checkpointId);
console.log(`Resuming from ${state.currentStep}`);
```

### Error Recovery

```javascript
async function runWorkflowWithRecovery(workflow) {
  const manager = new CheckpointManager();

  try {
    let state = { completedSteps: [], results: {} };

    // Try to resume from latest checkpoint
    const latest = await manager.getLatest(workflow.id);
    if (latest) {
      const resumed = await manager.resume(latest.id);
      state = resumed.state;
      console.log(`Resuming from checkpoint (progress: ${latest.metadata.progress}%)`);
    }

    // Execute workflow with periodic checkpoints
    for (const step of workflow.steps) {
      // Skip already completed steps
      if (state.completedSteps.includes(step.id)) {
        continue;
      }

      try {
        const result = await executeStep(step);
        state.completedSteps.push(step.id);
        state.results[step.id] = result;
        state.currentStep = step.id;
        state.progress = (state.completedSteps.length / workflow.steps.length) * 100;

        // Save checkpoint after each step
        await manager.save(workflow, state);
      } catch (error) {
        console.error(`Step ${step.id} failed:`, error);
        await manager.save(workflow, { ...state, failedSteps: [step.id] });
        throw error;
      }
    }

    console.log('Workflow completed successfully');
  } catch (error) {
    console.error('Workflow failed, checkpoint saved for recovery');
  }
}
```

### Checkpoint Management

```javascript
// List all checkpoints
const checkpoints = await manager.list();
console.log(`Total checkpoints: ${checkpoints.length}`);

// Filter by workflow
const workflowCheckpoints = await manager.list({ workflowId: 'test' });

// Show checkpoint details
for (const cp of workflowCheckpoints) {
  console.log(`
    ID: ${cp.id}
    Age: ${Math.floor(cp.age / 60000)} minutes
    Progress: ${cp.state.progress}%
    Completed: ${cp.state.completedSteps} steps
  `);
}

// Clean up old checkpoints
const cleaned = await manager.cleanup();
console.log(`Cleaned up ${cleaned} old checkpoints`);
```

### Manual Checkpoint Validation

```javascript
// Validate before loading
const validation = await manager.validate('checkpoint_123');

if (validation.valid) {
  const checkpoint = await manager.load('checkpoint_123');
  // Use checkpoint
} else {
  console.error('Invalid checkpoint:', validation.errors);
  // Delete invalid checkpoint
  await manager.delete('checkpoint_123');
}
```

### Periodic Auto-Checkpoints

```javascript
async function runWorkflowWithAutoCheckpoint(workflow) {
  const manager = new CheckpointManager({ autoCleanup: true });
  let state = { completedSteps: [], results: {} };

  // Save checkpoint every 5 steps
  const CHECKPOINT_INTERVAL = 5;

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];

    const result = await executeStep(step);
    state.completedSteps.push(step.id);
    state.results[step.id] = result;
    state.currentStep = step.id;

    // Auto-checkpoint
    if ((i + 1) % CHECKPOINT_INTERVAL === 0) {
      await manager.save(workflow, {
        ...state,
        timestamp: Date.now(),
        progress: ((i + 1) / workflow.steps.length) * 100,
      });
      console.log(`Auto-checkpoint saved at step ${i + 1}`);
    }
  }

  // Final checkpoint
  await manager.save(workflow, {
    ...state,
    timestamp: Date.now(),
    progress: 100,
  });
}
```

---

## Related Modules

- **workflow_engine** - Uses CheckpointManager for pause/resume
- **step_executor** - Provides state for checkpoints
- **step_registry** - Step definitions in checkpoints

---

## Notes

- **File Format**: Checkpoints are JSON files in `.ai_workflow/checkpoints/`
- **Naming**: Format is `{workflowId}_{timestamp}.json`
- **Auto Cleanup**: Runs after each save if enabled
- **State Merging**: Intelligently combines checkpoint and current state
- **Error Handling**: Comprehensive validation before save/load
- **Concurrency**: Not thread-safe - use locking for concurrent access

---

**Last Updated:** 2026-02-07
**Author:** AI Workflow Team
