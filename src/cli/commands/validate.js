/**
 * @fileoverview CLI Validate Command
 * @module cli/commands/validate
 *
 * Implements the 'validate' command — runs only the preflight phases
 * (config validation + health checks) without executing any workflow steps.
 *
 * Motivation: a full workflow invocation takes 30+ minutes to diagnose a
 * .workflow-config.yaml error or git-stash blockage. This command gives
 * operators sub-second feedback by running only the preflight stack and
 * exiting, making config iteration cycles fast.
 *
 * Modes:
 *   ai-workflow validate              — config validation + health checks
 *   ai-workflow validate --config     — config validation only (no git-stash check)
 *   ai-workflow validate --health     — health checks only (assumes config valid)
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for option validation and output formatting
 * - Impure wrapper for execution
 *
 * @version 1.0.0
 * @since 2026-05-27
 */

import chalk from 'chalk';
import { logger } from '../../core/logger.js';
// @ts-expect-error - legacy JS orchestrator module is untyped in the current TypeScript setup.
import { MainOrchestrator, WORKFLOW_STAGES } from '../../orchestrator/main_orchestrator.js';

// ============================================================================
// PURE FUNCTIONS
// ============================================================================

/**
 * Validate validate command options.
 * @pure
 * @param {Object} options
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateValidateOptions(options = {}) {
  const errors = [];

  if (options.config && options.health) {
    errors.push('--config and --health are mutually exclusive. Omit both to run all phases.');
  }

  const validStages = Object.values(WORKFLOW_STAGES);
  if (options.stage && !validStages.includes(options.stage)) {
    errors.push(`Invalid stage: ${options.stage}. Must be one of: ${validStages.join(', ')}`);
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Determine which phases to run from CLI options.
 * @pure
 * @param {Object} options
 * @returns {{ runConfig: boolean, runHealth: boolean }}
 */
export function resolvePhasesFromOptions(options = {}) {
  const configOnly = Boolean(options.config);
  const healthOnly = Boolean(options.health);
  return {
    runConfig: !healthOnly, // default true; suppressed only by --health
    runHealth: !configOnly, // default true; suppressed only by --config
  };
}

/**
 * Format a phase result line for console output.
 * @pure
 * @param {boolean} passed
 * @param {string} label
 * @param {string|null} [detail]
 * @returns {string}
 */
export function formatPhaseResult(passed, label, detail = null) {
  const icon = passed ? chalk.green('  ✓') : chalk.red('  ✗');
  const text = passed ? chalk.green(label) : chalk.red(label);
  const suffix = detail ? chalk.gray(` — ${detail}`) : '';
  return `${icon} ${text}${suffix}`;
}

// ============================================================================
// IMPURE WRAPPER — execute the validate command
// ============================================================================

/**
 * Execute the validate command.
 *
 * Runs the preflight phases (config validation and/or health checks) for the
 * target project and exits with code 0 on success, 1 on failure.
 *
 * @param {Object} [options]
 * @param {string}  [options.projectRoot]  — project root (default: cwd)
 * @param {string}  [options.workflowDir]  — workflow dir (default: .ai_workflow)
 * @param {string}  [options.stage]        — stage to validate against (default: full)
 * @param {boolean} [options.config]       — config validation phase only
 * @param {boolean} [options.health]       — health-check phase only
 * @param {boolean} [options.verbose]      — verbose output
 * @returns {Promise<void>}
 */
export async function validateCommand(options = {}) {
  // Validate options
  const optValidation = validateValidateOptions(options);
  if (!optValidation.isValid) {
    logger.error(chalk.red('Invalid options:'));
    optValidation.errors.forEach((err) => logger.error(chalk.red(`  - ${err}`)));
    process.exit(1);
  }

  const projectRoot = options.projectRoot || process.cwd();
  const workflowDir = options.workflowDir || '.ai_workflow';
  const stage = options.stage || WORKFLOW_STAGES.FULL;
  const { runConfig, runHealth } = resolvePhasesFromOptions(options);

  const phaseLabels = [runConfig && 'config validation', runHealth && 'health checks']
    .filter(Boolean)
    .join(' + ');

  console.log();
  console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.blue('  AI Workflow — Preflight Validation'));
  console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.gray(`  Stage: ${stage}  |  Phases: ${phaseLabels}`));
  console.log();

  const orchestrator = new MainOrchestrator({
    projectRoot,
    workflowDir,
    stage,
    auto: true, // non-interactive — no user prompts
    verbose: Boolean(options.verbose),
  });

  let configPassed = !runConfig; // true if phase is skipped
  let healthPassed = !runHealth;

  // ── Phase 1: Config validation ──────────────────────────────────────────
  if (runConfig) {
    console.log(chalk.cyan('Phase 1 — Config validation (.workflow-config.yaml):'));
    try {
      await orchestrator.runPreflight({ configValidation: true, healthChecks: false });
      configPassed = true;
      console.log(formatPhaseResult(true, '.workflow-config.yaml validated'));
    } catch (error) {
      configPassed = false;
      const msg = error instanceof Error ? error.message : String(error);
      const lines = msg.split('\n');
      console.log(formatPhaseResult(false, 'Config validation failed'));
      console.log();
      // Print the first error in full; truncate if more than 40 lines
      const printLines = lines.slice(0, 40);
      printLines.forEach((line) => console.log(chalk.red(`    ${line}`)));
      if (lines.length > 40) {
        console.log(
          chalk.gray(`    … ${lines.length - 40} more line(s) — run with --verbose to see all`)
        );
      }
    }
    console.log();
  }

  // ── Phase 2: Health checks ───────────────────────────────────────────────
  // Only run if config passed (or health-only mode), to avoid redundant errors.
  if (runHealth && (configPassed || options.health)) {
    console.log(chalk.cyan('Phase 2 — Health checks (git stash, preflight suites):'));
    try {
      // Re-use the same orchestrator instance so the step registry is already
      // populated when config was also validated in this invocation.
      await orchestrator.runPreflight({ configValidation: false, healthChecks: true });
      healthPassed = true;
      console.log(formatPhaseResult(true, 'All health checks passed'));
    } catch (error) {
      healthPassed = false;
      const msg = error instanceof Error ? error.message : String(error);
      console.log(formatPhaseResult(false, 'Health check failed'));
      console.log(chalk.red(`    ${msg.split('\n')[0]}`));
    }
    console.log();
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const allPassed = configPassed && healthPassed;

  console.log('━'.repeat(40));
  if (allPassed) {
    console.log(chalk.green(`✓ Preflight validation passed.`));
    console.log(chalk.gray('  Ready to run: ai-workflow run'));
  } else {
    const failed = [!configPassed && 'config validation', !healthPassed && 'health checks']
      .filter(Boolean)
      .join(', ');
    console.log(chalk.red(`✗ Preflight validation failed (${failed}).`));
    console.log(chalk.gray('  Fix the issues above, then re-run: ai-workflow validate'));
    process.exit(1);
  }
  console.log();
}
