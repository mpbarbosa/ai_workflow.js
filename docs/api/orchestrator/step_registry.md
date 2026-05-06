# Step Registry API

**Module:** `orchestrator/step_registry`
**Version:** 2.3.0
**Architecture:** Referential Transparency (Pure Functions + Impure Wrapper)

## Overview

The Step Registry is a comprehensive management system for workflow step definitions and metadata. It provides registration, validation, querying, and filtering capabilities for workflow steps with support for dependencies, requirements, tags, and phase organization.

### Key Features

- **Step Registration**: Register, update, and unregister workflow steps
- **Validation**: Comprehensive metadata validation with detailed error reporting
- **Dependency Management**: Validate step dependencies and detect missing references
- **Requirement Matching**: Check step requirements against execution context
- **Flexible Querying**: Filter by phase, tags, enabled status
- **Phase Organization**: Group steps by workflow phases (analysis, validation, testing, quality, finalization)
- **Statistics & Reporting**: Get registry statistics and insights

### Architecture

**Pure Functions:**

- `createStepDefinition()` - Create validated step definitions
- `validateStepMetadata()` - Validate step metadata structure
- `matchStepRequirements()` - Check requirements against context
- `groupStepsByPhase()` - Group steps by workflow phase
- `filterStepsByTags()` - Filter by tags with AND logic
- `filterStepsByEnabled()` - Filter by enabled status
- `findStepsByPhase()` - Find steps in specific phase
- `sortStepsById()` - Natural sort by step ID
- `validateStepDependencies()` - Validate all dependencies exist

**Impure Wrapper:**

- `StepRegistry` class - Registration, storage, and querying with state management

---

## Installation

```javascript
import {
  StepRegistry,
  createStepDefinition,
  validateStepMetadata,
  matchStepRequirements,
  groupStepsByPhase,
  filterStepsByTags,
} from 'ai_workflow.js/orchestrator/step_registry';
```

---

## Pure Functions

### `createStepDefinition(metadata)`

Creates a validated step definition from metadata with defaults applied.

**Parameters:**

- `metadata` (Object): Step metadata
  - `id` (string, required): Unique step identifier (lowercase, numbers, underscores)
  - `name` (string, required): Human-readable step name
  - `description` (string, required): Step description
  - `phase` (string, optional): Workflow phase (default: 'execution')
  - `dependencies` (Array<string>, optional): Step IDs this depends on (default: [])
  - `tags` (Array<string>, optional): Categorization tags (default: [])
  - `critical` (boolean, optional): Critical step flag (default: false)
  - `enabled` (boolean, optional): Enabled flag (default: true)
  - `timeout` (number, optional): Timeout in seconds (default: 300)
  - `requirements` (Object, optional): Step requirements (default: {})
  - `handler` (Function, optional): Execution handler function
  - `metadata` (Object, optional): Additional metadata

**Returns:** `Object` - Validated step definition with all fields

**Throws:** `ValidationError` - If metadata is invalid

**Pure:** ✅ Yes - Deterministic, no side effects

**Example:**

```javascript
const metadata = {
  id: 'step_00_analyze',
  name: 'Analyze Documentation',
  description: 'Analyzes project documentation for completeness',
  phase: 'analysis',
  dependencies: [],
  tags: ['documentation', 'analysis'],
  critical: true,
  timeout: 600,
  requirements: {
    files: ['README.md', 'docs/'],
    tools: ['grep', 'find'],
  },
  handler: async (context) => {
    // Analysis logic
  },
};

const step = createStepDefinition(metadata);
// => {
//   id: 'step_00_analyze',
//   name: 'Analyze Documentation',
//   description: 'Analyzes project documentation for completeness',
//   phase: 'analysis',
//   dependencies: [],
//   tags: ['documentation', 'analysis'],
//   critical: true,
//   enabled: true,
//   timeout: 600,
//   requirements: {
//     files: ['README.md', 'docs/'],
//     tools: ['grep', 'find']
//   },
//   handler: [Function],
//   metadata: {
//     registered: null,
//     version: '1.0.0'
//   }
// }

// With minimal metadata (defaults applied)
const minimal = createStepDefinition({
  id: 'step_simple',
  name: 'Simple Step',
  description: 'A simple step',
});
// => {
//   id: 'step_simple',
//   name: 'Simple Step',
//   description: 'A simple step',
//   phase: 'execution',
//   dependencies: [],
//   tags: [],
//   critical: false,
//   enabled: true,
//   timeout: 300,
//   requirements: {},
//   handler: undefined,
//   metadata: { registered: null, version: '1.0.0' }
// }

// Invalid metadata throws error
try {
  createStepDefinition({ name: 'Test' }); // Missing id and description
} catch (error) {
  console.error(error.message);
  // => "Invalid step metadata: id is required and must be a string, description is required and must be a string"
}
```

**Validation:** Uses `validateStepMetadata()` internally to ensure all fields are valid.

---

### `validateStepMetadata(metadata)`

Validates step metadata structure and values without creating a step definition.

**Parameters:**

- `metadata` (Object): Step metadata to validate

**Returns:** `Array<string>` - Array of validation error messages (empty if valid)

**Pure:** ✅ Yes - Deterministic, no side effects

**Example:**

```javascript
// Valid metadata
const valid = {
  id: 'step_01_test',
  name: 'Run Tests',
  description: 'Execute test suite',
  phase: 'testing',
  dependencies: ['step_00_analyze'],
  tags: ['test', 'quality'],
  critical: true,
  timeout: 900,
};

const errors = validateStepMetadata(valid);
// => [] (no errors)

// Invalid metadata
const invalid = {
  id: 'Step-01', // Invalid characters
  name: '', // Empty name
  phase: 'invalid-phase',
  dependencies: 'step_00', // Should be array
  tags: [123], // Tags must be strings
  critical: 'yes', // Must be boolean
  timeout: -100, // Must be positive
};

const errors2 = validateStepMetadata(invalid);
// => [
//   'id must contain only lowercase letters, numbers, and underscores',
//   'name is required and must be a string',
//   'description is required and must be a string',
//   'phase must be one of: analysis, validation, testing, quality, finalization, execution',
//   'dependencies must be an array',
//   'all tags must be strings',
//   'critical must be a boolean',
//   'timeout must be greater than 0'
// ]

// Missing required fields
const missing = {};
const errors3 = validateStepMetadata(missing);
// => [
//   'id is required and must be a string',
//   'name is required and must be a string',
//   'description is required and must be a string'
// ]
```

**Validation Rules:**

- **id** (required): Non-empty string, lowercase letters/numbers/underscores only
- **name** (required): Non-empty string
- **description** (required): Non-empty string
- **phase** (optional): One of: analysis, validation, testing, quality, finalization, execution
- **dependencies** (optional): Array of strings
- **tags** (optional): Array of strings
- **critical** (optional): Boolean
- **enabled** (optional): Boolean
- **timeout** (optional): Positive number
- **requirements** (optional): Object
- **handler** (optional): Function

---

### `matchStepRequirements(step, context)`

Checks if a step's requirements are met in the given execution context.

**Parameters:**

- `step` (Object): Step definition with requirements property
- `context` (Object): Execution context with available resources
  - `files` (Array<string>): Available files
  - `tools` (Array<string>): Available tools/commands
  - `config` (Object): Configuration values
  - `env` (Object): Environment variables

**Returns:** `Object` - Requirement check result

- `met` (boolean): True if all requirements met
- `missing` (Array<string>): Array of missing requirements

**Pure:** ✅ Yes - Deterministic, no side effects

**Example:**

```javascript
// Step with requirements
const step = {
  id: 'step_lint',
  name: 'Lint Code',
  requirements: {
    files: ['package.json', '.eslintrc.json'],
    tools: ['eslint', 'npm'],
    config: {
      linting_enabled: true,
    },
    env: ['NODE_ENV'],
  },
};

// Context with all requirements met
const contextMet = {
  files: ['package.json', '.eslintrc.json', 'src/index.js'],
  tools: ['eslint', 'npm', 'node'],
  config: {
    linting_enabled: true,
    test_coverage: 80,
  },
  env: {
    NODE_ENV: 'development',
    PATH: '/usr/bin',
  },
};

const result1 = matchStepRequirements(step, contextMet);
// => { met: true, missing: [] }

// Context with missing requirements
const contextMissing = {
  files: ['package.json'], // Missing .eslintrc.json
  tools: ['npm'], // Missing eslint
  config: {
    linting_enabled: false, // Wrong config value
  },
  env: {}, // Missing NODE_ENV
};

const result2 = matchStepRequirements(step, contextMissing);
// => {
//   met: false,
//   missing: [
//     'file:.eslintrc.json',
//     'tool:eslint',
//     'config:linting_enabled=true',
//     'env:NODE_ENV'
//   ]
// }

// Step with no requirements always matches
const simpleStep = { id: 'step_simple', requirements: {} };
const result3 = matchStepRequirements(simpleStep, {});
// => { met: true, missing: [] }

// Empty context
const result4 = matchStepRequirements(step, {});
// => {
//   met: false,
//   missing: [
//     'file:package.json',
//     'file:.eslintrc.json',
//     'tool:eslint',
//     'tool:npm',
//     'config:linting_enabled=true',
//     'env:NODE_ENV'
//   ]
// }
```

**Requirement Types:**

- **files**: Array of file paths that must exist
- **tools**: Array of command-line tools that must be available
- **config**: Object with key-value pairs that must match context config
- **env**: Array of environment variable names that must be set

---

### `groupStepsByPhase(steps)`

Groups steps by their workflow phase for organized execution.

**Parameters:**

- `steps` (Array<Object>): Array of step definitions

**Returns:** `Object` - Steps grouped by phase (6 categories)

**Pure:** ✅ Yes - Creates new object, no mutation

**Example:**

```javascript
const steps = [
  { id: 'step_00', phase: 'analysis', name: 'Analyze' },
  { id: 'step_01', phase: 'validation', name: 'Validate' },
  { id: 'step_02', phase: 'analysis', name: 'Review' },
  { id: 'step_03', phase: 'testing', name: 'Test' },
  { id: 'step_04', phase: 'quality', name: 'Lint' },
  { id: 'step_05', name: 'Custom' }, // No phase specified
];

const grouped = groupStepsByPhase(steps);
// => {
//   analysis: [
//     { id: 'step_00', phase: 'analysis', name: 'Analyze' },
//     { id: 'step_02', phase: 'analysis', name: 'Review' }
//   ],
//   validation: [
//     { id: 'step_01', phase: 'validation', name: 'Validate' }
//   ],
//   testing: [
//     { id: 'step_03', phase: 'testing', name: 'Test' }
//   ],
//   quality: [
//     { id: 'step_04', phase: 'quality', name: 'Lint' }
//   ],
//   finalization: [],
//   execution: [
//     { id: 'step_05', name: 'Custom' }  // Default phase
//   ]
// }

// Empty array
const emptyGroups = groupStepsByPhase([]);
// => {
//   analysis: [],
//   validation: [],
//   testing: [],
//   quality: [],
//   finalization: [],
//   execution: []
// }
```

**Phases:**

1. **analysis**: Documentation analysis, requirement gathering
2. **validation**: Schema validation, configuration checks
3. **testing**: Test execution, coverage reporting
4. **quality**: Linting, formatting, code quality checks
5. **finalization**: Cleanup, reporting, artifact generation
6. **execution**: Default phase for unspecified steps

---

### `filterStepsByTags(steps, tags)`

Filters steps that have ALL specified tags (AND logic).

**Parameters:**

- `steps` (Array<Object>): Array of step definitions
- `tags` (Array<string>): Tags to filter by (all must match)

**Returns:** `Array<Object>` - Filtered steps

**Pure:** ✅ Yes - Creates new array

**Example:**

```javascript
const steps = [
  { id: 'step_01', tags: ['docs', 'analysis', 'critical'] },
  { id: 'step_02', tags: ['docs', 'validation'] },
  { id: 'step_03', tags: ['test', 'quality'] },
  { id: 'step_04', tags: ['docs', 'analysis'] },
  { id: 'step_05', tags: [] },
];

// Single tag
const docSteps = filterStepsByTags(steps, ['docs']);
// => [step_01, step_02, step_04]

// Multiple tags (AND logic - all must match)
const docsAndAnalysis = filterStepsByTags(steps, ['docs', 'analysis']);
// => [step_01, step_04]

// All three tags
const criticalDocsAnalysis = filterStepsByTags(steps, ['docs', 'analysis', 'critical']);
// => [step_01]

// No matches
const noMatch = filterStepsByTags(steps, ['deploy']);
// => []

// Empty tags returns all steps
const allSteps = filterStepsByTags(steps, []);
// => [step_01, step_02, step_03, step_04, step_05]

// Tags without tag matches nothing
const untaggedSteps = filterStepsByTags(steps, ['any-tag']);
// => [] (step_05 has no tags)
```

**Behavior:**

- Empty tags array returns all steps (no filtering)
- All specified tags must be present on step (AND logic)
- Steps without tags property are treated as having empty tags
- Case-sensitive tag matching

---

### `filterStepsByEnabled(steps, enabledOnly = true)`

Filters steps by enabled status.

**Parameters:**

- `steps` (Array<Object>): Array of step definitions
- `enabledOnly` (boolean, optional): Only return enabled steps (default: true)

**Returns:** `Array<Object>` - Filtered steps

**Pure:** ✅ Yes - Creates new array

**Example:**

```javascript
const steps = [
  { id: 'step_01', enabled: true },
  { id: 'step_02', enabled: false },
  { id: 'step_03' }, // enabled is undefined (treated as enabled)
  { id: 'step_04', enabled: true },
  { id: 'step_05', enabled: false },
];

// Get only enabled steps (default)
const enabled = filterStepsByEnabled(steps);
// => [step_01, step_03, step_04]

const enabledExplicit = filterStepsByEnabled(steps, true);
// => [step_01, step_03, step_04]

// Get all steps (no filtering)
const all = filterStepsByEnabled(steps, false);
// => [step_01, step_02, step_03, step_04, step_05]
```

**Behavior:**

- `enabled: true` → included when `enabledOnly=true`
- `enabled: false` → excluded when `enabledOnly=true`
- `enabled: undefined` → treated as enabled (included)
- `enabledOnly=false` → returns all steps unchanged

---

### `findStepsByPhase(steps, phase)`

Finds all steps in a specific workflow phase.

**Parameters:**

- `steps` (Array<Object>): Array of step definitions
- `phase` (string): Phase to filter by

**Returns:** `Array<Object>` - Steps in the specified phase

**Pure:** ✅ Yes - Creates new array

**Example:**

```javascript
const steps = [
  { id: 'step_00', phase: 'analysis' },
  { id: 'step_01', phase: 'validation' },
  { id: 'step_02', phase: 'analysis' },
  { id: 'step_03', phase: 'testing' },
  { id: 'step_04', phase: 'analysis' },
];

const analysisSteps = findStepsByPhase(steps, 'analysis');
// => [step_00, step_02, step_04]

const validationSteps = findStepsByPhase(steps, 'validation');
// => [step_01]

const deploySteps = findStepsByPhase(steps, 'deployment');
// => []
```

**Comparison with `groupStepsByPhase()`:**

- `findStepsByPhase()` - Returns flat array for one phase
- `groupStepsByPhase()` - Returns object with all phases

---

### `sortStepsById(steps)`

Sorts steps by their ID using natural ordering (step_00, step_01, step_10, etc.).

**Parameters:**

- `steps` (Array<Object>): Array of step definitions

**Returns:** `Array<Object>` - Sorted steps (new array)

**Pure:** ✅ Yes - Creates new sorted array

**Example:**

```javascript
const steps = [
  { id: 'step_10_finalize' },
  { id: 'step_02_validate' },
  { id: 'step_01_analyze' },
  { id: 'step_15_deploy' },
  { id: 'step_05_test' },
];

const sorted = sortStepsById(steps);
// => [
//   { id: 'step_01_analyze' },
//   { id: 'step_02_validate' },
//   { id: 'step_05_test' },
//   { id: 'step_10_finalize' },
//   { id: 'step_15_deploy' }
// ]

// IDs without numbers sorted to end
const mixed = [
  { id: 'step_05_test' },
  { id: 'manual_step' },
  { id: 'step_01_analyze' },
  { id: 'custom_action' },
];

const sortedMixed = sortStepsById(mixed);
// => [
//   { id: 'step_01_analyze' },
//   { id: 'step_05_test' },
//   { id: 'manual_step' },      // Sorted to end (no number, uses 999)
//   { id: 'custom_action' }     // Sorted to end (no number, uses 999)
// ]
```

**Algorithm:**

- Extracts first numeric sequence from ID (e.g., `step_05_test` → 5)
- Sorts numerically by extracted number
- IDs without numbers use 999 as fallback (sorted to end)
- Natural ordering: 1, 2, 10, 11 (not 1, 10, 11, 2)

---

### `validateStepDependencies(steps)`

Validates that all step dependencies exist in the registry.

**Parameters:**

- `steps` (Array<Object>): Array of step definitions with dependencies

**Returns:** `Object` - Validation result

- `valid` (boolean): True if all dependencies exist
- `errors` (Array<string>): Array of error messages

**Pure:** ✅ Yes - Deterministic, no side effects

**Example:**

```javascript
// Valid dependencies
const validSteps = [
  { id: 'step_00', dependencies: [] },
  { id: 'step_01', dependencies: ['step_00'] },
  { id: 'step_02', dependencies: ['step_00', 'step_01'] },
];

const result1 = validateStepDependencies(validSteps);
// => { valid: true, errors: [] }

// Missing dependencies
const invalidSteps = [
  { id: 'step_00', dependencies: [] },
  { id: 'step_01', dependencies: ['step_00', 'step_missing'] },
  { id: 'step_02', dependencies: ['step_99'] },
];

const result2 = validateStepDependencies(invalidSteps);
// => {
//   valid: false,
//   errors: [
//     "Step 'step_01' depends on non-existent step 'step_missing'",
//     "Step 'step_02' depends on non-existent step 'step_99'"
//   ]
// }

// No dependencies (always valid)
const noDeps = [{ id: 'step_01' }, { id: 'step_02', dependencies: [] }];

const result3 = validateStepDependencies(noDeps);
// => { valid: true, errors: [] }
```

**Notes:**

- Only checks if dependencies exist (not circular dependencies)
- Use with `DependencyResolver` for circular dependency detection
- Returns all errors (doesn't stop at first)

---

## StepRegistry Class

Main registry class for managing workflow steps with state management and I/O.

### Constructor

```javascript
const registry = new StepRegistry();
```

**Parameters:** None

**Example:**

```javascript
import { StepRegistry } from 'ai_workflow.js/orchestrator/step_registry';

const registry = new StepRegistry();
// New empty registry created
```

---

### Methods

#### `register(stepId, definition)`

Registers a step in the registry.

**Parameters:**

- `stepId` (string): Unique step identifier
- `definition` (Object): Step definition (will be validated and enhanced)

**Returns:** `Object` - Validated and registered step definition

**Throws:** `ValidationError` - If step already exists or definition is invalid

**Side Effects:**

- Adds step to internal Map
- Tracks registration order
- Logs debug message

**Example:**

```javascript
const registry = new StepRegistry();

// Register a step
const step = registry.register('step_00_analyze', {
  name: 'Analyze Documentation',
  description: 'Analyzes project documentation',
  phase: 'analysis',
  tags: ['docs', 'analysis'],
  critical: true,
  handler: async (context) => {
    // Analysis logic
    return { success: true };
  },
});

// step.id === 'step_00_analyze'
// step.metadata.registered === <timestamp>

// Duplicate registration throws error
try {
  registry.register('step_00_analyze', {
    /* ... */
  });
} catch (error) {
  console.error(error.message);
  // => "Step 'step_00_analyze' is already registered"
}

// Invalid definition throws error
try {
  registry.register('invalid', { name: 'Test' }); // Missing description
} catch (error) {
  console.error(error.message);
  // => "Invalid step metadata: description is required and must be a string"
}
```

---

#### `update(stepId, updates)`

Updates an existing step definition with partial updates.

**Parameters:**

- `stepId` (string): Step identifier
- `updates` (Object): Partial step definition updates

**Returns:** `Object` - Updated step definition

**Throws:** `ValidationError` - If step doesn't exist or updates are invalid

**Side Effects:**

- Updates step in internal Map
- Logs debug message

**Example:**

```javascript
// Register initial step
registry.register('step_01', {
  name: 'Test Step',
  description: 'Initial description',
  timeout: 300,
});

// Update specific fields
const updated = registry.update('step_01', {
  description: 'Updated description',
  timeout: 600,
  tags: ['updated'],
});

// updated.description === 'Updated description'
// updated.timeout === 600
// updated.name === 'Test Step' (unchanged)

// Update non-existent step throws error
try {
  registry.update('step_missing', { timeout: 999 });
} catch (error) {
  console.error(error.message);
  // => "Step 'step_missing' not found"
}

// Invalid update throws error
try {
  registry.update('step_01', { timeout: -100 });
} catch (error) {
  console.error(error.message);
  // => "Invalid step metadata: timeout must be greater than 0"
}
```

---

#### `unregister(stepId)`

Unregisters (removes) a step from the registry.

**Parameters:**

- `stepId` (string): Step identifier

**Returns:** `boolean` - True if step was unregistered, false if not found

**Side Effects:**

- Removes step from internal Map
- Removes from registration order array
- Logs debug message

**Example:**

```javascript
registry.register('step_temp', {
  name: 'Temporary Step',
  description: 'Will be removed',
});

registry.has('step_temp'); // => true

const removed = registry.unregister('step_temp');
// => true

registry.has('step_temp'); // => false

// Unregister non-existent step returns false
const notFound = registry.unregister('step_missing');
// => false
```

---

#### `get(stepId)`

Gets a step definition by ID.

**Parameters:**

- `stepId` (string): Step identifier

**Returns:** `Object|null` - Step definition or null if not found

**Example:**

```javascript
registry.register('step_01', {
  name: 'Test Step',
  description: 'Test description',
});

const step = registry.get('step_01');
// => { id: 'step_01', name: 'Test Step', ... }

const missing = registry.get('step_missing');
// => null
```

---

#### `has(stepId)`

Checks if a step is registered.

**Parameters:**

- `stepId` (string): Step identifier

**Returns:** `boolean` - True if step exists

**Example:**

```javascript
registry.register('step_01', {
  name: 'Test',
  description: 'Test',
});

registry.has('step_01'); // => true
registry.has('step_missing'); // => false
```

---

#### `list(filter = {})`

Lists all steps with optional filtering and sorting.

**Parameters:**

- `filter` (Object, optional): Filter options
  - `phase` (string): Filter by phase
  - `tags` (Array<string>): Filter by tags (all must match)
  - `enabledOnly` (boolean): Only enabled steps (default: true)

**Returns:** `Array<Object>` - Filtered and sorted step definitions

**Example:**

```javascript
// Register multiple steps
registry.register('step_00', {
  name: 'Analyze',
  description: 'Analyze docs',
  phase: 'analysis',
  tags: ['docs'],
  enabled: true,
});

registry.register('step_01', {
  name: 'Test',
  description: 'Run tests',
  phase: 'testing',
  tags: ['test', 'quality'],
  enabled: true,
});

registry.register('step_02', {
  name: 'Lint',
  description: 'Lint code',
  phase: 'quality',
  tags: ['quality'],
  enabled: false,
});

// List all enabled steps (default)
const allEnabled = registry.list();
// => [step_00, step_01] (sorted by ID, step_02 excluded)

// Filter by phase
const testingSteps = registry.list({ phase: 'testing' });
// => [step_01]

// Filter by tags
const qualitySteps = registry.list({ tags: ['quality'] });
// => [step_01] (step_02 excluded because disabled)

// Include disabled steps
const allSteps = registry.list({ enabledOnly: false });
// => [step_00, step_01, step_02]

// Combine filters
const disabledQuality = registry.list({
  tags: ['quality'],
  enabledOnly: false,
});
// => [step_01, step_02]
```

---

#### `getByPhase()`

Gets all steps grouped by workflow phase.

**Parameters:** None

**Returns:** `Object` - Steps grouped by phase (6 categories)

**Example:**

```javascript
registry.register('step_00', {
  name: 'Analyze',
  description: 'Analyze',
  phase: 'analysis',
});

registry.register('step_01', {
  name: 'Test',
  description: 'Test',
  phase: 'testing',
});

const grouped = registry.getByPhase();
// => {
//   analysis: [step_00],
//   validation: [],
//   testing: [step_01],
//   quality: [],
//   finalization: [],
//   execution: []
// }
```

---

#### `getInOrder()`

Gets steps in registration order (not dependency order).

**Parameters:** None

**Returns:** `Array<Object>` - Steps in registration order

**Example:**

```javascript
registry.register('step_03', { name: 'Third', description: 'Third' });
registry.register('step_01', { name: 'First', description: 'First' });
registry.register('step_02', { name: 'Second', description: 'Second' });

const inOrder = registry.getInOrder();
// => [step_03, step_01, step_02] (registration order)

const sorted = registry.list();
// => [step_01, step_02, step_03] (sorted by ID)
```

---

#### `validateAll()`

Validates all registered steps and their dependencies.

**Parameters:** None

**Returns:** `Object` - Validation result

- `valid` (boolean): True if all steps valid
- `errors` (Array<string>): Array of validation errors

**Side Effects:**

- Logs warning if validation fails
- Logs debug if validation passes

**Example:**

```javascript
registry.register('step_00', {
  name: 'First',
  description: 'First step',
  dependencies: [],
});

registry.register('step_01', {
  name: 'Second',
  description: 'Second step',
  dependencies: ['step_00'],
});

const result = registry.validateAll();
// => { valid: true, errors: [] }

// Add step with invalid dependency
registry.register('step_02', {
  name: 'Third',
  description: 'Third step',
  dependencies: ['step_missing'],
});

const result2 = registry.validateAll();
// => {
//   valid: false,
//   errors: ["Step 'step_02' depends on non-existent step 'step_missing'"]
// }
```

---

#### `checkRequirements(stepId, context)`

Checks if a step's requirements are met in the execution context.

**Parameters:**

- `stepId` (string): Step identifier
- `context` (Object): Execution context with resources

**Returns:** `Object` - Requirement check result

- `met` (boolean): True if requirements met
- `missing` (Array<string>): Missing requirements

**Throws:** `ValidationError` - If step doesn't exist

**Example:**

```javascript
registry.register('step_lint', {
  name: 'Lint Code',
  description: 'Run ESLint',
  requirements: {
    files: ['.eslintrc.json'],
    tools: ['eslint'],
    config: { linting: true },
  },
});

// Check with complete context
const result1 = registry.checkRequirements('step_lint', {
  files: ['.eslintrc.json', 'package.json'],
  tools: ['eslint', 'npm'],
  config: { linting: true },
});
// => { met: true, missing: [] }

// Check with incomplete context
const result2 = registry.checkRequirements('step_lint', {
  files: ['package.json'],
  tools: ['npm'],
});
// => {
//   met: false,
//   missing: ['file:.eslintrc.json', 'tool:eslint', 'config:linting=true']
// }

// Non-existent step throws error
try {
  registry.checkRequirements('step_missing', {});
} catch (error) {
  console.error(error.message);
  // => "Step 'step_missing' not found"
}
```

---

#### `clear()`

Clears all registered steps from the registry.

**Parameters:** None

**Returns:** `void`

**Side Effects:**

- Clears internal Map
- Resets registration order
- Logs debug message

**Example:**

```javascript
registry.register('step_01', { name: 'Test', description: 'Test' });
registry.register('step_02', { name: 'Test2', description: 'Test2' });

registry.list().length; // => 2

registry.clear();

registry.list().length; // => 0
registry.has('step_01'); // => false
```

---

#### `getStats()`

Gets registry statistics and summary information.

**Parameters:** None

**Returns:** `Object` - Statistics object

- `total` (number): Total steps
- `enabled` (number): Enabled steps
- `disabled` (number): Disabled steps
- `critical` (number): Critical steps
- `byPhase` (Object): Count per phase

**Example:**

```javascript
registry.register('step_00', {
  name: 'Analyze',
  description: 'Analyze',
  phase: 'analysis',
  critical: true,
  enabled: true,
});

registry.register('step_01', {
  name: 'Test',
  description: 'Test',
  phase: 'testing',
  enabled: true,
});

registry.register('step_02', {
  name: 'Deploy',
  description: 'Deploy',
  phase: 'finalization',
  critical: true,
  enabled: false,
});

const stats = registry.getStats();
// => {
//   total: 3,
//   enabled: 2,
//   disabled: 1,
//   critical: 2,
//   byPhase: {
//     analysis: 1,
//     validation: 0,
//     testing: 1,
//     quality: 0,
//     finalization: 1,
//     execution: 0
//   }
// }
```

---

#### `loadStepsFromDirectory(dir)`

Loads steps from a directory (future implementation).

**Parameters:**

- `dir` (string): Directory path

**Throws:** `SystemError` - Not yet implemented

**Example:**

```javascript
try {
  registry.loadStepsFromDirectory('./steps');
} catch (error) {
  console.error(error.message);
  // => "loadStepsFromDirectory not yet implemented: ./steps"
}
```

---

## Usage Examples

### Basic Step Registration

```javascript
import { StepRegistry } from 'ai_workflow.js/orchestrator/step_registry';

// Create registry
const registry = new StepRegistry();

// Register steps
registry.register('step_00_analyze', {
  name: 'Analyze Documentation',
  description: 'Analyzes project documentation for completeness',
  phase: 'analysis',
  tags: ['docs', 'analysis'],
  critical: true,
  timeout: 600,
  handler: async (context) => {
    // Analysis logic
    return { success: true, findings: [] };
  },
});

registry.register('step_01_validate', {
  name: 'Validate Configuration',
  description: 'Validates project configuration files',
  phase: 'validation',
  dependencies: ['step_00_analyze'],
  tags: ['config', 'validation'],
  timeout: 300,
  handler: async (context) => {
    // Validation logic
    return { success: true, valid: true };
  },
});

// Check if step exists
if (registry.has('step_00_analyze')) {
  const step = registry.get('step_00_analyze');
  console.log(`Found step: ${step.name}`);
}

// List all steps
const allSteps = registry.list();
console.log(`Registered ${allSteps.length} steps`);
```

---

### Advanced Filtering and Querying

```javascript
const registry = new StepRegistry();

// Register multiple steps with various attributes
registry.register('step_00', {
  name: 'Analyze',
  description: 'Analyze',
  phase: 'analysis',
  tags: ['docs', 'critical'],
  critical: true,
});

registry.register('step_01', {
  name: 'Test',
  description: 'Test',
  phase: 'testing',
  tags: ['test', 'quality'],
});

registry.register('step_02', {
  name: 'Lint',
  description: 'Lint',
  phase: 'quality',
  tags: ['quality', 'style'],
  enabled: false,
});

// Filter by phase
const analysisSteps = registry.list({ phase: 'analysis' });
console.log('Analysis steps:', analysisSteps.length);

// Filter by tags
const qualitySteps = registry.list({ tags: ['quality'] });
console.log('Quality steps:', qualitySteps.length);

// Include disabled steps
const allSteps = registry.list({ enabledOnly: false });
console.log('All steps (including disabled):', allSteps.length);

// Get steps grouped by phase
const byPhase = registry.getByPhase();
console.log('Testing phase:', byPhase.testing.length);

// Get registry statistics
const stats = registry.getStats();
console.log(`Total: ${stats.total}, Enabled: ${stats.enabled}, Critical: ${stats.critical}`);
```

---

### Requirement Checking

```javascript
const registry = new StepRegistry();

// Register step with requirements
registry.register('step_lint', {
  name: 'Lint Code',
  description: 'Run ESLint on codebase',
  phase: 'quality',
  requirements: {
    files: ['.eslintrc.json', 'package.json'],
    tools: ['eslint', 'npm'],
    config: {
      linting_enabled: true,
      project_type: 'nodejs',
    },
    env: ['NODE_ENV'],
  },
  handler: async (context) => {
    // Linting logic
  },
});

// Prepare execution context
const context = {
  files: ['.eslintrc.json', 'package.json', 'src/index.js'],
  tools: ['eslint', 'npm', 'node'],
  config: {
    linting_enabled: true,
    project_type: 'nodejs',
    test_coverage: 80,
  },
  env: {
    NODE_ENV: 'development',
    PATH: '/usr/bin',
  },
};

// Check if requirements are met
const reqCheck = registry.checkRequirements('step_lint', context);

if (reqCheck.met) {
  console.log('All requirements met, ready to execute');
} else {
  console.error('Missing requirements:', reqCheck.missing);
  // => [] (all requirements met in this case)
}

// Check with incomplete context
const incompleteContext = {
  files: ['package.json'],
  tools: ['npm'],
};

const reqCheck2 = registry.checkRequirements('step_lint', incompleteContext);
console.log('Missing:', reqCheck2.missing);
// => ['file:.eslintrc.json', 'tool:eslint', 'config:linting_enabled=true', ...]
```

---

### Dependency Validation

```javascript
const registry = new StepRegistry();

// Register steps with dependencies
registry.register('step_00', {
  name: 'Initialize',
  description: 'Initialize workflow',
  dependencies: [],
});

registry.register('step_01', {
  name: 'Analyze',
  description: 'Analyze code',
  dependencies: ['step_00'],
});

registry.register('step_02', {
  name: 'Generate',
  description: 'Generate artifacts',
  dependencies: ['step_00', 'step_01'],
});

// Validate all dependencies
const validation = registry.validateAll();

if (validation.valid) {
  console.log('All dependencies valid');
} else {
  console.error('Dependency errors:', validation.errors);
}

// Add step with invalid dependency
registry.register('step_03', {
  name: 'Deploy',
  description: 'Deploy application',
  dependencies: ['step_missing'],
});

const validation2 = registry.validateAll();
console.log('Valid:', validation2.valid);
// => false

console.log('Errors:', validation2.errors);
// => ["Step 'step_03' depends on non-existent step 'step_missing'"]
```

---

### Dynamic Step Updates

```javascript
const registry = new StepRegistry();

// Register initial step
registry.register('step_01', {
  name: 'Test Step',
  description: 'Initial description',
  phase: 'testing',
  timeout: 300,
  enabled: true,
});

console.log('Initial timeout:', registry.get('step_01').timeout);
// => 300

// Update timeout for long-running test
registry.update('step_01', {
  timeout: 1800,
  tags: ['long-running'],
});

console.log('Updated timeout:', registry.get('step_01').timeout);
// => 1800

// Disable step temporarily
registry.update('step_01', {
  enabled: false,
});

console.log('Enabled:', registry.get('step_01').enabled);
// => false

// Re-enable step
registry.update('step_01', {
  enabled: true,
});
```

---

### Pure Function Usage

```javascript
import {
  createStepDefinition,
  validateStepMetadata,
  groupStepsByPhase,
  sortStepsById,
} from 'ai_workflow.js/orchestrator/step_registry';

// Validate metadata before creation
const metadata = {
  id: 'step_test',
  name: 'Test Step',
  description: 'Test description',
  phase: 'testing',
  timeout: 600,
};

const errors = validateStepMetadata(metadata);
if (errors.length === 0) {
  const step = createStepDefinition(metadata);
  console.log('Created step:', step.id);
}

// Group steps by phase
const steps = [
  { id: 'step_00', phase: 'analysis', name: 'Analyze' },
  { id: 'step_01', phase: 'testing', name: 'Test' },
  { id: 'step_02', phase: 'analysis', name: 'Review' },
];

const grouped = groupStepsByPhase(steps);
console.log('Analysis steps:', grouped.analysis.length);
// => 2

// Sort steps by ID
const unsorted = [{ id: 'step_10_deploy' }, { id: 'step_02_test' }, { id: 'step_05_build' }];

const sorted = sortStepsById(unsorted);
console.log('First step:', sorted[0].id);
// => 'step_02_test'
```

---

## Error Handling

### Validation Errors

```javascript
import { StepRegistry } from 'ai_workflow.js/orchestrator/step_registry';
import { ValidationError } from 'ai_workflow.js/utils/errors';

const registry = new StepRegistry();

// Invalid step ID (uppercase)
try {
  registry.register('STEP_01', {
    name: 'Test',
    description: 'Test',
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.message);
    // => "Invalid step metadata: id must contain only lowercase letters, numbers, and underscores"
  }
}

// Missing required fields
try {
  registry.register('step_02', {
    name: 'Test',
    // Missing description
  });
} catch (error) {
  console.error(error.message);
  // => "Invalid step metadata: description is required and must be a string"
}

// Invalid phase
try {
  registry.register('step_03', {
    name: 'Test',
    description: 'Test',
    phase: 'deployment', // Not a valid phase
  });
} catch (error) {
  console.error(error.message);
  // => "Invalid step metadata: phase must be one of: analysis, validation, testing, quality, finalization, execution"
}
```

---

### Duplicate Registration

```javascript
const registry = new StepRegistry();

registry.register('step_01', {
  name: 'First',
  description: 'First step',
});

// Try to register again
try {
  registry.register('step_01', {
    name: 'Duplicate',
    description: 'Duplicate step',
  });
} catch (error) {
  console.error(error.message);
  // => "Step 'step_01' is already registered"
}

// Solution: Use update() instead
registry.update('step_01', {
  name: 'Updated Name',
  description: 'Updated description',
});
```

---

### Missing Dependencies

```javascript
const registry = new StepRegistry();

registry.register('step_01', {
  name: 'First',
  description: 'First step',
  dependencies: ['step_00'], // Dependency doesn't exist
});

const validation = registry.validateAll();

if (!validation.valid) {
  console.error('Dependency errors found:');
  validation.errors.forEach((error) => {
    console.error('  -', error);
  });
  // => "Step 'step_01' depends on non-existent step 'step_00'"
}
```

---

### Unmet Requirements

```javascript
const registry = new StepRegistry();

registry.register('step_build', {
  name: 'Build',
  description: 'Build project',
  requirements: {
    tools: ['node', 'npm'],
    files: ['package.json'],
  },
});

const context = {
  tools: ['node'], // Missing npm
  files: [], // Missing package.json
};

const check = registry.checkRequirements('step_build', context);

if (!check.met) {
  console.error('Cannot execute step, missing:');
  check.missing.forEach((req) => {
    console.error('  -', req);
  });
  // => ['tool:npm', 'file:package.json']
}
```

---

## Related Modules

- **[workflow_engine](./workflow_engine.md)** - Main workflow execution engine
- **[dependency_resolver](./dependency_resolver.md)** - Resolves step dependencies and execution order
- **[step_executor](./step_executor.md)** - Executes individual steps with retry logic
- **[conditional_executor](./conditional_executor.md)** - Conditional step execution based on context
- **[checkpoint_manager](./checkpoint_manager.md)** - Checkpoint save/resume functionality

---

## Version History

- **2.0.0** (Current) - Referential transparency architecture
  - Pure functions extracted for all business logic
  - StepRegistry class for state management and I/O
  - Comprehensive validation and error handling
  - Flexible filtering and querying
  - Requirement matching against execution context
  - Registry statistics and reporting

---

**Last Updated:** January 29, 2026
**Module Version:** 2.0.0
