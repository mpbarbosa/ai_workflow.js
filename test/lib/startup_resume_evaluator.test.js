/**
 * @fileoverview Tests for startup_resume_evaluator.js
 * @module test/lib/startup_resume_evaluator
 */

import fs from 'fs/promises';
import path from 'path';
import {
  parseLogDirTimestamp,
  sortLogDirsByRecency,
  detectWorkflowCompletion,
  detectWorkflowTerminalState,
  buildAutoResumeDecision,
  COMPLETION_MARKERS,
  TERMINAL_FAILURE_MARKERS,
  WORKFLOW_TERMINAL_STATES,
  LOG_DIR_PATTERN,
  StartupResumeEvaluator,
} from '../../src/lib/startup_resume_evaluator.js';

// ============================================================================
// PURE FUNCTION TESTS
// ============================================================================

describe('startup_resume_evaluator - Pure Functions', () => {
  // --------------------------------------------------------------------------
  describe('parseLogDirTimestamp', () => {
    test('returns sortable timestamp for a valid directory name', () => {
      expect(parseLogDirTimestamp('workflow_20260312_151321')).toBe('20260312151321');
    });

    test('returns null for an unrecognised format', () => {
      expect(parseLogDirTimestamp('random-dir')).toBeNull();
      expect(parseLogDirTimestamp('workflow_abc_def')).toBeNull();
      expect(parseLogDirTimestamp('')).toBeNull();
      expect(parseLogDirTimestamp('workflow_20260312')).toBeNull(); // missing time
    });

    test('returns null when given a non-string', () => {
      expect(parseLogDirTimestamp(null)).toBeNull();
      expect(parseLogDirTimestamp(undefined)).toBeNull();
      expect(parseLogDirTimestamp(123)).toBeNull();
    });

    test('handles boundary date/time strings', () => {
      expect(parseLogDirTimestamp('workflow_20000101_000000')).toBe('20000101000000');
      expect(parseLogDirTimestamp('workflow_99991231_235959')).toBe('99991231235959');
    });
  });

  // --------------------------------------------------------------------------
  describe('sortLogDirsByRecency', () => {
    test('returns newest directory first', () => {
      const dirs = [
        'workflow_20260101_100000',
        'workflow_20260312_151321',
        'workflow_20260201_080000',
      ];
      const result = sortLogDirsByRecency(dirs);
      expect(result[0]).toBe('workflow_20260312_151321');
      expect(result[1]).toBe('workflow_20260201_080000');
      expect(result[2]).toBe('workflow_20260101_100000');
    });

    test('does not mutate the input array', () => {
      const dirs = ['workflow_20260101_100000', 'workflow_20260312_151321'];
      const original = [...dirs];
      sortLogDirsByRecency(dirs);
      expect(dirs).toEqual(original);
    });

    test('pushes unrecognised names to the end', () => {
      const dirs = ['workflow_20260312_151321', 'unknown-dir', 'workflow_20260201_080000'];
      const result = sortLogDirsByRecency(dirs);
      expect(result[0]).toBe('workflow_20260312_151321');
      expect(result[2]).toBe('unknown-dir');
    });

    test('handles an empty array', () => {
      expect(sortLogDirsByRecency([])).toEqual([]);
    });

    test('handles a single entry', () => {
      expect(sortLogDirsByRecency(['workflow_20260312_151321'])).toEqual([
        'workflow_20260312_151321',
      ]);
    });

    test('is stable for equal timestamps', () => {
      const dirs = ['workflow_20260312_151321', 'workflow_20260312_151321'];
      const result = sortLogDirsByRecency(dirs);
      expect(result).toHaveLength(2);
    });
  });

  // --------------------------------------------------------------------------
  describe('detectWorkflowCompletion', () => {
    test('returns true when log contains success marker', () => {
      const log = `[2026-03-12T18:18:21.782Z] ✓ Workflow completed successfully\n[2026-03-12T18:18:21.782Z] Duration: 300s`;
      expect(detectWorkflowCompletion(log)).toBe(true);
    });

    test('returns true when log contains failure-completion marker', () => {
      const log = `[2026-03-12T18:18:21.782Z] ⚠ Workflow completed with failures`;
      expect(detectWorkflowCompletion(log)).toBe(true);
    });

    test('returns true for the partial "completed with" marker', () => {
      const log = `[2026-03-12T18:18:21.782Z] ⚠ Workflow completed with warnings`;
      expect(detectWorkflowCompletion(log)).toBe(true);
    });

    test('returns false when log has no completion marker', () => {
      const log = `[2026-03-12T18:13:22.049Z] AI Workflow Automation - Starting\n[2026-03-12T18:15:10.000Z] Executing step: step_03`;
      expect(detectWorkflowCompletion(log)).toBe(false);
    });

    test('returns false for an empty string', () => {
      expect(detectWorkflowCompletion('')).toBe(false);
    });

    test('returns false for a non-string value', () => {
      expect(detectWorkflowCompletion(null)).toBe(false);
      expect(detectWorkflowCompletion(undefined)).toBe(false);
      expect(detectWorkflowCompletion(42)).toBe(false);
    });

    test('returns false for a corrupted / binary-like log', () => {
      const log = '\x00\x01\x02\x03 garbled content ###';
      expect(detectWorkflowCompletion(log)).toBe(false);
    });

    test('marker detection is not confused by partial substring matches', () => {
      // "completed" alone should not trigger — only the full COMPLETION_MARKERS
      const log = '[2026-03-12T18:15:10.000Z] ✓ Step step_03 completed in 5000ms';
      expect(detectWorkflowCompletion(log)).toBe(false);
    });

    test('detects completion marker anywhere in the log, not just the last line', () => {
      const log = [
        '[T] ✓ Workflow completed successfully',
        '[T] Duration: 300s',
        '[T] [DEBUG] [CommitHistory] Saved hash=abc123',
      ].join('\n');
      expect(detectWorkflowCompletion(log)).toBe(true);
    });

    test('returns false for terminal failure markers that are not completion markers', () => {
      const log = `[T] ${TERMINAL_FAILURE_MARKERS[0]}\n[T] Health checks failed`;
      expect(detectWorkflowCompletion(log)).toBe(false);
    });
  });

  describe('detectWorkflowTerminalState', () => {
    test('returns completed for success markers', () => {
      expect(detectWorkflowTerminalState('[T] ✓ Workflow completed successfully')).toBe(
        WORKFLOW_TERMINAL_STATES.COMPLETED
      );
    });

    test('returns completed_with_failures for warning markers', () => {
      expect(detectWorkflowTerminalState('[T] ⚠ Workflow completed with failures')).toBe(
        WORKFLOW_TERMINAL_STATES.COMPLETED_WITH_FAILURES
      );
    });

    test('returns failed for terminal failure markers', () => {
      expect(detectWorkflowTerminalState(`[T] ${TERMINAL_FAILURE_MARKERS[0]}`)).toBe(
        WORKFLOW_TERMINAL_STATES.FAILED
      );
    });

    test('returns null when the run is incomplete', () => {
      expect(
        detectWorkflowTerminalState('[T] Starting workflow...\n[T] step_02 started')
      ).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  describe('buildAutoResumeDecision', () => {
    test('returns no-resume when logDirName is null', () => {
      const result = buildAutoResumeDecision({
        logDirName: null,
        isIncomplete: false,
        checkpoint: null,
      });
      expect(result.shouldResume).toBe(false);
      expect(result.checkpointId).toBeNull();
      expect(result.workflowId).toBeNull();
      expect(result.lastRunState).toBe(WORKFLOW_TERMINAL_STATES.NONE);
      expect(typeof result.reason).toBe('string');
    });

    test('returns no-resume when workflow was complete', () => {
      const result = buildAutoResumeDecision({
        logDirName: 'workflow_20260312_151321',
        isIncomplete: false,
        checkpoint: null,
      });
      expect(result.shouldResume).toBe(false);
      expect(result.checkpointId).toBeNull();
      expect(result.workflowId).toBe('workflow_20260312_151321');
      expect(result.logDirName).toBe('workflow_20260312_151321');
      expect(result.lastRunState).toBe(WORKFLOW_TERMINAL_STATES.COMPLETED);
    });

    test('returns no-resume when incomplete but no checkpoint', () => {
      const result = buildAutoResumeDecision({
        logDirName: 'workflow_20260312_151321',
        isIncomplete: true,
        checkpoint: null,
      });
      expect(result.shouldResume).toBe(false);
      expect(result.checkpointId).toBeNull();
      expect(result.lastRunState).toBe(WORKFLOW_TERMINAL_STATES.INCOMPLETE);
      expect(result.reason).toContain('no valid checkpoint');
    });

    test('returns should-resume when incomplete with a valid checkpoint', () => {
      const checkpoint = {
        id: 'workflow_20260312_151321-1741796001481',
        workflowId: 'workflow_20260312_151321',
        timestamp: 1741796001481,
      };
      const result = buildAutoResumeDecision({
        logDirName: 'workflow_20260312_151321',
        isIncomplete: true,
        checkpoint,
      });
      expect(result.shouldResume).toBe(true);
      expect(result.checkpointId).toBe('workflow_20260312_151321-1741796001481');
      expect(result.workflowId).toBe('workflow_20260312_151321');
      expect(result.logDirName).toBe('workflow_20260312_151321');
      expect(result.lastRunState).toBe(WORKFLOW_TERMINAL_STATES.INCOMPLETE);
      expect(result.reason).toContain('workflow_20260312_151321');
    });

    test('reason is always a non-empty string in all branches', () => {
      const cases = [
        { logDirName: null, isIncomplete: false, checkpoint: null },
        { logDirName: 'workflow_20260312_151321', isIncomplete: false, checkpoint: null },
        { logDirName: 'workflow_20260312_151321', isIncomplete: true, checkpoint: null },
        {
          logDirName: 'workflow_20260312_151321',
          isIncomplete: true,
          checkpoint: { id: 'cp-1' },
        },
      ];
      cases.forEach((c) => {
        const result = buildAutoResumeDecision(c);
        expect(typeof result.reason).toBe('string');
        expect(result.reason.length).toBeGreaterThan(0);
      });
    });
  });

  // --------------------------------------------------------------------------
  describe('constants', () => {
    test('COMPLETION_MARKERS is a non-empty frozen array', () => {
      expect(Array.isArray(COMPLETION_MARKERS)).toBe(true);
      expect(COMPLETION_MARKERS.length).toBeGreaterThan(0);
      expect(Object.isFrozen(COMPLETION_MARKERS)).toBe(true);
    });

    test('LOG_DIR_PATTERN matches expected format', () => {
      expect(LOG_DIR_PATTERN.test('workflow_20260312_151321')).toBe(true);
      expect(LOG_DIR_PATTERN.test('workflow_20260312_000000')).toBe(true);
      expect(LOG_DIR_PATTERN.test('workflow_abc_def')).toBe(false);
      expect(LOG_DIR_PATTERN.test('workflow_20260312')).toBe(false);
      expect(LOG_DIR_PATTERN.test('other_20260312_151321')).toBe(false);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS (StartupResumeEvaluator class)
// ============================================================================

describe('StartupResumeEvaluator - Integration', () => {
  const TMP_DIR = path.join('.ai_workflow', 'test_startup_resume_tmp');
  const LOGS_DIR = path.join(TMP_DIR, 'logs');
  const CHECKPOINTS_DIR = path.join(TMP_DIR, 'checkpoints');

  /** Helper: write a workflow.log with given content */
  async function writeLog(runId, content) {
    const dir = path.join(LOGS_DIR, runId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'workflow.log'), content, 'utf8');
  }

  /** Helper: write a valid checkpoint JSON */
  async function writeCheckpoint(runId, extra = {}) {
    await fs.mkdir(CHECKPOINTS_DIR, { recursive: true });
    const ts = Date.now();
    const id = `${runId}-${ts}`;
    const data = {
      version: '1.0.0',
      workflowId: runId,
      workflowVersion: '2.0.0',
      timestamp: ts,
      state: {
        currentStep: 'step_04',
        completedSteps: ['step_00', 'step_01', 'step_02'],
        failedSteps: [],
        skippedSteps: [],
        results: {},
        context: {},
      },
      metadata: { totalSteps: 25, progress: 12 },
      ...extra,
    };
    await fs.writeFile(
      path.join(CHECKPOINTS_DIR, `${id}.json`),
      JSON.stringify(data, null, 2),
      'utf8'
    );
    return id;
  }

  /** Helper: write a corrupted (invalid JSON) checkpoint */
  async function writeCorruptedCheckpoint(id) {
    await fs.mkdir(CHECKPOINTS_DIR, { recursive: true });
    await fs.writeFile(
      path.join(CHECKPOINTS_DIR, `${id}.json`),
      '{ this is not valid JSON :::',
      'utf8'
    );
  }

  let evaluator;

  beforeEach(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
    evaluator = new StartupResumeEvaluator({ workflowDir: TMP_DIR });
  });

  afterAll(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  });

  // --------------------------------------------------------------------------
  describe('evaluate() — no prior runs', () => {
    test('returns no-resume when logs directory does not exist', async () => {
      const result = await evaluator.evaluate();
      expect(result.shouldResume).toBe(false);
      expect(result.logDirName).toBeNull();
    });

    test('returns no-resume when logs directory is empty', async () => {
      await fs.mkdir(LOGS_DIR, { recursive: true });
      const result = await evaluator.evaluate();
      expect(result.shouldResume).toBe(false);
    });

    test('returns no-resume when logs directory contains only unrecognised entries', async () => {
      await fs.mkdir(path.join(LOGS_DIR, 'random-dir'), { recursive: true });
      const result = await evaluator.evaluate();
      expect(result.shouldResume).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  describe('evaluate() — completed last run', () => {
    test('returns no-resume when last log contains success marker', async () => {
      const RUN = 'workflow_20260312_151321';
      await writeLog(RUN, '[T] ✓ Workflow completed successfully\n[T] Duration: 300s');
      const result = await evaluator.evaluate();
      expect(result.shouldResume).toBe(false);
      expect(result.logDirName).toBe(RUN);
    });

    test('returns no-resume when last log contains failure-completion marker', async () => {
      const RUN = 'workflow_20260312_151321';
      await writeLog(RUN, '[T] ⚠ Workflow completed with failures\n[T] Duration: 60s');
      const result = await evaluator.evaluate();
      expect(result.shouldResume).toBe(false);
      expect(result.lastRunState).toBe(WORKFLOW_TERMINAL_STATES.COMPLETED_WITH_FAILURES);
    });

    test('returns no-resume when last log contains a terminal pre-completion failure marker', async () => {
      const RUN = 'workflow_20260312_151321';
      await writeLog(RUN, `[T] ${TERMINAL_FAILURE_MARKERS[0]}\n[T] Health checks failed`);
      const result = await evaluator.evaluate();
      expect(result.shouldResume).toBe(false);
      expect(result.lastRunState).toBe(WORKFLOW_TERMINAL_STATES.FAILED);
    });

    test('evaluates only the most recent directory when multiple exist', async () => {
      // Older run: incomplete
      await writeLog('workflow_20260101_100000', '[T] Step started...');
      // Newer run: complete
      await writeLog('workflow_20260312_151321', '[T] ✓ Workflow completed successfully\n[T] Done');
      const result = await evaluator.evaluate();
      expect(result.shouldResume).toBe(false);
      expect(result.logDirName).toBe('workflow_20260312_151321');
    });
  });

  // --------------------------------------------------------------------------
  describe('evaluate() — incomplete last run', () => {
    test('returns no-resume when log is incomplete but no checkpoint exists', async () => {
      const RUN = 'workflow_20260312_151321';
      await writeLog(RUN, '[T] Starting workflow...\n[T] step_02 started');
      const result = await evaluator.evaluate();
      expect(result.shouldResume).toBe(false);
      expect(result.reason).toContain('no valid checkpoint');
    });

    test('returns should-resume when log is incomplete and a matching checkpoint exists', async () => {
      const RUN = 'workflow_20260312_151321';
      await writeLog(RUN, '[T] Starting workflow...\n[T] step_02 started');
      const cpId = await writeCheckpoint(RUN);

      const result = await evaluator.evaluate();

      expect(result.shouldResume).toBe(true);
      expect(result.checkpointId).toBe(cpId);
      expect(result.workflowId).toBe(RUN);
      expect(result.logDirName).toBe(RUN);
    });

    test('does not resume a checkpoint from a different run when no run-specific one exists', async () => {
      const RUN = 'workflow_20260312_151321';
      await writeLog(RUN, '[T] Starting workflow...');
      await writeCheckpoint('workflow_20260101_100000');

      const result = await evaluator.evaluate();

      expect(result.shouldResume).toBe(false);
      expect(result.checkpointId).toBeNull();
      expect(result.reason).toContain('no valid checkpoint');
    });

    test('chooses the most recent log dir even when older dirs are present', async () => {
      await writeLog('workflow_20260101_100000', '[T] ✓ Workflow completed successfully');
      const RUN = 'workflow_20260312_151321';
      await writeLog(RUN, '[T] Starting workflow...');
      const cpId = await writeCheckpoint(RUN);

      const result = await evaluator.evaluate();

      expect(result.shouldResume).toBe(true);
      expect(result.logDirName).toBe(RUN);
      expect(result.checkpointId).toBe(cpId);
    });
  });

  // --------------------------------------------------------------------------
  describe('evaluate() — edge cases / corruption', () => {
    test('returns no-resume when workflow.log is missing from the run dir', async () => {
      // Create the dir but no workflow.log inside it
      await fs.mkdir(path.join(LOGS_DIR, 'workflow_20260312_151321'), { recursive: true });
      const result = await evaluator.evaluate();
      expect(result.shouldResume).toBe(false);
    });

    test('returns no-resume when workflow.log is empty', async () => {
      await writeLog('workflow_20260312_151321', '');
      const result = await evaluator.evaluate();
      expect(result.shouldResume).toBe(false);
    });

    test('skips corrupted checkpoint files and falls back to none', async () => {
      const RUN = 'workflow_20260312_151321';
      await writeLog(RUN, '[T] Starting workflow...');
      await writeCorruptedCheckpoint(`${RUN}-9999999`);

      const result = await evaluator.evaluate();
      // The corrupted checkpoint is skipped → no valid checkpoint found
      expect(result.shouldResume).toBe(false);
      expect(result.reason).toContain('no valid checkpoint');
    });

    test('skips a corrupted checkpoint and uses the next valid one', async () => {
      const RUN = 'workflow_20260312_151321';
      await writeLog(RUN, '[T] Starting workflow...');

      // Write a good checkpoint first (lower timestamp → listed after bad one)
      const goodId = await writeCheckpoint(RUN);
      // Write a corrupted checkpoint with a higher timestamp in the filename
      await writeCorruptedCheckpoint(`${RUN}-9999999999999`);

      const result = await evaluator.evaluate();
      expect(result.shouldResume).toBe(true);
      expect(result.checkpointId).toBe(goodId);
    });

    test('never throws — returns no-resume decision on unexpected errors', async () => {
      // Construct evaluator pointing at a path that will cause unusual errors
      const badEvaluator = new StartupResumeEvaluator({
        workflowDir: '/nonexistent/path/that/should/not/exist',
      });
      await expect(badEvaluator.evaluate()).resolves.toMatchObject({
        shouldResume: false,
      });
    });

    test('returns no-resume when log contains binary / corrupted content', async () => {
      const RUN = 'workflow_20260312_151321';
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]).toString('binary');
      await writeLog(RUN, binaryContent);
      const result = await evaluator.evaluate();
      expect(result.shouldResume).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  describe('findMostRecentLogDir()', () => {
    test('returns null when logsDir does not exist', async () => {
      const result = await evaluator.findMostRecentLogDir();
      expect(result).toBeNull();
    });

    test('returns the newest directory name', async () => {
      await writeLog('workflow_20260101_100000', 'a');
      await writeLog('workflow_20260312_151321', 'b');
      const result = await evaluator.findMostRecentLogDir();
      expect(result).toBe('workflow_20260312_151321');
    });
  });

  // --------------------------------------------------------------------------
  describe('isWorkflowIncomplete()', () => {
    test('returns false when workflow.log is missing', async () => {
      await fs.mkdir(path.join(LOGS_DIR, 'workflow_20260312_151321'), { recursive: true });
      const result = await evaluator.isWorkflowIncomplete('workflow_20260312_151321');
      expect(result).toBe(false);
    });

    test('returns false when log is complete', async () => {
      await writeLog('workflow_20260312_151321', '[T] ✓ Workflow completed successfully\n[T] Done');
      const result = await evaluator.isWorkflowIncomplete('workflow_20260312_151321');
      expect(result).toBe(false);
    });

    test('returns true when log exists but has no completion marker', async () => {
      await writeLog('workflow_20260312_151321', '[T] Starting...\n[T] step_02 started');
      const result = await evaluator.isWorkflowIncomplete('workflow_20260312_151321');
      expect(result).toBe(true);
    });

    test('returns false when log contains a terminal failure marker', async () => {
      await writeLog(
        'workflow_20260312_151321',
        `[T] ${TERMINAL_FAILURE_MARKERS[0]}\n[T] Health checks failed`
      );
      const result = await evaluator.isWorkflowIncomplete('workflow_20260312_151321');
      expect(result).toBe(false);
    });
  });
});
