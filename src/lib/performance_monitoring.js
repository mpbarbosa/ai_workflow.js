/**
 * @fileoverview Performance Monitoring Module - Real-time performance monitoring with alerts
 *
 * Architecture: v2.0.0 (Referentially Transparent)
 * - Pure functions: Threshold detection, alert generation, status classification
 * - Impure wrapper: Real-time monitoring, logging, alerting
 *
 * @module lib/performance_monitoring
 * @version 2.0.0
 */

import { logger } from '../core/logger.js';
import { formatDuration, formatMemoryUsage } from './performance.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default performance thresholds
 */
export const DEFAULT_THRESHOLDS = {
  // Duration thresholds (milliseconds)
  DURATION_WARNING: 5000, // 5 seconds
  DURATION_CRITICAL: 30000, // 30 seconds

  // Memory thresholds (bytes)
  MEMORY_WARNING: 536870912, // 512 MB
  MEMORY_CRITICAL: 1073741824, // 1 GB

  // Operations per second thresholds
  OPS_PER_SEC_MIN: 10,
  OPS_PER_SEC_WARNING: 5,

  // Sample size for trending
  TRENDING_WINDOW: 10,
};

/**
 * Alert severity levels
 */
export const ALERT_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
};

// ============================================================================
// PURE FUNCTIONS - Exported for testing and reuse
// ============================================================================

/**
 * Check if duration exceeds threshold
 *
 * @param {number} durationMs - Duration in milliseconds
 * @param {number} thresholdMs - Threshold in milliseconds
 * @returns {boolean} True if duration exceeds threshold
 *
 * @example
 * isDurationSlow(6000, 5000)
 * // Returns: true
 */
export function isDurationSlow(durationMs, thresholdMs) {
  if (typeof durationMs !== 'number' || typeof thresholdMs !== 'number') {
    return false;
  }

  return durationMs > thresholdMs;
}

/**
 * Check if memory usage exceeds threshold
 *
 * @param {number} memoryBytes - Memory usage in bytes
 * @param {number} thresholdBytes - Threshold in bytes
 * @returns {boolean} True if memory exceeds threshold
 *
 * @example
 * isMemoryHigh(600000000, 536870912)
 * // Returns: true
 */
export function isMemoryHigh(memoryBytes, thresholdBytes) {
  if (typeof memoryBytes !== 'number' || typeof thresholdBytes !== 'number') {
    return false;
  }

  return memoryBytes > thresholdBytes;
}

/**
 * Determine alert severity based on metrics and thresholds
 *
 * @param {Object} metrics - Performance metrics
 * @param {Object} thresholds - Threshold configuration
 * @returns {string} Alert severity ('info', 'warning', 'critical')
 *
 * @example
 * determineAlertSeverity({ duration: 35000 }, { DURATION_WARNING: 5000, DURATION_CRITICAL: 30000 })
 * // Returns: 'critical'
 */
export function determineAlertSeverity(metrics, thresholds) {
  if (!metrics || typeof metrics !== 'object' || !thresholds) {
    return ALERT_SEVERITY.INFO;
  }

  // Check for critical conditions
  if (metrics.duration && isDurationSlow(metrics.duration, thresholds.DURATION_CRITICAL)) {
    return ALERT_SEVERITY.CRITICAL;
  }

  if (
    metrics.memory &&
    isMemoryHigh(metrics.memory.heapUsed * 1048576, thresholds.MEMORY_CRITICAL)
  ) {
    return ALERT_SEVERITY.CRITICAL;
  }

  // Check for warning conditions
  if (metrics.duration && isDurationSlow(metrics.duration, thresholds.DURATION_WARNING)) {
    return ALERT_SEVERITY.WARNING;
  }

  if (
    metrics.memory &&
    isMemoryHigh(metrics.memory.heapUsed * 1048576, thresholds.MEMORY_WARNING)
  ) {
    return ALERT_SEVERITY.WARNING;
  }

  return ALERT_SEVERITY.INFO;
}

/**
 * Generate alert message from metrics
 *
 * @param {string} operationId - Operation identifier
 * @param {Object} metrics - Performance metrics
 * @param {string} severity - Alert severity
 * @returns {string} Formatted alert message
 *
 * @example
 * generateAlertMessage('db-query', { duration: 6000, memory: { heapUsed: 25 } }, 'warning')
 * // Returns: "[WARNING] Operation 'db-query' took 6.0s (memory: 25MB)"
 */
export function generateAlertMessage(operationId, metrics, severity) {
  if (!operationId || !metrics) {
    return '';
  }

  const parts = [`[${severity.toUpperCase()}] Operation '${operationId}'`];

  if (metrics.duration !== undefined) {
    parts.push(`took ${formatDuration(metrics.duration)}`);
  }

  if (metrics.memory && metrics.memory.heapUsed !== undefined) {
    parts.push(`(memory: ${metrics.memory.heapUsed}MB)`);
  }

  return parts.join(' ');
}

/**
 * Calculate trend from recent samples
 *
 * @param {number[]} samples - Array of recent metric samples
 * @returns {string} Trend indicator ('improving', 'stable', 'degrading')
 *
 * @example
 * calculateTrend([100, 200, 300, 400, 500])
 * // Returns: 'degrading'
 */
export function calculateTrend(samples) {
  if (!Array.isArray(samples) || samples.length < 2) {
    return 'stable';
  }

  const halfPoint = Math.floor(samples.length / 2);
  const firstHalf = samples.slice(0, halfPoint);
  const secondHalf = samples.slice(halfPoint);

  const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

  const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;

  if (percentChange > 10) return 'degrading';
  if (percentChange < -10) return 'improving';
  return 'stable';
}

/**
 * Check if operation should trigger alert based on history
 *
 * @param {number[]} recentDurations - Recent duration samples
 * @param {number} currentDuration - Current operation duration
 * @param {number} threshold - Threshold value
 * @returns {boolean} True if alert should be triggered
 *
 * @example
 * shouldAlert([100, 110, 120], 5000, 1000)
 * // Returns: true (significant deviation)
 */
export function shouldAlert(recentDurations, currentDuration, threshold) {
  if (!Array.isArray(recentDurations) || recentDurations.length === 0) {
    return isDurationSlow(currentDuration, threshold);
  }

  // Calculate average of recent samples
  const avgDuration = recentDurations.reduce((sum, d) => sum + d, 0) / recentDurations.length;

  // Alert if current is > 2x average OR exceeds threshold
  const isSignificantDeviation = currentDuration > avgDuration * 2;
  const exceedsThreshold = isDurationSlow(currentDuration, threshold);

  return isSignificantDeviation || exceedsThreshold;
}

/**
 * Create performance summary from metrics
 *
 * @param {Object} metrics - Performance metrics
 * @param {Object} thresholds - Threshold configuration
 * @returns {Object} Performance summary with status and recommendations
 *
 * @example
 * createPerformanceSummary({ duration: 6000, memory: { heapUsed: 25 } }, DEFAULT_THRESHOLDS)
 * // Returns: { status: 'warning', issues: [...], recommendations: [...] }
 */
export function createPerformanceSummary(metrics, thresholds) {
  if (!metrics || !thresholds) {
    return { status: 'info', issues: [], recommendations: [] };
  }

  const severity = determineAlertSeverity(metrics, thresholds);
  const issues = [];
  const recommendations = [];

  // Check duration
  if (metrics.duration) {
    if (isDurationSlow(metrics.duration, thresholds.DURATION_CRITICAL)) {
      issues.push(
        `Critical: Duration ${formatDuration(metrics.duration)} exceeds ${formatDuration(thresholds.DURATION_CRITICAL)}`
      );
      recommendations.push('Consider optimizing algorithm or adding caching');
    } else if (isDurationSlow(metrics.duration, thresholds.DURATION_WARNING)) {
      issues.push(
        `Warning: Duration ${formatDuration(metrics.duration)} exceeds ${formatDuration(thresholds.DURATION_WARNING)}`
      );
      recommendations.push('Monitor for performance degradation');
    }
  }

  // Check memory
  if (metrics.memory && metrics.memory.heapUsed) {
    const memoryBytes = metrics.memory.heapUsed * 1048576;
    if (isMemoryHigh(memoryBytes, thresholds.MEMORY_CRITICAL)) {
      issues.push(
        `Critical: Memory ${formatMemoryUsage(memoryBytes)} exceeds ${formatMemoryUsage(thresholds.MEMORY_CRITICAL)}`
      );
      recommendations.push('Check for memory leaks or reduce data in memory');
    } else if (isMemoryHigh(memoryBytes, thresholds.MEMORY_WARNING)) {
      issues.push(
        `Warning: Memory ${formatMemoryUsage(memoryBytes)} exceeds ${formatMemoryUsage(thresholds.MEMORY_WARNING)}`
      );
      recommendations.push('Monitor memory usage trend');
    }
  }

  return {
    status: severity,
    issues,
    recommendations,
  };
}

/**
 * Validate threshold configuration
 *
 * @param {Object} thresholds - Threshold configuration to validate
 * @returns {boolean} True if thresholds are valid
 *
 * @example
 * validateThresholds({ DURATION_WARNING: 5000, DURATION_CRITICAL: 30000 })
 * // Returns: true
 */
export function validateThresholds(thresholds) {
  if (!thresholds || typeof thresholds !== 'object') {
    return false;
  }

  // Warning thresholds must be less than critical
  if (thresholds.DURATION_WARNING && thresholds.DURATION_CRITICAL) {
    if (thresholds.DURATION_WARNING >= thresholds.DURATION_CRITICAL) {
      return false;
    }
  }

  if (thresholds.MEMORY_WARNING && thresholds.MEMORY_CRITICAL) {
    if (thresholds.MEMORY_WARNING >= thresholds.MEMORY_CRITICAL) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// IMPURE WRAPPER CLASS - Handles side effects
// ============================================================================

/**
 * Performance monitor with real-time alerting
 *
 * @class PerformanceMonitor
 * @example
 * const monitor = new PerformanceMonitor({ DURATION_WARNING: 3000 });
 *
 * monitor.checkMetrics('operation1', { duration: 5000 });
 * // Logs warning if duration exceeds threshold
 */
export class PerformanceMonitor {
  constructor(thresholds = {}, options = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    this.history = new Map(); // operationId -> array of durations
    this.alerts = [];
    this.enabled = true;
    this._silent = options.silent === true;

    if (!validateThresholds(this.thresholds)) {
      if (!this._silent) {
        logger.warn('[PerformanceMonitor] Invalid thresholds provided, using defaults');
      }
      this.thresholds = { ...DEFAULT_THRESHOLDS };
    }
  }

  /**
   * Enable monitoring
   *
   * @returns {void}
   */
  enable() {
    this.enabled = true;
    logger.debug('[PerformanceMonitor] Monitoring enabled');
  }

  /**
   * Disable monitoring
   *
   * @returns {void}
   */
  disable() {
    this.enabled = false;
    logger.debug('[PerformanceMonitor] Monitoring disabled');
  }

  /**
   * Check metrics and generate alerts if thresholds exceeded
   *
   * @param {string} operationId - Operation identifier
   * @param {Object} metrics - Performance metrics
   * @returns {Object|null} Alert object if generated, null otherwise
   */
  checkMetrics(operationId, metrics) {
    if (!this.enabled) {
      return null;
    }

    if (!operationId || !metrics) {
      if (!this._silent) {
        logger.warn('[PerformanceMonitor] Invalid operationId or metrics');
      }
      return null;
    }

    // Update history
    if (metrics.duration !== undefined) {
      if (!this.history.has(operationId)) {
        this.history.set(operationId, []);
      }

      const history = this.history.get(operationId);
      history.push(metrics.duration);

      // Keep only recent samples
      if (history.length > this.thresholds.TRENDING_WINDOW) {
        history.shift();
      }
    }

    // Determine severity
    const severity = determineAlertSeverity(metrics, this.thresholds);

    // Only alert on warning or critical
    if (severity === ALERT_SEVERITY.INFO) {
      return null;
    }

    // Check if we should alert based on history
    const recentDurations = this.history.get(operationId) || [];
    if (
      metrics.duration &&
      !shouldAlert(recentDurations.slice(0, -1), metrics.duration, this.thresholds.DURATION_WARNING)
    ) {
      return null;
    }

    // Generate alert
    const alert = {
      operationId,
      severity,
      metrics,
      message: generateAlertMessage(operationId, metrics, severity),
      timestamp: Date.now(),
      trend: recentDurations.length > 1 ? calculateTrend(recentDurations) : 'stable',
    };

    this.alerts.push(alert);

    // Log based on severity
    if (!this._silent) {
      if (severity === ALERT_SEVERITY.CRITICAL) {
        logger.error(alert.message);
      } else {
        logger.warn(alert.message);
      }
    }

    return alert;
  }

  /**
   * Get performance summary for operation
   *
   * @param {string} operationId - Operation identifier
   * @param {Object} metrics - Performance metrics
   * @returns {Object} Performance summary
   */
  getSummary(operationId, metrics) {
    if (!operationId || !metrics) {
      return { status: 'info', issues: [], recommendations: [] };
    }

    return createPerformanceSummary(metrics, this.thresholds);
  }

  /**
   * Get recent alerts
   *
   * @param {number} count - Number of recent alerts to retrieve
   * @returns {Array} Recent alerts
   */
  getRecentAlerts(count = 10) {
    return this.alerts.slice(-count);
  }

  /**
   * Get all alerts for an operation
   *
   * @param {string} operationId - Operation identifier
   * @returns {Array} Alerts for operation
   */
  getAlertsForOperation(operationId) {
    return this.alerts.filter((alert) => alert.operationId === operationId);
  }

  /**
   * Get performance trend for operation
   *
   * @param {string} operationId - Operation identifier
   * @returns {string|null} Trend indicator or null if not enough data
   */
  getTrend(operationId) {
    const history = this.history.get(operationId);
    if (!history || history.length < 2) {
      return null;
    }

    return calculateTrend(history);
  }

  /**
   * Clear all alerts
   *
   * @returns {void}
   */
  clearAlerts() {
    this.alerts = [];
    logger.debug('[PerformanceMonitor] Alerts cleared');
  }

  /**
   * Clear history for an operation
   *
   * @param {string} operationId - Operation identifier
   * @returns {void}
   */
  clearHistory(operationId) {
    if (operationId) {
      this.history.delete(operationId);
    } else {
      this.history.clear();
    }
    logger.debug(`[PerformanceMonitor] History cleared for ${operationId || 'all operations'}`);
  }

  /**
   * Update thresholds
   *
   * @param {Object} newThresholds - New threshold values
   * @returns {boolean} True if thresholds updated successfully
   */
  updateThresholds(newThresholds) {
    if (!newThresholds || typeof newThresholds !== 'object') {
      if (!this._silent) {
        logger.error('[PerformanceMonitor] Invalid thresholds');
      }
      return false;
    }

    const updatedThresholds = { ...this.thresholds, ...newThresholds };

    if (!validateThresholds(updatedThresholds)) {
      if (!this._silent) {
        logger.error('[PerformanceMonitor] Invalid threshold configuration');
      }
      return false;
    }

    this.thresholds = updatedThresholds;
    if (!this._silent) {
      logger.info('[PerformanceMonitor] Thresholds updated');
    }
    return true;
  }

  /**
   * Get current threshold configuration
   *
   * @returns {Object} Current thresholds
   */
  getThresholds() {
    return { ...this.thresholds };
  }
}
