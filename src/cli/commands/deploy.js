/**
 * @fileoverview CLI Deploy Command
 * @module cli/commands/deploy
 *
 * Implements the 'deploy' command for executing project-defined deployment scripts.
 * Reads deployment configuration from .workflow-config.yaml and executes the
 * project-specific deploy script or command.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for validation and configuration
 * - Impure wrapper for execution
 *
 * @version 1.0.0
 * @since 2026-02-27
 */

import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import chalk from 'chalk';
import ora from 'ora';
import { logger } from '../../core/logger.js';
import { executeStream } from '../../core/executor.js';

// ============================================================================
// PURE FUNCTIONS - Command Logic
// ============================================================================

/**
 * Validate deploy command options
 * @pure
 * @param {Object} options - Command options
 * @returns {Object} Validation result { isValid: boolean, errors: string[] }
 */
export function validateDeployOptions(options) {
  const errors = [];

  if (options.projectRoot && typeof options.projectRoot !== 'string') {
    errors.push('Project root must be a string');
  }

  if (options.config && typeof options.config !== 'string') {
    errors.push('Config path must be a string');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Resolve deploy configuration from the workflow config object
 * @pure
 * @param {Object} workflowConfig - Parsed .workflow-config.yaml content
 * @returns {Object} Result { config: Object|null, error: string|null }
 */
export function resolveDeployConfig(workflowConfig) {
  if (!workflowConfig || typeof workflowConfig !== 'object') {
    return { config: null, error: 'Invalid workflow configuration' };
  }

  const deploySection = workflowConfig.deploy;

  if (!deploySection) {
    return {
      config: null,
      error: 'No deploy: section found in .workflow-config.yaml. Add a deploy: section to enable deployment.',
    };
  }

  if (deploySection.enabled === false) {
    return { config: null, error: 'Deployment is disabled (enabled: false) in .workflow-config.yaml' };
  }

  if (!deploySection.script && !deploySection.command) {
    return {
      config: null,
      error: 'deploy: section must specify either script: or command:',
    };
  }

  return {
    config: {
      script: deploySection.script || null,
      command: deploySection.command || null,
      description: deploySection.description || 'Deploy project',
      enabled: true,
    },
    error: null,
  };
}

/**
 * Build the shell command string to execute for deployment
 * @pure
 * @param {Object} deployConfig - Resolved deploy configuration
 * @param {string} projectRoot - Absolute project root path
 * @returns {Object} { command: string, cwd: string }
 */
export function buildDeployCommand(deployConfig, projectRoot) {
  if (!deployConfig || typeof deployConfig !== 'object') {
    throw new Error('deployConfig must be a valid object');
  }
  // script: takes priority over command:
  if (deployConfig.script) {
    const scriptPath = path.isAbsolute(deployConfig.script)
      ? deployConfig.script
      : path.join(projectRoot, deployConfig.script);
    return {
      command: `bash "${scriptPath}"`,
      cwd: projectRoot,
    };
  }

  return {
    command: deployConfig.command,
    cwd: projectRoot,
  };
}

/**
 * Format deploy result for display
 * @pure
 * @param {Object} result - Execution result
 * @returns {string} Formatted result message
 */
export function formatDeployResult(result) {
  if (!result) {
    return 'No result available';
  }

  if (result.success) {
    const duration = result.duration ? ` in ${(result.duration / 1000).toFixed(1)}s` : '';
    return `Deployment completed successfully${duration}`;
  }

  return `Deployment failed: ${result.error || 'Unknown error'}`;
}

// ============================================================================
// IMPURE WRAPPER - Deploy Action
// ============================================================================

/**
 * Execute the deploy command
 * @param {Object} options - Command options
 * @param {string} [options.projectRoot] - Project root directory
 * @param {string} [options.config] - Path to .workflow-config.yaml
 * @param {boolean} [options.dryRun] - Preview without executing
 * @param {boolean} [options.verbose] - Verbose output
 */
export async function deployCommand(options = {}) {
  const projectRoot = options.projectRoot
    ? path.resolve(options.projectRoot)
    : process.cwd();

  const configPath = options.config
    ? (path.isAbsolute(options.config)
        ? options.config
        : path.join(projectRoot, options.config))
    : path.join(projectRoot, '.workflow-config.yaml');

  // Validate options
  const validation = validateDeployOptions(options);
  if (!validation.isValid) {
    logger.error(chalk.red('Invalid options:'));
    validation.errors.forEach((e) => logger.error(chalk.red(`  • ${e}`)));
    process.exit(1);
  }

  // Load workflow config
  if (!fs.existsSync(configPath)) {
    logger.error(chalk.red(`Configuration file not found: ${configPath}`));
    logger.error(chalk.gray('  Run `ai-workflow init` to create a configuration file.'));
    process.exit(1);
  }

  let workflowConfig;
  try {
    const rawYaml = fs.readFileSync(configPath, 'utf8');
    workflowConfig = yaml.load(rawYaml);
  } catch (error) {
    logger.error(chalk.red(`Failed to parse configuration: ${error.message}`));
    process.exit(1);
  }

  // Resolve deploy configuration
  const { config: deployConfig, error: deployError } = resolveDeployConfig(workflowConfig);
  if (deployError) {
    logger.error(chalk.red(`Deploy configuration error: ${deployError}`));
    process.exit(1);
  }

  // Build the command
  const { command, cwd } = buildDeployCommand(deployConfig, projectRoot);

  console.log();
  console.log(chalk.cyan(`📦 ${deployConfig.description}`));
  console.log(chalk.gray(`   Command: ${command}`));
  console.log(chalk.gray(`   Working directory: ${cwd}`));
  console.log();

  // Dry-run: just print what would run
  if (options.dryRun) {
    console.log(chalk.yellow('⚠ Dry-run mode: command not executed'));
    process.exit(0);
  }

  // Execute deployment
  const startTime = Date.now();
  let spinner;

  if (!options.verbose) {
    spinner = ora('Deploying...').start();
  }

  try {
    await executeStream(command, {
      cwd,
      onStdout: (line) => {
        if (options.verbose) {
          process.stdout.write(line);
        } else if (spinner) {
          // Update spinner text with last output line for progress feedback
          const trimmed = line.trim();
          if (trimmed) spinner.text = `Deploying... ${trimmed.slice(0, 60)}`;
        }
      },
      onStderr: (line) => {
        if (options.verbose) {
          process.stderr.write(chalk.yellow(line));
        }
      },
    });

    const duration = Date.now() - startTime;

    if (spinner) spinner.succeed('Deploy complete');

    const resultMessage = formatDeployResult({ success: true, duration });
    console.log(chalk.green(`✓ ${resultMessage}`));
    console.log();

    process.exit(0);
  } catch (error) {
    const duration = Date.now() - startTime;

    if (spinner) spinner.fail('Deploy failed');

    const resultMessage = formatDeployResult({ success: false, error: error.message, duration });
    console.log(chalk.red(`✗ ${resultMessage}`));

    if (options.verbose && error.stderr) {
      console.log(chalk.gray(error.stderr));
    }

    console.log();
    process.exit(1);
  }
}

export default { deployCommand, validateDeployOptions, resolveDeployConfig, buildDeployCommand, formatDeployResult };
