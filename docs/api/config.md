# config - Configuration Module

**Module:** `lib/config`  
**Version:** 2.0.0  
**Type:** Pure Functions + Wrapper

## Overview

Workflow configuration management with referential transparency. Provides path calculation, metadata generation, and configuration defaults.

---

## Pure Functions

### `generateTimestamp(date)`

Generate timestamp string from Date object.

**Parameters:** `date` (Date) - Date to format

**Returns:** `string` - Format: `YYYYMMDD_HHMMSS`

**Example:**

```javascript
generateTimestamp(new Date('2026-01-15T14:30:00'));
// '20260115_143000'
```

### `generateWorkflowRunId(timestamp)`

Generate workflow run ID.

**Returns:** `string` - Format: `workflow_{timestamp}`

### `calculatePaths(projectRoot, workflowRunId)`

Calculate all directory paths.

**Returns:** Object with:

- `projectRoot`, `srcDir`, `docsDir`
- `artifactDir`, `backlogDir`, `summariesDir`
- `logsDir`, `metricsDir`, `checkpointsDir`, `promptsDir`
- `backlogRunDir`, `summariesRunDir`, `logsRunDir`

**Example:**

```javascript
const paths = calculatePaths('/project', 'workflow_20260115_143000');
console.log(paths.artifactDir); // '/project/.ai_workflow'
```

### `createMetadata(scriptVersion, scriptName, workflowRunId, totalSteps, startTime)`

Create metadata object with workflow information.

---

## Config Class

Wrapper for I/O operations and configuration management.

**Constructor:**

```javascript
new Config(projectRoot);
```

**Methods:**

- `initialize()` - Set up directories and paths
- `getPath(key)` - Get specific path
- `getAllPaths()` - Get all calculated paths
- `getMetadata()` - Get workflow metadata

---

## Usage Examples

### Initialize Configuration

```javascript
import { Config } from './lib/config.js';

const config = new Config('/path/to/project');
await config.initialize();

const paths = config.getAllPaths();
console.log('Artifact directory:', paths.artifactDir);
```

### Using Pure Functions

```javascript
import { generateTimestamp, calculatePaths } from './lib/config.js';

const timestamp = generateTimestamp(new Date());
const paths = calculatePaths('/project', `workflow_${timestamp}`);
```

---

## Related Modules

- **[backlog](./backlog.md)** - Uses paths for report generation
- **[metrics](./metrics.md)** - Uses paths for metrics storage

---

**Last Updated:** 2026-02-01  
**Part of:** AI Workflow Automation v1.0.0
