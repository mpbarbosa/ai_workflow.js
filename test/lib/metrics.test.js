/**
 * Tests for Metrics module (Pure Functions + Wrapper)
 * @version 2.0.0
 * @description Test suite for metrics collection with referential transparency
 * @module test/lib/metrics
 */

import {
  Metrics,
  formatISOTimestamp,
  convertToEpochSeconds,
  getExecutionModeString,
  calculateDuration,
  addStepTiming,
  updateStepCounters,
  formatDuration,
  getStatusEmoji,
  createInitialMetricsData,
  createMetricsData,
  generateMetricsSummary,
} from '../../src/lib/metrics.js';
import { Config } from '../../src/lib/config.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Metrics - Pure Functions', () => {
  describe('formatISOTimestamp', () => {
    test('should format timestamp to ISO string', () => {
      const timestamp = formatISOTimestamp(1706576169000);

      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('should be referentially transparent', () => {
      const ts1 = formatISOTimestamp(1000000);
      const ts2 = formatISOTimestamp(1000000);

      expect(ts1).toBe(ts2);
    });
  });

  describe('convertToEpochSeconds', () => {
    test('should convert milliseconds to seconds', () => {
      expect(convertToEpochSeconds(1000)).toBe(1);
      expect(convertToEpochSeconds(5500)).toBe(5);
      expect(convertToEpochSeconds(999)).toBe(0);
    });
  });

  describe('getExecutionModeString', () => {
    test('should return dry-run mode', () => {
      expect(getExecutionModeString({ dryRun: true })).toBe('dry-run');
    });

    test('should return auto mode', () => {
      expect(getExecutionModeString({ auto: true })).toBe('auto');
    });

    test('should return interactive mode', () => {
      expect(getExecutionModeString({ interactive: true })).toBe('interactive');
    });

    test('should prioritize dryRun over auto', () => {
      expect(getExecutionModeString({ dryRun: true, auto: true })).toBe('dry-run');
    });
  });

  describe('calculateDuration', () => {
    test('should calculate duration correctly', () => {
      expect(calculateDuration(1000, 2500)).toBe(1500);
      expect(calculateDuration(0, 1000)).toBe(1000);
    });

    test('should be referentially transparent', () => {
      const d1 = calculateDuration(100, 200);
      const d2 = calculateDuration(100, 200);

      expect(d1).toBe(d2);
      expect(d1).toBe(100);
    });
  });

  describe('addStepTiming', () => {
    test('should add timing to map', () => {
      const map = new Map();
      const newMap = addStepTiming(map, 0, 1000);

      expect(newMap.get(0)).toBe(1000);
      expect(map.size).toBe(0); // Original unchanged
    });

    test('should not mutate original map', () => {
      const map = new Map([[0, 500]]);
      const newMap = addStepTiming(map, 1, 1000);

      expect(map.size).toBe(1);
      expect(newMap.size).toBe(2);
    });
  });

  describe('updateStepCounters', () => {
    test('should increment completed for passed status', () => {
      const counters = { stepsCompleted: 0, stepsFailed: 0, stepsSkipped: 0 };
      const newCounters = updateStepCounters(counters, 'passed');

      expect(newCounters.stepsCompleted).toBe(1);
      expect(counters.stepsCompleted).toBe(0); // Original unchanged
    });

    test('should increment failed for failed status', () => {
      const counters = { stepsCompleted: 0, stepsFailed: 0, stepsSkipped: 0 };
      const newCounters = updateStepCounters(counters, 'failed');

      expect(newCounters.stepsFailed).toBe(1);
    });

    test('should increment skipped for skipped status', () => {
      const counters = { stepsCompleted: 0, stepsFailed: 0, stepsSkipped: 0 };
      const newCounters = updateStepCounters(counters, 'skipped');

      expect(newCounters.stepsSkipped).toBe(1);
    });
  });

  describe('formatDuration', () => {
    test('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    test('should format seconds', () => {
      expect(formatDuration(1000)).toBe('1.00s');
      expect(formatDuration(5500)).toBe('5.50s');
    });

    test('should format minutes', () => {
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(125000)).toBe('2m 5s');
    });
  });

  describe('getStatusEmoji', () => {
    test('should return correct emoji', () => {
      expect(getStatusEmoji('passed')).toBe('✅');
      expect(getStatusEmoji('failed')).toBe('❌');
      expect(getStatusEmoji('skipped')).toBe('⏭️');
      expect(getStatusEmoji('unknown')).toBe('⏭️');
    });
  });

  describe('createInitialMetricsData', () => {
    test('should create initial metrics object', () => {
      const data = createInitialMetricsData(
        'run_123',
        '2026-01-30T12:00:00Z',
        1706616000,
        '1.0.0',
        'auto'
      );

      expect(data).toEqual({
        workflow_run_id: 'run_123',
        start_time: '2026-01-30T12:00:00Z',
        start_epoch: 1706616000,
        version: '1.0.0',
        mode: 'auto',
        steps: {},
      });
    });
  });

  describe('createMetricsData', () => {
    test('should create complete metrics data object', () => {
      const stepDurations = new Map([[0, 1000]]);
      const stepStatuses = new Map([[0, 'passed']]);
      const stepStartTimes = new Map([[0, 100]]);
      const stepEndTimes = new Map([[0, 1100]]);

      const data = createMetricsData({
        workflowRunId: 'run_123',
        startEpoch: 1000,
        endEpoch: 2000,
        duration: 1000,
        version: '1.0.0',
        mode: 'auto',
        success: true,
        stepsCompleted: 1,
        stepsFailed: 0,
        stepsSkipped: 0,
        stepDurations,
        stepStatuses,
        stepStartTimes,
        stepEndTimes,
      });

      expect(data.workflow_run_id).toBe('run_123');
      expect(data.duration_ms).toBe(1000);
      expect(data.success).toBe(true);
      expect(data.steps[0]).toEqual({
        duration_ms: 1000,
        status: 'passed',
        start_time: 100,
        end_time: 1100,
      });
    });
  });

  describe('generateMetricsSummary', () => {
    test('should generate summary markdown', () => {
      const stepDurations = new Map([
        [0, 1000],
        [1, 2000],
      ]);
      const stepStatuses = new Map([
        [0, 'passed'],
        [1, 'failed'],
      ]);

      const summary = generateMetricsSummary({
        workflowRunId: 'run_123',
        timestamp: '2026-01-30 12:00:00',
        duration: 5000,
        success: true,
        stepsCompleted: 1,
        stepsFailed: 1,
        stepsSkipped: 0,
        stepDurations,
        stepStatuses,
      });

      expect(summary).toContain('# Workflow Metrics Summary');
      expect(summary).toContain('**Last Run:** run_123');
      expect(summary).toContain('**Duration:** 5.00s');
      expect(summary).toContain('**Status:** ✅ Success');
      expect(summary).toContain('| 0 | 1.00s | ✅ passed |');
      expect(summary).toContain('| 1 | 2.00s | ❌ failed |');
    });

    test('should be referentially transparent', () => {
      const params = {
        workflowRunId: 'test',
        timestamp: '2026-01-30',
        duration: 1000,
        success: false,
        stepsCompleted: 0,
        stepsFailed: 1,
        stepsSkipped: 0,
        stepDurations: new Map(),
        stepStatuses: new Map(),
      };

      const s1 = generateMetricsSummary(params);
      const s2 = generateMetricsSummary(params);

      expect(s1).toBe(s2);
    });
  });
});

describe('Metrics - Wrapper Class', () => {
  let metrics;
  let config;
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'metrics-test-'));
    config = new Config(tempDir);
    metrics = new Metrics(config);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('initMetrics', () => {
    it('should create metrics directory', async () => {
      await metrics.initMetrics();

      const dirExists = await fs
        .access(config.metricsDir)
        .then(() => true)
        .catch(() => false);

      expect(dirExists).toBe(true);
    });

    it('should create current run file', async () => {
      await metrics.initMetrics();

      const content = await fs.readFile(metrics.metricsCurrentFile, 'utf8');
      const data = JSON.parse(content);

      expect(data.workflow_run_id).toBe(config.workflowRunId);
      expect(data.version).toBe('1.0.0');
      expect(data.steps).toEqual({});
    });

    it('should create history file if not exists', async () => {
      await metrics.initMetrics();

      const fileExists = await fs
        .access(metrics.metricsHistoryFile)
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(true);
    });

    it('should not overwrite existing history file', async () => {
      await fs.mkdir(config.metricsDir, { recursive: true });
      await fs.writeFile(
        path.join(config.metricsDir, 'history.jsonl'),
        'existing content\n',
        'utf8'
      );

      await metrics.initMetrics();

      const content = await fs.readFile(metrics.metricsHistoryFile, 'utf8');
      expect(content).toBe('existing content\n');
    });
  });

  describe('step timing', () => {
    it('should track step start time', () => {
      metrics.startStepTimer(0);
      expect(metrics.stepStartTimes.get(0)).toBeGreaterThan(0);
    });

    it('should track step end time and duration', (done) => {
      metrics.startStepTimer(1);

      setTimeout(() => {
        metrics.endStepTimer(1, 'passed');

        const duration = metrics.getStepDuration(1);
        expect(duration).toBeGreaterThanOrEqual(50);
        expect(duration).toBeLessThan(200);

        expect(metrics.stepEndTimes.get(1)).toBeGreaterThan(0);
        done();
      }, 50);
    });

    it('should track step status', () => {
      metrics.startStepTimer(2);
      metrics.endStepTimer(2, 'failed');

      expect(metrics.getStepStatus(2)).toBe('failed');
    });

    it('should increment workflow counters', () => {
      metrics.startStepTimer(0);
      metrics.endStepTimer(0, 'passed');

      metrics.startStepTimer(1);
      metrics.endStepTimer(1, 'failed');

      metrics.startStepTimer(2);
      metrics.endStepTimer(2, 'skipped');

      expect(metrics.workflowStepsCompleted).toBe(1);
      expect(metrics.workflowStepsFailed).toBe(1);
      expect(metrics.workflowStepsSkipped).toBe(1);
    });
  });

  describe('getStepDuration', () => {
    it('should return null for non-existent step', () => {
      expect(metrics.getStepDuration(99)).toBeNull();
    });

    it('should return duration for completed step', () => {
      metrics.startStepTimer(3);
      metrics.stepDurations.set(3, 1500);

      expect(metrics.getStepDuration(3)).toBe(1500);
    });
  });

  describe('getStepStatus', () => {
    it('should return null for non-existent step', () => {
      expect(metrics.getStepStatus(99)).toBeNull();
    });

    it('should return status for completed step', () => {
      metrics.stepStatuses.set(4, 'passed');
      expect(metrics.getStepStatus(4)).toBe('passed');
    });
  });

  describe('markWorkflowComplete', () => {
    it('should mark workflow as successful', () => {
      metrics.workflowStartEpoch = Date.now() - 5000;
      metrics.markWorkflowComplete(true);

      expect(metrics.workflowSuccess).toBe(true);
      expect(metrics.workflowDuration).toBeGreaterThan(0);
      expect(metrics.workflowEndEpoch).toBeGreaterThan(0);
    });

    it('should mark workflow as failed', () => {
      metrics.workflowStartEpoch = Date.now();
      metrics.markWorkflowComplete(false);

      expect(metrics.workflowSuccess).toBe(false);
    });
  });

  describe('saveCurrentMetrics', () => {
    it('should save metrics to file', async () => {
      await metrics.initMetrics();

      metrics.workflowStartEpoch = Date.now() - 3000;
      metrics.markWorkflowComplete(true);

      metrics.startStepTimer(0);
      metrics.endStepTimer(0, 'passed');

      await metrics.saveCurrentMetrics();

      const content = await fs.readFile(metrics.metricsCurrentFile, 'utf8');
      const data = JSON.parse(content);

      expect(data.success).toBe(true);
      expect(data.steps_completed).toBe(1);
      expect(data.steps['0']).toBeDefined();
      expect(data.steps['0'].status).toBe('passed');
    });

    it('should throw if not initialized', async () => {
      await expect(metrics.saveCurrentMetrics()).rejects.toThrow('Metrics not initialized');
    });
  });

  describe('appendToHistory', () => {
    it('should append metrics to history file', async () => {
      await metrics.initMetrics();
      await metrics.saveCurrentMetrics();
      await metrics.appendToHistory();

      const content = await fs.readFile(metrics.metricsHistoryFile, 'utf8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(1);
      const data = JSON.parse(lines[0]);
      expect(data.workflow_run_id).toBe(config.workflowRunId);
    });

    it('should throw if not initialized', async () => {
      await expect(metrics.appendToHistory()).rejects.toThrow('Metrics not initialized');
    });
  });

  describe('generateSummary', () => {
    it('should generate summary markdown', async () => {
      await metrics.initMetrics();

      metrics.workflowStartEpoch = Date.now() - 5000;
      metrics.markWorkflowComplete(true);
      metrics.workflowStepsCompleted = 12;
      metrics.workflowStepsFailed = 1;
      metrics.workflowStepsSkipped = 2;

      metrics.stepDurations.set(0, 1500);
      metrics.stepStatuses.set(0, 'passed');

      await metrics.generateSummary();

      const content = await fs.readFile(metrics.metricsSummaryFile, 'utf8');

      expect(content).toContain('# Workflow Metrics Summary');
      expect(content).toContain(config.workflowRunId);
      expect(content).toContain('✅ Success');
      expect(content).toContain('Steps Completed:** 12');
      expect(content).toContain('Steps Failed:** 1');
      expect(content).toContain('Steps Skipped:** 2');
    });

    it('should throw if not initialized', async () => {
      await expect(metrics.generateSummary()).rejects.toThrow('Metrics not initialized');
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(metrics.formatDuration(500)).toBe('500ms');
      expect(metrics.formatDuration(999)).toBe('999ms');
    });

    it('should format seconds', () => {
      expect(metrics.formatDuration(1000)).toBe('1.00s');
      expect(metrics.formatDuration(2500)).toBe('2.50s');
      expect(metrics.formatDuration(59999)).toBe('60.00s');
    });

    it('should format minutes', () => {
      expect(metrics.formatDuration(60000)).toBe('1m 0s');
      expect(metrics.formatDuration(125000)).toBe('2m 5s');
      expect(metrics.formatDuration(3661000)).toBe('61m 1s');
    });
  });

  describe('getAllMetrics', () => {
    it('should return all metrics data', () => {
      metrics.workflowStartEpoch = Date.now() - 5000;
      metrics.startStepTimer(0);
      metrics.endStepTimer(0, 'passed');
      metrics.markWorkflowComplete(true);

      const allMetrics = metrics.getAllMetrics();

      expect(allMetrics.workflow).toBeDefined();
      expect(allMetrics.workflow.success).toBe(true);
      expect(allMetrics.workflow.stepsCompleted).toBe(1);

      expect(allMetrics.steps).toBeDefined();
      expect(allMetrics.steps[0]).toBeDefined();
      expect(allMetrics.steps[0].status).toBe('passed');
    });
  });
});
