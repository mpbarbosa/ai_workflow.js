# Backlog Module API Documentation

**Module:** `lib/backlog`
**Version:** 2.0.0
**Architecture:** Pure Functions + Impure Wrapper (Referential Transparency)

## Overview

The Backlog module provides workflow summary and backlog report generation capabilities with referential transparency. It separates pure content generation functions from impure I/O operations.

**Key Features:**

- ✅ Generate workflow execution summaries
- ✅ Create individual step reports
- ✅ List workflow runs
- ✅ Referentially transparent architecture (pure functions + impure wrapper)
- ✅ Markdown report generation
- ✅ Status emoji mapping

## Architecture

```
┌────────────────────────────────────┐
│  Backlog Class (Impure Wrapper)    │
│  - File I/O operations             │
│  - Timestamp injection             │
│  - Directory creation              │
└─────────────┬──────────────────────┘
              │ calls
              ▼
┌────────────────────────────────────┐
│  Pure Functions                    │
│  - generateSummaryContent()        │
│  - generateStepReportContent()     │
│  - buildStepStatusList()           │
│  - getStatusEmoji()                │
└────────────────────────────────────┘
```

## Pure Functions

### `getStatusEmoji(status)`

Get emoji representation for step status.

**Parameters:**

- `status` (string): Step status (`passed`, `failed`, `skipped`, `running`, `pending`)

**Returns:** `string` - Emoji representation

**Examples:**

```javascript
import { getStatusEmoji } from './lib/backlog.js';

getStatusEmoji('passed'); // '✅'
getStatusEmoji('failed'); // '❌'
getStatusEmoji('skipped'); // '⏭️'
getStatusEmoji('running'); // '▶️'
getStatusEmoji('pending'); // '⏸️'
getStatusEmoji('unknown'); // '⏭️' (default)
```

**Properties:**

- ✅ Referentially transparent
- ✅ Deterministic (same input → same output)
- ✅ No side effects

---

### `formatExecutionMode(executionMode)`

Format execution mode settings for display.

**Parameters:**

- `executionMode` (Object): Execution mode settings
  - `auto` (boolean): Automatic mode
  - `interactive` (boolean): Interactive mode
  - `dryRun` (boolean): Dry run mode

**Returns:** `string` - Formatted mode string

**Examples:**

```javascript
import { formatExecutionMode } from './lib/backlog.js';

formatExecutionMode({ auto: true }); // 'Automatic'
formatExecutionMode({ interactive: true }); // 'Interactive'
formatExecutionMode({ dryRun: true }); // 'Dry Run'
formatExecutionMode({}); // 'Unknown'
```

**Properties:**

- ✅ Referentially transparent
- ✅ Deterministic
- ✅ No side effects

---

### `buildStepStatusList(workflowStatus, totalSteps)`

Build markdown list of step statuses.

**Parameters:**

- `workflowStatus` (Map): Step statuses map (key: step number, value: status object)
- `totalSteps` (number, optional): Total number of steps (default: 15)

**Returns:** `string` - Markdown formatted list

**Examples:**

```javascript
import { buildStepStatusList } from './lib/backlog.js';

const workflowStatus = new Map([
  [0, { status: 'passed' }],
  [1, { status: 'failed' }],
  [2, { status: 'skipped' }],
]);

const markdown = buildStepStatusList(workflowStatus, 3);
// Output:
// - **Step 0:** ✅
// - **Step 1:** ❌
// - **Step 2:** ⏭️
```

**Properties:**

- ✅ Referentially transparent
- ✅ Deterministic
- ✅ Immutable (doesn't modify input)

---

### `buildChangeAnalysisSection(analysisContext)`

Build markdown section for change analysis.

**Parameters:**

- `analysisContext` (Object): Analysis context
  - `changeScope` (string): Change scope description
  - `commits` (number|string): Number of commits ahead
  - `modified` (number|string): Number of modified files

**Returns:** `string` - Markdown formatted section

**Examples:**

```javascript
import { buildChangeAnalysisSection } from './lib/backlog.js';

const analysisContext = {
  changeScope: 'full_codebase',
  commits: 5,
  modified: 12,
};

const markdown = buildChangeAnalysisSection(analysisContext);
// Output:
// - **Change Scope:** full_codebase
// - **Commits Ahead:** 5
// - **Modified Files:** 12
```

**Properties:**

- ✅ Referentially transparent
- ✅ Handles missing fields gracefully

---

### `generateSummaryContent(options)`

Generate complete workflow summary content.

**Parameters:**

- `options` (Object): Summary options
  - `metadata` (Object): Workflow metadata
    - `workflowRunId` (string): Workflow run ID
    - `scriptVersion` (string): Script version
    - `scriptName` (string): Script name
    - `totalSteps` (number): Total steps in workflow
  - `executionMode` (Object): Execution mode settings
  - `workflowStatus` (Map): Step statuses
  - `analysisContext` (Object): Analysis context
  - `timestamp` (string): Formatted timestamp

**Returns:** `string` - Complete markdown document

**Examples:**

```javascript
import { generateSummaryContent } from './lib/backlog.js';

const options = {
  metadata: {
    workflowRunId: 'wf-20260207-170230',
    scriptVersion: '1.0.0',
    scriptName: 'ai_workflow',
    totalSteps: 15,
  },
  executionMode: { auto: true },
  workflowStatus: new Map([
    [0, { status: 'passed' }],
    [1, { status: 'passed' }],
  ]),
  analysisContext: {
    changeScope: 'full_codebase',
    commits: 3,
    modified: 8,
  },
  timestamp: '2026-02-07 17:02:30',
};

const summary = generateSummaryContent(options);
// Returns complete markdown document with workflow summary
```

**Properties:**

- ✅ Referentially transparent
- ✅ Composes multiple pure functions
- ✅ Deterministic given timestamp

---

### `generateStepReportContent(stepNumber, reportData, timestamp)`

Generate individual step report content.

**Parameters:**

- `stepNumber` (number): Step number
- `reportData` (Object): Report data
  - `name` (string): Step name
  - `status` (string): Step status
  - `summary` (string): Summary text
  - `details` (string): Detailed findings
- `timestamp` (string): Formatted timestamp

**Returns:** `string` - Markdown document

**Examples:**

```javascript
import { generateStepReportContent } from './lib/backlog.js';

const reportData = {
  name: 'Documentation Validation',
  status: 'passed',
  summary: 'All documentation files validated successfully',
  details: 'Checked 42 files, found 0 issues',
};

const report = generateStepReportContent(0, reportData, '2026-02-07 17:02:30');
// Returns markdown document with step report
```

**Properties:**

- ✅ Referentially transparent
- ✅ Handles missing fields gracefully

---

## Impure Wrapper Class

### `class Backlog`

Wrapper class that isolates I/O operations and manages backlog state.

#### Constructor

```javascript
import { Backlog } from './lib/backlog.js';
import { Config } from './lib/config.js';

const config = new Config({ projectRoot: '/path/to/project' });
const backlog = new Backlog(config);
```

**Parameters:**

- `config` (Config): Configuration instance

---

#### `async createWorkflowSummary(options)`

Create workflow summary file for a completed run.

**Parameters:**

- `options` (Object):
  - `workflowStatus` (Map): Step statuses
  - `analysisContext` (Object): Analysis context
  - `dryRun` (boolean, optional): Dry run mode (default: false)

**Returns:** `Promise<string>` - Path to created summary file

**Side Effects:**

- 📁 Creates directory if it doesn't exist
- 📝 Writes summary file to disk
- 🕐 Injects current timestamp

**Examples:**

```javascript
const backlog = new Backlog(config);

const workflowStatus = new Map([
  [0, { status: 'passed' }],
  [1, { status: 'failed' }],
]);

const analysisContext = {
  changeScope: 'full_codebase',
  commits: 3,
  modified: 8,
};

// Create summary
const summaryPath = await backlog.createWorkflowSummary({
  workflowStatus,
  analysisContext,
});
console.log(`Summary created: ${summaryPath}`);

// Dry run (no file creation)
await backlog.createWorkflowSummary({
  workflowStatus,
  analysisContext,
  dryRun: true,
});
```

**Error Handling:**

- Throws filesystem errors if directory creation fails
- Throws write errors if file cannot be written

---

#### `async createStepReport(stepNumber, reportData)`

Create individual step report file.

**Parameters:**

- `stepNumber` (number): Step number (0-based)
- `reportData` (Object): Report data
  - `name` (string): Step name
  - `status` (string): Step status
  - `summary` (string): Summary text
  - `details` (string): Detailed findings

**Returns:** `Promise<string>` - Path to created report file

**Side Effects:**

- 📁 Creates directory if it doesn't exist
- 📝 Writes report file to disk
- 🕐 Injects current timestamp

**Examples:**

```javascript
const backlog = new Backlog(config);

const reportData = {
  name: 'Documentation Validation',
  status: 'passed',
  summary: 'All docs validated',
  details: 'Checked 42 files, 0 issues found',
};

const reportPath = await backlog.createStepReport(0, reportData);
// Creates: .ai_workflow/backlog/wf-20260207-170230/step_00.md
```

**File Naming:**

- Format: `step_NN.md` (where NN is zero-padded step number)
- Example: `step_00.md`, `step_01.md`, ..., `step_14.md`

---

#### `async listWorkflowRuns()`

List all workflow run IDs in the backlog directory.

**Returns:** `Promise<Array<string>>` - Array of workflow run directory names

**Side Effects:**

- 📁 Reads filesystem to list directories

**Examples:**

```javascript
const backlog = new Backlog(config);

const runs = await backlog.listWorkflowRuns();
console.log(runs);
// ['wf-20260207-170230', 'wf-20260206-140512', ...]
```

**Error Handling:**

- Returns empty array if backlog directory doesn't exist
- Throws on other filesystem errors

---

## Usage Patterns

### Basic Workflow Summary

```javascript
import { Backlog } from './lib/backlog.js';
import { Config } from './lib/config.js';

// Initialize
const config = new Config({ projectRoot: process.cwd() });
const backlog = new Backlog(config);

// Track workflow execution
const workflowStatus = new Map();
workflowStatus.set(0, { status: 'passed' });
workflowStatus.set(1, { status: 'passed' });
workflowStatus.set(2, { status: 'failed' });

const analysisContext = {
  changeScope: 'code_changes',
  commits: 2,
  modified: 5,
};

// Create summary
await backlog.createWorkflowSummary({
  workflowStatus,
  analysisContext,
});
```

### Creating Step Reports

```javascript
// Create individual step reports
for (let i = 0; i < 15; i++) {
  const status = workflowStatus.get(i);
  if (status) {
    await backlog.createStepReport(i, {
      name: `Step ${i}`,
      status: status.status,
      summary: status.message || 'No message',
      details: status.details || 'No details',
    });
  }
}
```

### Listing Previous Runs

```javascript
const backlog = new Backlog(config);
const runs = await backlog.listWorkflowRuns();

console.log(`Found ${runs.length} previous workflow runs:`);
runs.forEach((runId) => console.log(`  - ${runId}`));
```

### Dry Run Mode

```javascript
// Preview without creating files
await backlog.createWorkflowSummary({
  workflowStatus,
  analysisContext,
  dryRun: true,
});
// Logs: [DRY RUN] Would create workflow summary: ...
```

---

## File Structure

### Directory Layout

```
.ai_workflow/
└── backlog/
    ├── wf-20260207-170230/          # Workflow run directory
    │   ├── WORKFLOW_SUMMARY.md      # Main summary
    │   ├── step_00.md               # Step 0 report
    │   ├── step_01.md               # Step 1 report
    │   └── ...
    └── wf-20260206-140512/          # Previous run
        └── ...
```

### Summary File Format

```markdown
# Workflow Execution Summary

**Workflow Run ID:** wf-20260207-170230
**Execution Date:** 2026-02-07 17:02:30
**Script Version:** 1.0.0
**Mode:** Automatic

---

## Execution Overview

### Steps Completed

- **Step 0:** ✅
- **Step 1:** ✅
- **Step 2:** ❌
  ...

### Change Analysis

- **Change Scope:** code_changes
- **Commits Ahead:** 2
- **Modified Files:** 5

---

## Individual Step Reports

_Check the backlog directory for individual step reports._

---

**Generated by:** ai_workflow v1.0.0
```

---

## Testing

The module has comprehensive test coverage with separate tests for pure functions and integration:

**Pure Function Tests (deterministic):**

```javascript
describe('Backlog - Pure Functions', () => {
  test('getStatusEmoji is referentially transparent', () => {
    expect(getStatusEmoji('passed')).toBe('✅');
    expect(getStatusEmoji('passed')).toBe('✅'); // Always same
  });
});
```

**Integration Tests:**

```javascript
describe('Backlog Integration', () => {
  test('createWorkflowSummary creates file', async () => {
    const backlog = new Backlog(config);
    const path = await backlog.createWorkflowSummary({...});
    const exists = await fs.access(path).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });
});
```

**Test Coverage:** 100% (86 pure function tests + 88 integration tests)

---

## Dependencies

- `fs/promises` - File system operations
- `path` - Path manipulation
- `Config` - Configuration management

---

## Related Modules

- `lib/config` - Configuration management
- `lib/session_manager` - Session lifecycle
- `lib/metrics` - Performance metrics

---

## Best Practices

1. **Use Pure Functions for Testing:** Test content generation separately from I/O
2. **Inject Timestamps:** Always pass timestamps as parameters to pure functions
3. **Handle Missing Fields:** Use fallback values for optional report fields
4. **Enable Dry Run:** Test workflow without creating files
5. **Archive Old Runs:** Move completed workflow runs to archive directory

---

## Version History

- **v2.0.0** - Refactored to referential transparency architecture
- **v1.0.0** - Initial implementation

---

**Last Updated:** 2026-02-07
**Module Path:** `src/lib/backlog.js`
**Test Path:** `test/lib/backlog.test.js`
