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
      args: deploySection.args || null,
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
 * @param {string|null} [extraArgs] - Additional CLI arguments to append (overrides config args)
 * @returns {Object} { command: string, cwd: string }
 */
export function buildDeployCommand(deployConfig, projectRoot, extraArgs = null) {
  if (!deployConfig || typeof deployConfig !== 'object') {
    throw new Error('deployConfig must be a valid object');
  }

  // CLI-supplied extraArgs take priority over YAML-configured args
  const resolvedArgs = extraArgs !== null ? extraArgs : (deployConfig.args || '');
  const argsSuffix = resolvedArgs ? ` ${resolvedArgs}` : '';

  // script: takes priority over command:
  if (deployConfig.script) {
    const scriptPath = path.isAbsolute(deployConfig.script)
      ? deployConfig.script
      : path.join(projectRoot, deployConfig.script);
    return {
      command: `bash "${scriptPath}"${argsSuffix}`,
      cwd: projectRoot,
    };
  }

  return {
    command: `${deployConfig.command}${argsSuffix}`,
    cwd: projectRoot,
  };
}

/**
 * Parse a .env file's text content into a key/value object.
 * Skips blank lines and lines starting with #.
 * Values may optionally be quoted with single or double quotes.
 * @pure
 * @param {string} content - Raw text content of the .env file
 * @returns {Object} Key/value pairs found in the file
 */
export function parseEnvFile(content) {
  if (!content || typeof content !== 'string') return {};
  const result = {};
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx < 1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) result[key] = value;
  }
  return result;
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

/**
 * Detect well-known npm publish errors from captured output and return
 * a structured hint object, or null when no known pattern is matched.
 * @pure
 * @param {string} output - Combined stdout + stderr captured during deployment
 * @returns {{ message: string, hint: string, url: string|null }|null}
 */
export function detectNpmPublishError(output) {
  if (!output || typeof output !== 'string') return null;

  // 403 Forbidden — invalid / expired / missing token
  if (/npm error code E403/i.test(output) || /403 Forbidden/i.test(output)) {
    const isCredentials =
      /credentials/i.test(output) ||
      /token/i.test(output) ||
      /You may not perform that action/i.test(output);
    if (isCredentials) {
      return {
        message: 'npm publish failed: invalid or expired token.',
        hint: 'Verify NPM_TOKEN is a valid Automation token with publish rights.',
        url: 'https://www.npmjs.com/settings/~/tokens',
      };
    }
    return {
      message: 'npm publish failed: access forbidden (E403).',
      hint: 'Check that your npm token has publish rights for this package.',
      url: 'https://docs.npmjs.com/creating-and-viewing-access-tokens',
    };
  }

  // 401 Unauthenticated
  if (/npm error code E401/i.test(output) || /401 Unauthorized/i.test(output)) {
    return {
      message: 'npm publish failed: authentication required (E401).',
      hint: 'Set a valid NPM_TOKEN environment variable or run `npm login`.',
      url: 'https://docs.npmjs.com/creating-and-viewing-access-tokens',
    };
  }

  // 409 Conflict — version already published
  if (/npm error code E409/i.test(output) || /409 Conflict/i.test(output) || /cannot publish over/i.test(output)) {
    return {
      message: 'npm publish failed: this version is already published (E409).',
      hint: 'Bump the version in package.json before publishing.',
      url: null,
    };
  }

  // ENEEDAUTH — no credentials at all
  if (/npm error code ENEEDAUTH/i.test(output)) {
    return {
      message: 'npm publish failed: no npm credentials found (ENEEDAUTH).',
      hint: 'Run `npm login` or set the NPM_TOKEN environment variable.',
      url: 'https://docs.npmjs.com/creating-and-viewing-access-tokens',
    };
  }

  // 404 Not Found — org/scope doesn't exist
  if (/npm error code E404/i.test(output)) {
    return {
      message: 'npm publish failed: package or scope not found (E404).',
      hint: 'Ensure the npm organization/scope exists and the package name is correct.',
      url: null,
    };
  }

  return null;
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
  const extraArgs = options.source ? `--source ${options.source}` : null;
  const { command, cwd } = buildDeployCommand(deployConfig, projectRoot, extraArgs);

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

  // Load .env file from project root (if present) and merge into environment
  const envFilePath = path.join(projectRoot, '.env');
  let deployEnv = { ...process.env };
  if (fs.existsSync(envFilePath)) {
    try {
      const envContent = fs.readFileSync(envFilePath, 'utf8');
      const fileVars = parseEnvFile(envContent);
      const fileVarCount = Object.keys(fileVars).length;
      deployEnv = { ...deployEnv, ...fileVars };
      if (options.verbose && fileVarCount > 0) {
        console.log(chalk.gray(`   Loaded ${fileVarCount} variable(s) from ${envFilePath}`));
        console.log();
      }
    } catch (envErr) {
      logger.warn(chalk.yellow(`Warning: failed to read ${envFilePath}: ${envErr.message}`));
    }
  }

  // Execute deployment
  const startTime = Date.now();
  let spinner;

  if (!options.verbose) {
    spinner = ora('Deploying...').start();
  }

  // Buffer all output so we can analyse it for known errors on failure
  const outputBuffer = [];

  try {
    await executeStream(command, {
      cwd,
      env: deployEnv,
      onStdout: (line) => {
        outputBuffer.push(line);
        if (options.verbose) {
          process.stdout.write(line);
        } else if (spinner) {
          // Update spinner text with last output line for progress feedback
          const trimmed = line.trim();
          if (trimmed) spinner.text = `Deploying... ${trimmed.slice(0, 60)}`;
        }
      },
      onStderr: (line) => {
        outputBuffer.push(line);
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

    const capturedOutput = outputBuffer.join('');
    const npmError = detectNpmPublishError(capturedOutput);

    if (npmError) {
      console.log(chalk.red(`✗ ${npmError.message}`));
      console.log(chalk.yellow(`  ${npmError.hint}`));
      if (npmError.url) {
        console.log(chalk.gray(`  ${npmError.url}`));
      }
    } else {
      const resultMessage = formatDeployResult({ success: false, error: error.message, duration });
      console.log(chalk.red(`✗ ${resultMessage}`));

      if (error.stderr) {
        console.log(chalk.gray(error.stderr));
      } else if (!options.verbose && capturedOutput.trim()) {
        // Surface the last few lines of captured output to help diagnose the failure
        const lines = capturedOutput.trim().split('\n');
        const tail = lines.slice(-5).join('\n');
        console.log(chalk.gray(tail));
      }
    }

    console.log();
    process.exit(1);
  }
}

export default { deployCommand, validateDeployOptions, resolveDeployConfig, buildDeployCommand, formatDeployResult, detectNpmPublishError, parseEnvFile };
