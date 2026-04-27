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

import * as path from 'node:path';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { logger } from '../../core/logger.js';
// @ts-expect-error - legacy JS orchestrator module is untyped in the current TypeScript setup.
import { MainOrchestrator } from '../../orchestrator/main_orchestrator.js';
// @ts-expect-error - legacy JS checkpoint manager module is untyped in the current TypeScript setup.
import { CheckpointManager } from '../../orchestrator/checkpoint_manager.js';

export interface ResumeCommandOptions {
  latest?: boolean;
  list?: boolean;
  projectRoot?: string;
  stage?: string;
  tui?: boolean;
  verbose?: boolean;
  workflowDir?: string;
}

export interface ResumeValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ResumeCheckpointState {
  completedSteps?: string[] | number;
}

export interface ResumeCheckpointMetadata {
  progress?: number;
  totalSteps?: number;
}

export interface ResumeCheckpoint {
  id?: string;
  workflowId: string;
  timestamp: number | string | Date;
  state: ResumeCheckpointState;
  metadata?: ResumeCheckpointMetadata;
}

export interface ResumeCommandResult {
  aborted?: boolean;
  duration?: number;
  error?: string;
  success: boolean;
}

export interface TuiResumeResult extends ResumeCommandResult {
  aborted: boolean;
}

interface CheckpointManagerLike {
  list(): Promise<ResumeCheckpoint[]>;
}

interface ResumeOrchestratorLike {
  abort(): void;
  resume(checkpointId: string): Promise<ResumeCommandResult>;
}

interface StartTuiOptions {
  stage: string;
  version: string;
  verbose: boolean;
}

interface StartTuiModule {
  startTui: (
    orchestrator: ResumeOrchestratorLike,
    options: StartTuiOptions
  ) => Promise<TuiResumeResult>;
}

function createCheckpointManager(workflowDir: string): CheckpointManagerLike {
  return new CheckpointManager({
    checkpointDir: path.join(workflowDir, 'checkpoints'),
  }) as unknown as CheckpointManagerLike;
}

function createResumeOrchestrator(
  workflowDir: string,
  projectRoot: string,
  checkpointId: string
): ResumeOrchestratorLike {
  return new MainOrchestrator({
    workflowDir,
    projectRoot,
    resumeFromCheckpoint: checkpointId,
  }) as unknown as ResumeOrchestratorLike;
}

function getCompletedStepsCount(completedSteps: ResumeCheckpointState['completedSteps']): number {
  if (typeof completedSteps === 'number') {
    return completedSteps;
  }

  return completedSteps?.length ?? 0;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ============================================================================
// PURE FUNCTIONS - Command Logic
// ============================================================================

/**
 * Validate resume command options
 * @pure
 */
export function validateResumeOptions(
  options: ResumeCommandOptions = {},
  checkpointId: string | null | undefined
): ResumeValidationResult {
  const errors: string[] = [];

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
 */
export function formatCheckpoint(checkpoint: ResumeCheckpoint | null | undefined): string {
  if (!checkpoint) {
    return 'Invalid checkpoint';
  }

  const { workflowId, timestamp, state } = checkpoint;
  const date = new Date(timestamp);
  const completed = getCompletedStepsCount(state.completedSteps);
  const total = checkpoint.metadata?.totalSteps ?? 0;
  const progress = checkpoint.metadata?.progress ?? 0;

  return `${workflowId} - ${date.toLocaleString()} (${completed}/${total} steps, ${progress}% complete)`;
}

/**
 * Format checkpoint list for display
 * @pure
 */
export function formatCheckpointList(
  checkpoints: ResumeCheckpoint[] | null | undefined
): string {
  if (!checkpoints || checkpoints.length === 0) {
    return 'No checkpoints found';
  }

  const lines = ['Available checkpoints:', ''];
  checkpoints.forEach((checkpoint, index) => {
    lines.push(`${index + 1}. ${formatCheckpoint(checkpoint)}`);
  });

  return lines.join('\n');
}

// ============================================================================
// IMPURE WRAPPER - Command Execution
// ============================================================================

/**
 * List available checkpoints
 */
async function listCheckpoints(workflowDir: string): Promise<void> {
  const checkpointManager = createCheckpointManager(workflowDir);

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
    logger.error(chalk.red(`Failed to list checkpoints: ${getErrorMessage(error)}`));
    process.exit(1);
  }
}

/**
 * Get latest checkpoint ID
 */
async function getLatestCheckpointId(workflowDir: string): Promise<string | null> {
  const checkpointManager = createCheckpointManager(workflowDir);

  try {
    const checkpoints = await checkpointManager.list();

    if (checkpoints.length === 0) {
      return null;
    }

    // Sort by timestamp descending
    checkpoints.sort(
      (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
    );

    return checkpoints[0]?.id ?? null;
  } catch (error) {
    logger.error(chalk.red(`Failed to get latest checkpoint: ${getErrorMessage(error)}`));
    return null;
  }
}

/**
 * Execute the resume command
 */
export async function resumeCommand(
  checkpointId: string | null | undefined,
  options: ResumeCommandOptions = {}
): Promise<void> {
  let spinner: Ora | null = null;
  let onSigint: (() => void) | null = null;

  try {
    // Validate options
    const validation = validateResumeOptions(options, checkpointId);
    if (!validation.isValid) {
      logger.error(chalk.red('Invalid options:'));
      validation.errors.forEach((error) => logger.error(chalk.red(`  - ${error}`)));
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

    if (!checkpointId) {
      logger.error(chalk.red('No checkpoint ID provided'));
      process.exit(1);
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
    const orchestrator = createResumeOrchestrator(
      workflowDir,
      options.projectRoot || process.cwd(),
      checkpointId
    );

    // ── TUI mode ────────────────────────────────────────────────────────────
    if (options.tui) {
      // @ts-expect-error - legacy JS TUI module is untyped in the current TypeScript setup.
      const { startTui } = (await import('../tui/index.js')) as StartTuiModule;
      const result = await startTui(orchestrator, {
        stage: options.stage || 'full',
        version: '1.6.3',
        verbose: Boolean(options.verbose),
      });
      process.exit(result.aborted ? 130 : result.success ? 0 : 1);
    }
    // ── Standard (spinner) mode ─────────────────────────────────────────────

    // Handle Ctrl+C: abort gracefully after the current step finishes
    onSigint = () => {
      console.log(chalk.yellow('\n\n⚠ Interrupt received — stopping after current step...'));
      if (spinner) {
        spinner.warn('Stopping...');
      }
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
    if (onSigint) {
      process.removeListener('SIGINT', onSigint);
    }

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
      console.log(chalk.green('✓ Workflow completed successfully'));
      if (result.duration) {
        const durationSec = Math.round(result.duration / 1000);
        console.log(chalk.gray(`  Duration: ${durationSec}s`));
      }
    } else {
      console.log(chalk.red('✗ Workflow failed'));
      if (result.error) {
        console.log(chalk.red(`  Error: ${result.error}`));
      }
    }
    console.log();

    // Exit with appropriate code
    process.exit(result.aborted ? 130 : result.success ? 0 : 1);
  } catch (error) {
    // Remove SIGINT listener on error path
    if (onSigint) {
      process.removeListener('SIGINT', onSigint);
    }

    // Stop spinner on error
    if (spinner) {
      spinner.fail('Resume failed');
    }

    const errorMessage = getErrorMessage(error);
    logger.error(chalk.red(`Error: ${errorMessage}`));
    if (options.verbose && error instanceof Error && error.stack) {
      logger.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

const resumeCommandExports = {
  resumeCommand,
  validateResumeOptions,
  formatCheckpoint,
  formatCheckpointList,
};

export default resumeCommandExports;
