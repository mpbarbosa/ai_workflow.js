/**
 * Step 0f: Commit Artifacts
 * @module steps/step_0f_commit_artifacts
 * @version 2.0.0
 *
 * Commits any uncommitted workflow artifacts (.ai_workflow/) to the repository.
 * Uses AutoCommit to identify, filter, and commit artifact files generated
 * during the current workflow run.
 */

import { STEP_KIND } from './step_contract.js';
import { logger } from '../core/logger.js';
import { GitAutomation } from '../lib/git_automation.js';
import { AutoCommit, validateArtifactPath } from '../lib/auto_commit.js';
import {
  formatBlockingCriticalFailures,
  getBlockingCriticalFailures,
} from './step_execution_helpers.js';

// ============================================================================
// PURE FUNCTIONS
// ============================================================================

/**
 * Determine whether there are artifact files to commit.
 *
 * @pure
 * @param {string[]} changedFiles - List of changed file paths
 * @returns {boolean} True if any files are workflow artifacts
 */
export function hasArtifactFiles(changedFiles) {
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) return false;
  return changedFiles.some((f) => validateArtifactPath(f));
}

/**
 * Build a summary message describing the commit result.
 *
 * @pure
 * @param {Object} result - AutoCommit result object
 * @returns {string} Human-readable summary
 */
export function buildSummaryMessage(result) {
  if (!result.committed) {
    const reason = result.reason || 'unknown';
    const messages = {
      no_files: 'No artifact files to commit',
      filtered: 'No eligible artifact files after filtering',
      disabled: 'Auto-commit is disabled',
      no_git: 'Git not available',
    };
    return messages[reason] || `Skipped: ${reason}`;
  }
  const count = result.files?.length ?? 0;
  return `Committed ${count} artifact file(s)`;
}

// ============================================================================
// STEP CLASS - Impure Wrapper
// ============================================================================

/**
 * Step 0f: Commit workflow artifacts generated during the run.
 *
 * @class
 */
export class Step0fCommitArtifacts {
  static stepKind = STEP_KIND.PROJECT;

  constructor(options = {}) {
    this.gitOps = options.gitOps || new GitAutomation();
    this.autoCommit =
      options.autoCommit ||
      new AutoCommit({
        gitAutomation: this.gitOps,
        enabled: true,
        dryRun: options.dryRun || false,
      });
  }

  /**
   * Execute Step 0f.
   *
   * @param {string} projectRoot - Absolute path to the project root
   * @returns {Promise<Object>} Step result
   */
  async execute(projectRoot, context = {}) {
    logger.info('════════════════════════════════════════════════════════════');
    logger.info('🔷  Step 0f: Commit Workflow Artifacts');
    logger.info('════════════════════════════════════════════════════════════');

    try {
      const blockingFailures = getBlockingCriticalFailures(context);
      if (blockingFailures.length > 0) {
        const reason =
          `Skipping artifact commit because earlier critical step(s) failed: ` +
          `${formatBlockingCriticalFailures(blockingFailures)}`;
        logger.warn(reason);
        return {
          success: true,
          skipped: true,
          reason,
          blockedByFailures: blockingFailures.map((failure) => failure.stepId),
        };
      }

      // Get current git status to find changed artifact files
      const status = await this.gitOps.status(projectRoot);
      const changedFiles = [
        ...(status.staged?.map((f) => f.file) ?? []),
        ...(status.unstaged?.map((f) => f.file) ?? []),
        ...(status.untracked ?? []),
      ];

      if (!hasArtifactFiles(changedFiles)) {
        logger.info('Step 0f: No workflow artifact files to commit');
        return { success: true, skipped: true, reason: 'no_artifact_files' };
      }

      const artifactFiles = changedFiles.filter((f) => validateArtifactPath(f));
      logger.info(`Found ${artifactFiles.length} artifact file(s) to commit`);

      const result = await this.autoCommit.commitArtifacts(artifactFiles);
      const summary = buildSummaryMessage(result);
      logger.info(summary);

      return {
        success: true,
        committed: result.committed,
        files: result.files ?? [],
        summary,
      };
    } catch (error) {
      logger.error(`Step 0f failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
