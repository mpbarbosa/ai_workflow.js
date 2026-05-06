# Dependency Resolver API

**Module:** `orchestrator/dependency_resolver`
**Version:** 2.3.0
**Architecture:** Referential Transparency (Pure Functions + Impure Wrapper)

## Overview

The Dependency Resolver provides dependency graph construction, topological sorting, circular dependency detection, and parallel execution group identification for workflow steps. It ensures steps execute in the correct order while maximizing parallelism.

### Key Features

- **Dependency Graph**: Build graph structures from step definitions
- **Topological Sorting**: Order steps respecting dependencies (Kahn's algorithm)
- **Cycle Detection**: Identify circular dependencies with path reporting
- **Parallel Grouping**: Identify steps that can run concurrently
- **Validation**: Validate all dependencies exist and are valid
- **Critical Path**: Calculate longest execution path through workflow
- **Parallelism Checking**: Determine if two specific steps can run together

### Architecture

**Pure Functions:**

- `buildDependencyGraph()` - Construct graph from step definitions
- `topologicalSort()` - Order steps using Kahn's algorithm
- `detectCircularDependencies()` - Find cycles with DFS
- `groupParallelSteps()` - Identify parallel execution groups
- `validateDependencies()` - Validate all dependencies exist
- `canRunInParallel()` - Check if two steps can run together
- `calculateCriticalPath()` - Find longest execution path

**Impure Wrapper:**

- `DependencyResolver` class - Dependency analysis and resolution with state management

---

## Installation

```javascript
import {
  DependencyResolver,
  buildDependencyGraph,
  topologicalSort,
  detectCircularDependencies,
  groupParallelSteps,
} from 'ai_workflow.js/orchestrator/dependency_resolver';
```

---

## Pure Functions

### `buildDependencyGraph(steps)`

Builds a dependency graph from step definitions with adjacency lists and in-degrees.

**Parameters:**

- `steps` (Array<Object>) - Array of step definitions with `id` and `dependencies`

**Returns:** Object with:

- `nodes` (Map) - stepId → step definition
- `edges` (Map) - stepId → array of dependent step IDs
- `inDegree` (Map) - stepId → number of dependencies

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const steps = [
  { id: 'step1', dependencies: [] },
  { id: 'step2', dependencies: ['step1'] },
  { id: 'step3', dependencies: ['step1'] },
];

const graph = buildDependencyGraph(steps);
console.log(graph.nodes.size); // 3
console.log(graph.inDegree.get('step2')); // 1
```

---

### `topologicalSort(graph)`

Performs topological sort on dependency graph using Kahn's algorithm. Returns steps in execution order with dependencies before dependents.

**Parameters:**

- `graph` (Object) - Dependency graph from `buildDependencyGraph()`

**Returns:** Array<string> - Ordered step IDs

**Throws:** `ValidationError` if circular dependency detected

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const graph = buildDependencyGraph(steps);
const order = topologicalSort(graph);
// => ['step1', 'step2', 'step3']
```

---

### `detectCircularDependencies(graph)`

Detects circular dependencies using depth-first search and returns the cycle path if found.

**Parameters:**

- `graph` (Object) - Dependency graph from `buildDependencyGraph()`

**Returns:** Object with:

- `hasCycle` (boolean) - True if cycle detected
- `cycle` (Array<string> | null) - Cycle path if found (e.g., `['step1', 'step2', 'step1']`)

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const result = detectCircularDependencies(graph);
if (result.hasCycle) {
  console.error(`Circular dependency: ${result.cycle.join(' -> ')}`);
}
```

---

### `groupParallelSteps(orderedStepIds, graph)`

Identifies steps that can run in parallel based on dependency constraints. Groups steps that have no mutual dependencies.

**Parameters:**

- `orderedStepIds` (Array<string>) - Ordered step IDs from `topologicalSort()`
- `graph` (Object) - Dependency graph

**Returns:** Array<Array<string>> - Array of parallel execution groups

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const groups = groupParallelSteps(['step1', 'step2', 'step3'], graph);
// => [['step1'], ['step2', 'step3']]
// step2 and step3 can run in parallel after step1
```

---

### `validateDependencies(graph)`

Validates that all dependencies in the graph are valid (no missing references, no self-dependencies).

**Parameters:**

- `graph` (Object) - Dependency graph

**Returns:** Object with:

- `valid` (boolean) - True if all dependencies valid
- `errors` (Array<string>) - Validation error messages

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const result = validateDependencies(graph);
if (!result.valid) {
  console.error('Invalid dependencies:', result.errors);
}
```

---

### `canRunInParallel(stepA, stepB, graph)`

Checks if two steps can run in parallel (no mutual dependencies).

**Parameters:**

- `stepA` (Object) - First step definition
- `stepB` (Object) - Second step definition
- `graph` (Object) - Dependency graph

**Returns:** boolean - True if steps can run in parallel

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const step1 = graph.nodes.get('step1');
const step2 = graph.nodes.get('step2');

if (canRunInParallel(step1, step2, graph)) {
  console.log('Can execute in parallel');
}
```

---

### `calculateCriticalPath(graph, stepDurations = {})`

Calculates the critical path (longest execution path) through the workflow.

**Parameters:**

- `graph` (Object) - Dependency graph
- `stepDurations` (Object) - Optional map of stepId → duration in seconds

**Returns:** Object with:

- `path` (Array<string>) - Critical path step IDs
- `duration` (number) - Total duration of critical path

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const durations = { step1: 10, step2: 20, step3: 15 };
const critical = calculateCriticalPath(graph, durations);
console.log(`Critical path: ${critical.path.join(' -> ')}`);
console.log(`Total duration: ${critical.duration}s`);
```

---

## DependencyResolver Class

Wrapper for dependency analysis and resolution with state management.

### Constructor

```javascript
const resolver = new DependencyResolver();
```

No parameters required. Initializes empty state.

---

### Methods

#### `analyze(steps)`

Analyzes step dependencies and builds complete dependency graph with validation.

**Parameters:**

- `steps` (Array<Object>) - Step definitions

**Returns:** Object with:

- `graph` (Object) - Dependency graph
- `order` (Array<string>) - Topologically sorted step IDs
- `groups` (Array<Array<string>>) - Parallel execution groups

**Throws:**

- `ValidationError` if circular dependencies found
- `ValidationError` if invalid dependencies exist

**Side Effects:**

- Updates internal state (`graph`, `orderedSteps`, `parallelGroups`)
- Logs debug information via `logger`

**Example:**

```javascript
const resolver = new DependencyResolver();
const result = resolver.analyze(steps);

console.log('Execution order:', result.order);
console.log('Parallel groups:', result.groups);
```

---

#### `resolve(steps, startStep = null)`

Resolves execution order, optionally starting from a specific step.

**Parameters:**

- `steps` (Array<Object>) - Step definitions
- `startStep` (string, optional) - Step ID to start from

**Returns:** Array<string> - Ordered step IDs for execution

**Throws:**

- `ValidationError` if startStep not found
- `ValidationError` if dependencies invalid

**Side Effects:**

- Calls `analyze()` if not already done
- Logs debug information

**Example:**

```javascript
// Get full execution order
const order = resolver.resolve(steps);

// Resume from specific step
const remaining = resolver.resolve(steps, 'step5');
```

---

#### `canRunInParallel(stepIdA, stepIdB)`

Checks if two steps can run in parallel.

**Parameters:**

- `stepIdA` (string) - First step ID
- `stepIdB` (string) - Second step ID

**Returns:** boolean - True if steps can run together

**Throws:**

- `ValidationError` if analysis not performed
- `ValidationError` if steps not found

**Example:**

```javascript
if (resolver.canRunInParallel('step2', 'step3')) {
  // Execute step2 and step3 concurrently
}
```

---

#### `getParallelGroups()`

Gets parallel execution groups from last analysis.

**Returns:** Array<Array<string>> - Parallel execution groups

**Throws:** `ValidationError` if analysis not performed

**Example:**

```javascript
const groups = resolver.getParallelGroups();
for (const group of groups) {
  console.log(`Parallel group: ${group.join(', ')}`);
}
```

---

#### `getCriticalPath(stepDurations = {})`

Calculates critical path through the workflow.

**Parameters:**

- `stepDurations` (Object) - Map of stepId → duration

**Returns:** Object with `path` and `duration`

**Throws:** `ValidationError` if analysis not performed

**Example:**

```javascript
const durations = { step1: 10, step2: 20, step3: 15 };
const critical = resolver.getCriticalPath(durations);
console.log(`Critical path will take ${critical.duration}s`);
```

---

#### `getDependentsOf(stepId)`

Gets all steps that depend on the specified step (directly or indirectly).

**Parameters:**

- `stepId` (string) - Step ID to check

**Returns:** Array<string> - Dependent step IDs

**Throws:** `ValidationError` if step not found or analysis not performed

**Example:**

```javascript
const dependents = resolver.getDependentsOf('step1');
console.log(`Steps depending on step1: ${dependents.join(', ')}`);
```

---

#### `getDependenciesOf(stepId)`

Gets all dependencies of the specified step (directly or indirectly).

**Parameters:**

- `stepId` (string) - Step ID to check

**Returns:** Array<string> - Dependency step IDs

**Throws:** `ValidationError` if step not found or analysis not performed

**Example:**

```javascript
const deps = resolver.getDependenciesOf('step5');
console.log(`Step5 depends on: ${deps.join(', ')}`);
```

---

## Usage Examples

### Basic Dependency Resolution

```javascript
import { DependencyResolver } from 'ai_workflow.js/orchestrator/dependency_resolver';

const steps = [
  { id: 'analyze', name: 'Analyze Code', dependencies: [] },
  { id: 'test', name: 'Run Tests', dependencies: ['analyze'] },
  { id: 'lint', name: 'Lint Code', dependencies: ['analyze'] },
  { id: 'build', name: 'Build', dependencies: ['test', 'lint'] },
];

const resolver = new DependencyResolver();
const result = resolver.analyze(steps);

console.log('Execution order:', result.order);
// => ['analyze', 'test', 'lint', 'build']

console.log('Parallel groups:', result.groups);
// => [['analyze'], ['test', 'lint'], ['build']]
```

### Detecting Circular Dependencies

```javascript
const stepsWithCycle = [
  { id: 'step1', dependencies: ['step3'] },
  { id: 'step2', dependencies: ['step1'] },
  { id: 'step3', dependencies: ['step2'] },
];

try {
  resolver.analyze(stepsWithCycle);
} catch (error) {
  console.error(error.message);
  // => "Circular dependency: step1 -> step3 -> step2 -> step1"
}
```

### Critical Path Analysis

```javascript
const durations = {
  analyze: 30,
  test: 120,
  lint: 45,
  build: 60,
};

const critical = resolver.getCriticalPath(durations);
console.log(`Critical path: ${critical.path.join(' -> ')}`);
console.log(`Estimated completion: ${critical.duration} seconds`);
// Critical path: analyze -> test -> build
// Estimated completion: 210 seconds
```

### Using Pure Functions Directly

```javascript
import {
  buildDependencyGraph,
  topologicalSort,
  groupParallelSteps,
} from 'ai_workflow.js/orchestrator/dependency_resolver';

const graph = buildDependencyGraph(steps);
const order = topologicalSort(graph);
const groups = groupParallelSteps(order, graph);

// Pure functions for testing or custom workflows
```

---

## Related Modules

- **workflow_engine** - Uses DependencyResolver for step ordering
- **step_executor** - Executes steps in resolved order
- **step_registry** - Provides step definitions for resolution
- **conditional_executor** - May skip steps affecting execution order

---

## Notes

- **Kahn's Algorithm**: Topological sort uses Kahn's algorithm (BFS-based)
- **Cycle Detection**: Uses depth-first search to find cycles
- **Parallelism**: Conservative approach - only parallel if no mutual dependencies
- **Critical Path**: Uses longest path algorithm from project scheduling
- **State Management**: DependencyResolver maintains internal state between calls

---

**Last Updated:** 2026-02-07
**Author:** AI Workflow Team
