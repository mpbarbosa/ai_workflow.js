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
import ora from 'ora';
import { logger } from '../../core/logger.js';
import { MainOrchestrator, WORKFLOW_STAGES } from '../../orchestrator/main_orchestrator.js';
import { StartupResumeEvaluator } from '../../lib/startup_resume_evaluator.js';

// ============================================================================
// PURE FUNCTIONS - Command Logic
// ============================================================================

/**
 * Validate run command options
 * @pure
 * @param {Object} options - Command options
 * @returns {Object} Validation result
 */
export function validateRunOptions(options) {
  const errors = [];

  // Validate stage
  const validStages = Object.values(WORKFLOW_STAGES);
  if (options.stage && !validStages.includes(options.stage)) {
    errors.push(`Invalid stage: ${options.stage}. Must be one of: ${validStages.join(', ')}`);
  }

  // Validate config path
  if (options.config && typeof options.config !== 'string') {
    errors.push('Config path must be a string');
  }

  // Validate alternatives
  if (options.alternatives !== false && options.alternatives !== undefined) {
    const n = parseInt(options.alternatives, 10);
    if (!isNaN(n) && n < 2) {
      errors.push('--alternatives must be at least 2');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Create orchestrator options from CLI options
 * @pure
 * @param {Object} cliOptions - CLI command options
 * @returns {Object} Orchestrator options
 */
export function createOrchestratorOptions(cliOptions) {
  const rawAlt = cliOptions.alternatives;
  const alternatives =
    rawAlt === false || rawAlt === undefined ? false : Math.max(2, parseInt(rawAlt, 10) || 2);
  const verbose = !!cliOptions.verbose;
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
  };
}

/**
 * Format workflow result for display
 * @pure
 * @param {Object} result - Workflow execution result
 * @returns {string} Formatted result message
 */
export function formatWorkflowResult(result) {
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
 * @param {string} projectRoot - Target project path
 * @param {Object} decision - AutoResumeDecision from StartupResumeEvaluator
 * @param {Object|null} checkpoint - Latest checkpoint metadata (from list()), or null
 * @returns {string[]} Lines to print
 */
export function formatLastExecutionStatus(projectRoot, decision, checkpoint) {
  const lines = [];
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
    lines.push(chalk.gray(`Last run: ✓ completed on ${dateStr}`));
  }

  return lines;
}

/**
 * Execute the run command
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
export async function runCommand(options) {
  let spinner = null;
  let onSigint = null;

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
    const orchestrator = new MainOrchestrator(orchestratorOptions);

    // ── Startup status display ───────────────────────────────────────────────
    // Evaluate last-execution state before starting so we can always show the
    // user what happened last time, even when no resume is needed.
    // Use orchestrator.workflowDir (resolved absolute path) so the evaluator
    // looks in the correct directory regardless of where the CLI was invoked from.
    const startupEvaluator = new StartupResumeEvaluator({
      workflowDir: orchestrator.workflowDir,
    });
    const startupDecision = await startupEvaluator.evaluate();

    // Fetch the latest checkpoint metadata for richer status info (best-effort)
    let latestCheckpointMeta = null;
    if (startupDecision.shouldResume && startupDecision.checkpointId) {
      try {
        const cpList = await startupEvaluator.checkpointManager.list();
        latestCheckpointMeta = cpList.find((c) => c.id === startupDecision.checkpointId) ?? null;
      } catch (_err) {
        // eslint-disable-line no-unused-vars
        // ignore — status display is best-effort
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
      const { startTui } = await import('../tui/index.js');
      const result = await startTui(orchestrator, {
        stage: orchestratorOptions.stage,
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

    // Setup spinner for non-verbose mode
    if (!options.verbose && !options.dryRun) {
      spinner = ora('Initializing workflow...').start();
    }

    // ── Auto-resume check ───────────────────────────────────────────────────
    // Before starting a fresh run, inspect the most recent execution log.
    // When the last workflow was interrupted before completion and a valid
    // checkpoint exists, resume automatically (unless --no-auto-resume is set).
    let result;
    if (!options.noAutoResume) {
      // Re-use the decision already computed above for the status display.
      const resumeDecision = startupDecision;

      if (resumeDecision.shouldResume) {
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
    process.removeListener('SIGINT', onSigint);

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

    logger.error(chalk.red(`Error: ${error.message}`));
    if (options.verbose && error.stack) {
      logger.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

export default { runCommand, validateRunOptions, createOrchestratorOptions, formatWorkflowResult };
