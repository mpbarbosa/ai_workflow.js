/**
 * @fileoverview CLI Run Command
 * @module cli/commands/run
 *
 * Implements the 'run' command for executing AI workflows.
 * Integrates with MainOrchestrator to execute workflow steps.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for validation and configuration
 * - Impure wrapper for execution
 *
 * @version 1.0.0
 * @since 2026-02-10
 */

import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { logger } from '../../core/logger.js';
// @ts-expect-error - legacy JS orchestrator module is untyped in the current TypeScript setup.
import { MainOrchestrator, WORKFLOW_STAGES } from '../../orchestrator/main_orchestrator.js';
// @ts-expect-error - legacy JS startup evaluator module is untyped in the current TypeScript setup.
import { StartupResumeEvaluator } from '../../lib/startup_resume_evaluator.js';

export type ProviderName = 'copilot' | 'claude';
export type AlternativesOption = boolean | number | string;

export interface RunCommandOptions {
  alternatives?: AlternativesOption;
  auto?: boolean;
  config?: unknown;
  dryRun?: boolean;
  noAutoResume?: boolean;
  parallel?: boolean;
  projectRoot?: string;
  provider?: string;
  sdkSmokeTest?: boolean;
  stage?: string;
  tui?: boolean;
  verbose?: boolean;
  workflowDir?: string;
}

export interface RunOptionsValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface RunOrchestratorOptions {
  workflowDir: string;
  projectRoot: string;
  stage: string;
  auto: boolean;
  dryRun: boolean;
  noParallel: boolean;
  sdkSmokeTest: boolean;
  alternatives: boolean | number;
  verbose: boolean;
  streamingEnabled: boolean;
  provider: string;
}

export interface WorkflowResultSummary {
  failed?: number;
  succeeded?: number;
  total?: number;
}

export interface WorkflowExecutionResults {
  summary?: WorkflowResultSummary;
}

export interface RunResultSummary {
  report?: string;
}

export interface RunCommandResult {
  aborted?: boolean;
  duration: number;
  error?: string;
  results: WorkflowExecutionResults;
  success: boolean;
  summary?: RunResultSummary | string | null;
}

export interface StartupDecision {
  shouldResume: boolean;
  checkpointId: string | null;
  workflowId?: string | null;
  lastRunState: string;
  reason: string;
  logDirName: string | null;
}

export interface CheckpointState {
  completedSteps?: number | string[];
}

export interface CheckpointMetadata {
  id: string;
  state: CheckpointState;
}

interface CheckpointManagerLike {
  list(): Promise<CheckpointMetadata[]>;
}

interface StartupResumeEvaluatorLike {
  checkpointManager: CheckpointManagerLike;
  evaluate(): Promise<StartupDecision>;
}

interface RunOrchestratorLike {
  workflowDir: string;
  abort(): void;
  execute(): Promise<RunCommandResult>;
  resume(checkpointId: string): Promise<RunCommandResult>;
}

interface TuiRunResult extends RunCommandResult {
  aborted: boolean;
}

interface StartTuiOptions {
  stage: string;
  version: string;
  verbose: boolean;
}

interface StartTuiModule {
  startTui: (orchestrator: RunOrchestratorLike, options: StartTuiOptions) => Promise<TuiRunResult>;
}

function createRunOrchestrator(options: RunOrchestratorOptions): RunOrchestratorLike {
  return new MainOrchestrator(options) as unknown as RunOrchestratorLike;
}

function createStartupResumeEvaluator(workflowDir: string): StartupResumeEvaluatorLike {
  return new StartupResumeEvaluator({ workflowDir }) as unknown as StartupResumeEvaluatorLike;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ============================================================================
// PURE FUNCTIONS - Command Logic
// ============================================================================

/**
 * Validate run command options
 * @pure
 */
export function validateRunOptions(
  options: RunCommandOptions = {}
): RunOptionsValidationResult {
  const errors: string[] = [];

  // Validate stage
  const validStages = Object.values(WORKFLOW_STAGES) as string[];
  if (options.stage && !validStages.includes(options.stage)) {
    errors.push(`Invalid stage: ${options.stage}. Must be one of: ${validStages.join(', ')}`);
  }

  // Validate config path
  if (options.config !== undefined && typeof options.config !== 'string') {
    errors.push('Config path must be a string');
  }

  // Validate alternatives
  if (options.alternatives !== false && options.alternatives !== undefined) {
    const alternativesCount = Number.parseInt(String(options.alternatives), 10);
    if (!Number.isNaN(alternativesCount) && alternativesCount < 2) {
      errors.push('--alternatives must be at least 2');
    }
  }

  // Validate provider
  const validProviders: string[] = ['copilot', 'claude'];
  if (options.provider && !validProviders.includes(options.provider)) {
    errors.push(`Invalid provider: ${options.provider}. Must be one of: ${validProviders.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Create orchestrator options from CLI options
 * @pure
 */
export function createOrchestratorOptions(
  cliOptions: RunCommandOptions = {}
): RunOrchestratorOptions {
  const rawAlt = cliOptions.alternatives;
  const alternatives =
    rawAlt === false || rawAlt === undefined
      ? false
      : Math.max(2, Number.parseInt(String(rawAlt), 10) || 2);
  const verbose = Boolean(cliOptions.verbose);

  return {
    workflowDir: cliOptions.workflowDir || '.ai_workflow',
    projectRoot: cliOptions.projectRoot || process.cwd(),
    stage: cliOptions.stage || WORKFLOW_STAGES.FULL,
    auto: cliOptions.auto || false,
    dryRun: cliOptions.dryRun || false,
    noParallel: cliOptions.parallel === false,
    sdkSmokeTest: cliOptions.sdkSmokeTest || false,
    alternatives,
    verbose,
    streamingEnabled: verbose || !!cliOptions.tui,
    provider: cliOptions.provider || 'copilot',
  };
}

/**
 * Format workflow result for display
 * @pure
 */
export function formatWorkflowResult(result: RunCommandResult | null | undefined): string {
  if (!result) {
    return 'No result available';
  }

  const { success, duration, results } = result;
  const durationSec = Math.round(duration / 1000);

  if (success) {
    const completed = results.summary?.succeeded || 0;
    const total = results.summary?.total || 0;
    return `Workflow completed successfully! (${completed}/${total} steps, ${durationSec}s)`;
  } else {
    const failed = results.summary?.failed || 0;
    return `Workflow failed with ${failed} error(s) (${durationSec}s)`;
  }
}

/**
 * Format last execution status for display at startup
 * @pure
 */
function formatLastExecutionStatus(
  projectRoot: string,
  decision: StartupDecision,
  checkpoint: CheckpointMetadata | null
): string[] {
  const lines: string[] = [];
  lines.push(chalk.gray(`Project: ${projectRoot}`));

  if (!decision.logDirName) {
    lines.push(chalk.gray('Last run: – no previous executions'));
    return lines;
  }

  // Derive a display date from the log dir name (workflow_YYYYMMDD_HHMMSS)
  const m = /^workflow_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/.exec(decision.logDirName);
  const dateStr = m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}` : decision.logDirName;

  if (decision.shouldResume) {
    const stepInfo = checkpoint ? ` (${checkpoint.state.completedSteps} steps done)` : '';
    lines.push(chalk.yellow(`Last run: ⚠ incomplete on ${dateStr}${stepInfo}`));
  } else {
    if (decision.lastRunState === 'failed') {
      lines.push(chalk.red(`Last run: ✗ failed before completion on ${dateStr}`));
    } else if (decision.lastRunState === 'completed_with_failures') {
      lines.push(chalk.yellow(`Last run: ⚠ completed with failures on ${dateStr}`));
    } else {
      lines.push(chalk.gray(`Last run: ✓ completed on ${dateStr}`));
    }
  }

  return lines;
}

/**
 * Execute the run command
 */
export async function runCommand(options: RunCommandOptions = {}): Promise<void> {
  let spinner: Ora | null = null;
  let onSigint: (() => void) | null = null;

  try {
    // Validate options
    const validation = validateRunOptions(options);
    if (!validation.isValid) {
      logger.error(chalk.red('Invalid options:'));
      validation.errors.forEach((err) => logger.error(chalk.red(`  - ${err}`)));
      process.exit(1);
    }

    // Display banner
    console.log();
    console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.blue('  AI Workflow Automation'));
    console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log();
    console.log(chalk.cyan(`Stage: ${options.stage}`));
    console.log(chalk.cyan(`Mode: ${options.auto ? 'automatic' : 'interactive'}`));
    if (options.dryRun) {
      console.log(chalk.yellow('Dry run: No changes will be made'));
    }
    console.log();

    // Create orchestrator (workflowDir is resolved to projectRoot inside the constructor)
    const orchestratorOptions = createOrchestratorOptions(options);
    const orchestrator = createRunOrchestrator(orchestratorOptions);

    // ── Startup status display ───────────────────────────────────────────────
    // Evaluate last-execution state before starting so we can always show the
    // user what happened last time, even when no resume is needed.
    // Use orchestrator.workflowDir (resolved absolute path) so the evaluator
    // looks in the correct directory regardless of where the CLI was invoked from.
    const startupEvaluator = createStartupResumeEvaluator(orchestrator.workflowDir);
    const startupDecision = await startupEvaluator.evaluate();

    // Fetch the latest checkpoint metadata for richer status info (best-effort)
    let latestCheckpointMeta: CheckpointMetadata | null = null;
    if (startupDecision.shouldResume && startupDecision.checkpointId) {
      try {
        const checkpointList = await startupEvaluator.checkpointManager.list();
        latestCheckpointMeta =
          checkpointList.find((checkpoint) => checkpoint.id === startupDecision.checkpointId) ??
          null;
      } catch (error) {
        logger.debug(
          `[runCommand] Failed to load checkpoint metadata for startup status: ${getErrorMessage(error)}`
        );
      }
    }

    formatLastExecutionStatus(
      orchestratorOptions.projectRoot,
      startupDecision,
      latestCheckpointMeta
    ).forEach((line) => console.log(line));
    console.log();

    // ── TUI mode ────────────────────────────────────────────────────────────
    if (options.tui) {
      // @ts-expect-error - legacy JS TUI module is untyped in the current TypeScript setup.
      const { startTui } = (await import('../tui/index.js')) as StartTuiModule;
      const result = await startTui(orchestrator, {
        stage: orchestratorOptions.stage,
        version: '1.6.3',
        verbose: Boolean(options.verbose),
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

    // Setup spinner for non-verbose mode
    if (!options.verbose && !options.dryRun) {
      spinner = ora('Initializing workflow...').start();
    }

    // ── Auto-resume check ───────────────────────────────────────────────────
    // Before starting a fresh run, inspect the most recent execution log.
    // When the last workflow was interrupted before completion and a valid
    // checkpoint exists, resume automatically (unless --no-auto-resume is set).
    let result: RunCommandResult;
    if (!options.noAutoResume) {
      // Re-use the decision already computed above for the status display.
      const resumeDecision = startupDecision;

      if (resumeDecision.shouldResume && resumeDecision.checkpointId) {
        if (spinner) spinner.stop();
        console.log(
          chalk.yellow(`\n⚠ Incomplete workflow detected (${resumeDecision.logDirName})`)
        );
        console.log(chalk.cyan(`  Auto-resuming from checkpoint: ${resumeDecision.checkpointId}`));
        console.log();
        if (spinner) spinner = ora('Resuming workflow...').start();

        result = await orchestrator.resume(resumeDecision.checkpointId);
      } else {
        // Normal execution
        result = await orchestrator.execute();
      }
    } else {
      // Auto-resume explicitly disabled by the caller
      result = await orchestrator.execute();
    }

    // Remove SIGINT listener — workflow has finished
    if (onSigint) {
      process.removeListener('SIGINT', onSigint);
    }

    // Stop spinner
    if (spinner) {
      if (result.aborted) {
        spinner.warn('Workflow stopped by user');
      } else if (result.success) {
        spinner.succeed('Workflow completed');
      } else {
        spinner.fail('Workflow failed');
      }
    }

    // Display result
    console.log();
    if (result.aborted) {
      console.log(chalk.yellow('⚠ Workflow stopped by user (Ctrl+C)'));
    } else {
      const resultMessage = formatWorkflowResult(result);
      if (result.success) {
        console.log(chalk.green(`✓ ${resultMessage}`));
      } else {
        console.log(chalk.red(`✗ ${resultMessage}`));
        if (result.error) {
          console.log(chalk.red(`  Error: ${result.error}`));
        }
      }
    }

    // Display summary if available
    if (result.summary) {
      const summaryText =
        typeof result.summary === 'string' ? result.summary : result.summary.report;
      if (summaryText) {
        console.log();
        console.log(chalk.cyan('Summary:'));
        console.log(chalk.gray(`  ${summaryText}`));
      }
    }

    console.log();

    // Exit with appropriate code
    process.exit(result.aborted ? 130 : result.success ? 0 : 1);
  } catch (error) {
    // Remove SIGINT listener on error path (only set in non-TUI mode)
    if (onSigint) {
      process.removeListener('SIGINT', onSigint);
    }

    // Stop spinner on error
    if (spinner) {
      spinner.fail('Workflow failed');
    }

    logger.error(chalk.red(`Error: ${getErrorMessage(error)}`));
    if (options.verbose && error instanceof Error && error.stack) {
      logger.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

const runCommandExports = {
  runCommand,
  validateRunOptions,
  createOrchestratorOptions,
  formatWorkflowResult,
};

export default runCommandExports;
