# Performance Module

**Version:** 2.2.16
**Module:** `lib/performance`
**Architecture:** Referential Transparency (Pure Functions + Impure Wrapper)

## Overview

The **Performance** module provides real-time performance metrics collection for tracking execution time, memory usage, and operation statistics. It follows the v2.0.0 referentially transparent architecture with pure functions for calculations and an impure wrapper for I/O operations.

## Key Features

- ⏱️ **Duration Tracking** - Measure execution time for operations
- 💾 **Memory Monitoring** - Track memory usage and heap statistics
- 📊 **Metric Aggregation** - Collect and aggregate performance metrics
- 📁 **Metric Persistence** - Save metrics to JSON files
- 🎯 **Human-Readable Formatting** - Format durations and memory for display

## Architecture

```
┌─────────────────────────────────────┐
│     PerformanceTracker (Impure)     │
│  - Start/stop timers                │
│  - Record metrics                   │
│  - File I/O operations              │
└───────────┬─────────────────────────┘
            │ calls
            ▼
┌─────────────────────────────────────┐
│    Pure Functions (Exported)        │
│  - measureDuration()                │
│  - formatDuration()                 │
│  - calculateMemoryUsage()           │
│  - formatMemoryUsage()              │
└─────────────────────────────────────┘
```

## Pure Functions

### Duration Calculation

#### `measureDuration(startTime, endTime)`

Calculate duration between two timestamps.

**Parameters:**

- `startTime` (number) - Start time in milliseconds
- `endTime` (number) - End time in milliseconds

**Returns:** `number` - Duration in milliseconds

**Example:**

```javascript
import { measureDuration } from 'ai-workflow/lib/performance';

const duration = measureDuration(1000, 1500);
console.log(duration); // 500
```

#### `formatDuration(durationMs)`

Format duration in human-readable format.

**Parameters:**

- `durationMs` (number) - Duration in milliseconds

**Returns:** `string` - Formatted duration (e.g., "1.5s", "250ms", "2m 30s")

**Example:**

```javascript
import { formatDuration } from 'ai-workflow/lib/performance';

console.log(formatDuration(1500)); // "1.5s"
console.log(formatDuration(125000)); // "2m 5s"
console.log(formatDuration(500)); // "500ms"
```

### Memory Calculation

#### `calculateMemoryUsage(bytes)`

Calculate memory usage in megabytes.

**Parameters:**

- `bytes` (number) - Memory in bytes

**Returns:** `number` - Memory in MB (rounded to 2 decimals)

**Example:**

```javascript
import { calculateMemoryUsage } from 'ai-workflow/lib/performance';

const memoryMB = calculateMemoryUsage(1048576);
console.log(memoryMB); // 1.00
```

#### `formatMemoryUsage(bytes)`

Format memory usage in human-readable format.

**Parameters:**

- `bytes` (number) - Memory in bytes

**Returns:** `string` - Formatted memory (e.g., "1.5MB", "512KB", "2.1GB")

**Example:**

```javascript
import { formatMemoryUsage } from 'ai-workflow/lib/performance';

console.log(formatMemoryUsage(1572864)); // "1.5MB"
console.log(formatMemoryUsage(524288)); // "512KB"
console.log(formatMemoryUsage(2147483648)); // "2.0GB"
```

### Metric Aggregation

#### `aggregateMetrics(metrics)`

Aggregate multiple performance metrics.

**Parameters:**

- `metrics` (Array&lt;Object&gt;) - Array of metric objects

**Returns:** `Object` - Aggregated statistics (min, max, avg, total)

**Example:**

```javascript
import { aggregateMetrics } from 'ai-workflow/lib/performance';

const metrics = [
  { duration: 100, memory: 1048576 },
  { duration: 200, memory: 2097152 },
  { duration: 150, memory: 1572864 },
];

const stats = aggregateMetrics(metrics);
// {
//   duration: { min: 100, max: 200, avg: 150, total: 450 },
//   memory: { min: 1.00, max: 2.00, avg: 1.50, total: 4.50 }
// }
```

## Impure Wrapper Class

### `PerformanceTracker`

Manages performance metrics with state and I/O operations.

#### Constructor

```javascript
import { PerformanceTracker } from 'ai-workflow/lib/performance';

const tracker = new PerformanceTracker({
  enabled: true, // Enable/disable tracking
  outputDir: '.ai_workflow/metrics', // Metric output directory
  autoSave: true, // Auto-save metrics on process exit
});
```

#### Methods

##### `startTimer(label)`

Start a timer for an operation.

**Parameters:**

- `label` (string) - Timer label

**Returns:** `string` - Timer ID

**Example:**

```javascript
const timerId = tracker.startTimer('processFiles');
// ... do work ...
tracker.stopTimer(timerId);
```

##### `stopTimer(timerId)`

Stop a timer and record the metric.

**Parameters:**

- `timerId` (string) - Timer ID from `startTimer()`

**Returns:** `number` - Duration in milliseconds

**Example:**

```javascript
const timerId = tracker.startTimer('apiCall');
await makeApiCall();
const duration = tracker.stopTimer(timerId);
console.log(`API call took ${duration}ms`);
```

##### `recordMetric(label, value, unit)`

Record a custom metric.

**Parameters:**

- `label` (string) - Metric label
- `value` (number) - Metric value
- `unit` (string) - Unit of measurement (optional)

**Example:**

```javascript
tracker.recordMetric('filesProcessed', 42, 'files');
tracker.recordMetric('cacheHitRate', 0.75, 'percentage');
```

##### `getMetrics()`

Get all recorded metrics.

**Returns:** `Array<Object>` - Array of metric objects

**Example:**

```javascript
const metrics = tracker.getMetrics();
console.log(metrics);
// [
//   { label: 'processFiles', duration: 1500, timestamp: 1609459200000 },
//   { label: 'filesProcessed', value: 42, unit: 'files' }
// ]
```

##### `async saveMetrics(filepath)`

Save metrics to a JSON file.

**Parameters:**

- `filepath` (string) - Output file path (optional, uses config if not provided)

**Returns:** `Promise<void>`

**Example:**

```javascript
await tracker.saveMetrics('.ai_workflow/metrics/run-2026-02-07.json');
```

##### `clearMetrics()`

Clear all recorded metrics.

**Example:**

```javascript
tracker.clearMetrics();
```

## Usage Examples

### Basic Performance Tracking

```javascript
import { PerformanceTracker } from 'ai-workflow/lib/performance';

const tracker = new PerformanceTracker();

// Time an operation
const timerId = tracker.startTimer('dataProcessing');
await processData();
const duration = tracker.stopTimer(timerId);

// Record custom metrics
tracker.recordMetric('itemsProcessed', data.length);
tracker.recordMetric('successRate', successCount / data.length);

// Save metrics
await tracker.saveMetrics();
```

### Workflow Step Tracking

```javascript
import { PerformanceTracker } from 'ai-workflow/lib/performance';

const tracker = new PerformanceTracker({
  outputDir: '.ai_workflow/metrics',
  autoSave: true,
});

async function runWorkflowStep(step) {
  const timerId = tracker.startTimer(`step_${step.name}`);

  try {
    await step.execute();
    tracker.recordMetric(`${step.name}_success`, 1);
  } catch (error) {
    tracker.recordMetric(`${step.name}_failure`, 1);
    throw error;
  } finally {
    tracker.stopTimer(timerId);
  }
}
```

### Memory Monitoring

```javascript
import { PerformanceTracker, formatMemoryUsage } from 'ai-workflow/lib/performance';

const tracker = new PerformanceTracker();

function monitorMemory() {
  const usage = process.memoryUsage();

  tracker.recordMetric('heapUsed', usage.heapUsed, 'bytes');
  tracker.recordMetric('heapTotal', usage.heapTotal, 'bytes');
  tracker.recordMetric('rss', usage.rss, 'bytes');

  console.log(`Heap: ${formatMemoryUsage(usage.heapUsed)} / ${formatMemoryUsage(usage.heapTotal)}`);
}

// Monitor every 5 seconds
setInterval(monitorMemory, 5000);
```

## Configuration

### Default Configuration

```javascript
const DEFAULT_CONFIG = {
  enabled: true, // Enable tracking
  outputDir: '.ai_workflow/metrics', // Output directory
  autoSave: true, // Auto-save on exit
  consoleOutput: false, // Log to console
  precision: 2, // Decimal precision
};
```

## Error Handling

The module provides graceful error handling:

```javascript
import { PerformanceTracker } from 'ai-workflow/lib/performance';

const tracker = new PerformanceTracker();

try {
  await tracker.saveMetrics('/invalid/path/metrics.json');
} catch (error) {
  console.error('Failed to save metrics:', error.message);
  // Metrics are retained in memory and can be saved later
}
```

## Testing

### Pure Function Tests

```javascript
import { measureDuration, formatDuration, calculateMemoryUsage } from 'ai-workflow/lib/performance';

describe('Performance Pure Functions', () => {
  test('measureDuration calculates correctly', () => {
    expect(measureDuration(1000, 1500)).toBe(500);
    expect(measureDuration(1500, 1000)).toBe(0); // Invalid range
  });

  test('formatDuration formats correctly', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(125000)).toBe('2m 5s');
  });

  test('calculateMemoryUsage converts bytes to MB', () => {
    expect(calculateMemoryUsage(1048576)).toBe(1.0);
    expect(calculateMemoryUsage(1572864)).toBe(1.5);
  });
});
```

### Integration Tests

```javascript
import { PerformanceTracker } from 'ai-workflow/lib/performance';

describe('PerformanceTracker Integration', () => {
  test('tracks operation duration', () => {
    const tracker = new PerformanceTracker();
    const timerId = tracker.startTimer('test');

    // Simulate work
    const duration = tracker.stopTimer(timerId);

    expect(duration).toBeGreaterThan(0);
    expect(tracker.getMetrics().length).toBe(1);
  });
});
```

## Related Modules

- **[metrics](./metrics.md)** - Comprehensive workflow metrics collection
- **[session_manager](./session_manager.md)** - Session lifecycle management
- **[performance_monitoring](./performance_monitoring.md)** - Advanced performance monitoring (Phase 8)

## Version History

- **v2.0.0** - Referentially transparent architecture with pure functions
- **v1.0.0** - Initial implementation

---

**See Also:**

- [API Reference](../README.md)
- [Architecture Overview](../../architecture/OVERVIEW.md)
- [Testing Guide](../../guides/TESTING_GUIDE.md)
