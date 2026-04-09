# metrics - Metrics Collection Module

**Module:** `lib/metrics`
**Version:** 2.0.0
**Type:** Pure Functions + Wrapper

## Overview

Workflow metrics collection with referential transparency. Tracks duration, success rate, and step timing.

---

## Pure Functions

### `formatISOTimestamp(epochMs)`

Convert epoch time to ISO string.

### `convertToEpochSeconds(epochMs)`

Convert milliseconds to seconds.

### `getExecutionModeString(executionMode)`

Get mode string: 'dry-run', 'auto', 'interactive', 'unknown'.

### `calculateDuration(startTime, endTime)`

Calculate duration in milliseconds.

**Example:**

```javascript
const duration = calculateDuration(1000000, 1005000);
console.log(duration); // 5000
```

### `addStepTiming(timingMap, stepNumber, time)`

Add step timing (pure - returns new Map).

### `updateStepCounters(counters, status)`

Update step counters (pure - returns new object).

**Example:**

```javascript
let counters = { stepsCompleted: 0, stepsFailed: 0, stepsSkipped: 0 };
counters = updateStepCounters(counters, 'passed');
// { stepsCompleted: 1, stepsFailed: 0, stepsSkipped: 0 }
```

### `formatDuration(ms)`

Format duration for display.

**Example:**

```javascript
formatDuration(500); // '500ms'
formatDuration(5000); // '5.00s'
formatDuration(125000); // '2m 5s'
```

---

## Metrics Class

Wrapper for metrics collection and persistence.

**Methods:**

- `recordStepStart(stepNum)` - Record step start time
- `recordStepEnd(stepNum, status)` - Record step completion
- `getMetrics()` - Get all metrics
- `saveMetrics()` - Persist metrics to file

---

## Usage Examples

### Collecting Metrics

```javascript
import { Metrics } from './lib/metrics.js';

const metrics = new Metrics(fileOps, paths);

metrics.recordStepStart(0);
// ... execute step ...
metrics.recordStepEnd(0, 'passed');

await metrics.saveMetrics();
```

### Using Pure Functions

```javascript
import { calculateDuration, formatDuration } from './lib/metrics.js';

const start = Date.now();
// ... operation ...
const end = Date.now();

const duration = calculateDuration(start, end);
console.log(`Took ${formatDuration(duration)}`);
```

---

## Metrics Output

Saved metrics include:

- Total duration
- Step timings
- Success/failure counts
- Execution mode
- Timestamps

---

**Last Updated:** 2026-02-01
**Part of:** AI Workflow Automation v1.9.11
