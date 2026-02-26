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
  return {
    workflowDir: cliOptions.workflowDir || '.ai_workflow',
    projectRoot: cliOptions.projectRoot || process.cwd(),
    stage: cliOptions.stage || WORKFLOW_STAGES.FULL,
    auto: cliOptions.auto || false,
    dryRun: cliOptions.dryRun || false,
    noParallel: cliOptions.parallel === false,
    sdkSmokeTest: cliOptions.sdkSmokeTest || false,
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

// ============================================================================
// IMPURE WRAPPER - Command Execution
// ============================================================================

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

    // Create orchestrator
    const orchestratorOptions = createOrchestratorOptions(options);
    const orchestrator = new MainOrchestrator(orchestratorOptions);

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

    // Execute workflow
    const result = await orchestrator.execute();

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
    // Remove SIGINT listener on error path
    process.removeListener('SIGINT', onSigint);

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
