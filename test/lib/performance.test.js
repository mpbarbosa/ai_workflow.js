/**
 * @fileoverview Tests for Performance Tracking Module
 * @module test/lib/performance
 */

import {
  measureDuration,
  formatDuration,
  calculateMemoryUsage,
  formatMemoryUsage,
  calculateAverage,
  calculatePercentile,
  aggregateMetrics,
  createPerformanceSnapshot,
  formatMetrics,
  calculateOpsPerSecond,
  PerformanceTracker,
} from '../../src/lib/performance.js';
import fs from 'fs/promises';
import path from 'path';

describe('Performance Module - Pure Functions', () => {
  describe('measureDuration', () => {
    test('calculates duration correctly', () => {
      expect(measureDuration(1000, 1500)).toBe(500);
      expect(measureDuration(0, 1000)).toBe(1000);
    });

    test('handles same timestamps', () => {
      expect(measureDuration(1000, 1000)).toBe(0);
    });

    test('handles invalid inputs', () => {
      expect(measureDuration('1000', 1500)).toBe(0);
      expect(measureDuration(1000, '1500')).toBe(0);
      expect(measureDuration(null, 1500)).toBe(0);
    });

    test('handles end time before start time', () => {
      expect(measureDuration(1500, 1000)).toBe(0);
    });
  });

  describe('formatDuration', () => {
    test('formats milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    test('formats seconds', () => {
      expect(formatDuration(1000)).toBe('1.0s');
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(59999)).toBe('60.0s');
    });

    test('formats minutes and seconds', () => {
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(125000)).toBe('2m 5s');
    });

    test('handles invalid inputs', () => {
      expect(formatDuration(-100)).toBe('0ms');
      expect(formatDuration('1000')).toBe('0ms');
      expect(formatDuration(null)).toBe('0ms');
    });
  });

  describe('calculateMemoryUsage', () => {
    test('converts bytes to MB', () => {
      expect(calculateMemoryUsage(1048576)).toBe(1.0);
      expect(calculateMemoryUsage(2097152)).toBe(2.0);
      expect(calculateMemoryUsage(1572864)).toBe(1.5);
    });

    test('rounds to 2 decimals', () => {
      expect(calculateMemoryUsage(1234567)).toBe(1.18);
    });

    test('handles invalid inputs', () => {
      expect(calculateMemoryUsage(-1000)).toBe(0);
      expect(calculateMemoryUsage('1048576')).toBe(0);
      expect(calculateMemoryUsage(null)).toBe(0);
    });
  });

  describe('formatMemoryUsage', () => {
    test('formats bytes', () => {
      expect(formatMemoryUsage(512)).toBe('512B');
      expect(formatMemoryUsage(1023)).toBe('1023B');
    });

    test('formats kilobytes', () => {
      expect(formatMemoryUsage(1024)).toBe('1.0KB');
      expect(formatMemoryUsage(5120)).toBe('5.0KB');
    });

    test('formats megabytes', () => {
      expect(formatMemoryUsage(1048576)).toBe('1.0MB');
      expect(formatMemoryUsage(1572864)).toBe('1.5MB');
    });

    test('formats gigabytes', () => {
      expect(formatMemoryUsage(1073741824)).toBe('1.00GB');
      expect(formatMemoryUsage(2147483648)).toBe('2.00GB');
    });

    test('handles invalid inputs', () => {
      expect(formatMemoryUsage(-100)).toBe('0B');
      expect(formatMemoryUsage('1024')).toBe('0B');
      expect(formatMemoryUsage(null)).toBe('0B');
    });
  });

  describe('calculateAverage', () => {
    test('calculates average correctly', () => {
      expect(calculateAverage([10, 20, 30])).toBe(20);
      expect(calculateAverage([1, 2, 3, 4, 5])).toBe(3);
    });

    test('handles single value', () => {
      expect(calculateAverage([42])).toBe(42);
    });

    test('rounds to 2 decimals', () => {
      expect(calculateAverage([10, 20, 25])).toBe(18.33);
    });

    test('handles empty array', () => {
      expect(calculateAverage([])).toBe(0);
    });

    test('handles invalid inputs', () => {
      expect(calculateAverage(null)).toBe(0);
      expect(calculateAverage('not an array')).toBe(0);
    });

    test('ignores non-numeric values', () => {
      expect(calculateAverage([10, 'invalid', 20, null, 30])).toBe(12);
    });
  });

  describe('calculatePercentile', () => {
    test('calculates 50th percentile (median)', () => {
      expect(calculatePercentile([1, 2, 3, 4, 5], 50)).toBe(3);
      expect(calculatePercentile([10, 20, 30, 40], 50)).toBe(20);
    });

    test('calculates 95th percentile', () => {
      const data = Array.from({ length: 100 }, (_, i) => i + 1);
      expect(calculatePercentile(data, 95)).toBe(95);
    });

    test('calculates 99th percentile', () => {
      const data = Array.from({ length: 100 }, (_, i) => i + 1);
      expect(calculatePercentile(data, 99)).toBe(99);
    });

    test('handles edge cases', () => {
      expect(calculatePercentile([1], 50)).toBe(1);
      expect(calculatePercentile([1, 2], 100)).toBe(2);
    });

    test('handles invalid inputs', () => {
      expect(calculatePercentile([], 50)).toBe(0);
      expect(calculatePercentile([1, 2, 3], -10)).toBe(0);
      expect(calculatePercentile([1, 2, 3], 150)).toBe(0);
    });
  });

  describe('aggregateMetrics', () => {
    test('calculates all statistics', () => {
      const result = aggregateMetrics([10, 20, 30, 40, 50]);

      expect(result.min).toBe(10);
      expect(result.max).toBe(50);
      expect(result.avg).toBe(30);
      expect(result.p50).toBe(30);
      expect(result.p95).toBe(50);
      expect(result.p99).toBe(50);
    });

    test('handles large dataset', () => {
      const data = Array.from({ length: 1000 }, (_, i) => i + 1);
      const result = aggregateMetrics(data);

      expect(result.min).toBe(1);
      expect(result.max).toBe(1000);
      expect(result.avg).toBe(500.5);
      expect(result.p50).toBe(500);
      expect(result.p95).toBe(950);
      expect(result.p99).toBe(990);
    });

    test('handles empty array', () => {
      const result = aggregateMetrics([]);

      expect(result.min).toBe(0);
      expect(result.max).toBe(0);
      expect(result.avg).toBe(0);
      expect(result.p50).toBe(0);
    });
  });

  describe('createPerformanceSnapshot', () => {
    test('creates snapshot with all metrics', () => {
      const startTime = 1000;
      const currentTime = 2500;
      const memoryUsage = {
        heapUsed: 10485760,
        heapTotal: 20971520,
        rss: 31457280,
        external: 1048576,
      };

      const snapshot = createPerformanceSnapshot(startTime, currentTime, memoryUsage);

      expect(snapshot.duration).toBe(1500);
      expect(snapshot.durationFormatted).toBe('1.5s');
      expect(snapshot.memory.heapUsed).toBe(10.0);
      expect(snapshot.memory.heapTotal).toBe(20.0);
      expect(snapshot.memory.rss).toBe(30.0);
      expect(snapshot.timestamp).toBe(2500);
    });
  });

  describe('formatMetrics', () => {
    test('formats duration and memory', () => {
      const metrics = {
        duration: 1500,
        memory: { heapUsed: 25.5 },
      };

      expect(formatMetrics(metrics)).toBe('Duration: 1.5s | Memory: 25.5MB');
    });

    test('formats with operations count', () => {
      const metrics = {
        duration: 2000,
        memory: { heapUsed: 10 },
        operations: 100,
      };

      expect(formatMetrics(metrics)).toBe('Duration: 2.0s | Memory: 10MB | Operations: 100');
    });

    test('handles missing properties', () => {
      expect(formatMetrics({ duration: 1000 })).toBe('Duration: 1.0s');
      expect(formatMetrics({ memory: { heapUsed: 5 } })).toBe('Memory: 5MB');
    });

    test('handles invalid inputs', () => {
      expect(formatMetrics(null)).toBe('No metrics available');
      expect(formatMetrics({})).toBe('');
    });
  });

  describe('calculateOpsPerSecond', () => {
    test('calculates ops/sec correctly', () => {
      expect(calculateOpsPerSecond(1000, 5000)).toBe(200);
      expect(calculateOpsPerSecond(500, 1000)).toBe(500);
    });

    test('handles zero duration', () => {
      expect(calculateOpsPerSecond(1000, 0)).toBe(0);
    });

    test('handles invalid inputs', () => {
      expect(calculateOpsPerSecond('1000', 5000)).toBe(0);
      expect(calculateOpsPerSecond(1000, '5000')).toBe(0);
    });

    test('rounds to 2 decimals', () => {
      expect(calculateOpsPerSecond(1000, 3333)).toBe(300.03);
    });
  });
});

describe('Performance Module - PerformanceTracker Class', () => {
  let tracker;

  beforeEach(() => {
    tracker = new PerformanceTracker();
  });

  afterEach(() => {
    tracker.clear();
  });

  describe('constructor', () => {
    test('initializes empty maps', () => {
      expect(tracker.timers.size).toBe(0);
      expect(tracker.metrics.size).toBe(0);
      expect(tracker.samples.size).toBe(0);
    });
  });

  describe('startTimer / endTimer', () => {
    test('records timer and calculates duration', async () => {
      tracker.startTimer('test-op');
      await new Promise((resolve) => setTimeout(resolve, 100));

      const metrics = tracker.endTimer('test-op');

      expect(metrics).not.toBeNull();
      expect(metrics.duration).toBeGreaterThanOrEqual(90);
      expect(metrics.durationFormatted).toMatch(/\d+ms/);
      expect(metrics.memory.heapUsed).toBeGreaterThan(0);
    });

    test('returns null for unknown operation', () => {
      const metrics = tracker.endTimer('unknown-op');
      expect(metrics).toBeNull();
    });

    test('handles invalid operation IDs', () => {
      tracker.startTimer(null);
      expect(tracker.timers.size).toBe(0);

      const metrics = tracker.endTimer('');
      expect(metrics).toBeNull();
    });

    test('cleans up timer after ending', () => {
      tracker.startTimer('test-op');
      expect(tracker.timers.size).toBe(1);

      tracker.endTimer('test-op');
      expect(tracker.timers.size).toBe(0);
    });
  });

  describe('getMetrics', () => {
    test('retrieves recorded metrics', async () => {
      tracker.startTimer('test-op');
      await new Promise((resolve) => setTimeout(resolve, 50));
      tracker.endTimer('test-op');

      const metrics = tracker.getMetrics('test-op');
      expect(metrics).not.toBeNull();
      expect(metrics.duration).toBeGreaterThanOrEqual(40);
    });

    test('returns null for unknown operation', () => {
      expect(tracker.getMetrics('unknown')).toBeNull();
    });
  });

  describe('getAggregatedStats', () => {
    test('calculates statistics from multiple samples', async () => {
      // Record 3 samples
      for (let i = 0; i < 3; i++) {
        tracker.startTimer('test-op');
        await new Promise((resolve) => setTimeout(resolve, 50));
        tracker.endTimer('test-op');
      }

      const stats = tracker.getAggregatedStats('test-op');

      expect(stats).not.toBeNull();
      expect(stats.min).toBeGreaterThan(0);
      expect(stats.max).toBeGreaterThan(0);
      expect(stats.avg).toBeGreaterThan(0);
      expect(stats.p50).toBeGreaterThan(0);
    });

    test('returns null for no samples', () => {
      expect(tracker.getAggregatedStats('unknown')).toBeNull();
    });
  });

  describe('getAllMetrics', () => {
    test('returns all recorded metrics', async () => {
      tracker.startTimer('op1');
      tracker.endTimer('op1');

      tracker.startTimer('op2');
      tracker.endTimer('op2');

      const allMetrics = tracker.getAllMetrics();
      expect(allMetrics.size).toBe(2);
      expect(allMetrics.has('op1')).toBe(true);
      expect(allMetrics.has('op2')).toBe(true);
    });
  });

  describe('clear', () => {
    test('clears all metrics and timers', () => {
      tracker.startTimer('op1');
      tracker.endTimer('op1');

      expect(tracker.metrics.size).toBe(1);

      tracker.clear();

      expect(tracker.timers.size).toBe(0);
      expect(tracker.metrics.size).toBe(0);
      expect(tracker.samples.size).toBe(0);
    });
  });

  describe('exportToFile / importFromFile', () => {
    const testDir = path.join(process.cwd(), '.test-tmp');
    const testFile = path.join(testDir, 'performance-test.json');

    beforeAll(async () => {
      await fs.mkdir(testDir, { recursive: true });
    });

    afterAll(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    afterEach(async () => {
      try {
        await fs.unlink(testFile);
      } catch {
        // Ignore if file doesn't exist
      }
    });

    test('exports metrics to file', async () => {
      tracker.startTimer('test-op');
      tracker.endTimer('test-op');

      await tracker.exportToFile(testFile);

      const content = await fs.readFile(testFile, 'utf8');
      const data = JSON.parse(content);

      expect(data.timestamp).toBeGreaterThan(0);
      expect(data.metrics).toHaveProperty('test-op');
      expect(data.samples).toHaveProperty('test-op');
    });

    test('imports metrics from file', async () => {
      // Export first
      tracker.startTimer('test-op');
      tracker.endTimer('test-op');
      await tracker.exportToFile(testFile);

      // Clear and import
      tracker.clear();
      expect(tracker.metrics.size).toBe(0);

      await tracker.importFromFile(testFile);
      expect(tracker.metrics.size).toBe(1);
      expect(tracker.getMetrics('test-op')).not.toBeNull();
    });

    test('handles invalid file path on export', async () => {
      await expect(tracker.exportToFile('')).rejects.toThrow();
    });

    test('handles invalid file path on import', async () => {
      await expect(tracker.importFromFile('/nonexistent/file.json')).rejects.toThrow();
    });

    test('handles invalid JSON on import', async () => {
      await fs.writeFile(testFile, 'invalid json');
      await expect(tracker.importFromFile(testFile)).rejects.toThrow();
    });
  });
});
