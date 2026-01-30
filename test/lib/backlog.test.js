/**
 * Tests for Backlog module
 */

import { Backlog } from '../../src/lib/backlog.js';
import { Config } from '../../src/lib/config.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Backlog', () => {
  let backlog;
  let config;
  let tempDir;

  beforeEach(async () => {
    // Create temp directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'backlog-test-'));
    config = new Config(tempDir);
    backlog = new Backlog(config);
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('createWorkflowSummary', () => {
    it('should create workflow summary file', async () => {
      const workflowStatus = new Map();
      workflowStatus.set(0, { status: 'passed' });
      workflowStatus.set(1, { status: 'failed' });

      const summaryFile = await backlog.createWorkflowSummary({
        workflowStatus,
        analysisContext: {
          commits: 'HEAD~3..HEAD',
          modified: '5 files',
          changeScope: 'mixed',
        },
        dryRun: false,
      });

      const content = await fs.readFile(summaryFile, 'utf8');
      expect(content).toContain('# Workflow Execution Summary');
      expect(content).toContain(config.workflowRunId);
      expect(content).toContain('- **Step 0:** ✅');
      expect(content).toContain('- **Step 1:** ❌');
      expect(content).toContain('Change Scope:** mixed');
    });

    it('should handle dry run mode', async () => {
      const summaryFile = await backlog.createWorkflowSummary({
        workflowStatus: new Map(),
        analysisContext: {},
        dryRun: true,
      });

      // In dry run, file shouldn't be created
      const exists = await fs
        .access(summaryFile)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it('should show all 15 steps', async () => {
      const summaryFile = await backlog.createWorkflowSummary({
        workflowStatus: new Map(),
        analysisContext: {},
        dryRun: false,
      });

      const content = await fs.readFile(summaryFile, 'utf8');

      for (let i = 0; i < 15; i++) {
        expect(content).toContain(`Step ${i}:`);
      }
    });

    it('should handle empty status as skipped', async () => {
      const summaryFile = await backlog.createWorkflowSummary({
        workflowStatus: new Map(),
        analysisContext: {},
        dryRun: false,
      });

      const content = await fs.readFile(summaryFile, 'utf8');
      expect(content).toContain('⏭️');
    });
  });

  describe('createStepReport', () => {
    it('should create step report file', async () => {
      const reportData = {
        name: 'Test Execution',
        status: 'passed',
        summary: 'All tests passed successfully',
        details: 'Ran 42 tests in 3.2s',
      };

      const reportFile = await backlog.createStepReport(7, reportData);

      const content = await fs.readFile(reportFile, 'utf8');
      expect(content).toContain('# Step 7 Report');
      expect(content).toContain('Test Execution');
      expect(content).toContain('passed');
      expect(content).toContain('All tests passed successfully');
      expect(content).toContain('Ran 42 tests in 3.2s');
    });

    it('should pad step number with zeros', async () => {
      const reportFile = await backlog.createStepReport(3, {});
      expect(reportFile).toContain('step_03.md');
    });

    it('should handle missing report data', async () => {
      const reportFile = await backlog.createStepReport(5, {});

      const content = await fs.readFile(reportFile, 'utf8');
      expect(content).toContain('No summary available');
      expect(content).toContain('No details available');
    });
  });

  describe('listWorkflowRuns', () => {
    it('should return empty array when backlog dir does not exist', async () => {
      const runs = await backlog.listWorkflowRuns();
      expect(runs).toEqual([]);
    });

    it('should list workflow run directories', async () => {
      // Create some test run directories
      const backlogDir = config.backlogDir;
      await fs.mkdir(backlogDir, { recursive: true });
      await fs.mkdir(path.join(backlogDir, 'workflow_20260130_120000'));
      await fs.mkdir(path.join(backlogDir, 'workflow_20260130_130000'));
      await fs.writeFile(path.join(backlogDir, 'file.txt'), 'test'); // file, not dir

      const runs = await backlog.listWorkflowRuns();

      expect(runs).toHaveLength(2);
      expect(runs).toContain('workflow_20260130_120000');
      expect(runs).toContain('workflow_20260130_130000');
      expect(runs).not.toContain('file.txt');
    });
  });
});
