/**
 * @fileoverview Performance Tracking Module - Real-time performance metrics collection
 *
 * Architecture: v2.0.0 (Referentially Transparent)
 * - Pure functions: Duration calculation, memory formatting, metric aggregation
 * - Impure wrapper: Metric recording, timer management, I/O operations
 *
 * @module lib/performance
 * @version 2.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../core/logger.js';

// ============================================================================
// PURE FUNCTIONS - Exported for testing and reuse
// ============================================================================

/**
 * Calculate duration between two timestamps
 *
 * @param {number} startTime - Start time in milliseconds
 * @param {number} endTime - End time in milliseconds
 * @returns {number} Duration in milliseconds
 *
 * @example
 * measureDuration(1000, 1500)
 * // Returns: 500
 */
export function measureDuration(startTime, endTime) {
  if (typeof startTime !== 'number' || typeof endTime !== 'number') {
    return 0;
  }

  if (endTime < startTime) {
    return 0;
  }

  return endTime - startTime;
}

/**
 * Format duration in human-readable format
 *
 * @param {number} durationMs - Duration in milliseconds
 * @returns {string} Formatted duration (e.g., "1.5s", "250ms", "2m 30s")
 *
 * @example
 * formatDuration(1500)
 * // Returns: "1.5s"
 *
 * formatDuration(125000)
 * // Returns: "2m 5s"
 */
export function formatDuration(durationMs) {
  if (typeof durationMs !== 'number' || durationMs < 0) {
    return '0ms';
  }

  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }

  if (durationMs < 60000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }

  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.round((durationMs % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Calculate memory usage in megabytes
 *
 * @param {number} bytes - Memory in bytes
 * @returns {number} Memory in MB (rounded to 2 decimals)
 *
 * @example
 * calculateMemoryUsage(1048576)
 * // Returns: 1.00
 */
export function calculateMemoryUsage(bytes) {
  if (typeof bytes !== 'number' || bytes < 0) {
    return 0;
  }

  return Math.round((bytes / 1048576) * 100) / 100;
}

/**
 * Format memory usage in human-readable format
 *
 * @param {number} bytes - Memory in bytes
 * @returns {string} Formatted memory (e.g., "1.5MB", "512KB", "2.1GB")
 *
 * @example
 * formatMemoryUsage(1572864)
 * // Returns: "1.5MB"
 */
export function formatMemoryUsage(bytes) {
  if (typeof bytes !== 'number' || bytes < 0) {
    return '0B';
  }

  if (bytes < 1024) {
    return `${bytes}B`;
  }

  if (bytes < 1048576) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }

  if (bytes < 1073741824) {
    return `${(bytes / 1048576).toFixed(1)}MB`;
  }

  return `${(bytes / 1073741824).toFixed(2)}GB`;
}

/**
 * Calculate average from array of numbers
 *
 * @param {number[]} values - Array of numeric values
 * @returns {number} Average (rounded to 2 decimals), or 0 if empty
 *
 * @example
 * calculateAverage([10, 20, 30])
 * // Returns: 20
 */
export function calculateAverage(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }

  const sum = values.reduce((acc, val) => acc + (typeof val === 'number' ? val : 0), 0);
  return Math.round((sum / values.length) * 100) / 100;
}

/**
 * Calculate percentile from sorted array
 *
 * @param {number[]} sortedValues - Sorted array of values
 * @param {number} percentile - Percentile to calculate (0-100)
 * @returns {number} Percentile value
 *
 * @example
 * calculatePercentile([1, 2, 3, 4, 5], 50)
 * // Returns: 3
 */
export function calculatePercentile(sortedValues, percentile) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) {
    return 0;
  }

  if (percentile < 0 || percentile > 100) {
    return 0;
  }

  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)];
}

/**
 * Aggregate metrics from multiple samples
 *
 * @param {number[]} samples - Array of metric samples
 * @returns {Object} Aggregated statistics
 * @property {number} min - Minimum value
 * @property {number} max - Maximum value
 * @property {number} avg - Average value
 * @property {number} p50 - 50th percentile (median)
 * @property {number} p95 - 95th percentile
 * @property {number} p99 - 99th percentile
 *
 * @example
 * aggregateMetrics([10, 20, 30, 40, 50])
 * // Returns: { min: 10, max: 50, avg: 30, p50: 30, p95: 50, p99: 50 }
 */
export function aggregateMetrics(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  }

  const sorted = [...samples].sort((a, b) => a - b);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: calculateAverage(samples),
    p50: calculatePercentile(sorted, 50),
    p95: calculatePercentile(sorted, 95),
    p99: calculatePercentile(sorted, 99),
  };
}

/**
 * Create performance snapshot from current metrics
 *
 * @param {number} startTime - Operation start time (ms)
 * @param {number} currentTime - Current time (ms)
 * @param {Object} memoryUsage - Memory usage object from process.memoryUsage()
 * @returns {Object} Performance snapshot
 *
 * @example
 * const snapshot = createPerformanceSnapshot(1000, 1500, process.memoryUsage());
 * // Returns: { duration: 500, durationFormatted: "500ms", memory: {...}, timestamp: 1500 }
 */
export function createPerformanceSnapshot(startTime, currentTime, memoryUsage) {
  const duration = measureDuration(startTime, currentTime);

  return {
    duration,
    durationFormatted: formatDuration(duration),
    memory: {
      heapUsed: calculateMemoryUsage(memoryUsage.heapUsed),
      heapTotal: calculateMemoryUsage(memoryUsage.heapTotal),
      rss: calculateMemoryUsage(memoryUsage.rss),
      external: calculateMemoryUsage(memoryUsage.external),
      heapUsedFormatted: formatMemoryUsage(memoryUsage.heapUsed),
      heapTotalFormatted: formatMemoryUsage(memoryUsage.heapTotal),
      rssFormatted: formatMemoryUsage(memoryUsage.rss),
    },
    timestamp: currentTime,
  };
}

/**
 * Format metrics for display
 *
 * @param {Object} metrics - Metrics object
 * @returns {string} Formatted metrics string
 *
 * @example
 * formatMetrics({ duration: 1500, memory: { heapUsed: 25.5 } })
 * // Returns: "Duration: 1.5s | Memory: 25.5MB"
 */
export function formatMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object') {
    return 'No metrics available';
  }

  const parts = [];

  if (metrics.duration !== undefined) {
    parts.push(`Duration: ${formatDuration(metrics.duration)}`);
  }

  if (metrics.memory && metrics.memory.heapUsed !== undefined) {
    parts.push(`Memory: ${metrics.memory.heapUsed}MB`);
  }

  if (metrics.operations !== undefined) {
    parts.push(`Operations: ${metrics.operations}`);
  }

  return parts.join(' | ');
}

/**
 * Calculate operations per second
 *
 * @param {number} operations - Number of operations completed
 * @param {number} durationMs - Duration in milliseconds
 * @returns {number} Operations per second (rounded to 2 decimals)
 *
 * @example
 * calculateOpsPerSecond(1000, 5000)
 * // Returns: 200
 */
export function calculateOpsPerSecond(operations, durationMs) {
  if (typeof operations !== 'number' || typeof durationMs !== 'number') {
    return 0;
  }

  if (durationMs === 0) {
    return 0;
  }

  return Math.round((operations / durationMs) * 1000 * 100) / 100;
}

// ============================================================================
// IMPURE WRAPPER CLASS - Handles side effects
// ============================================================================

/**
 * Performance tracker with timer management and metric recording
 *
 * @class PerformanceTracker
 * @example
 * const tracker = new PerformanceTracker();
 *
 * tracker.startTimer('operation1');
 * // ... do work ...
 * const metrics = tracker.endTimer('operation1');
 * console.log(metrics); // { duration: 1500, durationFormatted: "1.5s", ... }
 */
export class PerformanceTracker {
  constructor() {
    this.timers = new Map();
    this.metrics = new Map();
    this.samples = new Map();
  }

  /**
   * Start a timer for an operation
   *
   * @param {string} operationId - Unique operation identifier
   * @returns {void}
   */
  startTimer(operationId) {
    if (!operationId || typeof operationId !== 'string') {
      logger.warn('[Performance] Invalid operation ID');
      return;
    }

    this.timers.set(operationId, {
      startTime: Date.now(),
      startMemory: process.memoryUsage(),
    });
  }

  /**
   * End a timer and record metrics
   *
   * @param {string} operationId - Operation identifier
   * @returns {Object|null} Performance metrics or null if timer not found
   */
  endTimer(operationId) {
    if (!operationId || typeof operationId !== 'string') {
      logger.warn('[Performance] Invalid operation ID');
      return null;
    }

    const timer = this.timers.get(operationId);
    if (!timer) {
      logger.warn(`[Performance] Timer not found: ${operationId}`);
      return null;
    }

    const currentTime = Date.now();
    const currentMemory = process.memoryUsage();

    const snapshot = createPerformanceSnapshot(timer.startTime, currentTime, currentMemory);

    // Record metric
    this.metrics.set(operationId, snapshot);

    // Add to samples for aggregation
    if (!this.samples.has(operationId)) {
      this.samples.set(operationId, []);
    }
    this.samples.get(operationId).push(snapshot.duration);

    // Clean up timer
    this.timers.delete(operationId);

    logger.debug(`[Performance] ${operationId}: ${snapshot.durationFormatted}`);

    return snapshot;
  }

  /**
   * Get metrics for an operation
   *
   * @param {string} operationId - Operation identifier
   * @returns {Object|null} Metrics or null if not found
   */
  getMetrics(operationId) {
    return this.metrics.get(operationId) || null;
  }

  /**
   * Get aggregated statistics for an operation
   *
   * @param {string} operationId - Operation identifier
   * @returns {Object|null} Aggregated stats or null if no samples
   */
  getAggregatedStats(operationId) {
    const samples = this.samples.get(operationId);
    if (!samples || samples.length === 0) {
      return null;
    }

    return aggregateMetrics(samples);
  }

  /**
   * Get all recorded metrics
   *
   * @returns {Map} Map of operation IDs to metrics
   */
  getAllMetrics() {
    return new Map(this.metrics);
  }

  /**
   * Clear all metrics and timers
   *
   * @returns {void}
   */
  clear() {
    this.timers.clear();
    this.metrics.clear();
    this.samples.clear();
    logger.debug('[Performance] Metrics cleared');
  }

  /**
   * Export metrics to JSON file
   *
   * @param {string} filePath - Path to export file
   * @returns {Promise<void>}
   */
  async exportToFile(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      const error = new Error('[Performance] Invalid file path');
      logger.error(error.message);
      throw error;
    }

    const data = {
      timestamp: Date.now(),
      metrics: Object.fromEntries(this.metrics),
      samples: Object.fromEntries(this.samples),
    };

    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      logger.info(`[Performance] Metrics exported to ${filePath}`);
    } catch (error) {
      logger.error(`[Performance] Failed to export metrics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Import metrics from JSON file
   *
   * @param {string} filePath - Path to import file
   * @returns {Promise<void>}
   */
  async importFromFile(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      logger.error('[Performance] Invalid file path');
      return;
    }

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);

      this.metrics = new Map(Object.entries(data.metrics || {}));
      this.samples = new Map(Object.entries(data.samples || {}));

      logger.info(`[Performance] Metrics imported from ${filePath}`);
    } catch (error) {
      logger.error(`[Performance] Failed to import metrics: ${error.message}`);
      throw error;
    }
  }
}
