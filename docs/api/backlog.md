# backlog - Workflow Reporting Module

**Module:** `lib/backlog`  
**Version:** 2.0.0  
**Type:** Pure Functions + Wrapper

## Overview

Workflow summary and backlog report generation with markdown formatting. All core logic is referentially transparent.

---

## Pure Functions

### `getStatusEmoji(status)`

Get emoji for step status.

**Parameters:** `status` (string) - 'passed', 'failed', 'skipped', 'running', 'pending'

**Returns:** string - Emoji (`✅`, `❌`, `⏭️`, `▶️`, `⏸️`)

### `formatExecutionMode(executionMode)`

Format execution mode for display.

**Returns:** 'Automatic', 'Interactive', 'Dry Run', or 'Unknown'

### `buildStepStatusList(workflowStatus, totalSteps)`

Build markdown list of step statuses.

**Example:**

```javascript
const statusList = buildStepStatusList(workflowStatus, 15);
// Returns:
// - **Step 0:** ✅
// - **Step 1:** ✅
// - **Step 2:** ❌
```

### `generateSummaryContent(options)`

Generate complete workflow summary markdown.

**Parameters:** Object with:

- `metadata` - Workflow metadata
- `executionMode` - Execution settings
- `workflowStatus` - Step statuses map
- `analysisContext` - Analysis data
- `timestamp` - Formatted timestamp

**Returns:** string - Complete markdown report

---

## Backlog Class

Wrapper for file I/O operations.

**Methods:**

- `generateSummary(options)` - Create and save summary
- `getSummaryPath()` - Get summary file path

---

## Usage Examples

### Generate Summary

```javascript
import { Backlog } from './lib/backlog.js';

const backlog = new Backlog(fileOps, paths);

await backlog.generateSummary({
  metadata,
  executionMode,
  workflowStatus,
  analysisContext,
  timestamp: generateTimestamp(new Date()),
});
```

### Using Pure Functions

```javascript
import { getStatusEmoji, formatExecutionMode } from './lib/backlog.js';

console.log(getStatusEmoji('passed')); // ✅
console.log(formatExecutionMode({ auto: true })); // 'Automatic'
```

---

## Report Format

Generated reports include:

- Workflow run ID and timestamp
- Execution mode
- Step status list with emojis
- Change analysis (commits, files)
- Execution summary

---

**Last Updated:** 2026-02-01  
**Part of:** AI Workflow Automation v1.0.0
