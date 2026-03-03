/**
 * @fileoverview AI Workflow CLI - Main Entry Point
 * @module cli/index
 *
 * Command-line interface for ai_workflow.js, providing commands for running
 * workflows, managing configuration, and viewing status.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for CLI logic
 * - Impure wrapper for user interaction
 *
 * @version 1.0.0
 * @since 2026-02-10
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { logger } from '../core/logger.js';
import { runCommand } from './commands/run.js';
import { resumeCommand } from './commands/resume.js';
import { statusCommand } from './commands/status.js';
import { initCommand } from './commands/init.js';
import { configCommand } from './commands/config.js';
import { cleanCommand } from './commands/clean.js';
import { deployCommand } from './commands/deploy.js';

// Package information
const VERSION = '1.4.0';
const DESCRIPTION = 'AI-powered workflow automation for software development';

// ============================================================================
// PURE FUNCTIONS - CLI Configuration
// ============================================================================

/**
 * Create CLI program configuration
 * @pure
 * @param {string} version - CLI version
 * @param {string} description - CLI description
 * @returns {Object} Program configuration
 */
export function createProgramConfig(version, description) {
  return {
    version,
    description,
    name: 'ai-workflow',
    usage: '[command] [options]',
  };
}

/**
 * Validate CLI arguments
 * @pure
 * @param {Array<string>} args - Command line arguments
 * @returns {Object} Validation result
 */
export function validateCliArgs(args) {
  const errors = [];

  if (!Array.isArray(args)) {
    errors.push('Arguments must be an array');
  }

  if (args && args.length < 2) {
    errors.push('Invalid arguments: missing node and script path');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// IMPURE WRAPPER - CLI Interface
// ============================================================================

/**
 * Apply global CLI options to the logger instance
 * @pure
 * @param {Object} opts - Global program options (from program.opts())
 * @param {Object} loggerInstance - Logger instance to configure
 * @returns {void}
 */
export function applyGlobalOptions(opts, loggerInstance) {
  loggerInstance.verbose = opts.verbose || false;
  loggerInstance.quiet = opts.quiet || false;
}

/**
 * Create and configure the CLI program
 * @returns {Command} Configured commander program
 */
export function createProgram() {
  const config = createProgramConfig(VERSION, DESCRIPTION);
  const program = new Command();

  // Basic configuration
  program
    .name(config.name)
    .version(config.version)
    .description(config.description)
    .usage(config.usage);

  // Global options
  program
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('--no-color', 'Disable colored output')
    .option('--config <path>', 'Path to configuration file', '.workflow-config.yaml');

  // Apply global options to logger before any command action
  program.hook('preAction', () => {
    applyGlobalOptions(program.opts(), logger);
  });

  // Run command
  program
    .command('run')
    .description('Run the AI workflow')
    .option('--stage <stage>', 'Workflow stage (quick, medium, full)', 'full')
    .option('--auto', 'Run in automatic mode without prompts', false)
    .option('--dry-run', 'Preview execution without running', false)
    .option('--project-root <path>', 'Project root directory')
    .option('--workflow-dir <path>', 'Workflow directory', '.ai_workflow')
    .option('--no-parallel', 'Disable parallel step execution')
    .option('--sdk-smoke-test', 'Run a Copilot API smoke test before starting the workflow', false)
    .action((options) => {
      const globalOpts = program.opts();
      runCommand({ ...options, ...globalOpts });
    });

  // Resume command
  program
    .command('resume [checkpointId]')
    .description('Resume workflow from checkpoint')
    .option('--list', 'List available checkpoints', false)
    .option('--latest', 'Resume from latest checkpoint', false)
    .option('--workflow-dir <path>', 'Workflow directory', '.ai_workflow')
    .option('--project-root <path>', 'Project root directory')
    .action(async (checkpointId, options) => {
      const globalOpts = program.opts();
      await resumeCommand(checkpointId, { ...globalOpts, ...options });
    });

  // Status command
  program
    .command('status')
    .description('Show workflow status')
    .option('--workflow-dir <path>', 'Workflow directory', '.ai_workflow')
    .action(async (options) => {
      const globalOpts = program.opts();
      await statusCommand({ ...globalOpts, ...options });
    });

  // Init command
  program
    .command('init')
    .description('Initialize workflow in a new project')
    .option('--template <name>', 'Use project template')
    .option('--name <name>', 'Project name')
    .option('--description <desc>', 'Project description')
    .option('--interactive', 'Run configuration wizard', false)
    .option('--force', 'Overwrite existing configuration', false)
    .option('--project-root <path>', 'Project root directory')
    .action(async (options) => {
      const globalOpts = program.opts();
      await initCommand({ ...globalOpts, ...options });
    });

  // Config command
  program
    .command('config <action> [args...]')
    .description('Manage workflow configuration (show, validate, get, set)')
    .action(async (action, args, options) => {
      const globalOpts = program.opts();
      await configCommand(action, args, { ...globalOpts, ...options });
    });

  // Clean command
  program
    .command('clean')
    .description('Clean workflow artifacts')
    .option('--artifacts', 'Clean workflow artifacts', false)
    .option('--cache', 'Clean cache files', false)
    .option('--checkpoints', 'Clean checkpoints', false)
    .option('--all', 'Clean everything', false)
    .option('--dry-run', 'Preview without deleting', false)
    .option('--workflow-dir <path>', 'Workflow directory', '.ai_workflow')
    .option('--older-than-days <days>', 'Clean files older than N days')
    .option('--keep-last <n>', 'Keep last N checkpoints', '5')
    .action(async (options) => {
      const globalOpts = program.opts();
      await cleanCommand({ ...globalOpts, ...options });
    });

  // Deploy command
  program
    .command('deploy')
    .description('Deploy the project using the script defined in .workflow-config.yaml')
    .option('--project-root <path>', 'Project root directory')
    .option('--dry-run', 'Preview deployment command without executing', false)
    .action(async (options) => {
      const globalOpts = program.opts();
      await deployCommand({ ...globalOpts, ...options });
    });

  return program;
}

/**
 * Main CLI entry point
 * @param {Array<string>} argv - Command line arguments
 * @returns {Promise<void>}
 */
export async function cli(argv) {
  try {
    // Validate arguments
    const validation = validateCliArgs(argv);
    if (!validation.isValid) {
      console.error(chalk.red('Error: Invalid arguments'));
      validation.errors.forEach((err) => console.error(chalk.red(`  - ${err}`)));
      process.exit(1);
    }

    // Create and parse program
    const program = createProgram();
    await program.parseAsync(argv);
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export default { cli, createProgram, createProgramConfig, validateCliArgs, applyGlobalOptions };
