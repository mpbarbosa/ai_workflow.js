/**
 * @fileoverview Tests for Performance Monitoring Module
 * @module test/lib/performance_monitoring
 */

import {
  DEFAULT_THRESHOLDS,
  ALERT_SEVERITY,
  isDurationSlow,
  isMemoryHigh,
  determineAlertSeverity,
  generateAlertMessage,
  calculateTrend,
  shouldAlert,
  createPerformanceSummary,
  validateThresholds,
  PerformanceMonitor,
} from '../../src/lib/performance_monitoring.js';

describe('Performance Monitoring Module - Pure Functions', () => {
  describe('isDurationSlow', () => {
    test('detects slow duration', () => {
      expect(isDurationSlow(6000, 5000)).toBe(true);
      expect(isDurationSlow(10000, 5000)).toBe(true);
    });

    test('detects normal duration', () => {
      expect(isDurationSlow(4000, 5000)).toBe(false);
      expect(isDurationSlow(5000, 5000)).toBe(false);
    });

    test('handles invalid inputs', () => {
      expect(isDurationSlow('6000', 5000)).toBe(false);
      expect(isDurationSlow(6000, '5000')).toBe(false);
      expect(isDurationSlow(null, 5000)).toBe(false);
    });
  });

  describe('isMemoryHigh', () => {
    test('detects high memory usage', () => {
      expect(isMemoryHigh(600000000, 536870912)).toBe(true);
      expect(isMemoryHigh(1073741824, 536870912)).toBe(true);
    });

    test('detects normal memory usage', () => {
      expect(isMemoryHigh(500000000, 536870912)).toBe(false);
      expect(isMemoryHigh(536870912, 536870912)).toBe(false);
    });

    test('handles invalid inputs', () => {
      expect(isMemoryHigh('600000000', 536870912)).toBe(false);
      expect(isMemoryHigh(600000000, '536870912')).toBe(false);
    });
  });

  describe('determineAlertSeverity', () => {
    test('returns critical for high duration', () => {
      const metrics = { duration: 35000 };
      const severity = determineAlertSeverity(metrics, DEFAULT_THRESHOLDS);
      expect(severity).toBe(ALERT_SEVERITY.CRITICAL);
    });

    test('returns warning for moderate duration', () => {
      const metrics = { duration: 6000 };
      const severity = determineAlertSeverity(metrics, DEFAULT_THRESHOLDS);
      expect(severity).toBe(ALERT_SEVERITY.WARNING);
    });

    test('returns critical for high memory', () => {
      const metrics = { memory: { heapUsed: 1100 } }; // 1100 MB
      const severity = determineAlertSeverity(metrics, DEFAULT_THRESHOLDS);
      expect(severity).toBe(ALERT_SEVERITY.CRITICAL);
    });

    test('returns warning for moderate memory', () => {
      const metrics = { memory: { heapUsed: 600 } }; // 600 MB
      const severity = determineAlertSeverity(metrics, DEFAULT_THRESHOLDS);
      expect(severity).toBe(ALERT_SEVERITY.WARNING);
    });

    test('returns info for normal metrics', () => {
      const metrics = { duration: 1000, memory: { heapUsed: 100 } };
      const severity = determineAlertSeverity(metrics, DEFAULT_THRESHOLDS);
      expect(severity).toBe(ALERT_SEVERITY.INFO);
    });

    test('handles invalid inputs', () => {
      expect(determineAlertSeverity(null, DEFAULT_THRESHOLDS)).toBe(ALERT_SEVERITY.INFO);
      expect(determineAlertSeverity({}, null)).toBe(ALERT_SEVERITY.INFO);
    });
  });

  describe('generateAlertMessage', () => {
    test('generates message with duration', () => {
      const metrics = { duration: 6000 };
      const message = generateAlertMessage('db-query', metrics, 'warning');
      expect(message).toContain('[WARNING]');
      expect(message).toContain('db-query');
      expect(message).toContain('6.0s');
    });

    test('generates message with memory', () => {
      const metrics = { memory: { heapUsed: 600 } };
      const message = generateAlertMessage('data-processing', metrics, 'critical');
      expect(message).toContain('[CRITICAL]');
      expect(message).toContain('data-processing');
      expect(message).toContain('600MB');
    });

    test('generates message with both duration and memory', () => {
      const metrics = { duration: 6000, memory: { heapUsed: 600 } };
      const message = generateAlertMessage('api-call', metrics, 'warning');
      expect(message).toContain('6.0s');
      expect(message).toContain('600MB');
    });

    test('handles invalid inputs', () => {
      expect(generateAlertMessage(null, {}, 'info')).toBe('');
      expect(generateAlertMessage('op', null, 'info')).toBe('');
    });
  });

  describe('calculateTrend', () => {
    test('detects degrading trend', () => {
      const samples = [100, 110, 120, 200, 210, 220];
      expect(calculateTrend(samples)).toBe('degrading');
    });

    test('detects improving trend', () => {
      const samples = [200, 210, 220, 100, 110, 120];
      expect(calculateTrend(samples)).toBe('improving');
    });

    test('detects stable trend', () => {
      const samples = [100, 105, 110, 108, 112, 115];
      expect(calculateTrend(samples)).toBe('stable');
    });

    test('handles insufficient data', () => {
      expect(calculateTrend([100])).toBe('stable');
      expect(calculateTrend([])).toBe('stable');
    });

    test('handles invalid input', () => {
      expect(calculateTrend(null)).toBe('stable');
      expect(calculateTrend('not an array')).toBe('stable');
    });
  });

  describe('shouldAlert', () => {
    test('alerts on significant deviation', () => {
      const recent = [100, 110, 120];
      const current = 300; // > 2x average
      expect(shouldAlert(recent, current, 5000)).toBe(true);
    });

    test('alerts on threshold exceeded', () => {
      const recent = [100, 110, 120];
      const current = 6000; // exceeds threshold
      expect(shouldAlert(recent, current, 5000)).toBe(true);
    });

    test('does not alert on normal duration', () => {
      const recent = [100, 110, 120];
      const current = 115; // within normal range
      expect(shouldAlert(recent, current, 5000)).toBe(false);
    });

    test('alerts on first sample exceeding threshold', () => {
      expect(shouldAlert([], 6000, 5000)).toBe(true);
    });

    test('does not alert on first sample within threshold', () => {
      expect(shouldAlert([], 4000, 5000)).toBe(false);
    });
  });

  describe('createPerformanceSummary', () => {
    test('creates summary for slow duration', () => {
      const metrics = { duration: 6000 };
      const summary = createPerformanceSummary(metrics, DEFAULT_THRESHOLDS);

      expect(summary.status).toBe('warning');
      expect(summary.issues).toHaveLength(1);
      expect(summary.issues[0]).toContain('Duration');
      expect(summary.recommendations).toHaveLength(1);
    });

    test('creates summary for high memory', () => {
      const metrics = { memory: { heapUsed: 1100 } };
      const summary = createPerformanceSummary(metrics, DEFAULT_THRESHOLDS);

      expect(summary.status).toBe('critical');
      expect(summary.issues).toHaveLength(1);
      expect(summary.issues[0]).toContain('Memory');
      expect(summary.recommendations).toHaveLength(1);
    });

    test('creates summary for multiple issues', () => {
      const metrics = { duration: 35000, memory: { heapUsed: 1100 } };
      const summary = createPerformanceSummary(metrics, DEFAULT_THRESHOLDS);

      expect(summary.status).toBe('critical');
      expect(summary.issues).toHaveLength(2);
      expect(summary.recommendations).toHaveLength(2);
    });

    test('creates clean summary for normal metrics', () => {
      const metrics = { duration: 1000, memory: { heapUsed: 100 } };
      const summary = createPerformanceSummary(metrics, DEFAULT_THRESHOLDS);

      expect(summary.status).toBe('info');
      expect(summary.issues).toHaveLength(0);
      expect(summary.recommendations).toHaveLength(0);
    });

    test('handles invalid inputs', () => {
      const summary = createPerformanceSummary(null, null);
      expect(summary.status).toBe('info');
      expect(summary.issues).toHaveLength(0);
    });
  });

  describe('validateThresholds', () => {
    test('validates correct thresholds', () => {
      const thresholds = {
        DURATION_WARNING: 5000,
        DURATION_CRITICAL: 30000,
      };
      expect(validateThresholds(thresholds)).toBe(true);
    });

    test('rejects warning >= critical', () => {
      const thresholds = {
        DURATION_WARNING: 30000,
        DURATION_CRITICAL: 5000,
      };
      expect(validateThresholds(thresholds)).toBe(false);
    });

    test('rejects equal warning and critical', () => {
      const thresholds = {
        DURATION_WARNING: 5000,
        DURATION_CRITICAL: 5000,
      };
      expect(validateThresholds(thresholds)).toBe(false);
    });

    test('validates memory thresholds', () => {
      const thresholds = {
        MEMORY_WARNING: 536870912,
        MEMORY_CRITICAL: 1073741824,
      };
      expect(validateThresholds(thresholds)).toBe(true);
    });

    test('handles partial thresholds', () => {
      expect(validateThresholds({ DURATION_WARNING: 5000 })).toBe(true);
      expect(validateThresholds({ MEMORY_CRITICAL: 1073741824 })).toBe(true);
    });

    test('handles invalid inputs', () => {
      expect(validateThresholds(null)).toBe(false);
      expect(validateThresholds('invalid')).toBe(false);
    });
  });
});

describe('Performance Monitoring Module - PerformanceMonitor Class', () => {
  let monitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor({}, { silent: true });
  });

  afterEach(() => {
    monitor.clearAlerts();
    monitor.clearHistory();
  });

  describe('constructor', () => {
    test('initializes with default thresholds', () => {
      const thresholds = monitor.getThresholds();
      expect(thresholds.DURATION_WARNING).toBe(5000);
      expect(thresholds.DURATION_CRITICAL).toBe(30000);
    });

    test('accepts custom thresholds', () => {
      const customMonitor = new PerformanceMonitor({
        DURATION_WARNING: 3000,
      });

      const thresholds = customMonitor.getThresholds();
      expect(thresholds.DURATION_WARNING).toBe(3000);
      expect(thresholds.DURATION_CRITICAL).toBe(30000); // default
    });

    test('rejects invalid thresholds', () => {
      const invalidMonitor = new PerformanceMonitor(
        {
          DURATION_WARNING: 30000,
          DURATION_CRITICAL: 5000, // invalid: warning >= critical
        },
        { silent: true }
      );

      const thresholds = invalidMonitor.getThresholds();
      expect(thresholds).toEqual(DEFAULT_THRESHOLDS);
    });
  });

  describe('enable / disable', () => {
    test('enables monitoring', () => {
      monitor.disable();
      monitor.enable();

      const alert = monitor.checkMetrics('test-op', { duration: 6000 });
      expect(alert).not.toBeNull();
    });

    test('disables monitoring', () => {
      monitor.disable();

      const alert = monitor.checkMetrics('test-op', { duration: 6000 });
      expect(alert).toBeNull();
    });
  });

  describe('checkMetrics', () => {
    test('generates alert for slow duration', () => {
      const metrics = { duration: 6000, memory: { heapUsed: 100 } };
      const alert = monitor.checkMetrics('db-query', metrics);

      expect(alert).not.toBeNull();
      expect(alert.severity).toBe('warning');
      expect(alert.operationId).toBe('db-query');
      expect(alert.message).toContain('6.0s');
    });

    test('generates alert for critical duration', () => {
      const metrics = { duration: 35000 };
      const alert = monitor.checkMetrics('slow-operation', metrics);

      expect(alert).not.toBeNull();
      expect(alert.severity).toBe('critical');
    });

    test('does not alert for normal metrics', () => {
      const metrics = { duration: 1000, memory: { heapUsed: 100 } };
      const alert = monitor.checkMetrics('fast-op', metrics);

      expect(alert).toBeNull();
    });

    test('tracks operation history', () => {
      monitor.checkMetrics('op1', { duration: 1000 });
      monitor.checkMetrics('op1', { duration: 1100 });
      monitor.checkMetrics('op1', { duration: 1200 });

      const trend = monitor.getTrend('op1');
      expect(trend).toBeTruthy();
    });

    test('limits history window', () => {
      // Add more samples than TRENDING_WINDOW
      for (let i = 0; i < 15; i++) {
        monitor.checkMetrics('op1', { duration: 1000 + i * 10 });
      }

      const history = monitor.history.get('op1');
      expect(history.length).toBeLessThanOrEqual(DEFAULT_THRESHOLDS.TRENDING_WINDOW);
    });

    test('handles invalid inputs', () => {
      expect(monitor.checkMetrics(null, {})).toBeNull();
      expect(monitor.checkMetrics('op', null)).toBeNull();
    });
  });

  describe('getSummary', () => {
    test('returns performance summary', () => {
      const metrics = { duration: 6000, memory: { heapUsed: 600 } };
      const summary = monitor.getSummary('op1', metrics);

      expect(summary.status).toBe('warning');
      expect(summary.issues.length).toBeGreaterThan(0);
      expect(summary.recommendations.length).toBeGreaterThan(0);
    });

    test('handles invalid inputs', () => {
      const summary = monitor.getSummary(null, null);
      expect(summary.status).toBe('info');
    });
  });

  describe('getRecentAlerts', () => {
    test('returns recent alerts', () => {
      // Generate multiple alerts
      for (let i = 0; i < 5; i++) {
        monitor.checkMetrics(`op${i}`, { duration: 6000 });
      }

      const recent = monitor.getRecentAlerts(3);
      expect(recent).toHaveLength(3);
    });

    test('returns all alerts if count exceeds total', () => {
      monitor.checkMetrics('op1', { duration: 6000 });
      monitor.checkMetrics('op2', { duration: 6000 });

      const recent = monitor.getRecentAlerts(10);
      expect(recent).toHaveLength(2);
    });
  });

  describe('getAlertsForOperation', () => {
    test('returns alerts for specific operation', () => {
      monitor.checkMetrics('op1', { duration: 6000 });
      monitor.checkMetrics('op2', { duration: 6000 });
      monitor.checkMetrics('op1', { duration: 7000 });

      const op1Alerts = monitor.getAlertsForOperation('op1');
      expect(op1Alerts).toHaveLength(2);
      expect(op1Alerts.every((a) => a.operationId === 'op1')).toBe(true);
    });

    test('returns empty array for unknown operation', () => {
      const alerts = monitor.getAlertsForOperation('unknown');
      expect(alerts).toHaveLength(0);
    });
  });

  describe('getTrend', () => {
    test('calculates trend from history', () => {
      // Add samples with degrading trend
      for (let i = 0; i < 10; i++) {
        monitor.checkMetrics('op1', { duration: 1000 + i * 100 });
      }

      const trend = monitor.getTrend('op1');
      expect(trend).toBe('degrading');
    });

    test('returns null for insufficient data', () => {
      monitor.checkMetrics('op1', { duration: 1000 });
      expect(monitor.getTrend('op1')).toBeNull();
    });

    test('returns null for unknown operation', () => {
      expect(monitor.getTrend('unknown')).toBeNull();
    });
  });

  describe('clearAlerts', () => {
    test('clears all alerts', () => {
      monitor.checkMetrics('op1', { duration: 6000 });
      monitor.checkMetrics('op2', { duration: 6000 });

      expect(monitor.alerts).toHaveLength(2);

      monitor.clearAlerts();
      expect(monitor.alerts).toHaveLength(0);
    });
  });

  describe('clearHistory', () => {
    test('clears history for specific operation', () => {
      monitor.checkMetrics('op1', { duration: 1000 });
      monitor.checkMetrics('op2', { duration: 1000 });

      monitor.clearHistory('op1');

      expect(monitor.history.has('op1')).toBe(false);
      expect(monitor.history.has('op2')).toBe(true);
    });

    test('clears all history when no operationId provided', () => {
      monitor.checkMetrics('op1', { duration: 1000 });
      monitor.checkMetrics('op2', { duration: 1000 });

      monitor.clearHistory();

      expect(monitor.history.size).toBe(0);
    });
  });

  describe('updateThresholds', () => {
    test('updates thresholds successfully', () => {
      const result = monitor.updateThresholds({ DURATION_WARNING: 3000 });

      expect(result).toBe(true);
      expect(monitor.getThresholds().DURATION_WARNING).toBe(3000);
    });

    test('rejects invalid thresholds', () => {
      const result = monitor.updateThresholds({
        DURATION_WARNING: 30000,
        DURATION_CRITICAL: 5000,
      });

      expect(result).toBe(false);
      expect(monitor.getThresholds()).toEqual(DEFAULT_THRESHOLDS);
    });

    test('handles invalid input', () => {
      const result = monitor.updateThresholds(null);
      expect(result).toBe(false);
    });
  });

  describe('getThresholds', () => {
    test('returns copy of thresholds', () => {
      const thresholds = monitor.getThresholds();
      thresholds.DURATION_WARNING = 999; // mutate copy

      // Original should be unchanged
      expect(monitor.getThresholds().DURATION_WARNING).toBe(5000);
    });
  });
});
