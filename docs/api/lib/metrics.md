# Metrics Module API Documentation

**Module:** `lib/metrics`
**Version:** 2.3.0
**Architecture:** Pure Functions + Impure Wrapper (Referential Transparency)

## Overview

The Metrics module provides performance metrics collection and reporting with referential transparency. It tracks workflow execution times, step durations, success rates, and generates detailed metrics reports.

**Key Features:**

- ✅ Track workflow start/end times and duration
- ✅ Record individual step execution times
- ✅ Calculate success rates and completion statistics
- ✅ Generate JSON and human-readable metrics reports
- ✅ Support for incremental metrics updates
- ✅ Referentially transparent architecture (pure functions + impure wrapper)
- ✅ File-based metrics persistence

## Architecture

```
┌────────────────────────────────────┐
│  MetricsCollector Class (Impure)   │
│  - State management (Map, Object)  │
│  - Time injection                  │
│  - File I/O operations             │
│  - Logging side effects            │
└─────────────┬──────────────────────┘
              │ calls
              ▼
┌────────────────────────────────────┐
│  Pure Functions                    │
│  - formatISOTimestamp()            │
│  - calculate Duration()             │
│  - formatDuration()                │
│  - addStepTiming()                 │
│  - updateStepCounters()            │
│  - calculateSuccessRate()          │
│  - formatMetricsReport()           │
└────────────────────────────────────┘
```

## Key Pure Functions

### `formatISOTimestamp(epochMs)`

Convert epoch milliseconds to ISO timestamp string.

### `calculateDuration(startTime, endTime)`

Calculate duration between two timestamps in milliseconds.

### `formatDuration(ms)`

Format duration as human-readable string (e.g., "1m 30s", "500ms").

### `addStepTiming(timingMap, stepNumber, time)`

Immutably add step timing to timing map.

### `updateStepCounters(counters, status)`

Immutably update step success/failure/skip counters.

## MetricsCollector Class

### Constructor

```javascript
new MetricsCollector(workflowId, config);
```

### Methods

#### `startWorkflow()`

Record workflow start time.

#### `endWorkflow(status)`

Record workflow end time and status.

#### `recordStepStart(stepNum)`

Record step start time.

#### `recordStepEnd(stepNum, status)`

Record step end time and status.

#### `async saveMetrics()`

Save metrics to JSON file.

#### `generateReport()`

Generate human-readable metrics report.

## Usage Example

```javascript
import { MetricsCollector } from './lib/metrics.js';

const metrics = new MetricsCollector('workflow-001', {
  metricsDir: '.ai_workflow/metrics',
  formatDuration: true,
});

// Start workflow
metrics.startWorkflow();

// Track step execution
metrics.recordStepStart(1);
// ... step execution ...
metrics.recordStepEnd(1, 'passed');

// End workflow
metrics.endWorkflow('success');

// Save and report
await metrics.saveMetrics();
const report = metrics.generateReport();
console.log(report);
```

## Metrics Output

Example metrics JSON:

```json
{
  "workflowId": "workflow-001",
  "startTime": 1706576169000,
  "endTime": 1706576189000,
  "duration": 20000,
  "status": "success",
  "steps": {
    "1": { "start": 1706576169000, "end": 1706576172000, "duration": 3000, "status": "passed" },
    "2": { "start": 1706576172000, "end": 1706576175000, "duration": 3000, "status": "passed" }
  },
  "counters": {
    "stepsCompleted": 2,
    "stepsFailed": 0,
    "stepsSkipped": 0
  },
  "successRate": 100.0
}
```

## Related Modules

- [backlog](./backlog.md) - Workflow summary reporting
- [session_manager](./session_manager.md) - Session lifecycle management

## See Also

- Source: `src/lib/metrics.js` (475 LOC)
- Tests: `test/lib/metrics.test.js` (174 tests)
- Architecture: [Referential Transparency](../../architecture/DESIGN_PRINCIPLES.md)
