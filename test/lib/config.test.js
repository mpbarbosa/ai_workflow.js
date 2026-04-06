/**
 * Tests for Config module (Pure Functions + Wrapper)
 * @version 2.0.0
 * @description Test suite for workflow configuration with referential transparency
 * @module test/lib/config
 */

import {
  Config,
  generateTimestamp,
  generateWorkflowRunId,
  calculatePaths,
  createMetadata,
  createExecutionMode,
  createAnalysisContext,
  addTempFile,
  createStepStatus,
  updateStepStatusMap,
  calculateElapsedTime,
  resolveProjectRoot,
} from '../../src/lib/config.js';
import path from 'path';

describe('Config - Pure Functions', () => {
  describe('generateTimestamp', () => {
    test('should generate timestamp in correct format', () => {
      const date = new Date('2026-01-30T12:34:56Z');
      const timestamp = generateTimestamp(date);

      expect(timestamp).toMatch(/^\d{8}_\d{6}$/);
      expect(timestamp).toContain('20260130');
    });

    test('should be referentially transparent', () => {
      const date = new Date('2026-01-30T12:00:00Z');
      const ts1 = generateTimestamp(date);
      const ts2 = generateTimestamp(date);

      expect(ts1).toBe(ts2);
    });

    test('should pad numbers correctly', () => {
      const date = new Date(2026, 0, 5, 3, 4, 5); // Local time: Jan 5, 2026, 03:04:05
      const timestamp = generateTimestamp(date);

      expect(timestamp).toMatch(/^20260105_030405$/);
    });
  });

  describe('generateWorkflowRunId', () => {
    test('should generate workflow run ID', () => {
      const runId = generateWorkflowRunId('20260130_120000');

      expect(runId).toBe('workflow_20260130_120000');
    });

    test('should be referentially transparent', () => {
      const runId1 = generateWorkflowRunId('test');
      const runId2 = generateWorkflowRunId('test');

      expect(runId1).toBe(runId2);
    });
  });

  describe('calculatePaths', () => {
    test('should calculate all paths correctly', () => {
      const projectRoot = '/test/project';
      const workflowRunId = 'workflow_123';

      const paths = calculatePaths(projectRoot, workflowRunId);

      expect(paths.projectRoot).toBe('/test/project');
      expect(paths.srcDir).toBe('/test/project/src');
      expect(paths.docsDir).toBe('/test/project/docs');
      expect(paths.artifactDir).toBe('/test/project/.ai_workflow');
      expect(paths.backlogRunDir).toBe('/test/project/.ai_workflow/backlog/workflow_123');
    });

    test('should be referentially transparent', () => {
      const paths1 = calculatePaths('/test', 'run1');
      const paths2 = calculatePaths('/test', 'run1');

      expect(paths1).toEqual(paths2);
    });
  });

  describe('createMetadata', () => {
    test('should create metadata object', () => {
      const metadata = createMetadata('1.0.0', 'Test', 'run_123', 15, 1000);

      expect(metadata).toEqual({
        scriptVersion: '1.0.0',
        scriptName: 'Test',
        workflowRunId: 'run_123',
        totalSteps: 15,
        workflowStartTime: 1000,
      });
    });
  });

  describe('createExecutionMode', () => {
    test('should create execution mode object', () => {
      const mode = createExecutionMode(true, false, false);

      expect(mode).toEqual({
        dryRun: true,
        interactive: false,
        auto: false,
      });
    });
  });

  describe('createAnalysisContext', () => {
    test('should create analysis context object', () => {
      const context = createAnalysisContext('HEAD~3', '5 files', 'mixed');

      expect(context).toEqual({
        commits: 'HEAD~3',
        modified: '5 files',
        changeScope: 'mixed',
      });
    });
  });

  describe('addTempFile', () => {
    test('should add file to list', () => {
      const files = ['file1.txt'];
      const newFiles = addTempFile(files, 'file2.txt');

      expect(newFiles).toEqual(['file1.txt', 'file2.txt']);
      expect(files).toEqual(['file1.txt']); // Original unchanged
    });

    test('should not mutate original array', () => {
      const files = [];
      const newFiles = addTempFile(files, 'test.txt');

      expect(files).toEqual([]);
      expect(newFiles).toEqual(['test.txt']);
    });
  });

  describe('createStepStatus', () => {
    test('should create step status object', () => {
      const status = createStepStatus('passed', 1000, { duration: 500 });

      expect(status).toEqual({
        status: 'passed',
        timestamp: 1000,
        duration: 500,
      });
    });

    test('should handle empty metadata', () => {
      const status = createStepStatus('failed', 2000);

      expect(status).toEqual({
        status: 'failed',
        timestamp: 2000,
      });
    });
  });

  describe('updateStepStatusMap', () => {
    test('should update status map', () => {
      const statusMap = new Map();
      const newMap = updateStepStatusMap(statusMap, 0, 'passed', 1000, { test: true });

      expect(newMap.get(0)).toEqual({
        status: 'passed',
        timestamp: 1000,
        test: true,
      });
      expect(statusMap.size).toBe(0); // Original unchanged
    });

    test('should not mutate original map', () => {
      const statusMap = new Map([[0, { status: 'pending', timestamp: 500 }]]);
      const newMap = updateStepStatusMap(statusMap, 1, 'passed', 1000);

      expect(statusMap.size).toBe(1);
      expect(newMap.size).toBe(2);
    });
  });

  describe('calculateElapsedTime', () => {
    test('should calculate elapsed time', () => {
      const elapsed = calculateElapsedTime(1000, 2500);

      expect(elapsed).toBe(1500);
    });

    test('should be referentially transparent', () => {
      const elapsed1 = calculateElapsedTime(100, 200);
      const elapsed2 = calculateElapsedTime(100, 200);

      expect(elapsed1).toBe(elapsed2);
      expect(elapsed1).toBe(100);
    });

    test('should return zero when start and end are equal', () => {
      expect(calculateElapsedTime(1000, 1000)).toBe(0);
    });

    test('should return negative value when start is after end', () => {
      expect(calculateElapsedTime(2500, 1000)).toBe(-1500);
    });
  });

  describe('resolveProjectRoot', () => {
    test('should resolve project root from dirname', () => {
      const dirname = '/test/project/src/lib';
      const root = resolveProjectRoot(dirname);

      expect(root).toBe(path.resolve(dirname, '../..'));
    });
  });
});

describe('Config - Wrapper Class', () => {
  let config;

  beforeEach(() => {
    config = new Config();
  });

  describe('constructor', () => {
    it('should auto-detect project root', () => {
      expect(config.projectRoot).toBeTruthy();
      expect(path.isAbsolute(config.projectRoot)).toBe(true);
    });

    it('should accept custom project root', () => {
      const customRoot = '/custom/project';
      const customConfig = new Config(customRoot);
      expect(customConfig.projectRoot).toBe(customRoot);
    });

    it('should initialize with correct metadata', () => {
      expect(config.scriptVersion).toBe('1.0.0');
      expect(config.scriptName).toBe('AI Workflow Automation');
    });

    it('should generate workflow run ID with correct format', () => {
      const config1 = new Config();
      expect(config1.workflowRunId).toMatch(/^workflow_\d{8}_\d{6}$/);

      // Create second config with small delay to ensure different timestamps
      const config2 = new Config();
      // IDs may be the same if created in the same second, which is acceptable
      expect(config2.workflowRunId).toMatch(/^workflow_\d{8}_\d{6}$/);
    });

    it('should initialize with default values', () => {
      expect(config.totalSteps).toBe(15);
      expect(config.dryRun).toBe(false);
      expect(config.interactiveMode).toBe(true);
      expect(config.autoMode).toBe(false);
      expect(config.workflowStartTime).toBeGreaterThan(0);
    });

    it('should initialize empty collections', () => {
      expect(config.workflowStatus).toBeInstanceOf(Map);
      expect(config.workflowStatus.size).toBe(0);
      expect(config.tempFiles).toEqual([]);
    });
  });

  describe('getPaths', () => {
    it('should return all directory paths', () => {
      const paths = config.getPaths();

      expect(paths.projectRoot).toBeTruthy();
      expect(paths.srcDir).toContain('src');
      expect(paths.docsDir).toContain('docs');
      expect(paths.artifactDir).toContain('.ai_workflow');
      expect(paths.backlogDir).toContain('backlog');
      expect(paths.summariesDir).toContain('summaries');
      expect(paths.logsDir).toContain('logs');
      expect(paths.metricsDir).toContain('metrics');
      expect(paths.checkpointsDir).toContain('checkpoints');
      expect(paths.promptsDir).toContain('prompts');
    });

    it('should return run-specific directories', () => {
      const paths = config.getPaths();

      expect(paths.backlogRunDir).toContain(config.workflowRunId);
      expect(paths.summariesRunDir).toContain(config.workflowRunId);
      expect(paths.logsRunDir).toContain(config.workflowRunId);
    });
  });

  describe('getMetadata', () => {
    it('should return workflow metadata', () => {
      const metadata = config.getMetadata();

      expect(metadata.scriptVersion).toBe('1.0.0');
      expect(metadata.scriptName).toBe('AI Workflow Automation');
      expect(metadata.workflowRunId).toBe(config.workflowRunId);
      expect(metadata.totalSteps).toBe(15);
      expect(metadata.workflowStartTime).toBe(config.workflowStartTime);
    });
  });

  describe('setExecutionMode', () => {
    it('should set dry run mode', () => {
      config.setExecutionMode({ dryRun: true });
      expect(config.dryRun).toBe(true);
    });

    it('should set interactive mode', () => {
      config.setExecutionMode({ interactive: false });
      expect(config.interactiveMode).toBe(false);
    });

    it('should set auto mode', () => {
      config.setExecutionMode({ auto: true });
      expect(config.autoMode).toBe(true);
    });

    it('should set multiple modes at once', () => {
      config.setExecutionMode({
        dryRun: true,
        interactive: false,
        auto: true,
      });

      expect(config.dryRun).toBe(true);
      expect(config.interactiveMode).toBe(false);
      expect(config.autoMode).toBe(true);
    });

    it('should not change unspecified values', () => {
      config.dryRun = true;
      config.setExecutionMode({ interactive: false });

      expect(config.dryRun).toBe(true); // unchanged
      expect(config.interactiveMode).toBe(false); // changed
    });
  });

  describe('getExecutionMode', () => {
    it('should return execution mode settings', () => {
      const mode = config.getExecutionMode();

      expect(mode.dryRun).toBe(false);
      expect(mode.interactive).toBe(true);
      expect(mode.auto).toBe(false);
    });
  });

  describe('setAnalysisContext', () => {
    it('should set commits', () => {
      config.setAnalysisContext({ commits: 'abc123..def456' });
      expect(config.analysisCommits).toBe('abc123..def456');
    });

    it('should set modified files', () => {
      config.setAnalysisContext({ modified: 'file1.js,file2.js' });
      expect(config.analysisModified).toBe('file1.js,file2.js');
    });

    it('should set change scope', () => {
      config.setAnalysisContext({ changeScope: 'docs' });
      expect(config.changeScope).toBe('docs');
    });

    it('should set multiple context values', () => {
      config.setAnalysisContext({
        commits: 'HEAD~5..HEAD',
        modified: '3 files',
        changeScope: 'mixed',
      });

      expect(config.analysisCommits).toBe('HEAD~5..HEAD');
      expect(config.analysisModified).toBe('3 files');
      expect(config.changeScope).toBe('mixed');
    });
  });

  describe('getAnalysisContext', () => {
    it('should return analysis context', () => {
      config.analysisCommits = 'abc123';
      config.analysisModified = '5 files';
      config.changeScope = 'code';

      const context = config.getAnalysisContext();

      expect(context.commits).toBe('abc123');
      expect(context.modified).toBe('5 files');
      expect(context.changeScope).toBe('code');
    });
  });

  describe('trackTempFile', () => {
    it('should track temporary file', () => {
      config.trackTempFile('/tmp/test.txt');
      expect(config.tempFiles).toContain('/tmp/test.txt');
    });

    it('should track multiple files', () => {
      config.trackTempFile('/tmp/test1.txt');
      config.trackTempFile('/tmp/test2.txt');

      expect(config.tempFiles).toHaveLength(2);
      expect(config.tempFiles).toContain('/tmp/test1.txt');
      expect(config.tempFiles).toContain('/tmp/test2.txt');
    });
  });

  describe('getTempFiles', () => {
    it('should return copy of temp files array', () => {
      config.trackTempFile('/tmp/test.txt');
      const files = config.getTempFiles();

      files.push('/tmp/another.txt');
      expect(config.tempFiles).toHaveLength(1); // original unchanged
    });
  });

  describe('updateStepStatus', () => {
    it('should update step status', () => {
      config.updateStepStatus(0, 'running');

      const status = config.getStepStatus(0);
      expect(status.status).toBe('running');
      expect(status.timestamp).toBeGreaterThan(0);
    });

    it('should include metadata', () => {
      config.updateStepStatus(1, 'passed', { duration: 1500 });

      const status = config.getStepStatus(1);
      expect(status.status).toBe('passed');
      expect(status.duration).toBe(1500);
    });

    it('should override previous status', () => {
      config.updateStepStatus(2, 'running');
      config.updateStepStatus(2, 'passed');

      const status = config.getStepStatus(2);
      expect(status.status).toBe('passed');
    });
  });

  describe('getStepStatus', () => {
    it('should return null for non-existent step', () => {
      expect(config.getStepStatus(99)).toBeNull();
    });

    it('should return step status', () => {
      config.updateStepStatus(3, 'failed', { error: 'timeout' });

      const status = config.getStepStatus(3);
      expect(status.status).toBe('failed');
      expect(status.error).toBe('timeout');
    });
  });

  describe('getAllStatus', () => {
    it('should return copy of all statuses', () => {
      config.updateStepStatus(0, 'passed');
      config.updateStepStatus(1, 'failed');

      const allStatus = config.getAllStatus();

      expect(allStatus).toBeInstanceOf(Map);
      expect(allStatus.size).toBe(2);
      expect(allStatus.get(0).status).toBe('passed');
      expect(allStatus.get(1).status).toBe('failed');

      // Verify it's a copy
      allStatus.set(2, { status: 'skipped' });
      expect(config.workflowStatus.size).toBe(2); // original unchanged
    });
  });

  describe('getElapsedTime', () => {
    it('should return elapsed time in milliseconds', (done) => {
      setTimeout(() => {
        const elapsed = config.getElapsedTime();
        expect(elapsed).toBeGreaterThanOrEqual(40);
        // No upper-bound assertion: under CI / parallel test load the
        // 50ms timer may resolve well beyond 200ms — that is a scheduling
        // artefact, not a bug in getElapsedTime.
        done();
      }, 50);
    });
  });

  describe('toJSON', () => {
    it('should export complete configuration', () => {
      config.setExecutionMode({ dryRun: true });
      config.setAnalysisContext({ commits: 'HEAD' });
      config.updateStepStatus(0, 'passed');

      const json = config.toJSON();

      expect(json.metadata).toBeDefined();
      expect(json.paths).toBeDefined();
      expect(json.executionMode).toBeDefined();
      expect(json.analysisContext).toBeDefined();
      expect(json.workflowStatus).toBeDefined();
      expect(json.elapsedTime).toBeGreaterThanOrEqual(0);
    });

    it('should convert Map to plain object', () => {
      config.updateStepStatus(0, 'passed');

      const json = config.toJSON();

      expect(json.workflowStatus).not.toBeInstanceOf(Map);
      expect(json.workflowStatus[0]).toBeDefined();
      expect(json.workflowStatus[0].status).toBe('passed');
    });
  });
});
