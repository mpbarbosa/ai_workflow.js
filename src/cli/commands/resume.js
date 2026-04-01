/**
 * @fileoverview CLI Resume Command
 * @module cli/commands/resume
 *
 * Implements the 'resume' command for resuming workflows from checkpoints.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for validation and formatting
 * - Impure wrapper for execution
 *
 * @version 1.0.0
 * @since 2026-02-10
 */

import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { logger } from '../../core/logger.js';
import { MainOrchestrator } from '../../orchestrator/main_orchestrator.js';
import { CheckpointManager } from '../../orchestrator/checkpoint_manager.js';

// ============================================================================
// PURE FUNCTIONS - Command Logic
// ============================================================================

/**
 * Validate resume command options
 * @pure
 * @param {Object} options - Command options
 * @param {string|null} checkpointId - Checkpoint ID to resume from
 * @returns {Object} Validation result
 */
export function validateResumeOptions(options, checkpointId) {
  const errors = [];

  // If not listing and not using latest, need checkpoint ID
  if (!options.list && !options.latest && !checkpointId) {
    errors.push('Must specify checkpoint ID, use --latest, or use --list');
  }

  // Can't use both list and latest
  if (options.list && options.latest) {
    errors.push('Cannot use both --list and --latest');
  }

  // Can't specify ID with list or latest
  if (checkpointId && (options.list || options.latest)) {
    errors.push('Cannot specify checkpoint ID with --list or --latest');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Format checkpoint for display
 * @pure
 * @param {Object} checkpoint - Checkpoint data
 * @returns {string} Formatted checkpoint info
 */
export function formatCheckpoint(checkpoint) {
  if (!checkpoint) {
    return 'Invalid checkpoint';
  }

  const { workflowId, timestamp, state } = checkpoint;
  const date = new Date(timestamp);
  const completed = state.completedSteps?.length || 0;
  const total = checkpoint.metadata?.totalSteps || 0;
  const progress = checkpoint.metadata?.progress || 0;

  return `${workflowId} - ${date.toLocaleString()} (${completed}/${total} steps, ${progress}% complete)`;
}

/**
 * Format checkpoint list for display
 * @pure
 * @param {Array<Object>} checkpoints - Array of checkpoints
 * @returns {string} Formatted list
 */
export function formatCheckpointList(checkpoints) {
  if (!checkpoints || checkpoints.length === 0) {
    return 'No checkpoints found';
  }

  const lines = ['Available checkpoints:', ''];
  checkpoints.forEach((cp, index) => {
    lines.push(`${index + 1}. ${formatCheckpoint(cp)}`);
  });

  return lines.join('\n');
}

// ============================================================================
// IMPURE WRAPPER - Command Execution
// ============================================================================

/**
 * List available checkpoints
 * @param {string} workflowDir - Workflow directory
 * @returns {Promise<void>}
 */
async function listCheckpoints(workflowDir) {
  const checkpointManager = new CheckpointManager({
    checkpointDir: path.join(workflowDir, 'checkpoints'),
  });

  try {
    const checkpoints = await checkpointManager.list();

    if (checkpoints.length === 0) {
      console.log(chalk.yellow('No checkpoints found'));
      return;
    }

    console.log();
    console.log(chalk.cyan('Available Checkpoints:'));
    console.log(chalk.gray('━'.repeat(60)));

    checkpoints.forEach((checkpoint, index) => {
      const info = formatCheckpoint(checkpoint);
      console.log(chalk.white(`${index + 1}. ${info}`));
    });

    console.log();
  } catch (error) {
    logger.error(chalk.red(`Failed to list checkpoints: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Get latest checkpoint ID
 * @param {string} workflowDir - Workflow directory
 * @returns {Promise<string|null>} Latest checkpoint ID
 */
async function getLatestCheckpointId(workflowDir) {
  const checkpointManager = new CheckpointManager({
    checkpointDir: path.join(workflowDir, 'checkpoints'),
  });

  try {
    const checkpoints = await checkpointManager.list();

    if (checkpoints.length === 0) {
      return null;
    }

    // Sort by timestamp descending
    checkpoints.sort((a, b) => b.timestamp - a.timestamp);

    return checkpoints[0].id;
  } catch (error) {
    logger.error(chalk.red(`Failed to get latest checkpoint: ${error.message}`));
    return null;
  }
}

/**
 * Execute the resume command
 * @param {string|null} checkpointId - Checkpoint ID to resume from
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
export async function resumeCommand(checkpointId, options) {
  let spinner = null;
  let onSigint = null;

  try {
    // Validate options
    const validation = validateResumeOptions(options, checkpointId);
    if (!validation.isValid) {
      logger.error(chalk.red('Invalid options:'));
      validation.errors.forEach((err) => logger.error(chalk.red(`  - ${err}`)));
      process.exit(1);
    }

    const workflowDir = options.workflowDir || '.ai_workflow';

    // Handle list mode
    if (options.list) {
      await listCheckpoints(workflowDir);
      process.exit(0);
    }

    // Handle latest mode
    if (options.latest) {
      checkpointId = await getLatestCheckpointId(workflowDir);
      if (!checkpointId) {
        logger.error(chalk.red('No checkpoints found'));
        process.exit(1);
      }
      console.log(chalk.cyan(`Resuming from latest checkpoint: ${checkpointId}`));
    }

    // Display banner
    console.log();
    console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.blue('  Resuming Workflow'));
    console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log();
    console.log(chalk.cyan(`Checkpoint: ${checkpointId}`));
    console.log();

    // Create orchestrator
    const orchestrator = new MainOrchestrator({
      workflowDir,
      projectRoot: options.projectRoot || process.cwd(),
      resumeFromCheckpoint: checkpointId,
    });

    // ── TUI mode ────────────────────────────────────────────────────────────
    if (options.tui) {
      const { startTui } = await import('../tui/index.js');
      const result = await startTui(orchestrator, {
        stage: options.stage || 'full',
        version: '1.6.3',
        verbose: !!options.verbose,
      });
      process.exit(result.aborted ? 130 : result.success ? 0 : 1);
      return;
    }
    // ── Standard (spinner) mode ─────────────────────────────────────────────

    // Handle Ctrl+C: abort gracefully after the current step finishes
    onSigint = () => {
      console.log(chalk.yellow('\n\n⚠ Interrupt received — stopping after current step...'));
      if (spinner) spinner.warn('Stopping...');
      orchestrator.abort();
    };
    process.once('SIGINT', onSigint);

    // Setup spinner
    if (!options.verbose) {
      spinner = ora('Loading checkpoint...').start();
    }

    // Resume workflow
    const result = await orchestrator.resume(checkpointId);

    // Remove SIGINT listener — workflow has finished
    process.removeListener('SIGINT', onSigint);

    // Stop spinner
    if (spinner) {
      if (result.aborted) {
        spinner.warn('Workflow stopped by user');
      } else if (result.success) {
        spinner.succeed('Workflow resumed and completed');
      } else {
        spinner.fail('Workflow failed');
      }
    }

    // Display result
    console.log();
    if (result.aborted) {
      console.log(chalk.yellow('⚠ Workflow stopped by user (Ctrl+C)'));
    } else if (result.success) {
      console.log(chalk.green(`✓ Workflow completed successfully`));
      if (result.duration) {
        const durationSec = Math.round(result.duration / 1000);
        console.log(chalk.gray(`  Duration: ${durationSec}s`));
      }
    } else {
      console.log(chalk.red(`✗ Workflow failed`));
      if (result.error) {
        console.log(chalk.red(`  Error: ${result.error}`));
      }
    }
    console.log();

    // Exit with appropriate code
    process.exit(result.aborted ? 130 : result.success ? 0 : 1);
  } catch (error) {
    // Remove SIGINT listener on error path
    process.removeListener('SIGINT', onSigint);

    // Stop spinner on error
    if (spinner) {
      spinner.fail('Resume failed');
    }

    logger.error(chalk.red(`Error: ${error.message}`));
    if (options.verbose && error.stack) {
      logger.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

export default { resumeCommand, validateResumeOptions, formatCheckpoint, formatCheckpointList };
