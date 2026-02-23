/**
 * Tests for Backlog module (Pure Functions + Wrapper)
 * @version 2.0.0
 * @description Test suite for backlog management with referential transparency
 * @module test/lib/backlog
 */

import {
  Backlog,
  getStatusEmoji,
  formatExecutionMode,
  buildStepStatusList,
  buildChangeAnalysisSection,
  generateSummaryContent,
  generateStepReportContent,
} from '../../src/lib/backlog.js';
import { Config } from '../../src/lib/config.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Backlog - Pure Functions', () => {
  describe('getStatusEmoji', () => {
    test('should return correct emoji for each status', () => {
      expect(getStatusEmoji('passed')).toBe('✅');
      expect(getStatusEmoji('failed')).toBe('❌');
      expect(getStatusEmoji('skipped')).toBe('⏭️');
      expect(getStatusEmoji('running')).toBe('▶️');
      expect(getStatusEmoji('pending')).toBe('⏸️');
    });

    test('should return default emoji for unknown status', () => {
      expect(getStatusEmoji('unknown')).toBe('⏭️');
      expect(getStatusEmoji(null)).toBe('⏭️');
      expect(getStatusEmoji(undefined)).toBe('⏭️');
    });

    test('should be referentially transparent', () => {
      const result1 = getStatusEmoji('passed');
      const result2 = getStatusEmoji('passed');
      expect(result1).toBe(result2);
    });
  });

  describe('formatExecutionMode', () => {
    test('should format auto mode', () => {
      expect(formatExecutionMode({ auto: true })).toBe('Automatic');
    });

    test('should format interactive mode', () => {
      expect(formatExecutionMode({ interactive: true })).toBe('Interactive');
    });

    test('should format dry run mode', () => {
      expect(formatExecutionMode({ dryRun: true })).toBe('Dry Run');
    });

    test('should return Unknown for unrecognized mode', () => {
      expect(formatExecutionMode({})).toBe('Unknown');
    });

    test('should prioritize auto over interactive', () => {
      expect(formatExecutionMode({ auto: true, interactive: true })).toBe('Automatic');
    });
  });

  describe('buildStepStatusList', () => {
    test('should build step status list for all steps', () => {
      const workflowStatus = new Map();
      workflowStatus.set(0, { status: 'passed' });
      workflowStatus.set(1, { status: 'failed' });
      workflowStatus.set(2, { status: 'skipped' });

      const result = buildStepStatusList(workflowStatus, 3);

      expect(result).toContain('- **Step 0:** ✅');
      expect(result).toContain('- **Step 1:** ❌');
      expect(result).toContain('- **Step 2:** ⏭️');
    });

    test('should handle missing status as pending', () => {
      const workflowStatus = new Map();
      const result = buildStepStatusList(workflowStatus, 2);

      expect(result).toContain('- **Step 0:** ⏭️');
      expect(result).toContain('- **Step 1:** ⏭️');
    });

    test('should default to 15 steps', () => {
      const workflowStatus = new Map();
      const result = buildStepStatusList(workflowStatus);

      const lines = result.split('\n').filter((l) => l.trim());
      expect(lines).toHaveLength(15);
    });
  });

  describe('buildChangeAnalysisSection', () => {
    test('should build change analysis with all fields', () => {
      const analysisContext = {
        changeScope: 'mixed',
        commits: 'HEAD~3..HEAD',
        modified: '5 files',
      };

      const result = buildChangeAnalysisSection(analysisContext);

      expect(result).toContain('**Change Scope:** mixed');
      expect(result).toContain('**Commits Ahead:** HEAD~3..HEAD');
      expect(result).toContain('**Modified Files:** 5 files');
    });

    test('should handle missing fields with defaults', () => {
      const result = buildChangeAnalysisSection({});

      expect(result).toContain('**Change Scope:** Not specified');
      expect(result).toContain('**Commits Ahead:** 0');
      expect(result).toContain('**Modified Files:** 0');
    });
  });

  describe('generateSummaryContent', () => {
    test('should generate complete summary markdown', () => {
      const metadata = {
        workflowRunId: 'workflow_123',
        scriptVersion: '1.0.0',
        scriptName: 'Test Script',
        totalSteps: 3,
      };
      const executionMode = { auto: true };
      const workflowStatus = new Map([[0, { status: 'passed' }]]);
      const analysisContext = { changeScope: 'docs' };
      const timestamp = '2026-01-30 12:00:00';

      const result = generateSummaryContent({
        metadata,
        executionMode,
        workflowStatus,
        analysisContext,
        timestamp,
      });

      expect(result).toContain('# Workflow Execution Summary');
      expect(result).toContain('**Workflow Run ID:** workflow_123');
      expect(result).toContain('**Execution Date:** 2026-01-30 12:00:00');
      expect(result).toContain('**Mode:** Automatic');
      expect(result).toContain('- **Step 0:** ✅');
      expect(result).toContain('**Change Scope:** docs');
      expect(result).toContain('Generated by:** Test Script v1.0.0');
    });

    test('should be referentially transparent', () => {
      const params = {
        metadata: {
          workflowRunId: 'test',
          scriptVersion: '1.0.0',
          scriptName: 'Test',
          totalSteps: 2,
        },
        executionMode: { interactive: true },
        workflowStatus: new Map(),
        analysisContext: {},
        timestamp: '2026-01-30',
      };

      const result1 = generateSummaryContent(params);
      const result2 = generateSummaryContent(params);

      expect(result1).toBe(result2);
    });
  });

  describe('generateStepReportContent', () => {
    test('should generate step report markdown', () => {
      const reportData = {
        name: 'Test Step',
        status: 'passed',
        summary: 'Step summary',
        details: 'Step details',
      };
      const timestamp = '2026-01-30 12:00:00';

      const result = generateStepReportContent(5, reportData, timestamp);

      expect(result).toContain('# Step 5 Report');
      expect(result).toContain('**Step:** Test Step');
      expect(result).toContain('**Status:** passed');
      expect(result).toContain('**Timestamp:** 2026-01-30 12:00:00');
      expect(result).toContain('Step summary');
      expect(result).toContain('Step details');
    });

    test('should handle missing report data', () => {
      const result = generateStepReportContent(3, {}, '2026-01-30');

      expect(result).toContain('**Step:** Step 3');
      expect(result).toContain('**Status:** Unknown');
      expect(result).toContain('No summary available');
      expect(result).toContain('No details available');
    });

    test('should be referentially transparent', () => {
      const result1 = generateStepReportContent(1, { name: 'Test' }, '2026-01-30');
      const result2 = generateStepReportContent(1, { name: 'Test' }, '2026-01-30');

      expect(result1).toBe(result2);
    });

    test('should format array summary as markdown list', () => {
      const reportData = {
        name: 'UX_Analysis',
        status: '✅',
        summary: [
          {
            type: 'error',
            message: 'AI helper not available. Initialize first.',
            location: 'step_15_ux_analysis',
          },
        ],
      };
      const result = generateStepReportContent(15, reportData, '2026-02-23');

      expect(result).toContain(
        '- **error**: AI helper not available. Initialize first. (step_15_ux_analysis)'
      );
      expect(result).not.toContain('[object Object]');
    });

    test('should format array of plain strings as markdown list', () => {
      const reportData = {
        name: 'Test',
        status: '✅',
        summary: ['item one', 'item two'],
      };
      const result = generateStepReportContent(7, reportData, '2026-02-23');

      expect(result).toContain('- item one');
      expect(result).toContain('- item two');
    });

    test('should serialize plain objects as JSON', () => {
      const reportData = {
        name: 'Test',
        status: '✅',
        summary: { foo: 'bar' },
      };
      const result = generateStepReportContent(7, reportData, '2026-02-23');

      expect(result).toContain('"foo": "bar"');
      expect(result).not.toContain('[object Object]');
    });
  });
});

describe('Backlog - Wrapper Class', () => {
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
