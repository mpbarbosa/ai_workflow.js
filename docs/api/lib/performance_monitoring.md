# performance_monitoring — Real-time Performance Monitoring

**Module:** `src/lib/performance_monitoring.js`
**Version:** v2.4.0
**Phase:** 8 (Performance Optimization)
**Architecture:** Referential Transparency (Pure Functions + Impure Wrapper)

## Overview

Real-time performance monitoring with threshold-based alerts for workflow steps. Tracks duration and memory metrics, emits alerts when thresholds are exceeded, and integrates with the workflow execution engine.

**Key Features:**

- ⏱️ **Duration monitoring**: Warning and critical thresholds (configurable)
- 🧠 **Memory monitoring**: Heap usage tracking with 512 MB / 1 GB defaults
- 🚨 **Alert severity levels**: `info`, `warning`, `critical`
- 📈 **Trending window**: Rolling average over last 10 samples
- 🔗 **Integrates with** `performance.js` for metric collection

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  PerformanceMonitor (Impure Wrapper)                │
│  - Subscribes to step events                        │
│  - Logs alerts, emits events                        │
│  - Manages monitoring lifecycle                     │
└───────────────┬─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│  Pure Functions                                     │
│  - isDurationSlow()                                 │
│  - isMemoryHigh()                                   │
│  - determineAlertSeverity()                         │
│  - generateAlertMessage()                           │
└─────────────────────────────────────────────────────┘
```

## Installation

```javascript
import {
  PerformanceMonitor,
  DEFAULT_THRESHOLDS,
  ALERT_SEVERITY,
  isDurationSlow,
  isMemoryHigh,
  determineAlertSeverity,
  generateAlertMessage,
} from 'ai-workflow/lib/performance_monitoring';
```

## Constants

### `DEFAULT_THRESHOLDS`

Default alert thresholds:

```javascript
export const DEFAULT_THRESHOLDS = {
  DURATION_WARNING: 5000, // 5 seconds
  DURATION_CRITICAL: 30000, // 30 seconds
  MEMORY_WARNING: 536870912, // 512 MB (bytes)
  MEMORY_CRITICAL: 1073741824, // 1 GB (bytes)
  OPS_PER_SEC_MIN: 10,
  OPS_PER_SEC_WARNING: 5,
  TRENDING_WINDOW: 10, // samples for rolling average
};
```

### `ALERT_SEVERITY`

Alert severity level identifiers:

```javascript
export const ALERT_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
};
```

## Pure Functions

### `isDurationSlow(durationMs, thresholdMs)`

Check whether a duration exceeds a threshold.

**Parameters:**

- `durationMs` (number) - Measured duration in milliseconds
- `thresholdMs` (number) - Threshold in milliseconds

**Returns:** (boolean) `true` if `durationMs > thresholdMs`

**Example:**

```javascript
isDurationSlow(6000, 5000); // true  — exceeds warning threshold
isDurationSlow(3000, 5000); // false — within threshold
isDurationSlow('abc', 5000); // false — invalid input safe default
```

### `isMemoryHigh(memoryBytes, thresholdBytes)`

Check whether memory usage exceeds a threshold.

**Parameters:**

- `memoryBytes` (number) - Current memory usage in bytes
- `thresholdBytes` (number) - Threshold in bytes

**Returns:** (boolean) `true` if `memoryBytes > thresholdBytes`

**Example:**

```javascript
isMemoryHigh(600_000_000, DEFAULT_THRESHOLDS.MEMORY_WARNING); // true  (600 MB > 512 MB)
isMemoryHigh(100_000_000, DEFAULT_THRESHOLDS.MEMORY_WARNING); // false
```

### `determineAlertSeverity(metrics, thresholds)`

Determine the alert severity level from a metrics snapshot.

**Parameters:**

- `metrics` (Object) - Current metrics `{ duration?, memory? }`
  - `metrics.duration` (number, optional) - Duration in milliseconds
  - `metrics.memory` (Object, optional) - `{ heapUsed }` in MB
- `thresholds` (Object) - Threshold configuration (default: `DEFAULT_THRESHOLDS`)

**Returns:** (string) One of `ALERT_SEVERITY` values

**Example:**

```javascript
determineAlertSeverity({ duration: 35000 }, DEFAULT_THRESHOLDS);
// 'critical'  — exceeds 30s critical threshold

determineAlertSeverity({ duration: 8000 }, DEFAULT_THRESHOLDS);
// 'warning'   — exceeds 5s warning threshold

determineAlertSeverity({ duration: 2000 }, DEFAULT_THRESHOLDS);
// 'info'      — within all thresholds
```

### `generateAlertMessage(operationId, metrics, severity)`

Format a human-readable alert message.

**Parameters:**

- `operationId` (string) - Identifier for the operation being monitored
- `metrics` (Object) - `{ duration?, memory? }`
- `severity` (string) - Alert severity from `ALERT_SEVERITY`

**Returns:** (string) Formatted alert message

**Example:**

```javascript
generateAlertMessage(
  'step_01_documentation',
  { duration: 6000, memory: { heapUsed: 25 } },
  'warning'
);
// "[WARNING] Operation 'step_01_documentation' took 6.0s (memory: 25MB)"

generateAlertMessage('step_07_linting', { duration: 35000 }, 'critical');
// "[CRITICAL] Operation 'step_07_linting' took 35.0s"
```

## Wrapper Class

### `PerformanceMonitor`

Impure wrapper that hooks into workflow step events and emits real-time alerts.

**Constructor:**

```javascript
constructor((options = {}));
```

**Options:**

- `thresholds` (Object) - Override `DEFAULT_THRESHOLDS` fields
- `onAlert` (Function) - `(alert) => void` callback for alerts

**Methods:**

#### `startOperation(operationId)`

Begin monitoring an operation.

**Parameters:**

- `operationId` (string) - Unique identifier for the operation

**Returns:** (void)

#### `endOperation(operationId, metrics)`

End monitoring and evaluate thresholds.

**Parameters:**

- `operationId` (string) - Must match `startOperation` call
- `metrics` (Object) - `{ duration, memory }` snapshot

**Returns:** (Object | null) Alert object if a threshold was exceeded, else `null`

- `operationId` (string)
- `severity` (string)
- `message` (string)
- `metrics` (Object)
- `timestamp` (number)

#### `getAlertHistory()`

Retrieve all alerts emitted during this monitor's lifetime.

**Returns:** (Object[]) Array of alert objects in chronological order

## Usage Examples

### Basic Monitoring

```javascript
import { PerformanceMonitor, DEFAULT_THRESHOLDS } from 'ai-workflow/lib/performance_monitoring';

const monitor = new PerformanceMonitor({
  thresholds: DEFAULT_THRESHOLDS,
  onAlert: (alert) => {
    console.warn(`[${alert.severity.toUpperCase()}] ${alert.message}`);
  },
});

monitor.startOperation('doc-validation');

// ... run validation ...

const memUsage = process.memoryUsage();
const alert = monitor.endOperation('doc-validation', {
  duration: 8500,
  memory: { heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) },
});

if (alert) {
  console.warn('Threshold exceeded:', alert);
}
```

### Custom Thresholds

```javascript
const monitor = new PerformanceMonitor({
  thresholds: {
    ...DEFAULT_THRESHOLDS,
    DURATION_WARNING: 2000, // stricter: warn after 2s
    DURATION_CRITICAL: 10000, // stricter: critical after 10s
  },
});
```

### Pure Function Testing

```javascript
import {
  isDurationSlow,
  determineAlertSeverity,
  ALERT_SEVERITY,
} from 'ai-workflow/lib/performance_monitoring';

test('flags slow operations', () => {
  expect(isDurationSlow(6000, 5000)).toBe(true);
  expect(isDurationSlow(4000, 5000)).toBe(false);
});

test('determines correct severity', () => {
  const thresholds = { DURATION_WARNING: 5000, DURATION_CRITICAL: 30000 };
  expect(determineAlertSeverity({ duration: 35000 }, thresholds)).toBe(ALERT_SEVERITY.CRITICAL);
  expect(determineAlertSeverity({ duration: 6000 }, thresholds)).toBe(ALERT_SEVERITY.WARNING);
  expect(determineAlertSeverity({ duration: 1000 }, thresholds)).toBe(ALERT_SEVERITY.INFO);
});
```

## Integration with Workflow Engine

The monitoring module integrates with the step executor:

```javascript
import { PerformanceMonitor } from 'ai-workflow/lib/performance_monitoring';
import { StepExecutor } from 'ai-workflow/orchestrator/step_executor';

const monitor = new PerformanceMonitor();
const executor = new StepExecutor({ monitor });

// Monitor automatically receives step start/end events
await executor.execute(step, context);
```

## Related Modules

- **[performance](./performance.md)** - Base metrics collection (`formatDuration`, `formatMemoryUsage`)
- **[workflow_profiles](./workflow_profiles.md)** - Workflow profile management
- **[step_executor](../orchestrator/step_executor.md)** - Integrates monitoring into step execution
- **[Performance Optimization Guide](../../guides/PERFORMANCE_GUIDE.md)** - Configuration and tuning

---

**Last Updated:** 2026-03-04
**Status:** Complete
**Test Coverage:** 100%
**Source:** `src/lib/performance_monitoring.js`
