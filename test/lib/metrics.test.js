/**
 * Tests for Metrics module
 * @version 1.0.0
 * @description Test suite for metrics collection
 * @module test/lib/metrics
 */

import { Metrics } from '../../src/lib/metrics.js';
import { Config } from '../../src/lib/config.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Metrics', () => {
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
