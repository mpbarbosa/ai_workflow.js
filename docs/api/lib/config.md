# config.js API Documentation

**Module:** `lib/config`
**Version:** 2.3.1
**Architecture:** Pure functions + Wrapper class (Referential Transparency)

## Overview

The config module provides configuration management with YAML file support, schema validation, and referentially transparent design. Core logic is implemented as pure functions, with side effects isolated in the `Config` wrapper class.

## Installation

```javascript
import { Config, generateTimestamp, calculatePaths } from 'ai-workflow';
```

## Architecture Pattern

### Pure Functions (Exported for Testing)

```javascript
// Timestamp generation
export function generateTimestamp(date);
export function generateWorkflowRunId(timestamp);

// Path calculations
export function calculatePaths(projectRoot, workflowRunId);
export function calculateFilePaths(paths, workflowRunId);
```

### Impure Wrapper

```javascript
export class Config {
  // Handles side effects: file I/O, state management, logging
}
```

## API Reference

### Pure Functions

#### `generateTimestamp(date)`

Generate timestamp string from Date object (PURE).

**Parameters:**

- `date` (Date) - Date object to format

**Returns:** (string) Timestamp in format `YYYYMMDD_HHMMSS`

**Example:**

```javascript
const date = new Date('2026-02-01T12:30:45');
const timestamp = generateTimestamp(date);
// Returns: "20260201_123045"
```

#### `generateWorkflowRunId(timestamp)`

Generate workflow run ID from timestamp (PURE).

**Parameters:**

- `timestamp` (string) - Formatted timestamp

**Returns:** (string) Workflow run ID

**Example:**

```javascript
const timestamp = '20260201_123045';
const runId = generateWorkflowRunId(timestamp);
// Returns: "workflow_20260201_123045"
```

#### `calculatePaths(projectRoot, workflowRunId)`

Calculate all directory paths for workflow (PURE).

**Parameters:**

- `projectRoot` (string) - Project root directory path
- `workflowRunId` (string) - Workflow run ID

**Returns:** (Object) All directory paths

**Example:**

```javascript
const paths = calculatePaths('/path/to/project', 'workflow_20260201_123045');
// Returns: {
//   projectRoot: '/path/to/project',
//   srcDir: '/path/to/project/src',
//   docsDir: '/path/to/project/docs',
//   artifactDir: '/path/to/project/.ai_workflow',
//   backlogDir: '/path/to/project/.ai_workflow/backlog',
//   // ... more paths
// }
```

### Config Class

#### Constructor

```javascript
new Config(projectRoot);
```

**Parameters:**

- `projectRoot` (string, optional) - Project root directory (default: process.cwd())

**Example:**

```javascript
const config = new Config('/path/to/project');
// or
const config = new Config(); // Uses current directory
```

#### Properties

- `projectRoot` (string) - Project root directory
- `workflowRunId` (string) - Current workflow run ID
- `paths` (Object) - All directory paths
- `files` (Object) - All file paths

#### `initialize()`

Initialize configuration with timestamp and paths.

**Returns:** (void)

**Side Effects:**

- Generates timestamp (Date.now())
- Calculates all paths
- Logs initialization

**Example:**

```javascript
const config = new Config();
config.initialize();
console.log(config.workflowRunId); // "workflow_20260201_123045"
```

#### `getPaths()`

Get all directory paths.

**Returns:** (Object) Directory paths

**Example:**

```javascript
const paths = config.getPaths();
console.log(paths.logsDir); // "/path/to/project/.ai_workflow/logs"
```

#### `getFiles()`

Get all file paths.

**Returns:** (Object) File paths

**Example:**

```javascript
const files = config.getFiles();
console.log(files.summaryFile); // "/path/to/project/.ai_workflow/backlog/workflow_20260201_123045/summary.md"
```

## Usage Examples

### Basic Configuration Setup

```javascript
import { Config } from 'ai-workflow';

// Create and initialize configuration
const config = new Config('/my-project');
config.initialize();

// Access paths
const logsDir = config.paths.logsDir;
const summaryFile = config.files.summaryFile;

console.log(`Logs: ${logsDir}`);
console.log(`Summary: ${summaryFile}`);
```

### Using Pure Functions Directly

```javascript
import { generateTimestamp, calculatePaths } from 'ai-workflow';

// Pure functions are deterministic and testable
const date = new Date('2026-02-01T12:00:00');
const timestamp = generateTimestamp(date);
const runId = `workflow_${timestamp}`;

const paths = calculatePaths('/project', runId);
console.log(paths.artifactDir); // "/project/.ai_workflow"
```

### Testing Pure Functions

```javascript
import { generateTimestamp, generateWorkflowRunId } from 'ai-workflow';

// Tests are deterministic - no mocks needed!
describe('Pure Functions', () => {
  test('generateTimestamp is deterministic', () => {
    const date = new Date('2026-02-01T12:30:45');
    expect(generateTimestamp(date)).toBe('20260201_123045');
    expect(generateTimestamp(date)).toBe('20260201_123045'); // Always same
  });

  test('generateWorkflowRunId', () => {
    const timestamp = '20260201_123045';
    expect(generateWorkflowRunId(timestamp)).toBe('workflow_20260201_123045');
  });
});
```

### Integration Testing

```javascript
import { Config } from 'ai-workflow';

describe('Config Integration', () => {
  test('initialize generates unique run IDs', () => {
    const config1 = new Config();
    const config2 = new Config();

    config1.initialize();
    config2.initialize();

    // Non-deterministic (uses Date.now())
    expect(config1.workflowRunId).not.toBe(config2.workflowRunId);
  });
});
```

## Directory Structure

The config module manages the following directory structure:

```
.ai_workflow/
├── backlog/
│   └── workflow_YYYYMMDD_HHMMSS/
│       └── summary.md
├── summaries/
│   └── workflow_YYYYMMDD_HHMMSS/
│       └── step_*.md
├── logs/
│   └── workflow_YYYYMMDD_HHMMSS/
│       └── step_*.log
├── metrics/
│   └── metrics.json
├── checkpoints/
│   └── checkpoint_*.json
└── prompts/
    └── prompt_*.md
```

## Best Practices

### 1. Initialize Early

```javascript
const config = new Config();
config.initialize(); // Do this early in application startup
```

### 2. Use Pure Functions for Testing

```javascript
// Test logic separately from side effects
const timestamp = generateTimestamp(new Date());
const paths = calculatePaths('/project', `workflow_${timestamp}`);
// No file I/O needed for testing!
```

### 3. Access Paths Through Config

```javascript
// Good
const logsDir = config.paths.logsDir;

// Bad
const logsDir = path.join(projectRoot, '.ai_workflow', 'logs');
```

## Referential Transparency Benefits

- **Pure functions** are deterministic and easy to test
- **No mocks** needed for business logic tests
- **Side effects** (Date.now(), logging) isolated in wrapper
- **Predictable** behavior with same inputs

## Error Handling

- Pure functions do not throw errors (return values or null)
- Config may throw errors for invalid paths
- All errors include context for debugging

## Related Modules

- **[file_operations](./file_operations.md)** - Uses config paths for file operations
- **[session_manager](./session_manager.md)** - Uses config for session tracking
- **[metrics](./metrics.md)** - Uses config for metrics storage

## See Also

- [Architecture Overview](../../architecture/OVERVIEW.md)
- [Referential Transparency Guide](../../guides/REFERENTIAL_TRANSPARENCY.md)
- [Testing Guide](../../guides/TESTING_GUIDE.md)
