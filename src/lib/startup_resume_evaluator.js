/**
 * @fileoverview Startup Resume Evaluator
 * @module lib/startup_resume_evaluator
 *
 * Evaluates the most recent workflow execution log at startup to determine
 * whether the last run was incomplete. If it was, the evaluator locates the
 * latest valid checkpoint for that run so the caller can auto-resume rather
 * than restarting from scratch.
 *
 * Architecture: v2.0.0 Referential Transparency
 * - Pure functions: log-dir sorting, completion detection, decision building
 * - Impure wrapper: StartupResumeEvaluator class for filesystem I/O
 *
 * @version 1.0.0
 * @since 2026-04-01
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../core/logger.js';
import { CheckpointManager } from '../orchestrator/checkpoint_manager.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Log lines that unambiguously mark a workflow as completed.
 */
export const COMPLETION_MARKERS = Object.freeze([
  '✓ Workflow completed successfully',
  '⚠ Workflow completed with failures',
  '⚠ Workflow completed with', // covers future wording variations
]);

/**
 * Log lines that mark a workflow as terminally failed before normal completion.
 * These runs should not trigger auto-resume.
 */
export const TERMINAL_FAILURE_MARKERS = Object.freeze(['✗ Workflow terminated before completion']);

export const WORKFLOW_TERMINAL_STATES = Object.freeze({
  COMPLETED: 'completed',
  COMPLETED_WITH_FAILURES: 'completed_with_failures',
  FAILED: 'failed',
  INCOMPLETE: 'incomplete',
  NONE: 'none',
});

/**
 * Pattern for log-directory names created by MainOrchestrator.
 * Format: workflow_YYYYMMDD_HHMMSS  (e.g. workflow_20260312_151321)
 */
export const LOG_DIR_PATTERN = /^workflow_(\d{8})_(\d{6})$/;

// ============================================================================
// PURE FUNCTIONS
// ============================================================================

/**
 * Extracts a sortable timestamp string from a log-directory name.
 *
 * @param {string} dirName - Directory name (e.g. "workflow_20260312_151321")
 * @returns {string|null} Sortable timestamp string "YYYYMMDDHHMMSS", or null
 *   if the name does not match the expected pattern.
 * @pure
 */
export function parseLogDirTimestamp(dirName) {
  const match = LOG_DIR_PATTERN.exec(dirName);
  if (!match) return null;
  return `${match[1]}${match[2]}`; // "YYYYMMDDHHMMSS"
}

/**
 * Sorts log-directory names by recency (newest first).
 * Directories with unrecognised names are placed at the end.
 *
 * @param {string[]} dirs - Array of directory names
 * @returns {string[]} Sorted copy (newest first)
 * @pure
 */
export function sortLogDirsByRecency(dirs) {
  return [...dirs].sort((a, b) => {
    const tsA = parseLogDirTimestamp(a) ?? '';
    const tsB = parseLogDirTimestamp(b) ?? '';
    if (tsB > tsA) return 1;
    if (tsB < tsA) return -1;
    return 0;
  });
}

/**
 * Determines whether log content represents a completed workflow execution.
 *
 * The function scans every line for any of the known completion markers.
 * It intentionally checks the whole file (not just the tail) because
 * additional debug lines may be appended after the completion message.
 *
 * @param {string} logContent - Full text content of a workflow.log file
 * @returns {boolean} `true` when a completion marker is found
 * @pure
 */
export function detectWorkflowCompletion(logContent) {
  if (typeof logContent !== 'string' || logContent.length === 0) return false;
  return COMPLETION_MARKERS.some((marker) => logContent.includes(marker));
}

/**
 * Determines the terminal state recorded in a workflow log, if any.
 *
 * @param {string} logContent - Full text content of a workflow.log file
 * @returns {string|null} Terminal state, or null when the run is incomplete
 * @pure
 */
export function detectWorkflowTerminalState(logContent) {
  if (typeof logContent !== 'string' || logContent.length === 0) return null;
  if (logContent.includes(COMPLETION_MARKERS[0])) {
    return WORKFLOW_TERMINAL_STATES.COMPLETED;
  }
  if (COMPLETION_MARKERS.slice(1).some((marker) => logContent.includes(marker))) {
    return WORKFLOW_TERMINAL_STATES.COMPLETED_WITH_FAILURES;
  }
  if (TERMINAL_FAILURE_MARKERS.some((marker) => logContent.includes(marker))) {
    return WORKFLOW_TERMINAL_STATES.FAILED;
  }
  return null;
}

/**
 * Builds a structured auto-resume decision object from evaluation inputs.
 *
 * @param {Object} params
 * @param {string|null} params.logDirName - Most recent log-directory name, or null
 * @param {boolean}     params.isIncomplete - Whether the run was incomplete
 * @param {Object|null} params.checkpoint - Latest valid checkpoint, or null
 * @returns {AutoResumeDecision} Structured decision
 * @pure
 *
 * @typedef {Object} AutoResumeDecision
 * @property {boolean}     shouldResume - Whether auto-resume should be triggered
 * @property {string|null} checkpointId - ID of the checkpoint to resume from
 * @property {string|null} workflowId   - Workflow ID derived from the log dir
 * @property {string}      lastRunState - Terminal state of the last run
 * @property {string}      reason       - Human-readable explanation
 * @property {string|null} logDirName   - The log directory that was evaluated
 */
export function buildAutoResumeDecision({ logDirName, isIncomplete, checkpoint, terminalState }) {
  if (!logDirName) {
    return {
      shouldResume: false,
      checkpointId: null,
      workflowId: null,
      lastRunState: WORKFLOW_TERMINAL_STATES.NONE,
      reason: 'No previous workflow execution logs found',
      logDirName: null,
    };
  }

  if (!isIncomplete) {
    const lastRunState = terminalState || WORKFLOW_TERMINAL_STATES.COMPLETED;
    const reason =
      lastRunState === WORKFLOW_TERMINAL_STATES.FAILED
        ? `Most recent workflow (${logDirName}) failed before completion`
        : lastRunState === WORKFLOW_TERMINAL_STATES.COMPLETED_WITH_FAILURES
          ? `Most recent workflow (${logDirName}) completed with failures`
          : `Most recent workflow (${logDirName}) completed normally`;
    return {
      shouldResume: false,
      checkpointId: null,
      workflowId: logDirName,
      lastRunState,
      reason,
      logDirName,
    };
  }

  if (!checkpoint) {
    return {
      shouldResume: false,
      checkpointId: null,
      workflowId: logDirName,
      lastRunState: WORKFLOW_TERMINAL_STATES.INCOMPLETE,
      reason: `Incomplete workflow detected (${logDirName}) but no valid checkpoint found`,
      logDirName,
    };
  }

  return {
    shouldResume: true,
    checkpointId: checkpoint.id,
    workflowId: logDirName,
    lastRunState: WORKFLOW_TERMINAL_STATES.INCOMPLETE,
    reason: `Incomplete workflow detected (${logDirName}); resuming from checkpoint ${checkpoint.id}`,
    logDirName,
  };
}

// ============================================================================
// IMPURE WRAPPER
// ============================================================================

/**
 * Evaluates startup conditions to decide whether to auto-resume a workflow.
 *
 * Typical usage inside `runCommand`:
 * ```js
 * const evaluator = new StartupResumeEvaluator({ workflowDir });
 * const decision  = await evaluator.evaluate();
 * if (decision.shouldResume) {
 *   await orchestrator.resume(decision.checkpointId);
 * } else {
 *   await orchestrator.execute();
 * }
 * ```
 */
export class StartupResumeEvaluator {
  /**
   * @param {Object} options
   * @param {string} [options.workflowDir='.ai_workflow'] - Absolute or relative
   *   path to the workflow artifacts directory (the same value passed to
   *   MainOrchestrator).
   */
  constructor(options = {}) {
    this.workflowDir = options.workflowDir || '.ai_workflow';
    this.logsDir = path.join(this.workflowDir, 'logs');
    this.checkpointManager = new CheckpointManager({
      checkpointDir: path.join(this.workflowDir, 'checkpoints'),
    });
  }

  // --------------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------------

  /**
   * Returns the name of the most recent log directory, or null when the logs
   * directory does not exist or is empty.
   *
   * @returns {Promise<string|null>}
   */
  async findMostRecentLogDir() {
    let entries;
    try {
      entries = await fs.readdir(this.logsDir);
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }

    const dirs = entries.filter((e) => LOG_DIR_PATTERN.test(e));
    if (dirs.length === 0) return null;

    return sortLogDirsByRecency(dirs)[0];
  }

  /**
   * Reads the workflow.log inside `logDirName` and returns the recorded
   * terminal state, or null when the run appears incomplete.
   *
   * Returns `null` for any of: file missing, unreadable, empty, or incomplete.
   *
   * @param {string} logDirName - Name of the log subdirectory
   * @returns {Promise<string|null>}
   */
  async getWorkflowTerminalState(logDirName) {
    const logFilePath = path.join(this.logsDir, logDirName, 'workflow.log');
    let content;
    try {
      content = await fs.readFile(logFilePath, 'utf8');
    } catch (err) {
      logger.debug(`[StartupResumeEvaluator] Could not read log file: ${err.message}`);
      return null;
    }

    return detectWorkflowTerminalState(content);
  }

  /**
   * Reads the workflow.log inside `logDirName` and returns `true` when the
   * execution was incomplete (i.e. the log exists but contains no terminal
   * marker).
   *
   * Returns `false` for any of: file missing, unreadable, empty, or complete.
   *
   * @param {string} logDirName - Name of the log subdirectory
   * @returns {Promise<boolean>}
   */
  async isWorkflowIncomplete(logDirName) {
    const terminalState = await this.getWorkflowTerminalState(logDirName);
    if (terminalState) {
      return false;
    }

    const logFilePath = path.join(this.logsDir, logDirName, 'workflow.log');
    try {
      const content = await fs.readFile(logFilePath, 'utf8');
      return typeof content === 'string' && content.length > 0;
    } catch (err) {
      // Missing log → treat as indeterminate (not incomplete); we don't
      // want to falsely trigger a resume when there's nothing to recover.
      logger.debug(`[StartupResumeEvaluator] Could not read log file: ${err.message}`);
      return false;
    }
  }

  /**
   * Finds the latest valid checkpoint for the given workflow run ID.
   *
   * The log-directory name equals the `workflowRunId` which is also stored as
   * `checkpoint.workflowId` when the checkpoint is saved by MainOrchestrator.
   *
   * @param {string} workflowRunId - The log-directory name (== workflowId)
   * @returns {Promise<{id: string, workflowId: string, timestamp: number}|null>}
   */
  async findLatestCheckpoint(workflowRunId) {
    try {
      // 1. Prefer a checkpoint whose workflowId matches the log dir exactly.
      const runCheckpoints = await this.checkpointManager.list({ workflowId: workflowRunId });
      if (runCheckpoints.length > 0) {
        // list() returns newest-first; validate the winner
        for (const candidate of runCheckpoints) {
          const validation = await this.checkpointManager.validate(candidate.id);
          if (validation.valid) return candidate;
        }
      }
    } catch (err) {
      logger.debug(`[StartupResumeEvaluator] Checkpoint lookup failed: ${err.message}`);
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Evaluates startup conditions and returns a resume decision.
   *
   * Steps:
   * 1. Locate the most recent log directory under `{workflowDir}/logs/`.
   * 2. Read its `workflow.log` and check for a completion marker.
   * 3. If incomplete, look for the latest valid checkpoint.
   * 4. Return a structured {@link AutoResumeDecision}.
   *
   * This method never throws; errors are caught, logged, and expressed as a
   * "should not resume" decision so that the calling command can fall through
   * to a normal workflow execution.
   *
   * @returns {Promise<AutoResumeDecision>}
   */
  async evaluate() {
    try {
      const logDirName = await this.findMostRecentLogDir();
      logger.debug(`[StartupResumeEvaluator] Most recent log dir: ${logDirName ?? 'none'}`);

      if (!logDirName) {
        return buildAutoResumeDecision({ logDirName: null, isIncomplete: false, checkpoint: null });
      }

      const terminalState = await this.getWorkflowTerminalState(logDirName);
      const isIncomplete =
        terminalState === null ? await this.isWorkflowIncomplete(logDirName) : false;
      logger.debug(`[StartupResumeEvaluator] Is incomplete: ${isIncomplete}`);

      if (!isIncomplete) {
        return buildAutoResumeDecision({
          logDirName,
          isIncomplete: false,
          checkpoint: null,
          terminalState,
        });
      }

      const checkpoint = await this.findLatestCheckpoint(logDirName);
      logger.debug(
        `[StartupResumeEvaluator] Checkpoint found: ${checkpoint ? checkpoint.id : 'none'}`
      );

      return buildAutoResumeDecision({
        logDirName,
        isIncomplete: true,
        checkpoint,
        terminalState: WORKFLOW_TERMINAL_STATES.INCOMPLETE,
      });
    } catch (err) {
      logger.warn(
        `[StartupResumeEvaluator] Evaluation failed (proceeding normally): ${err.message}`
      );
      return buildAutoResumeDecision({
        logDirName: null,
        isIncomplete: false,
        checkpoint: null,
        terminalState: WORKFLOW_TERMINAL_STATES.NONE,
      });
    }
  }
}

export default {
  parseLogDirTimestamp,
  sortLogDirsByRecency,
  detectWorkflowCompletion,
  detectWorkflowTerminalState,
  buildAutoResumeDecision,
  StartupResumeEvaluator,
  COMPLETION_MARKERS,
  TERMINAL_FAILURE_MARKERS,
  WORKFLOW_TERMINAL_STATES,
  LOG_DIR_PATTERN,
};
